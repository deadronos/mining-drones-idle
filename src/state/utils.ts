import { Vector3 } from 'three';
import { calculateExponentialCost } from '@/lib/math';
import { getResourceModifiers, type ResourceModifierSnapshot } from '@/lib/resourceModifiers';
import type { BuildableFactory } from '@/ecs/factories';
import type {
  VectorTuple,
  StoreState,
  Modules,
  RefineryStats,
  FactoryUpgradeId,
  FactoryUpgradeCostVariantId,
  FactoryResources,
} from './types';
import { getSinkBonuses } from './sinks';
import {
  GROWTH,
  BASE_REFINERY_RATE,
  ORE_PER_BAR,
  ORE_CONVERSION_PER_SECOND,
  BASE_STORAGE,
  STORAGE_PER_LEVEL,
  BASE_ENERGY_CAP,
  ENERGY_PER_SOLAR,
  SOLAR_BASE_GEN,
  DRONE_ENERGY_COST,
  FACTORY_UPGRADE_GROWTH,
  emptyRefineryStats,
  FACTORY_SOLAR_BASE_REGEN,
  FACTORY_SOLAR_REGEN_PER_LEVEL,
  SOLAR_ARRAY_LOCAL_REGEN_PER_LEVEL,
  SOLAR_ARRAY_LOCAL_MAX_ENERGY_PER_LEVEL,
  WAREHOUSE_CONFIG,
} from './constants';

import { computeUpgradeCost } from '@/ecs/factories/config';

// Re-exports from lib/utils
export {
  vector3ToTuple,
  tupleToVector3,
  generateUniqueId,
  coerceNumber,
} from '@/lib/utils';

// Re-exports from lib/rng
export { generateSeed } from '@/lib/rng';

// Re-exports from ecs/factories
export { computeFactoryPlacement } from '@/ecs/factories/placement';
export { deriveProcessSequence } from '@/ecs/factories/refining';

// Alias for compatibility
export const computeFactoryUpgradeCost = computeUpgradeCost;
export const getFactoryUpgradeCost = computeUpgradeCost;

export const getFactorySolarRegen = (level: number): number => {
  // Base 0.25 regen available at level 0 (not purchased)
  // Each upgrade level adds 0.5 more
  return FACTORY_SOLAR_BASE_REGEN + FACTORY_SOLAR_REGEN_PER_LEVEL * level;
};

export const getSolarArrayLocalRegen = (level: number): number => {
  if (level <= 0) return 0;
  return SOLAR_ARRAY_LOCAL_REGEN_PER_LEVEL * level;
};

export const getSolarArrayLocalMaxEnergy = (level: number): number => {
  if (level <= 0) return 0;
  return SOLAR_ARRAY_LOCAL_MAX_ENERGY_PER_LEVEL * level;
};

export const getFactoryEffectiveEnergyCapacity = (
  factory: BuildableFactory,
  solarArrayLevel: number,
  modifiers?: ResourceModifierSnapshot,
): number => {
  // Base capacity from factory upgrades (stored in factory.energyCapacity)
  // + bonus from global Solar Array module
  const base = factory.energyCapacity + getSolarArrayLocalMaxEnergy(solarArrayLevel);
  return base * (modifiers?.energyStorageMultiplier ?? 1);
};

export const computeRefineryProduction = (
  state: Pick<
    StoreState,
    'resources' | 'modules' | 'prestige' | 'specTechs' | 'prestigeInvestments'
  >,
  dt: number,
): RefineryStats => {
  if (dt <= 0) return emptyRefineryStats;
  const oreAvailable = state.resources.ore;
  if (oreAvailable <= 0) {
    return emptyRefineryStats;
  }
  const prestigeMult = computePrestigeBonus(state.prestige.cores);
  const refineryMult = Math.pow(1.1, state.modules.refinery);
  const modifiers = getResourceModifiers(state.resources, state.prestige.cores);
  const sinkBonuses = getSinkBonuses(state);
  const oreConsumed = Math.min(oreAvailable, ORE_CONVERSION_PER_SECOND * dt);
  if (oreConsumed <= 0) {
    return emptyRefineryStats;
  }
  const barsProduced =
    (oreConsumed / ORE_PER_BAR) *
    BASE_REFINERY_RATE *
    refineryMult *
    prestigeMult *
    modifiers.refineryYieldMultiplier *
    sinkBonuses.refineryYieldMultiplier;
  return { oreConsumed, barsProduced };
};

export const applyRefineryProduction = (state: StoreState, stats: RefineryStats) => ({
  resources: {
    ...state.resources,
    ore: Math.max(0, state.resources.ore - stats.oreConsumed),
    bars: state.resources.bars + stats.barsProduced,
  },
});

export const costForLevel = (base: number, level: number) =>
  calculateExponentialCost(base, GROWTH, level);

export const computePrestigeGain = (bars: number) => Math.floor(Math.pow(bars / 1_000, 0.6));

export const computePrestigeBonus = (cores: number) => {
  const capped = Math.min(cores, 100);
  const overflow = Math.max(0, cores - 100);
  return 1 + 0.05 * capped + 0.02 * overflow;
};

export const getStorageCapacity = (modules: Modules, modifiers?: ResourceModifierSnapshot) => {
  const base = BASE_STORAGE + modules.storage * STORAGE_PER_LEVEL;
  return base * (modifiers?.storageCapacityMultiplier ?? 1);
};

export const computeWarehouseCapacity = (modules: Modules, modifiers?: ResourceModifierSnapshot) =>
  getStorageCapacity(modules, modifiers) * WAREHOUSE_CONFIG.storageMultiplier;

export const getEnergyCapacity = (modules: Modules, modifiers?: ResourceModifierSnapshot) => {
  const base = BASE_ENERGY_CAP + modules.solar * ENERGY_PER_SOLAR;
  return base * (modifiers?.energyStorageMultiplier ?? 1);
};

export const getEnergyGeneration = (modules: Modules, modifiers?: ResourceModifierSnapshot) =>
  SOLAR_BASE_GEN * (modules.solar + 1) * (modifiers?.energyGenerationMultiplier ?? 1);

export const getEnergyConsumption = (
  _modules: Modules,
  drones: number,
  modifiers?: ResourceModifierSnapshot,
) => drones * DRONE_ENERGY_COST * (modifiers?.energyDrainMultiplier ?? 1);

export const computeEnergyThrottle = (
  state: Pick<StoreState, 'resources' | 'modules' | 'settings' | 'prestige'>,
) => {
  const modifiers = getResourceModifiers(state.resources, state.prestige.cores);
  const capacity = getEnergyCapacity(state.modules, modifiers);
  if (capacity <= 0) {
    return 1;
  }
  const normalized = Math.max(0, Math.min(1, state.resources.energy / capacity));
  return Math.max(state.settings.throttleFloor, normalized);
};
