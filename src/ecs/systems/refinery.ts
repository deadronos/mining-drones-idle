import type { GameWorld } from '@/ecs/world';
import type { StoreApiType } from '@/state/store';

export const createRefinerySystem = (_world: GameWorld, _store: StoreApiType) => (_dt: number) => {
  /* Refinery processing handled within store.tick for now. */
};
