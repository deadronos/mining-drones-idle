import {
  ensureAsteroidTarget,
  removeAsteroid,
  type AsteroidEntity,
  type GameWorld,
} from '@/ecs/world';
import type { StoreApiType } from '@/state/store';
import { TAU } from '@/lib/math';
import { getSinkBonuses } from '@/state/sinks';

export const createAsteroidSystem = (world: GameWorld, store: StoreApiType) => {
  const { asteroidQuery } = world;
  const recyclable: AsteroidEntity[] = [];
  return (dt: number) => {
    const state = store.getState();
    const { modules } = state;
    const sinkBonuses = getSinkBonuses(state);
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
    ensureAsteroidTarget(world, {
      scannerLevel: modules.scanner,
      spawnMultiplier: sinkBonuses.asteroidSpawnMultiplier,
      richnessMultiplier: sinkBonuses.asteroidRichnessMultiplier,
    });
  };
};
