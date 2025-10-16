import { describe, expect, it } from 'vitest';
import { createGameWorld, spawnDrone, type TravelData } from '@/ecs/world';
import { createStoreInstance, serializeStore } from '@/state/store';
import { createDroneAISystem } from '@/ecs/systems/droneAI';
import { createTravelSystem } from '@/ecs/systems/travel';
import { computeTravelPosition, snapshotToTravel } from '@/ecs/flights';
import { createRng } from '@/lib/rng';

describe('drone flight persistence', () => {
  it('restores in-progress flights from serialized snapshots', () => {
    const world = createGameWorld({ asteroidCount: 3, rng: createRng(123456) });
    const store = createStoreInstance();
    const drone = spawnDrone(world);
    drone.position.copy(world.factory.position);

    const aiSystem = createDroneAISystem(world, store);
    const travelSystem = createTravelSystem(world, store);

    aiSystem(0);
    expect(store.getState().droneFlights).toHaveLength(1);

    travelSystem(0.4);
    const progressedFlight = store.getState().droneFlights[0];
    expect(progressedFlight.travel.elapsed).toBeGreaterThan(0);

    const snapshot = serializeStore(store.getState());
    const savedFlight = snapshot.droneFlights?.[0];
    expect(savedFlight).toBeDefined();

    const restoredStore = createStoreInstance();
    restoredStore.getState().applySnapshot(snapshot);

    drone.state = 'idle';
    drone.targetId = null;
    drone.travel = null;
    drone.flightSeed = null;
    drone.position.copy(world.factory.position);

    const restoredAI = createDroneAISystem(world, restoredStore);
    restoredAI(0);

    expect(drone.travel).not.toBeNull();
    expect(drone.state).toBe(savedFlight!.state);
    expect(drone.flightSeed).toBe(savedFlight!.pathSeed);
    expect(drone.targetId).toBe(savedFlight!.targetAsteroidId);

    const travelData = drone.travel as TravelData | null;
    if (!travelData) {
      throw new Error('expected restored travel data');
    }
    const activeTravel = travelData;
    expect(activeTravel.elapsed).toBeCloseTo(savedFlight!.travel.elapsed, 5);

    const expectedPosition = computeTravelPosition(snapshotToTravel(savedFlight!.travel));
    expect(drone.position.distanceTo(expectedPosition)).toBeLessThan(1e-4);
  });
});
