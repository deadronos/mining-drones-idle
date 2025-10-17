import { describe, expect, it } from 'vitest';
import { createTravelSystem } from '@/ecs/systems/travel';
import { createGameWorld, spawnDrone } from '@/ecs/world';
import { createStoreInstance } from '@/state/store';
import { Vector3 } from 'three';
import { createDroneAISystem } from '@/ecs/systems/droneAI';

describe('ecs/systems/travel defensive guards', () => {
  it('clears travel and sends drone returning when travel has invalid duration', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    const drone = spawnDrone(world);
    drone.state = 'toAsteroid';
    // create invalid travel with NaN duration
    drone.travel = {
      from: drone.position.clone(),
      to: drone.position.clone().add(new Vector3(10, 0, 0)),
      elapsed: 0,
      duration: NaN,
    } as any;

    const system = createTravelSystem(world, store);
    system(0.5);

    expect(drone.travel).toBeNull();
    expect(drone.state).toBe('returning');
  });

  it('synchronizeDroneFlight rejects invalid rehydrated travel from store', () => {
    const world = createGameWorld({ asteroidCount: 0 });
    const store = createStoreInstance();
    const drone = spawnDrone(world);

    // create a malformed flight snapshot in the store
    const badFlight = {
      droneId: drone.id,
      state: 'toAsteroid',
      targetAsteroidId: null,
      targetRegionId: null,
      pathSeed: 1,
      travel: {
        from: [NaN, 0, 0],
        to: [0, 0, 0],
        elapsed: 0,
        duration: 1,
      },
    } as any;

    store.getState().recordDroneFlight(badFlight);

    const aiSystem = createDroneAISystem(world, store);
    aiSystem(0);

    // invalid flight should be cleared and drone put back to idle
    expect(store.getState().droneFlights.length).toBe(0);
    expect(drone.state).toBe('idle');
    expect(drone.travel).toBeNull();
  });
});
