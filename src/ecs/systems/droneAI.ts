import { Vector3 } from 'three';
import type { AsteroidEntity, DroneEntity, GameWorld } from '@/ecs/world';
import type { StoreApiType } from '@/state/store';

const temp = new Vector3();

const computeTravel = (drone: DroneEntity, destination: Vector3) => {
  const from = drone.position.clone();
  const to = destination.clone();
  const distance = from.distanceTo(to);
  const duration = Math.max(distance / Math.max(1, drone.speed), 0.1);
  drone.travel = { from, to, elapsed: 0, duration };
};

const findNearestAsteroid = (source: Vector3, asteroids: Iterable<AsteroidEntity>) => {
  let nearest: AsteroidEntity | null = null;
  let closest = Number.POSITIVE_INFINITY;
  for (const asteroid of asteroids) {
    if (asteroid.oreRemaining <= 0) continue;
    const distance = temp.copy(asteroid.position).distanceTo(source);
    if (distance < closest) {
      closest = distance;
      nearest = asteroid;
    }
  }
  return nearest;
};

export const createDroneAISystem = (world: GameWorld, _store: StoreApiType) => {
  const { droneQuery, asteroidQuery, factory } = world;
  return (_dt: number) => {
    for (const drone of droneQuery) {
      if (drone.state === 'idle') {
        const target = findNearestAsteroid(drone.position, asteroidQuery);
        if (target) {
          drone.targetId = target.id;
          drone.state = 'toAsteroid';
          computeTravel(drone, target.position);
        }
        continue;
      }
      if (drone.state === 'toAsteroid') {
        const target = asteroidQuery.entities.find((asteroid) => asteroid.id === drone.targetId);
        if (!target || target.oreRemaining <= 0) {
          drone.state = 'idle';
          drone.targetId = null;
          drone.travel = null;
        }
        continue;
      }
      if (drone.state === 'unloading' && drone.cargo <= 0.01) {
        drone.state = 'idle';
        drone.targetId = null;
        drone.travel = null;
        continue;
      }
      if (drone.state === 'returning' && !drone.travel) {
        computeTravel(drone, factory.position);
      }
    }
  };
};
