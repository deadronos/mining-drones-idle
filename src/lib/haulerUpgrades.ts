import type {
  Modules,
  HaulerConfig,
  FactoryHaulerUpgrades,
  HaulerModuleId,
  FactoryHaulerUpgradeId,
  Resources,
  FactoryResources,
} from '@/state/types';
import { calculateExponentialCost } from '@/lib/math';
import { LOGISTICS_CONFIG } from '@/ecs/logistics';
import {
  HAULER_DEPOT_CAPACITY_PER_LEVEL,
  HAULER_DEPOT_SPEED_MULT_PER_LEVEL,
  LOGISTICS_HUB_OVERHEAD_REDUCTION_PER_LEVEL,
  ROUTING_PROTOCOL_MATCHING_BONUS_PER_LEVEL,
  FACTORY_HAULER_CAPACITY_PER_LEVEL,
  FACTORY_HAULER_SPEED_PER_LEVEL,
  FACTORY_HAULER_EFFICIENCY_PER_LEVEL,
  haulerModuleDefinitions,
  factoryHaulerUpgradeDefinitions,
} from '@/state/constants';

export interface HaulerModuleBonuses {
  capacityBonus: number;
  speedMultiplier: number;
  pickupOverheadMultiplier: number;
  dropoffOverheadMultiplier: number;
  routingEfficiencyBonus: number;
}

export const getHaulerModuleBonuses = (modules: Modules): HaulerModuleBonuses => {
  const depotLevel = modules.haulerDepot ?? 0;
  const hubLevel = modules.logisticsHub ?? 0;
  const routingLevel = modules.routingProtocol ?? 0;

  const speedMultiplier = 1 + HAULER_DEPOT_SPEED_MULT_PER_LEVEL * depotLevel;
  const overheadReduction = LOGISTICS_HUB_OVERHEAD_REDUCTION_PER_LEVEL * hubLevel;
  const overheadMultiplier = Math.max(0.25, 1 - overheadReduction);

  return {
    capacityBonus: depotLevel * HAULER_DEPOT_CAPACITY_PER_LEVEL,
    speedMultiplier,
    pickupOverheadMultiplier: overheadMultiplier,
    dropoffOverheadMultiplier: overheadMultiplier,
    routingEfficiencyBonus: routingLevel * ROUTING_PROTOCOL_MATCHING_BONUS_PER_LEVEL,
  };
};

export interface ResolvedHaulerConfig extends HaulerConfig {
  routingEfficiencyBonus: number;
}

type ResolveParams = {
  baseConfig?: HaulerConfig;
  modules: Modules;
  upgrades?: FactoryHaulerUpgrades;
};

export const resolveFactoryHaulerConfig = ({
  baseConfig,
  modules,
  upgrades,
}: ResolveParams): ResolvedHaulerConfig => {
  const base: HaulerConfig = {
    capacity: baseConfig?.capacity ?? LOGISTICS_CONFIG.hauler_capacity,
    speed: baseConfig?.speed ?? LOGISTICS_CONFIG.hauler_speed,
    pickupOverhead: baseConfig?.pickupOverhead ?? LOGISTICS_CONFIG.pickup_overhead,
    dropoffOverhead: baseConfig?.dropoffOverhead ?? LOGISTICS_CONFIG.dropoff_overhead,
    resourceFilters: baseConfig?.resourceFilters ?? [],
    mode: baseConfig?.mode ?? 'auto',
    priority: baseConfig?.priority ?? 5,
  };

  const bonuses = getHaulerModuleBonuses(modules);
  const upgradedCapacity = base.capacity + bonuses.capacityBonus;
  const upgradedSpeed = base.speed * bonuses.speedMultiplier;
  const upgradedPickup = base.pickupOverhead * bonuses.pickupOverheadMultiplier;
  const upgradedDropoff = base.dropoffOverhead * bonuses.dropoffOverheadMultiplier;

  const capacityBoostLevels = upgrades?.capacityBoost ?? 0;
  const speedBoostLevels = upgrades?.speedBoost ?? 0;
  const efficiencyLevels = upgrades?.efficiencyBoost ?? 0;

  const capacityFromFactory = capacityBoostLevels * FACTORY_HAULER_CAPACITY_PER_LEVEL;
  const speedFromFactory = speedBoostLevels * FACTORY_HAULER_SPEED_PER_LEVEL;
  const efficiencyMultiplier = Math.max(
    0.2,
    1 - FACTORY_HAULER_EFFICIENCY_PER_LEVEL * efficiencyLevels,
  );

  return {
    capacity: Math.max(1, upgradedCapacity + capacityFromFactory),
    speed: Math.max(0.05, upgradedSpeed + speedFromFactory),
    pickupOverhead: Math.max(0, upgradedPickup * efficiencyMultiplier),
    dropoffOverhead: Math.max(0, upgradedDropoff * efficiencyMultiplier),
    resourceFilters: base.resourceFilters,
    mode: base.mode,
    priority: base.priority,
    routingEfficiencyBonus: bonuses.routingEfficiencyBonus,
  };
};

export const getHaulerModuleCost = (
  moduleId: HaulerModuleId,
  nextLevel: number,
): Partial<Resources> => {
  const definition = haulerModuleDefinitions[moduleId];
  const cost: Partial<Resources> = {};
  for (const [resource, amount] of Object.entries(definition.baseCost) as [
    keyof Resources,
    number,
  ][]) {
    cost[resource] = calculateExponentialCost(amount, definition.costGrowth, nextLevel - 1);
  }
  return cost;
};

export const getFactoryHaulerUpgradeCost = (
  upgradeId: FactoryHaulerUpgradeId,
  nextLevel: number,
): Partial<FactoryResources> => {
  const definition = factoryHaulerUpgradeDefinitions[upgradeId];
  const cost: Partial<FactoryResources> = {};
  for (const [resource, amount] of Object.entries(definition.baseCost) as [
    keyof FactoryResources,
    number,
  ][]) {
    cost[resource] = calculateExponentialCost(amount, definition.costGrowth, nextLevel - 1);
  }
  return cost;
};

export const getHaulerModuleMaxLevel = (moduleId: HaulerModuleId): number =>
  haulerModuleDefinitions[moduleId].maxLevel;

export const getFactoryHaulerUpgradeMaxLevel = (upgradeId: FactoryHaulerUpgradeId): number =>
  factoryHaulerUpgradeDefinitions[upgradeId].maxLevel;
