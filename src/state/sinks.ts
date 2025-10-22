import { prestigeInvestmentDefinitions, specTechDefinitions } from './constants';
import type {
  PrestigeInvestmentId,
  SpecTechId,
  StoreState,
  SpecTechState,
  SpecTechSpentState,
  PrestigeInvestmentState,
} from './types';

export const getSpecTechLevel = (state: SpecTechState, techId: SpecTechId) => state[techId] ?? 0;

export const getSpecTechCost = (techId: SpecTechId, level: number) => {
  const definition = specTechDefinitions[techId];
  const cost = definition.baseCost * Math.pow(definition.costGrowth, level);
  return Math.ceil(cost);
};

export const getSpecTechUnlockProgress = (
  spent: SpecTechSpentState,
  techId: SpecTechId,
): { unlocked: boolean; spent: number; required: number } => {
  const definition = specTechDefinitions[techId];
  const resourceKey = definition.resource;
  const resourceSpent = spent[resourceKey] ?? 0;
  return {
    unlocked: resourceSpent >= definition.unlockAt,
    spent: resourceSpent,
    required: definition.unlockAt,
  };
};

export const getPrestigeInvestmentCost = (investmentId: PrestigeInvestmentId, level: number) => {
  const definition = prestigeInvestmentDefinitions[investmentId];
  const cost = definition.baseCost * Math.pow(definition.growthFactor, level);
  return Math.ceil(cost);
};

export interface SinkBonuses {
  oreYieldMultiplier: number;
  droneSpeedMultiplier: number;
  asteroidRichnessMultiplier: number;
  asteroidSpawnMultiplier: number;
  refineryYieldMultiplier: number;
  offlineProgressMultiplier: number;
}

const clampMultiplier = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 1);

export const getSinkBonuses = (
  state: Pick<StoreState, 'specTechs' | 'prestigeInvestments'>,
): SinkBonuses => {
  const { specTechs, prestigeInvestments } = state;
  const oreBonus = (specTechs.oreMagnet ?? 0) * specTechDefinitions.oreMagnet.bonusPerLevel;
  const crystalBonus = (specTechs.crystalResonance ?? 0) * specTechDefinitions.crystalResonance.bonusPerLevel;
  const biotechBonus = (specTechs.biotechFarming ?? 0) * specTechDefinitions.biotechFarming.bonusPerLevel;
  const cryoBonus = (specTechs.cryoPreservation ?? 0) * specTechDefinitions.cryoPreservation.bonusPerLevel;

  const velocityBonus =
    (prestigeInvestments.droneVelocity ?? 0) *
    prestigeInvestmentDefinitions.droneVelocity.bonusPerTier;
  const spawnBonus =
    (prestigeInvestments.asteroidAbundance ?? 0) *
    prestigeInvestmentDefinitions.asteroidAbundance.bonusPerTier;
  const refineryBonus =
    (prestigeInvestments.refineryMastery ?? 0) *
    prestigeInvestmentDefinitions.refineryMastery.bonusPerTier;
  const offlineBonus =
    (prestigeInvestments.offlineEfficiency ?? 0) *
    prestigeInvestmentDefinitions.offlineEfficiency.bonusPerTier;

  const oreYieldMultiplier = clampMultiplier(1 + oreBonus);
  const droneSpeedMultiplier = clampMultiplier(1 + velocityBonus);
  const asteroidRichnessMultiplier = clampMultiplier((1 + crystalBonus) * (1 + spawnBonus));
  const asteroidSpawnMultiplier = clampMultiplier(1 + spawnBonus);
  const refineryYieldMultiplier = clampMultiplier((1 + biotechBonus) * (1 + refineryBonus));
  const offlineProgressMultiplier = clampMultiplier((1 + cryoBonus) * (1 + offlineBonus));

  return {
    oreYieldMultiplier,
    droneSpeedMultiplier,
    asteroidRichnessMultiplier,
    asteroidSpawnMultiplier,
    refineryYieldMultiplier,
    offlineProgressMultiplier,
  };
};

export const getPrestigeInvestmentLevel = (
  state: PrestigeInvestmentState,
  investmentId: PrestigeInvestmentId,
) => state[investmentId] ?? 0;

export const getSpecTechMaxLevel = (techId: SpecTechId) => specTechDefinitions[techId].maxLevel;
