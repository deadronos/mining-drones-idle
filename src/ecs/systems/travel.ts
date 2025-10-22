import { Vector3 } from 'three';
import { consumeDroneEnergy } from '@/ecs/energy';
import type { GameWorld } from '@/ecs/world';
import { computeTravelPosition, travelToSnapshot } from '@/ecs/flights';
import { isFiniteTravel } from '@/ecs/flights';
import { createRng } from '@/lib/rng';
import { DRONE_ENERGY_COST, type StoreApiType } from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';

const offsetVector = new Vector3();

// Distance threshold for drone to trigger unload when returning to factory.
// When drone.position is within this distance of factory.position, unload begins immediately.
// This bypasses battery throttling that delays travel.elapsed completion.
const UNLOAD_ARRIVAL_DISTANCE = 1.0;

export const computeWaypointWithOffset = (baseWaypoint: Vector3, seed: number, index: number) => {
  const mixedSeed = (seed ^ ((index + 1) * 0x9e3779b9)) >>> 0;
  const rng = createRng(mixedSeed || 1);
  const yaw = rng.nextRange(0, Math.PI * 2);
  const pitch = rng.nextRange(-Math.PI / 5, Math.PI / 5);
  const radius = rng.nextRange(0.2, 1);
  offsetVector.set(
    Math.cos(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.sin(yaw) * Math.cos(pitch),
  );
  return baseWaypoint.clone().addScaledVector(offsetVector, radius);
};

export const createTravelSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery } = world;
  return (dt: number) => {
    if (dt <= 0) return;
    const api = store.getState();
    const modifiers = getResourceModifiers(api.resources, api.prestige.cores);
    const throttleFloor = api.settings.throttleFloor;
    const drainRate = DRONE_ENERGY_COST * modifiers.energyDrainMultiplier;
    for (const drone of droneQuery) {
      const travel = drone.travel;
      if (!travel) continue;
      // Defensive: validate travel object
      if (!isFiniteTravel(travel) || !Number.isFinite(travel.duration) || travel.duration <= 0) {
        // Log minimal snapshot for debugging and recover the drone to a safe state
        console.warn('[travel] invalid travel detected, clearing travel', {
          id: drone.id,
          state: drone.state,
          travel: travelToSnapshot(travel),
        });
        // clear travel and force returning to base as a safe fallback
        drone.travel = null;
        drone.flightSeed = null;
        if (drone.state !== 'unloading') {
          drone.state = 'returning';
        }
        continue;
      }
      const { fraction } = consumeDroneEnergy(drone, dt, throttleFloor, drainRate);
      travel.elapsed = Math.min(travel.elapsed + dt * fraction, travel.duration);
      computeTravelPosition(travel, drone.position);

      if (
        (drone.state === 'toAsteroid' || drone.state === 'returning') &&
        drone.flightSeed != null
      ) {
        api.recordDroneFlight({
          droneId: drone.id,
          state: drone.state,
          targetAsteroidId: drone.state === 'toAsteroid' ? drone.targetId : null,
          targetRegionId: drone.state === 'toAsteroid' ? drone.targetRegionId : null,
          targetFactoryId: drone.state === 'returning' ? drone.targetFactoryId : null,
          pathSeed: drone.flightSeed,
          travel: travelToSnapshot(travel),
        });
      }

      // Position-based unload trigger: if drone has reached factory position, start unloading immediately.
      // This bypasses battery throttling that delays travel.elapsed completion.
      // Flight data has already been recorded above, so clearing travel is safe.
      if (drone.state === 'returning' && drone.targetFactoryId) {
        const factory = api.getFactory(drone.targetFactoryId);
        if (factory) {
          const distanceToFactory = drone.position.distanceTo(factory.position);
          if (distanceToFactory < UNLOAD_ARRIVAL_DISTANCE) {
            // Drone has arrived at factory position; start unload immediately
            drone.position.copy(factory.position);
            drone.travel = null;
            api.clearDroneFlight(drone.id);
            drone.state = 'unloading';
            drone.flightSeed = null;
            continue;
          }
        }
      }

      // Time-based trigger: fallback for when position-based trigger doesn't fire
      if (travel.elapsed >= travel.duration - 1e-4) {
        drone.position.copy(travel.to);
        drone.travel = null;
        api.clearDroneFlight(drone.id);
        if (drone.state === 'toAsteroid') {
          drone.state = 'mining';
        } else if (drone.state === 'returning') {
          drone.state = 'unloading';
        }
        drone.flightSeed = null;
      }
    }
  };
};
