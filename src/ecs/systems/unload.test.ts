import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createGameWorld, spawnDrone } from '@/ecs/world';
import { createUnloadSystem } from '@/ecs/systems/unload';
import { createStoreInstance } from '@/state/store';

describe('ecs/systems/unload', () => {
  it('emits transfer events and resets drone state', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    const drone = spawnDrone(world);
    drone.state = 'unloading';
    drone.cargo = 20;
    drone.lastDockingFrom = new Vector3(5, 0, 0);

    const system = createUnloadSystem(world, store);
    system(0.1);

    expect(store.getState().resources.ore).toBeGreaterThan(0);
    expect(drone.state).toBe('idle');
    expect(drone.lastDockingFrom).toBeNull();
    expect(world.events.transfers.length).toBe(1);
    const [event] = world.events.transfers;
    expect(event.amount).toBeCloseTo(20, 5);
    expect(event.from.distanceTo(world.factory.position)).toBeGreaterThan(1);
    expect(world.factory.activity.lastTransferAt).toBeGreaterThan(0);
  });
});
