import { Vector3 } from 'three';
import type { AsteroidEntity, DroneEntity, GameWorld, TravelData } from '@/ecs/world';
import { computeTravelPosition, snapshotToTravel, travelToSnapshot } from '@/ecs/flights';
import type { DroneFlightPhase, DroneFlightState, StoreApiType } from '@/state/store';
import type { RandomSource } from '@/lib/rng';
import { computeWaypointWithOffset } from '@/ecs/systems/travel';
import { getRegionById, pickRegionForDrone } from '@/ecs/biomes';

const nearestTemp = new Vector3();
const midPoint = new Vector3();
const direction = new Vector3();
const offset = new Vector3();

const NEARBY_LIMIT = 4;
const MAX_OFFSET_DISTANCE = 3;
const EPSILON = 1e-4;
const FACTORY_VARIETY_CHANCE = 0.25;
const FACTORY_WEIGHT_EPSILON = 0.001;

interface TargetCandidate {
  asteroid: AsteroidEntity;
  distance: number;
  weight: number;
}

interface AssignmentResult {
  target: AsteroidEntity;
  pathSeed: number;
  destination: Vector3;
  regionId: string | null;
  gravityMultiplier: number;
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
  const target = chosen.asteroid;
  let regionId: string | null = null;
  let destination = target.position.clone();
  let gravityMultiplier = target.gravityMultiplier;
  if (target.regions && target.regions.length > 0) {
    const region = pickRegionForDrone(target, target.biome, target.regions, rng);
    if (region) {
      regionId = region.id;
      destination = target.position.clone().add(region.offset);
      gravityMultiplier = region.gravityMultiplier;
    }
  }
  return { target, pathSeed: seed, destination, regionId, gravityMultiplier };
};

const startTravel = (
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
  const effectiveSpeed = Math.max(1, drone.speed / gravity);
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
    const target = world.asteroidQuery.entities.find(
      (asteroid) => asteroid.id === flight.targetAsteroidId,
    );
    if (!target || target.oreRemaining <= 0) {
      store.getState().clearDroneFlight(flight.droneId);
      drone.state = 'idle';
      drone.targetId = null;
      drone.travel = null;
      drone.flightSeed = null;
      return;
    }
  }
  // Validate travel rehydrated from store
  let travel: TravelData;
  try {
    travel = snapshotToTravel(flight.travel);
    const invalid =
      !travel ||
      !Number.isFinite(travel.duration) ||
      Number.isNaN(travel.duration) ||
      !Number.isFinite(travel.elapsed) ||
      Number.isNaN(travel.elapsed) ||
      !Number.isFinite(travel.from.x) ||
      !Number.isFinite(travel.from.y) ||
      !Number.isFinite(travel.from.z) ||
      !Number.isFinite(travel.to.x) ||
      !Number.isFinite(travel.to.y) ||
      !Number.isFinite(travel.to.z);
    if (invalid) {
      console.warn('[synchronizeDroneFlight] invalid travel snapshot; clearing flight', {
        id: flight.droneId,
        flight,
      });
      store.getState().clearDroneFlight(flight.droneId);
      // put drone in idle to allow reassignment
      drone.state = 'idle';
      drone.targetId = null;
      drone.travel = null;
      drone.flightSeed = null;
      return;
    }
  } catch (err) {
    console.warn('[synchronizeDroneFlight] failed to parse travel snapshot', {
      id: flight.droneId,
      err,
    });
    store.getState().clearDroneFlight(flight.droneId);
    drone.state = 'idle';
    drone.targetId = null;
    drone.travel = null;
    drone.flightSeed = null;
    return;
  }

  const needsUpdate =
    drone.state !== flight.state ||
    drone.flightSeed !== flight.pathSeed ||
    !drone.travel ||
    Math.abs(drone.travel.elapsed - flight.travel.elapsed) > 1e-4;

  if (!needsUpdate) {
    return;
  }

  if (flight.state === 'returning') {
    drone.targetFactoryId = flight.targetFactoryId;
    if (flight.targetFactoryId) {
      store.getState().dockDroneAtFactory(flight.targetFactoryId, drone.id);
    }
  }

  drone.state = flight.state;
  drone.flightSeed = flight.pathSeed;
  drone.targetId = flight.state === 'toAsteroid' ? flight.targetAsteroidId : null;
  drone.targetRegionId = flight.state === 'toAsteroid' ? flight.targetRegionId : null;
  drone.travel = travel;
  if (flight.state === 'returning') {
    drone.lastDockingFrom = travel.from.clone();
  }
  computeTravelPosition(travel, drone.position);
};

export const createDroneAISystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery, asteroidQuery, rng } = world;
  const assignReturnFactory = (
    drone: DroneEntity,
  ): { targetId: string; position: Vector3 } | null => {
    const state = store.getState();
    if (state.factories.length === 0) {
      drone.targetFactoryId = null;
      return null;
    }

    if (drone.targetFactoryId) {
      const existing = state.factories.find((item) => item.id === drone.targetFactoryId);
      if (existing) {
        const queueIndex = existing.queuedDrones.indexOf(drone.id);
        if (queueIndex !== -1 && queueIndex < existing.dockingCapacity) {
          return { targetId: existing.id, position: existing.position.clone() };
        }
        return null;
      }
      state.undockDroneFromFactory(drone.targetFactoryId, drone.id);
      drone.targetFactoryId = null;
    }

    const withDistances = state.factories.map((factory) => {
      const distance = drone.position.distanceTo(factory.position);
      const occupied = Math.min(factory.queuedDrones.length, factory.dockingCapacity);
      const available = Math.max(0, factory.dockingCapacity - occupied);
      return {
        factory,
        distance,
        available,
        queueLength: factory.queuedDrones.length,
      };
    });

    const candidates = withDistances.filter((entry) => entry.available > 0);
    let selected = null as (typeof withDistances)[number] | null;

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.distance - b.distance);
      selected = candidates[0];
      if (candidates.length > 1 && rng.next() < FACTORY_VARIETY_CHANCE) {
        const others = candidates.slice(1);
        const weights = others.map((entry) => 1 / Math.max(entry.distance, FACTORY_WEIGHT_EPSILON));
        const totalWeight = weights.reduce((sum, value) => sum + value, 0);
        let roll = rng.next() * totalWeight;
        for (let i = 0; i < others.length; i += 1) {
          roll -= weights[i];
          if (roll <= 0) {
            selected = others[i];
            break;
          }
        }
      }
    } else {
      selected = withDistances.reduce<(typeof withDistances)[number] | null>((best, entry) => {
        if (!best) return entry;
        if (entry.queueLength < best.queueLength) return entry;
        if (entry.queueLength === best.queueLength && entry.distance < best.distance) {
          return entry;
        }
        return best;
      }, null);
    }

    if (!selected) {
      return null;
    }

    const result = state.dockDroneAtFactory(selected.factory.id, drone.id);
    if (result === 'queued') {
      drone.targetFactoryId = selected.factory.id;
      return null;
    }
    if (result === 'docking') {
      drone.targetFactoryId = selected.factory.id;
      return { targetId: selected.factory.id, position: selected.factory.position.clone() };
    }

    // Already exists in queue; check if now within docking range
    const current = state.getFactory(selected.factory.id);
    if (current) {
      const queueIndex = current.queuedDrones.indexOf(drone.id);
      if (queueIndex !== -1 && queueIndex < current.dockingCapacity) {
        drone.targetFactoryId = current.id;
        return { targetId: current.id, position: current.position.clone() };
      }
    }
    return null;
  };
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

      if (
        drone.targetFactoryId &&
        drone.state !== 'returning' &&
        drone.state !== 'unloading'
      ) {
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
        const assignment = assignReturnFactory(drone);
        if (assignment) {
          drone.flightSeed = Math.max(1, Math.floor(rng.next() * 0xffffffff));
          drone.targetRegionId = null;
          startTravel(drone, assignment.position, 'returning', store, { recordDockingFrom: true });
        } else {
          drone.flightSeed = null;
          drone.targetRegionId = null;
          drone.targetFactoryId = null;
        }
      }
    }
  };
};
