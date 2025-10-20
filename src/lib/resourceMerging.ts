import type { Resources, Modules } from '@/state/types';
import { getResourceModifiers } from './resourceModifiers';
import { computeWarehouseCapacity } from '@/state/utils';
import { rawResourceKeys } from '@/state/constants';

/**
 * Merges a resource delta into a base resource set, with optional capacity-aware clamping.
 * This is the core resource merging logic that incorporates prestige and storage capacity.
 *
 * @param base The base resource set
 * @param delta The resource changes to apply
 * @param modules The player's module upgrades (for capacity calculation)
 * @param capacityAware Whether to clamp resources to storage capacity
 * @param prestigeCores Number of prestige cores (for resource modifier calculation)
 * @returns The merged resource set
 */
export const mergeResourceDelta = (
  base: Resources,
  delta: Partial<Resources>,
  modules: Modules,
  capacityAware: boolean,
  prestigeCores = 0,
): Resources => {
  const next: Resources = { ...base };
  for (const key of rawResourceKeys) {
    const amount = delta[key];
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) continue;
    next[key] = base[key] + amount;
  }
  if (typeof delta.bars === 'number' && Number.isFinite(delta.bars) && delta.bars !== 0) {
    next.bars = Math.max(0, next.bars + delta.bars);
  }
  if (typeof delta.energy === 'number' && Number.isFinite(delta.energy) && delta.energy !== 0) {
    next.energy = Math.max(0, next.energy + delta.energy);
  }
  if (typeof delta.credits === 'number' && Number.isFinite(delta.credits) && delta.credits !== 0) {
    next.credits = Math.max(0, next.credits + delta.credits);
  }
  if (!capacityAware) {
    return next;
  }
  const modifiers = getResourceModifiers(next, prestigeCores);
  const capacity = computeWarehouseCapacity(modules, modifiers);
  for (const key of rawResourceKeys) {
    const value = next[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      next[key] = Math.max(0, Math.min(capacity, base[key]));
    } else {
      next[key] = Math.min(capacity, Math.max(0, value));
    }
  }
  return next;
};
