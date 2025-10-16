import { Vector3 } from 'three';
import type { AsteroidEntity, DroneEntity, GameWorld, TravelData } from '@/ecs/world';
import { computeTravelPosition, snapshotToTravel, travelToSnapshot } from '@/ecs/flights';
import type { DroneFlightPhase, DroneFlightState, StoreApiType } from '@/state/store';
import type { RandomSource } from '@/lib/rng';
import { computeWaypointWithOffset } from '@/ecs/systems/travel';

const nearestTemp = new Vector3();
const midPoint = new Vector3();
const direction = new Vector3();
const offset = new Vector3();

const NEARBY_LIMIT = 4;
const MAX_OFFSET_DISTANCE = 3;
const EPSILON = 1e-4;

interface TargetCandidate {
  asteroid: AsteroidEntity;
  distance: number;
  weight: number;
}

interface AssignmentResult {
  target: AsteroidEntity;
  pathSeed: number;
}

const toWeight = (distance: number) => 1 / Math.max(distance, 1);

const buildCandidates = (
  drone: DroneEntity,
  asteroids: Iterable<AsteroidEntity>,
): TargetCandidate[] => {
  const candidates: TargetCandidate[] = [];
  for (const asteroid of asteroids) {
    if (asteroid.oreRemaining <= 0) continue;
    const distance = nearestTemp.copy(asteroid.position).distanceTo(drone.position);
    candidates.push({ asteroid, distance, weight: 0 });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, Math.min(NEARBY_LIMIT, candidates.length));
};

export const assignDroneTarget = (
  drone: DroneEntity,
  asteroids: Iterable<AsteroidEntity>,
  rng: RandomSource,
): AssignmentResult | null => {
  const candidates = buildCandidates(drone, asteroids);
  if (candidates.length === 0) {
    return null;
  }
  let totalWeight = 0;
  for (const candidate of candidates) {
    candidate.weight = toWeight(candidate.distance);
    totalWeight += candidate.weight;
  }
  const roll = rng.next() * (totalWeight || 1);
  let accumulated = 0;
  let chosen = candidates[candidates.length - 1];
  for (const candidate of candidates) {
    accumulated += candidate.weight;
    if (roll <= accumulated) {
      chosen = candidate;
      break;
    }
  }
  const seed = Math.max(1, Math.floor(rng.next() * 0xffffffff));
  return { target: chosen.asteroid, pathSeed: seed };
};

const startTravel = (
  drone: DroneEntity,
  destination: Vector3,
  phase: DroneFlightPhase,
  store: StoreApiType,
  options?: { recordDockingFrom?: boolean },
) => {
  const from = drone.position.clone();
  const to = destination.clone();
  const distance = from.distanceTo(to);
  const duration = Math.max(distance / Math.max(1, drone.speed), 0.1);
  const travel: TravelData = { from, to, elapsed: 0, duration };
  const pathSeed = drone.flightSeed ?? 1;
  drone.flightSeed = pathSeed;

  if (pathSeed) {
    midPoint.copy(from).lerp(to, 0.5);
    offset
      .copy(computeWaypointWithOffset(midPoint, pathSeed, 0))
      .sub(midPoint);
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
  }
  if (options?.recordDockingFrom) {
    drone.lastDockingFrom = from.clone();
  } else if (phase !== 'returning') {
    drone.lastDockingFrom = null;
  }

  const targetAsteroidId = phase === 'toAsteroid' ? drone.targetId : null;
  store.getState().recordDroneFlight({
    droneId: drone.id,
    state: phase,
    targetAsteroidId,
    pathSeed,
    travel: travelToSnapshot(travel),
  });
};

const synchronizeDroneFlight = (
  drone: DroneEntity,
  flight: DroneFlightState,
  world: GameWorld,
  store: StoreApiType,
) => {
  if (flight.state === 'toAsteroid') {
    if (!flight.targetAsteroidId) {
      store.getState().clearDroneFlight(flight.droneId);
      return;
    }
    const target = world.asteroidQuery.entities.find((asteroid) => asteroid.id === flight.targetAsteroidId);
    if (!target || target.oreRemaining <= 0) {
      store.getState().clearDroneFlight(flight.droneId);
      drone.state = 'idle';
      drone.targetId = null;
      drone.travel = null;
      drone.flightSeed = null;
      return;
    }
  }

  const needsUpdate =
    drone.state !== flight.state ||
    drone.flightSeed !== flight.pathSeed ||
    !drone.travel ||
    Math.abs(drone.travel.elapsed - flight.travel.elapsed) > 1e-4;

  if (!needsUpdate) {
    return;
  }

  const travel = snapshotToTravel(flight.travel);
  drone.state = flight.state;
  drone.flightSeed = flight.pathSeed;
  drone.targetId = flight.state === 'toAsteroid' ? flight.targetAsteroidId : null;
  drone.travel = travel;
  if (flight.state === 'returning') {
    drone.lastDockingFrom = travel.from.clone();
  }
  computeTravelPosition(travel, drone.position);
};

export const createDroneAISystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery, asteroidQuery, factory, rng } = world;
  return (_dt: number) => {
    const flights = store.getState().droneFlights;
    const flightMap = new Map<string, DroneFlightState>();
    for (const flight of flights) {
      flightMap.set(flight.droneId, flight);
    }

    for (const drone of droneQuery) {
      const storedFlight = flightMap.get(drone.id);
      if (storedFlight) {
        synchronizeDroneFlight(drone, storedFlight, world, store);
      }

      if (drone.state === 'idle') {
        drone.flightSeed = null;
        const assignment = assignDroneTarget(drone, asteroidQuery, rng);
        if (assignment) {
          drone.targetId = assignment.target.id;
          drone.flightSeed = assignment.pathSeed;
          startTravel(drone, assignment.target.position, 'toAsteroid', store);
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
          drone.travel = null;
          drone.flightSeed = null;
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
        drone.flightSeed = Math.max(1, Math.floor(rng.next() * 0xffffffff));
        startTravel(drone, factory.position, 'returning', store, { recordDockingFrom: true });
      }
    }
  };
};
