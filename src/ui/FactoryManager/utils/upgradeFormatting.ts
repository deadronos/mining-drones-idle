import type { BuildableFactory } from '@/ecs/factories';

/**
 * Check if a value is a valid finite cost entry (non-zero number).
 */
const isFiniteCostEntry = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value !== 0;

/**
 * Format a cost object into a human-readable string.
 * Example: { metals: 10, crystals: 5 } → "10 metals + 5 crystals"
 */
export const formatCost = (cost: Partial<Record<string, number>>): string =>
  Object.entries(cost)
    .filter((entry): entry is [string, number] => isFiniteCostEntry(entry[1]))
    .map(([key, value]) => `${Math.ceil(value)} ${key}`)
    .join(' + ');

/**
 * Check if a factory has sufficient resources to afford a cost.
 */
export const hasResources = (
  factory: BuildableFactory,
  cost: Partial<Record<string, number>>,
): boolean =>
  Object.entries(cost).every(([key, value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return true;
    }
    const ledgerValue = factory.resources[key as keyof BuildableFactory['resources']];
    return (ledgerValue ?? 0) >= value;
  });
