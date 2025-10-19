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
    const initialStorage = store.getState().factories[0].currentStorage;

    const system = createUnloadSystem(world, store);
    system(0.1);

    const factoryState = store.getState().factories[0];
    expect(factoryState.currentStorage).toBeCloseTo(initialStorage + 20, 5);
    expect(drone.state).toBe('idle');
    expect(drone.lastDockingFrom).toBeNull();
    expect(world.events.transfers.length).toBe(1);
    const [event] = world.events.transfers;
    expect(event.amount).toBeCloseTo(20, 5);
    expect(event.from.distanceTo(world.factory.position)).toBeGreaterThan(1);
    expect(world.factory.activity.lastTransferAt).toBeGreaterThan(0);
  });

  it('releases docking slot when unloading drone carries no cargo', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    const [factory] = store.getState().factories;
    if (!factory) throw new Error('expected default factory');
    const drone = spawnDrone(world);
    drone.state = 'unloading';
    drone.cargo = 0;
    drone.targetFactoryId = factory.id;
    store.getState().dockDroneAtFactory(factory.id, drone.id);

    const system = createUnloadSystem(world, store);
    system(0.1);

    const factoryState = store.getState().getFactory(factory.id);
    expect(factoryState?.queuedDrones.includes(drone.id)).toBe(false);
    expect(drone.state).toBe('idle');
    expect(drone.targetFactoryId).toBeNull();
    expect(drone.ownerFactoryId).toBe(factory.id);
    expect(world.events.transfers.length).toBe(0);
  });

  it('keeps non-ore unloads in factory storage without touching warehouse', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    const [factory] = store.getState().factories;
    if (!factory) throw new Error('expected default factory');
    const drone = spawnDrone(world);
    drone.state = 'unloading';
    drone.cargo = 12;
    drone.targetFactoryId = factory.id;
    drone.cargoProfile.metals = 12;
    drone.cargoProfile.ore = 0;

    const system = createUnloadSystem(world, store);
    system(0.1);

    const factoryState = store.getState().factories[0];
    expect(factoryState.resources.metals).toBeGreaterThanOrEqual(12);
    expect(store.getState().resources.metals).toBe(0);
  });

  it('sends non-ore unloads to warehouse when no factory is available', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    store.setState({ factories: [] });
    const drone = spawnDrone(world);
    drone.state = 'unloading';
    drone.cargo = 8;
    drone.targetFactoryId = null;
    drone.cargoProfile.crystals = 8;
    drone.cargoProfile.ore = 0;

    const system = createUnloadSystem(world, store);
    system(0.1);

    expect(store.getState().resources.crystals).toBeGreaterThanOrEqual(8);
  });
});
