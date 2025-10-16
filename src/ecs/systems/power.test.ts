import { describe, expect, it } from 'vitest';
import { createPowerSystem } from '@/ecs/systems/power';
import { createGameWorld, spawnDrone } from '@/ecs/world';
import { createStoreInstance } from '@/state/store';

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
});
