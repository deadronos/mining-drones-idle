import { clamp } from '@/lib/math';
import {
  ICE_DRAIN_REDUCTION_FACTOR,
  ORGANICS_DRONE_OUTPUT_FACTOR,
  ORGANICS_ENERGY_REGEN_FACTOR,
  RESOURCE_BALANCE,
  getBalanceWithPrestige,
  type BalancedResource,
  type ResourceBalanceEntry,
} from '@/config/resourceBalance';
import type { Resources } from '@/state/store';

export interface ResourceModifierSnapshot {
  metalsBonus: number;
  crystalsBonus: number;
  organicsBonus: number;
  iceBonus: number;
  droneCapacityMultiplier: number;
  droneBatteryMultiplier: number;
  storageCapacityMultiplier: number;
  refineryYieldMultiplier: number;
  droneProductionSpeedMultiplier: number;
  energyGenerationMultiplier: number;
  energyStorageMultiplier: number;
  energyDrainMultiplier: number;
}

const computeBonus = (amount: number, balance: ResourceBalanceEntry) => {
  const safeAmount = Math.max(0, amount);
  const scale = balance.scale > 0 ? balance.scale : 1;
  const cap = balance.cap;

  // Primary saturation curve reaches ~99% of cap at 5*scale
  const primaryBonus = cap * (1 - Math.exp(-safeAmount / scale));

  // Soft cap: resources beyond saturation point still contribute
  // at 1/10th the rate, creating unbounded but diminishing returns
  const saturationPoint = scale * 5;
  const overflow = Math.max(0, safeAmount - saturationPoint);
  const overflowBonus = (overflow / (scale * 10)) * cap;

  return Math.max(0, primaryBonus + overflowBonus);
};

const pickBonus = (resources: Resources, key: BalancedResource, prestigeCores = 0) => {
  const balance = getBalanceWithPrestige(RESOURCE_BALANCE[key], prestigeCores);
  return computeBonus(resources[key] ?? 0, balance);
};

export const getResourceModifiers = (
  resources: Resources,
  prestigeCores = 0,
): ResourceModifierSnapshot => {
  const metalsBonus = pickBonus(resources, 'metals', prestigeCores);
  const crystalsBonus = pickBonus(resources, 'crystals', prestigeCores);
  const organicsBonus = pickBonus(resources, 'organics', prestigeCores);
  const iceBonus = pickBonus(resources, 'ice', prestigeCores);

  const droneBatteryMultiplier = 1 + metalsBonus;
  const droneCapacityMultiplier = 1 + metalsBonus;
  const storageCapacityMultiplier = 1 + metalsBonus;
  const refineryYieldMultiplier = 1 + crystalsBonus;
  const droneProductionSpeedMultiplier = 1 + ORGANICS_DRONE_OUTPUT_FACTOR * organicsBonus;
  const energyGenerationMultiplier = 1 + ORGANICS_ENERGY_REGEN_FACTOR * organicsBonus;
  const energyStorageMultiplier = 1 + iceBonus;
  const energyDrainMultiplier = clamp(1 - ICE_DRAIN_REDUCTION_FACTOR * iceBonus, 0.5, 1);

  return {
    metalsBonus,
    crystalsBonus,
    organicsBonus,
    iceBonus,
    droneCapacityMultiplier,
    droneBatteryMultiplier,
    storageCapacityMultiplier,
    refineryYieldMultiplier,
    droneProductionSpeedMultiplier,
    energyGenerationMultiplier,
    energyStorageMultiplier,
    energyDrainMultiplier,
  };
};
