import { Vector3 } from 'three';
import { consumeDroneEnergy } from '@/ecs/energy';
import type { GameWorld } from '@/ecs/world';
import { computeTravelPosition, travelToSnapshot } from '@/ecs/flights';
import { createRng } from '@/lib/rng';
import { DRONE_ENERGY_COST, type StoreApiType } from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';

const offsetVector = new Vector3();

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
    const modifiers = getResourceModifiers(api.resources);
    const throttleFloor = api.settings.throttleFloor;
    const drainRate = DRONE_ENERGY_COST * modifiers.energyDrainMultiplier;
    for (const drone of droneQuery) {
      const travel = drone.travel;
      if (!travel) continue;
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
          pathSeed: drone.flightSeed,
          travel: travelToSnapshot(travel),
        });
      }

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
