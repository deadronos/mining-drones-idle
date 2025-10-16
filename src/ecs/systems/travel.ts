import { consumeDroneEnergy } from '@/ecs/energy';
import type { GameWorld } from '@/ecs/world';
import { DRONE_ENERGY_COST, type StoreApiType } from '@/state/store';

export const createTravelSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery } = world;
  return (dt: number) => {
    if (dt <= 0) return;
    const throttleFloor = store.getState().settings.throttleFloor;
    for (const drone of droneQuery) {
      const travel = drone.travel;
      if (!travel) continue;
      const { fraction } = consumeDroneEnergy(drone, dt, throttleFloor, DRONE_ENERGY_COST);
      travel.elapsed = Math.min(travel.elapsed + dt * fraction, travel.duration);
      const t = travel.duration > 0 ? travel.elapsed / travel.duration : 1;
      drone.position.lerpVectors(travel.from, travel.to, t);
      if (travel.elapsed >= travel.duration - 1e-4) {
        drone.position.copy(travel.to);
        drone.travel = null;
        if (drone.state === 'toAsteroid') {
          drone.state = 'mining';
        } else if (drone.state === 'returning') {
          drone.state = 'unloading';
        }
      }
    }
  };
};
