import { describe, expect, it } from 'vitest';
import { createFleetSystem } from '@/ecs/systems/fleet';
import {
  DEFAULT_DRONE_BATTERY,
  DEFAULT_DRONE_CAPACITY,
  DEFAULT_DRONE_MINING_RATE,
  DEFAULT_DRONE_SPEED,
  createGameWorld,
} from '@/ecs/world';
import { createStoreInstance } from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';

describe('ecs/systems/fleet', () => {
  it('maintains drone count according to module level', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    const system = createFleetSystem(world, store);
    system(0.1);
    expect(world.droneQuery.size).toBe(1);
    store.setState((state) => ({ modules: { ...state.modules, droneBay: 4 } }));
    system(0.1);
    expect(world.droneQuery.size).toBe(4);
    store.setState((state) => ({ modules: { ...state.modules, droneBay: 2 } }));
    system(0.1);
    expect(world.droneQuery.size).toBe(2);
  });

  it('applies resource modifiers to drone stats', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    const system = createFleetSystem(world, store);

    system(0.1);
    const [drone] = world.droneQuery.entities;
    if (!drone) throw new Error('expected drone');
    drone.cargo = 80;
    drone.cargoProfile.ore = 80;

    store.setState((state) => ({
      resources: { ...state.resources, metals: 25, organics: 18 },
    }));

    system(0.1);
    const state = store.getState();
    const modifiers = getResourceModifiers(state.resources);
    const expectedCapacity =
      (DEFAULT_DRONE_CAPACITY + state.modules.storage * 5) *
      modifiers.droneCapacityMultiplier;

    expect(drone.capacity).toBeCloseTo(expectedCapacity, 5);
    expect(drone.cargo).toBeCloseTo(expectedCapacity, 5);
    expect(drone.cargoProfile.ore).toBeCloseTo(expectedCapacity, 5);
    expect(drone.miningRate).toBeCloseTo(
      (DEFAULT_DRONE_MINING_RATE + state.modules.refinery * 0.5) *
        modifiers.droneProductionSpeedMultiplier,
      5,
    );
    expect(drone.speed).toBeCloseTo(
      DEFAULT_DRONE_SPEED * modifiers.droneProductionSpeedMultiplier,
      5,
    );
    expect(drone.maxBattery).toBeCloseTo(
      DEFAULT_DRONE_BATTERY * modifiers.droneBatteryMultiplier,
      5,
    );
  });
});
