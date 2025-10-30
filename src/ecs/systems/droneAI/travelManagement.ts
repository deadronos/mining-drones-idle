import type { DroneEntity } from '@/ecs/world';
import type { DroneFlightPhase, StoreApiType } from '@/state/store';
import type { TravelData } from '@/ecs/world';
import { getSinkBonuses } from '@/state/sinks';
import { computeWaypointWithOffset } from '@/ecs/systems/travel';
import { travelToSnapshot } from '@/ecs/flights';
import { Vector3 } from 'three';

const midPoint = new Vector3();
const direction = new Vector3();
const offset = new Vector3();
const MAX_OFFSET_DISTANCE = 3;
const EPSILON = 1e-4;

export const startTravel = (
  drone: DroneEntity,
  destination: Vector3,
  phase: DroneFlightPhase,
  store: StoreApiType,
  options?: { recordDockingFrom?: boolean; gravityMultiplier?: number },
) => {
  const from = drone.position.clone();
  const to = destination.clone();
  // Defensive validation: ensure vectors are finite
  const invalidVec = (v: Vector3) =>
    !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z);
  if (invalidVec(from) || invalidVec(to)) {
    console.warn('[startTravel] invalid from/to vectors; forcing return-to-base', {
      id: drone.id,
      from: from.toArray(),
      to: to.toArray(),
      phase,
    });
    // fallback: send drone back to factory by clearing travel and marking returning
    drone.travel = null;
    drone.flightSeed = null;
    drone.state = 'returning';
    drone.targetId = null;
    return;
  }
  const distance = from.distanceTo(to);
  const gravity = Math.max(0.5, options?.gravityMultiplier ?? 1);
  const sinkBonuses = getSinkBonuses(store.getState());
  const effectiveSpeed = Math.max(1, (drone.speed * sinkBonuses.droneSpeedMultiplier) / gravity);
  const duration = Math.max(distance / effectiveSpeed, 0.1);
  const travel: TravelData = { from, to, elapsed: 0, duration };
  const pathSeed = drone.flightSeed ?? 1;
  drone.flightSeed = pathSeed;

  if (pathSeed) {
    midPoint.copy(from).lerp(to, 0.5);
    offset.copy(computeWaypointWithOffset(midPoint, pathSeed, 0)).sub(midPoint);
    direction.copy(to).sub(from);
    const magnitudeSq = direction.lengthSq();
    if (magnitudeSq > EPSILON) {
      direction.normalize();
      const parallel = direction.dot(offset);
      offset.addScaledVector(direction, -parallel);
      if (offset.lengthSq() > EPSILON) {
        offset.clampLength(0, Math.max(0.5, Math.min(MAX_OFFSET_DISTANCE, distance * 0.25)));
        travel.control = midPoint.clone().add(offset);
      }
    }
  }

  drone.travel = travel;
  drone.state = phase;
  if (phase === 'returning') {
    drone.targetId = null;
    drone.targetRegionId = null;
  } else {
    drone.targetFactoryId = null;
  }
  if (options?.recordDockingFrom) {
    drone.lastDockingFrom = from.clone();
  } else if (phase !== 'returning') {
    drone.lastDockingFrom = null;
  }

  const targetAsteroidId = phase === 'toAsteroid' ? drone.targetId : null;
  const targetRegionId = phase === 'toAsteroid' ? drone.targetRegionId : null;
  const targetFactoryId = phase === 'returning' ? drone.targetFactoryId : null;
  store.getState().recordDroneFlight({
    droneId: drone.id,
    state: phase,
    targetAsteroidId,
    targetRegionId,
    targetFactoryId,
    pathSeed,
    travel: travelToSnapshot(travel),
  });
};
