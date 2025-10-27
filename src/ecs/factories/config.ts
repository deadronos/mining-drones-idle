/**
 * Factory configuration constants and cost calculations.
 */

import type { FactoryResources, FactoryUpgrades } from './models';

/**
 * Factory configuration with sensible defaults.
 */
export const FACTORY_CONFIG = {
  baseCost: { metals: 100, crystals: 50 },
  dockingCapacity: 3,
  refineSlots: 2,
  refineTime: 10, // seconds per batch
  idleEnergyPerSec: 1,
  energyPerRefine: 2,
  storageCapacity: 300,
  energyCapacity: 80,
  initialEnergy: 40,
  priceScaleIncrement: 50, // linear price scaling
} as const;

/**
 * Computes the cost to purchase the Nth factory (0-indexed).
 * Uses linear scaling: base + n * increment.
 */
export const computeFactoryCost = (factoryCount: number) => {
  const n = factoryCount; // 0-indexed
  const baseCost = FACTORY_CONFIG.baseCost;
  const priceIncrease = FACTORY_CONFIG.priceScaleIncrement * n;
  return {
    metals: baseCost.metals + priceIncrease,
    crystals: baseCost.crystals + priceIncrease,
  };
};

/**
 * Computes total energy upkeep for all factories.
 * Scales linearly: count * idleEnergyPerSec.
 */
export const computeFactoryEnergyUpkeep = (factoryCount: number): number =>
  factoryCount * FACTORY_CONFIG.idleEnergyPerSec;

/**
 * Helper to compute upgrade cost by ID and level.
 * Uses the same logic as state/utils.ts computeFactoryUpgradeCost.
 */
export const computeUpgradeCost = (
  upgradeId: keyof FactoryUpgrades,
  currentLevel: number,
): Partial<FactoryResources> => {
  const upgradeMap: Record<
    keyof FactoryUpgrades,
    { baseCost: Partial<FactoryResources>; growth: number }
  > = {
    docking: {
      baseCost: { bars: 1350 },
      growth: 1.35,
    },
    refine: {
      baseCost: { bars: 1350 },
      growth: 1.35,
    },
    storage: {
      baseCost: { bars: 1350 },
      growth: 1.35,
    },
    energy: {
      baseCost: { bars: 1350 },
      growth: 1.35,
    },
    solar: {
      baseCost: { bars: 1350 },
      growth: 1.35,
    },
  };

  const def = upgradeMap[upgradeId];
  if (!def) return {};

  const result: Partial<FactoryResources> = {};
  for (const [key, value] of Object.entries(def.baseCost)) {
    if (typeof value === 'number') {
      result[key as keyof FactoryResources] = Math.ceil(value * Math.pow(def.growth, currentLevel));
    }
  }
  return result;
};
