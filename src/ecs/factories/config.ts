/**
 * Factory configuration constants and cost calculations.
 */

import { calculateExponentialCost } from '@/lib/math';
import type { FactoryResources, FactoryUpgrades } from './models';

/**
 * Factory configuration with sensible defaults.
 * Defines base costs, capacities, and rates for new factories.
 */
export const FACTORY_CONFIG = {
  /** Base cost to build the first factory. */
  baseCost: { metals: 100, crystals: 50 },
  /** Default docking capacity (number of drones). */
  dockingCapacity: 3,
  /** Default number of refining slots. */
  refineSlots: 2,
  /** Time in seconds to process one batch. */
  refineTime: 10,
  /** Energy consumed per second when idle. */
  idleEnergyPerSec: 1,
  /** Energy consumed per active refining process. */
  energyPerRefine: 2,
  /** Default storage capacity for resources. */
  storageCapacity: 300,
  /** Default energy storage capacity. */
  energyCapacity: 80,
  /** Initial energy level for new factories. */
  initialEnergy: 40,
  /** Linear price increment for each subsequent factory. */
  priceScaleIncrement: 50,
} as const;

export const FACTORY_MIN_DISTANCE = 10;
export const FACTORY_MAX_DISTANCE = 50;
export const FACTORY_PLACEMENT_ATTEMPTS = 100;
export const FACTORY_UPGRADE_GROWTH = 1.35;

export const FACTORY_SOLAR_BASE_REGEN = 1.25;
export const FACTORY_SOLAR_REGEN_PER_LEVEL = 0.5;
export const FACTORY_SOLAR_MAX_ENERGY_PER_LEVEL = 10;

export const FACTORY_UPGRADE_CONFIG = {
  docking: {
    baseCost: { bars: 13 },
    alternativeCosts: {
      metals: { metals: 50 },
    },
    growth: FACTORY_UPGRADE_GROWTH,
  },
  refine: {
    baseCost: { bars: 13 },
    alternativeCosts: {
      organics: { organics: 25, metals: 25 },
    },
    growth: FACTORY_UPGRADE_GROWTH,
  },
  storage: {
    baseCost: { bars: 13 },
    alternativeCosts: {
      organics: { organics: 20 },
    },
    growth: FACTORY_UPGRADE_GROWTH,
  },
  energy: {
    baseCost: { bars: 13 },
    alternativeCosts: {
      ice: { ice: 30, metals: 15 },
    },
    growth: FACTORY_UPGRADE_GROWTH,
  },
  solar: {
    baseCost: { bars: 13 },
    alternativeCosts: {
      crystals: { crystals: 25, metals: 10 },
    },
    growth: FACTORY_UPGRADE_GROWTH,
  },
} as const;

/**
 * Computes the cost to purchase the Nth factory (0-indexed).
 * Uses linear scaling: base + n * increment.
 *
 * @param factoryCount - The number of factories already owned (or index of next factory).
 * @returns The resource cost for the next factory.
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
 *
 * @param factoryCount - The total number of factories.
 * @returns The total energy consumed per second by idle factories.
 */
export const computeFactoryEnergyUpkeep = (factoryCount: number): number =>
  factoryCount * FACTORY_CONFIG.idleEnergyPerSec;

/**
 * Helper to compute upgrade cost by ID and level.
 * Uses exponential growth for cost scaling.
 *
 * @param upgradeId - The ID of the upgrade (e.g., 'docking').
 * @param currentLevel - The current level of the upgrade.
 * @param variant - Optional variant ID for alternative costs.
 * @returns The resource cost for the next level.
 */
export const computeUpgradeCost = (
  upgradeId: keyof FactoryUpgrades,
  currentLevel: number,
  variant?: string,
): Partial<FactoryResources> => {
  const def = FACTORY_UPGRADE_CONFIG[upgradeId];
  if (!def) return {};

  let baseCostMap = def.baseCost;

  if (variant && 'alternativeCosts' in def) {
    const alt = (def.alternativeCosts as any)[variant];
    if (alt) {
      baseCostMap = alt;
    }
  }

  const result: Partial<FactoryResources> = {};
  for (const [key, value] of Object.entries(baseCostMap)) {
    if (typeof value === 'number') {
      result[key as keyof FactoryResources] = calculateExponentialCost(
        value,
        def.growth,
        currentLevel,
      );
    }
  }
  return result;
};
