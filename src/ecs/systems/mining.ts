import type { GameWorld } from '@/ecs/world';
import { computeEnergyThrottle, type StoreApiType } from '@/state/store';

export const createMiningSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery, asteroidQuery } = world;
  return (dt: number) => {
    if (dt <= 0) return;
    const state = store.getState();
    const throttle = computeEnergyThrottle(state);
    if (throttle <= 0) return;
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
      const mined = Math.min(drone.miningRate * throttle * dt, capacityLeft, asteroid.oreRemaining);
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
