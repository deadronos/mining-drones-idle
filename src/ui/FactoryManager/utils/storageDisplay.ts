import type { BuildableFactory } from '@/ecs/factories';
import { computeBufferTarget, type TransportableResource } from '@/ecs/logistics';

/**
 * Storage resource ordering and labels for consistent UI display.
 */
export const STORAGE_RESOURCE_ORDER: Array<keyof BuildableFactory['resources']> = [
  'ore',
  'bars',
  'metals',
  'crystals',
  'organics',
  'ice',
  'credits',
];

export const STORAGE_LABELS: Record<keyof BuildableFactory['resources'], string> = {
  ore: 'Ore',
  bars: 'Bars',
  metals: 'Metals',
  crystals: 'Crystals',
  organics: 'Organics',
  ice: 'Ice',
  credits: 'Credits',
};

/**
 * Format storage amount for display, with special handling for ore (includes capacity).
 */
export const formatStorageAmount = (
  key: keyof BuildableFactory['resources'],
  amount: number,
  storageCapacity?: number,
): string => {
  if (key === 'ore' && storageCapacity) {
    return `${Math.floor(amount).toLocaleString()} / ${storageCapacity.toLocaleString()}`;
  }
  return Math.floor(amount).toLocaleString();
};

/**
 * Build storage entries for display in the Storage section.
 */
export function buildStorageEntries(factory: BuildableFactory) {
  return STORAGE_RESOURCE_ORDER.map((key) => {
    const amount = factory.resources[key] ?? 0;
    const display = formatStorageAmount(key, amount, factory.storageCapacity);
    const bufferTarget = computeBufferTarget(factory, key as TransportableResource);

    return {
      key,
      label: STORAGE_LABELS[key] ?? key,
      amount,
      display,
      bufferTarget,
    };
  });
}
