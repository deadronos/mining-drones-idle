import type { GameWorld } from '@/ecs/world';
import { consumeDroneEnergy } from '@/ecs/energy';
import { DRONE_ENERGY_COST, type StoreApiType } from '@/state/store';

export const createMiningSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery, asteroidQuery } = world;
  return (dt: number) => {
    if (dt <= 0) return;
    const { settings } = store.getState();
    const throttleFloor = settings.throttleFloor;
    for (const drone of droneQuery) {
      if (drone.state !== 'mining') continue;
      const asteroid = asteroidQuery.entities.find((node) => node.id === drone.targetId);
      if (!asteroid) {
        drone.state = 'returning';
        drone.targetId = null;
        drone.travel = null;
        continue;
      }
      const capacityLeft = Math.max(0, drone.capacity - drone.cargo);
      if (capacityLeft <= 0) {
        drone.state = 'returning';
        drone.targetId = null;
        drone.travel = null;
        continue;
      }
      const { fraction } = consumeDroneEnergy(drone, dt, throttleFloor, DRONE_ENERGY_COST);
      if (fraction <= 0) {
        continue;
      }
      const mined = Math.min(drone.miningRate * fraction * dt, capacityLeft, asteroid.oreRemaining);
      if (mined <= 0) {
        drone.state = 'returning';
        drone.targetId = null;
        drone.travel = null;
        continue;
      }
      drone.cargo += mined;
      asteroid.oreRemaining -= mined;
      if (drone.cargo >= drone.capacity - 0.01 || asteroid.oreRemaining <= 0.01) {
        drone.state = 'returning';
        drone.targetId = null;
        drone.travel = null;
      }
    }
  };
};
