import { Vector3 } from 'three';
import { getResourceModifiers, type ResourceModifierSnapshot } from '@/lib/resourceModifiers';
import type { BuildableFactory } from '@/ecs/factories';
import type {
  VectorTuple,
  StoreState,
  Modules,
  RefineryStats,
  FactoryUpgradeId,
  FactoryResources,
  FactoryUpgradeCostVariantId,
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
  FACTORY_MIN_DISTANCE,
  FACTORY_MAX_DISTANCE,
  FACTORY_PLACEMENT_ATTEMPTS,
  FACTORY_UPGRADE_GROWTH,
  emptyRefineryStats,
  factoryUpgradeDefinitions,
  FACTORY_SOLAR_BASE_REGEN,
  FACTORY_SOLAR_REGEN_PER_LEVEL,
  SOLAR_ARRAY_LOCAL_REGEN_PER_LEVEL,
  SOLAR_ARRAY_LOCAL_MAX_ENERGY_PER_LEVEL,
  WAREHOUSE_CONFIG,
} from './constants';

export const vector3ToTuple = (vector: Vector3): VectorTuple => [vector.x, vector.y, vector.z];

export const tupleToVector3 = (tuple: VectorTuple): Vector3 =>
  new Vector3(tuple[0], tuple[1], tuple[2]);

export const generateSeed = () => {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buffer = new Uint32Array(2);
    crypto.getRandomValues(buffer);
    return (buffer[0] << 16) ^ buffer[1];
  }
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
};

export const computeFactoryPlacement = (factories: BuildableFactory[]): Vector3 => {
  if (factories.length === 0) {
    return new Vector3(0, 0, 0);
  }

  const centroid = factories
    .reduce((acc, factory) => acc.add(factory.position), new Vector3())
    .divideScalar(factories.length);

  for (let attempt = 0; attempt < FACTORY_PLACEMENT_ATTEMPTS; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance =
      FACTORY_MIN_DISTANCE + Math.random() * (FACTORY_MAX_DISTANCE - FACTORY_MIN_DISTANCE);

    const candidate = new Vector3(
      centroid.x + Math.cos(angle) * distance,
      centroid.y,
      centroid.z + Math.sin(angle) * distance,
    );

    const distances = factories
      .map((factory) => candidate.distanceTo(factory.position))
      .sort((a, b) => a - b);

    const nearest = distances[0] ?? Number.POSITIVE_INFINITY;
    const secondNearest = distances[1] ?? nearest;

    if (nearest < FACTORY_MIN_DISTANCE) {
      continue;
    }
    if (nearest > FACTORY_MAX_DISTANCE) {
      continue;
    }
    if (factories.length > 1 && secondNearest > FACTORY_MAX_DISTANCE) {
      continue;
    }

    return candidate;
  }

  const index = factories.length;
  const ring = Math.floor(index / 6);
  const angle = (index % 6) * (Math.PI / 3);
  const radius = Math.min(
    FACTORY_MAX_DISTANCE,
    FACTORY_MIN_DISTANCE + ring * ((FACTORY_MAX_DISTANCE - FACTORY_MIN_DISTANCE) * 0.5),
  );

  return new Vector3(
    centroid.x + Math.cos(angle) * radius,
    centroid.y,
    centroid.z + Math.sin(angle) * radius,
  );
};

export const deriveProcessSequence = (factories: BuildableFactory[]): number => {
  let maxSequence = 0;
  for (const factory of factories) {
    for (const process of factory.activeRefines) {
      const match = /-p(\d+)$/.exec(process.id);
      if (match) {
        const value = Number.parseInt(match[1] ?? '0', 10);
        if (Number.isFinite(value)) {
          maxSequence = Math.max(maxSequence, value);
        }
      }
    }
  }
  return maxSequence;
};

export const computeFactoryUpgradeCost = (
  upgrade: FactoryUpgradeId,
  level: number,
  variant?: FactoryUpgradeCostVariantId,
): Partial<FactoryResources> => {
  const definition = factoryUpgradeDefinitions[upgrade];
  const baseCostMap =
    (variant && variant !== 'bars' ? definition.alternativeCosts?.[variant] : undefined) ??
    definition.baseCost;
  const result: Partial<FactoryResources> = {};
  for (const [key, value] of Object.entries(baseCostMap ?? {}) as [
    keyof FactoryResources,
    number,
  ][]) {
    result[key] = Math.ceil(value * Math.pow(FACTORY_UPGRADE_GROWTH, level));
  }
  return result;
};

export const getFactoryUpgradeCost = (
  upgrade: FactoryUpgradeId,
  level: number,
  variant?: FactoryUpgradeCostVariantId,
): Partial<FactoryResources> => computeFactoryUpgradeCost(upgrade, level, variant);

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
): number => {
  // Base capacity from factory upgrades (stored in factory.energyCapacity)
  // + bonus from global Solar Array module
  return factory.energyCapacity + getSolarArrayLocalMaxEnergy(solarArrayLevel);
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
  Math.ceil(base * Math.pow(GROWTH, level));

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

export const coerceNumber = (value: unknown, fallback: number) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};
