import {
  ensureAsteroidTarget,
  removeAsteroid,
  type AsteroidEntity,
  type GameWorld,
} from '@/ecs/world';
import type { StoreApiType } from '@/state/store';
import { TAU } from '@/lib/math';

export const createAsteroidSystem = (world: GameWorld, store: StoreApiType) => {
  const { asteroidQuery } = world;
  const recyclable: AsteroidEntity[] = [];
  return (dt: number) => {
    const { modules } = store.getState();
    recyclable.length = 0;
    for (const asteroid of asteroidQuery) {
      asteroid.rotation = (asteroid.rotation + asteroid.spin * dt) % TAU;
      if (asteroid.oreRemaining <= 0.01) {
        recyclable.push(asteroid);
      }
    }
    for (const asteroid of recyclable) {
      removeAsteroid(world, asteroid);
    }
    ensureAsteroidTarget(world, modules.scanner);
  };
};
