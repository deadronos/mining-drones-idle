import type { GameWorld } from '@/ecs/world';
import {
  ORE_CONVERSION_PER_SECOND,
  ORE_PER_BAR,
  type StoreApiType,
  computeRefineryProduction,
} from '@/state/store';

const BOOST_THRESHOLD_MULTIPLIER = 1.2;
const PROCESSING_DECAY_PER_SECOND = 0.9;
const BOOST_DECAY_SECONDS = 1.5;

export const createRefinerySystem = (world: GameWorld, store: StoreApiType) => (dt: number) => {
  if (dt <= 0) return;
  const state = store.getState();
  const stats = computeRefineryProduction(state, dt);
  if (stats.oreConsumed > 0 || stats.barsProduced > 0) {
    state.applyRefineryStats(stats);
  }

  const activity = world.factory.activity;
  const orePerSecond = dt > 0 ? stats.oreConsumed / dt : 0;
  const normalized = Math.min(1, orePerSecond / ORE_CONVERSION_PER_SECOND);
  const decayedProcessing = Math.max(0, activity.processing - PROCESSING_DECAY_PER_SECOND * dt);
  activity.processing = Math.min(1, Math.max(decayedProcessing, normalized));
  const barsPerSecond = dt > 0 ? stats.barsProduced / dt : 0;
  activity.throughput = Math.max(0, barsPerSecond);

  const decayedBoost = Math.max(0, activity.boost - dt / BOOST_DECAY_SECONDS);
  const baseBarsPerSecond = ORE_CONVERSION_PER_SECOND / ORE_PER_BAR;
  const boostTrigger = barsPerSecond > baseBarsPerSecond * BOOST_THRESHOLD_MULTIPLIER;
  activity.boost = boostTrigger ? 1 : decayedBoost;
};
