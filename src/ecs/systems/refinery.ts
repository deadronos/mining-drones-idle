import type { GameWorld } from '@/ecs/world';
import type { StoreApiType } from '@/state/store';

export const createRefinerySystem = (_world: GameWorld, store: StoreApiType) => (dt: number) => {
  if (dt <= 0) return;
  store.getState().processRefinery(dt);
};
