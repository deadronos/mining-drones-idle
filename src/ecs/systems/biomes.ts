import {
  applyFractureToAsteroid,
  generateFractureRegions,
  handleDroneReassignment,
  pickRegionForDrone,
  updateFractureTimer,
} from '@/ecs/biomes';
import type { AsteroidEntity, GameWorld } from '@/ecs/world';

export const createBiomeSystem = (world: GameWorld) => {
  const { asteroidQuery, droneQuery, rng } = world;
  return (dt: number) => {
    if (dt <= 0) return;
    for (const asteroid of asteroidQuery) {
      const triggered = updateFractureTimer(asteroid.biome, dt, rng);
      if (!triggered) continue;
      const regions = generateFractureRegions(asteroid, asteroid.biome);
      applyFractureToAsteroid(asteroid, asteroid.biome, regions);
      handleDroneReassignment(asteroid, regions, droneQuery, rng);
    }
  };
};

export const ensureRegionSelection = (asteroid: AsteroidEntity, world: GameWorld) =>
  pickRegionForDrone(asteroid, asteroid.biome, asteroid.regions, world.rng);
