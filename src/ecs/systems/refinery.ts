import type { GameWorld } from '@/ecs/world';
import { runRefineryStep, type StoreApiType } from '@/state/store';

export const createRefinerySystem = (_world: GameWorld, store: StoreApiType) => (dt: number) => {
  runRefineryStep(store, dt);
};
