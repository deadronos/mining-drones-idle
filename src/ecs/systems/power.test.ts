import { describe, expect, it } from 'vitest';
import { createPowerSystem } from '@/ecs/systems/power';
import { createGameWorld, spawnDrone } from '@/ecs/world';
import {
  createStoreInstance,
  getEnergyCapacity,
  getEnergyGeneration,
  getFactorySolarRegen,
} from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';

const addDrones = (world: ReturnType<typeof createGameWorld>, count: number) => {
  for (let index = 0; index < count; index += 1) {
    spawnDrone(world);
  }
};

describe('ecs/systems/power', () => {
  it('charges idle drones from factory local energy first', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    addDrones(world, 1);
    const [drone] = world.droneQuery.entities;
    if (!drone) throw new Error('expected drone');
    drone.state = 'idle';
    drone.battery = 0;

    const store = createStoreInstance();
    const [factory] = store.getState().factories;
    if (!factory) throw new Error('expected factory');

    store.setState((state) => ({
      modules: { ...state.modules, solar: 0 },
      resources: {
        ore: 0,
        ice: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
        bars: 0,
        energy: 10,
        credits: 0,
      },
      factories: state.factories.map((item, index) =>
        index === 0
          ? { ...item, energy: 20, upgrades: { ...item.upgrades, solar: 0 } }
          : { ...item, upgrades: { ...item.upgrades, solar: 0 } },
      ),
    }));
    drone.ownerFactoryId = factory.id;

    const system = createPowerSystem(world, store);
    system(1);

    const { resources, factories } = store.getState();
    // Drone charges from factory local first
    expect(drone.battery).toBeCloseTo(2.4, 5);
    // Factory energy decreased by charge amount
    expect(factories[0]?.energy).toBeCloseTo(17.6, 5);
    // Global energy stays same or gains from generation (+ ~5)
    expect(resources.energy).toBeGreaterThanOrEqual(10);
    expect(drone.charging).toBe(true);
  });

  it('falls back to global energy when factory is empty', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    addDrones(world, 1);
    const [drone] = world.droneQuery.entities;
    if (!drone) throw new Error('expected drone');
    drone.state = 'idle';
    drone.battery = 0;

    const store = createStoreInstance();
    const [factory] = store.getState().factories;
    if (!factory) throw new Error('expected factory');

    store.setState((state) => ({
      modules: { ...state.modules, solar: 0 },
      resources: {
        ore: 0,
        ice: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
        bars: 0,
        energy: 10,
        credits: 0,
      },
      factories: state.factories.map((item, index) =>
        index === 0
          ? { ...item, energy: 0, upgrades: { ...item.upgrades, solar: 0 } }
          : { ...item, upgrades: { ...item.upgrades, solar: 0 } },
      ),
    }));
    drone.ownerFactoryId = factory.id;

    const system = createPowerSystem(world, store);
    system(1);

    const { resources, factories } = store.getState();
    // Drone charges from global (factory was empty)
    expect(drone.battery).toBeCloseTo(2.4, 5);
    // Factory energy still zero (none available)
    expect(factories[0]?.energy).toBeCloseTo(0, 5);
    // Global energy decreased by charge amount (but gains from generation ~5)
    // So: 10 - 2.4 + 5 = 12.6 (gain from global generation)
    expect(resources.energy).toBeGreaterThan(7.6);
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
      modules: { ...state.modules, solar: 0 },
      resources: {
        ore: 0,
        ice: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
        bars: 0,
        energy: 0,
        credits: 0,
      },
      factories: state.factories.map((item) => ({
        ...item,
        upgrades: { ...item.upgrades, solar: 0 },
      })),
    }));

    const system = createPowerSystem(world, store);
    system(1);

    const { resources } = store.getState();
    expect(resources.energy).toBeCloseTo(0, 5);
    const batteries = drones.map((drone) => drone?.battery ?? 0).sort((a, b) => b - a);
    // Energy is depleted, so batteries should be limited by global generation
    // With 4 drones and ~5 energy generated, first ~2 drones get charge
    expect(batteries[0]).toBeLessThan(3);
    expect(batteries[1]).toBeLessThan(3);
    expect(batteries[2]).toBeLessThan(1);
    expect(batteries[3]).toBeLessThan(1);
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

  it('prioritizes factory local energy over global for drone charging', () => {
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
    const first = drones[0];
    if (!first) throw new Error('expected first drone');

    store.setState((state) => ({
      modules: { ...state.modules, solar: 0 },
      resources: {
        ore: 0,
        ice: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
        bars: 0,
        energy: 10,
        credits: 0,
      },
      factories: state.factories.map((item, index) =>
        index === 0
          ? { ...item, energy: 10, upgrades: { ...item.upgrades, solar: 0 } }
          : { ...item, upgrades: { ...item.upgrades, solar: 0 } },
      ),
    }));

    const system = createPowerSystem(world, store);
    system(1);

    const snapshot = store.getState();
    // First drone charges from factory local
    expect(first.battery).toBeGreaterThan(0);
    // Factory energy should be reduced by charging
    expect(snapshot.factories[0]?.energy).toBeLessThan(10);
    // Global energy should be unchanged or gain from generation
    expect(snapshot.resources.energy).toBeGreaterThanOrEqual(10);
    expect(drones.some((drone) => drone?.charging === true)).toBe(true);
  });

  it('regenerates factory energy via solar upgrades', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    const [factory] = store.getState().factories;
    if (!factory) throw new Error('expected default factory');

    store.setState((state) => ({
      factories: state.factories.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              energy: 10,
              energyCapacity: 50,
              upgrades: { ...entry.upgrades, solar: 2 },
            }
          : entry,
      ),
    }));

    const system = createPowerSystem(world, store);
    system(1);

    const snapshot = store.getState().factories[0];
    const expectedGain = getFactorySolarRegen(2);
    expect(snapshot?.energy).toBeCloseTo(10 + expectedGain, 5);
  });
});
