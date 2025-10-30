import type { DroneEntity, GameWorld, TravelData } from '@/ecs/world';
import type { DroneFlightState, StoreApiType } from '@/state/store';
import { snapshotToTravel, computeTravelPosition } from '@/ecs/flights';

export const synchronizeDroneFlight = (
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
