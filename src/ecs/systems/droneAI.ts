import type { GameWorld } from '@/ecs/world';
import type { StoreApiType } from '@/state/store';
import { getRegionById, pickRegionForDrone } from '@/ecs/biomes';
import { assignDroneTarget } from './droneAI/targetAssignment';
import { startTravel } from './droneAI/travelManagement';
import { synchronizeDroneFlight } from './droneAI/flightSync';
import { assignReturnFactory } from './droneAI/factoryAssignment';

// Re-export for backward compatibility
export { assignDroneTarget } from './droneAI/targetAssignment';

/**
 * Creates the Drone AI system which governs drone behavior.
 * Handles state transitions (idle -> mining -> returning), target assignment,
 * and synchronization with the persistent store (for offline travel).
 *
 * @param world - The ECS world containing entities.
 * @param store - The application state store for persistence and global state.
 * @returns A system update function accepting delta time (dt).
 */
export const createDroneAISystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery, asteroidQuery, rng } = world;

  return (_dt: number) => {
    // droneFlights is now a Record, but we can iterate it or use keys.
    // However, the original logic built a Map from array.
    // Now we can just use the Record directly or values.
    const flights = store.getState().droneFlights;

    // We can clear flightMap and repopulate, or just assume the Record is efficient.
    // Given the previous code copied to a Map, doing:
    // const flight = flights[drone.id];
    // is O(1) and much faster than building the Map every frame (which was O(N)).
    // So we don't need flightMap anymore!

    for (const drone of droneQuery) {
      const storedFlight = flights[drone.id];
      if (storedFlight) {
        synchronizeDroneFlight(drone, storedFlight, world, store);
      }

      if (drone.targetFactoryId && drone.state !== 'returning' && drone.state !== 'unloading') {
        const stuckFactoryId = drone.targetFactoryId;
        const stateApi = store.getState();
        const factory = stateApi.getFactory(stuckFactoryId);
        if (factory?.queuedDrones.includes(drone.id)) {
          stateApi.undockDroneFromFactory(stuckFactoryId, drone.id);
        }
        drone.targetFactoryId = null;
      }

      if (drone.state === 'idle') {
        drone.flightSeed = null;
        drone.targetRegionId = null;
        const assignment = assignDroneTarget(drone, asteroidQuery, rng);
        if (assignment) {
          drone.targetId = assignment.target.id;
          drone.flightSeed = assignment.pathSeed;
          drone.targetRegionId = assignment.regionId;
          startTravel(drone, assignment.destination, 'toAsteroid', store, {
            gravityMultiplier: assignment.gravityMultiplier,
          });
        } else {
          store.getState().clearDroneFlight(drone.id);
        }
        continue;
      }

      if (drone.state === 'toAsteroid') {
        const target = asteroidQuery.entities.find((asteroid) => asteroid.id === drone.targetId);
        if (!target || target.oreRemaining <= 0) {
          store.getState().clearDroneFlight(drone.id);
          drone.state = 'idle';
          drone.targetId = null;
          drone.targetRegionId = null;
          drone.travel = null;
          drone.flightSeed = null;
        }
        if (target?.regions?.length) {
          const region = getRegionById(target.regions, drone.targetRegionId);
          if (!region) {
            const reassigned = pickRegionForDrone(target, target.biome, target.regions, rng);
            if (reassigned) {
              drone.targetRegionId = reassigned.id;
              drone.flightSeed = Math.max(1, Math.floor(rng.next() * 0xffffffff));
              startTravel(
                drone,
                target.position.clone().add(reassigned.offset),
                'toAsteroid',
                store,
                {
                  gravityMultiplier: reassigned.gravityMultiplier,
                },
              );
            } else {
              store.getState().clearDroneFlight(drone.id);
              drone.state = 'returning';
              drone.targetId = null;
              drone.targetRegionId = null;
              drone.travel = null;
            }
          }
        }
        continue;
      }

      if (drone.state === 'unloading' && drone.cargo <= 0.01) {
        store.getState().clearDroneFlight(drone.id);
        drone.state = 'idle';
        drone.targetId = null;
        drone.travel = null;
        drone.flightSeed = null;
        continue;
      }

      if (drone.state === 'returning' && !drone.travel) {
        const assignment = assignReturnFactory(drone, store, rng);
        if (assignment) {
          drone.flightSeed = Math.max(1, Math.floor(rng.next() * 0xffffffff));
          drone.targetRegionId = null;
          startTravel(drone, assignment.position, 'returning', store, { recordDockingFrom: true });
        } else {
          // If the drone was queued for docking, assignReturnFactory will set
          // drone.targetFactoryId and return null. In that case we must NOT
          // clear targetFactoryId here, otherwise the drone will lose its
          // queued assignment and never travel to the factory (becoming
          // stuck in the 'returning' state). Only clear the factory id when
          // there is genuinely no candidate selected (i.e. targetFactoryId
          // is already null).
          drone.flightSeed = null;
          drone.targetRegionId = null;
          // leave drone.targetFactoryId as-is (null or previously set)
        }
      }
    }
  };
};
