import { describe, expect, it } from 'vitest';
import { createPowerSystem } from '@/ecs/systems/power';
import { createGameWorld, spawnDrone } from '@/ecs/world';
import { createStoreInstance, getEnergyCapacity, getEnergyGeneration } from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';

const addDrones = (world: ReturnType<typeof createGameWorld>, count: number) => {
  for (let index = 0; index < count; index += 1) {
    spawnDrone(world);
  }
};

describe('ecs/systems/power', () => {
  it('charges idle drones using available stored energy', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    addDrones(world, 1);
    const [drone] = world.droneQuery.entities;
    if (!drone) throw new Error('expected drone');
    drone.state = 'idle';
    drone.battery = 0;

    const store = createStoreInstance();
    store.setState((state) => ({
      resources: { ...state.resources, energy: 10 },
    }));

    const system = createPowerSystem(world, store);
    system(1);

    const { resources } = store.getState();
    expect(drone.battery).toBeCloseTo(2.4, 5);
    expect(resources.energy).toBeCloseTo(12.6, 5);
    expect(drone.charging).toBe(true);
  });

  it('avoids negative energy even with heavy charging demand', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    addDrones(world, 4);
    const drones = [...world.droneQuery.entities];
    drones.forEach((drone) => {
      drone.state = 'idle';
      drone.battery = 0;
    });

    const store = createStoreInstance();
    store.setState((state) => ({
      resources: { ...state.resources, energy: 0 },
    }));

    const system = createPowerSystem(world, store);
    system(1);

    const { resources } = store.getState();
    expect(resources.energy).toBeCloseTo(0, 5);
    const batteries = drones.map((drone) => drone?.battery ?? 0).sort((a, b) => b - a);
    expect(batteries[0]).toBeCloseTo(2.4, 5);
    expect(batteries[1]).toBeCloseTo(2.4, 5);
    expect(batteries[2]).toBeCloseTo(0.2, 5);
    expect(batteries[3]).toBeCloseTo(0, 5);
    expect(drones.some((drone) => drone?.charging === false && drone?.battery === 0)).toBe(true);
  });

  it('scales stored energy with organics and ice modifiers', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    store.setState((state) => ({
      modules: { ...state.modules, solar: 0 },
      resources: { ...state.resources, organics: 20, ice: 40, energy: 0 },
    }));

    const snapshot = store.getState();
    const modifiers = getResourceModifiers(snapshot.resources);
    const expectedGeneration = getEnergyGeneration(snapshot.modules, modifiers);
    const expectedCapacity = getEnergyCapacity(snapshot.modules, modifiers);

    const system = createPowerSystem(world, store);
    system(1);

    const { resources } = store.getState();
    expect(resources.energy).toBeCloseTo(Math.min(expectedCapacity, expectedGeneration), 5);
  });

  it('pulls from factory energy when global supply is exhausted', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    addDrones(world, 3);
    const drones = [...world.droneQuery.entities];
    const store = createStoreInstance();
    const [factory] = store.getState().factories;
    if (!factory) throw new Error('expected default factory');

    drones.forEach((drone) => {
      drone.state = 'idle';
      drone.battery = 0;
      drone.charging = false;
      drone.ownerFactoryId = factory.id;
    });
    const third = drones[drones.length - 1];
    if (!third) throw new Error('expected third drone');

    store.setState((state) => ({
      resources: { ...state.resources, energy: 0 },
      factories: state.factories.map((item, index) =>
        index === 0 ? { ...item, energy: 10 } : item,
      ),
    }));

    const system = createPowerSystem(world, store);
    system(1);

    const snapshot = store.getState();
    expect(third.battery).toBeCloseTo(2.4, 5);
    expect(snapshot.factories[0]?.energy).toBeCloseTo(7.8, 5);
    expect(snapshot.resources.energy).toBeCloseTo(0, 5);
    expect(third.charging).toBe(true);
  });
});
