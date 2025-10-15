import type { GameWorld, DroneEntity } from '@/ecs/world';
import { removeDrone, spawnDrone } from '@/ecs/world';
import type { StoreApiType } from '@/state/store';

const BASE_SPEED = 14;

const updateDroneStats = (drone: DroneEntity, level: number) => {
  const speedBonus = 1 + Math.max(0, level - 1) * 0.05;
  drone.speed = BASE_SPEED * speedBonus;
};

export const createFleetSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery, factory } = world;
  return (_dt: number) => {
    const { modules } = store.getState();
    const target = Math.max(1, modules.droneBay);
    while (droneQuery.size < target) {
      const drone = spawnDrone(world);
      drone.position.copy(factory.position);
    }
    while (droneQuery.size > target) {
      const drone = droneQuery.entities[droneQuery.size - 1];
      removeDrone(world, drone);
    }
    for (const drone of droneQuery) {
      updateDroneStats(drone, modules.droneBay);
      drone.capacity = 40 + modules.storage * 5;
      drone.miningRate = 6 + modules.refinery * 0.5;
    }
  };
};
