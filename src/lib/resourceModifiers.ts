import { clamp } from '@/lib/math';
import {
  ICE_DRAIN_REDUCTION_FACTOR,
  ORGANICS_DRONE_OUTPUT_FACTOR,
  ORGANICS_ENERGY_REGEN_FACTOR,
  RESOURCE_BALANCE,
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
  const bonus = balance.cap * (1 - Math.exp(-safeAmount / scale));
  return clamp(bonus, 0, balance.cap);
};

const pickBonus = (resources: Resources, key: BalancedResource) =>
  computeBonus(resources[key] ?? 0, RESOURCE_BALANCE[key]);

export const getResourceModifiers = (resources: Resources): ResourceModifierSnapshot => {
  const metalsBonus = pickBonus(resources, 'metals');
  const crystalsBonus = pickBonus(resources, 'crystals');
  const organicsBonus = pickBonus(resources, 'organics');
  const iceBonus = pickBonus(resources, 'ice');

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
