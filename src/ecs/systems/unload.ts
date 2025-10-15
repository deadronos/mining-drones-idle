import type { GameWorld } from '@/ecs/world';
import type { StoreApiType } from '@/state/store';

export const createUnloadSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery, factory } = world;
  return (_dt: number) => {
    for (const drone of droneQuery) {
      if (drone.state !== 'unloading') continue;
      if (drone.cargo > 0) {
        store.getState().addOre(drone.cargo);
      }
      drone.cargo = 0;
      drone.state = 'idle';
      drone.targetId = null;
      drone.travel = null;
      drone.position.copy(factory.position);
    }
  };
};
