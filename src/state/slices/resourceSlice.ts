import type { StateCreator } from 'zustand';
import type {
  StoreState,
  Resources,
  Modules,
  SpecTechState,
  SpecTechSpentState,
  PrestigeInvestmentState,
  SpecTechId,
  PrestigeInvestmentId,
} from '../types';
import {
  PRESTIGE_THRESHOLD,
  initialResources,
  initialModules,
  BASE_ENERGY_CAP,
  moduleDefinitions,
  initialSave,
  initialSpecTechs,
  initialSpecTechSpent,
  initialPrestigeInvestments,
  specTechDefinitions,
  prestigeInvestmentDefinitions,
} from '../constants';
import { costForLevel, computePrestigeGain } from '../utils';
import {
  getSpecTechCost,
  getSpecTechLevel,
  getSpecTechUnlockProgress,
  getPrestigeInvestmentCost,
  getSpecTechMaxLevel,
} from '../sinks';
import { mergeResourceDelta } from '@/lib/resourceMerging';
import { createDefaultFactories } from '../factory';
import { generateSeed, deriveProcessSequence } from '../utils';

export interface ResourceSliceState {
  resources: Resources;
  modules: Modules;
  prestige: { cores: number };
  specTechs: SpecTechState;
  specTechSpent: SpecTechSpentState;
  prestigeInvestments: PrestigeInvestmentState;
}

export interface ResourceSliceMethods {
  addResources: (delta: Partial<Resources>, options?: { capacityAware?: boolean }) => void;
  addOre: (amount: number) => void;
  buy: (moduleId: string) => void;
  prestigeReady: () => boolean;
  preview: () => number;
  doPrestige: () => void;
  setLastSave: (timestamp: number) => void;
  purchaseSpecTech: (techId: SpecTechId) => boolean;
  investPrestige: (investmentId: PrestigeInvestmentId) => boolean;
}

export const createResourceSlice: StateCreator<
  StoreState,
  [],
  [],
  ResourceSliceState & ResourceSliceMethods
> = (set, get) => ({
  resources: { ...initialResources },
  modules: { ...initialModules },
  prestige: { cores: 0 },
  specTechs: { ...initialSpecTechs },
  specTechSpent: { ...initialSpecTechSpent },
  prestigeInvestments: { ...initialPrestigeInvestments },

  addResources: (delta, options) => {
    set((state) => {
      const capacityAware = options?.capacityAware ?? true;
      const resources = mergeResourceDelta(
        state.resources,
        delta ?? {},
        state.modules,
        capacityAware,
        state.prestige.cores,
      );
      return { resources };
    });
  },

  addOre: (amount) => {
    get().addResources({ ore: amount });
  },

  buy: (id) => {
    set((state) => {
      const definition = moduleDefinitions[id as keyof typeof moduleDefinitions];
      if (!definition) {
        return state;
      }
      const currentLevel = (state.modules as unknown as Record<string, number>)[id] ?? 0;
      const cost = costForLevel(definition.baseCost, currentLevel);
      if (state.resources.bars < cost) {
        return state;
      }
      const resources: Resources = { ...state.resources, bars: state.resources.bars - cost };
      const modules: Modules = { ...state.modules, [id as keyof Modules]: currentLevel + 1 };
      return { resources, modules };
    });
  },

  purchaseSpecTech: (techId) => {
    let purchased = false;
    set((state) => {
      const definition = specTechDefinitions[techId];
      if (!definition) {
        return state;
      }
      const currentLevel = getSpecTechLevel(state.specTechs, techId);
      if (currentLevel >= getSpecTechMaxLevel(techId)) {
        return state;
      }
      const { unlocked } = getSpecTechUnlockProgress(state.specTechSpent, techId);
      if (!unlocked) {
        return state;
      }
      const cost = getSpecTechCost(techId, currentLevel);
      const resourceKey = definition.resource;
      const available = state.resources[resourceKey] ?? 0;
      if (available < cost) {
        return state;
      }
      const resources: Resources = {
        ...state.resources,
        [resourceKey]: available - cost,
      };
      const specTechs: SpecTechState = {
        ...state.specTechs,
        [techId]: currentLevel + 1,
      };
      const specTechSpent: SpecTechSpentState = {
        ...state.specTechSpent,
        [resourceKey]: (state.specTechSpent[resourceKey] ?? 0) + cost,
      };
      purchased = true;
      return { resources, specTechs, specTechSpent };
    });
    return purchased;
  },

  investPrestige: (investmentId) => {
    let invested = false;
    set((state) => {
      const definition = prestigeInvestmentDefinitions[investmentId];
      if (!definition) {
        return state;
      }
      const currentLevel = state.prestigeInvestments[investmentId] ?? 0;
      const cost = getPrestigeInvestmentCost(investmentId, currentLevel);
      const resourceKey = definition.resource;
      const available = state.resources[resourceKey] ?? 0;
      if (available < cost) {
        return state;
      }
      const resources: Resources = {
        ...state.resources,
        [resourceKey]: available - cost,
      };
      const prestigeInvestments: PrestigeInvestmentState = {
        ...state.prestigeInvestments,
        [investmentId]: currentLevel + 1,
      };
      invested = true;
      return { resources, prestigeInvestments };
    });
    return invested;
  },

  prestigeReady: () => {
    return get().resources.bars >= PRESTIGE_THRESHOLD;
  },

  preview: () => {
    return computePrestigeGain(get().resources.bars);
  },

  doPrestige: () => {
    set((state) => {
      if (state.resources.bars < PRESTIGE_THRESHOLD) {
        return state;
      }
      const gain = computePrestigeGain(state.resources.bars);
      const prestige = { cores: state.prestige.cores + gain };
      const factories = createDefaultFactories();
      const selectedFactoryId = factories[0]?.id ?? null;
      return {
        prestige,
        resources: { ...initialResources, energy: BASE_ENERGY_CAP },
        modules: { ...initialModules },
        specTechs: { ...initialSpecTechs },
        specTechSpent: { ...initialSpecTechSpent },
        prestigeInvestments: { ...state.prestigeInvestments },
        droneFlights: [],
        droneOwners: {},
        factories,
        logisticsQueues: { pendingTransfers: [] },
        logisticsTick: 0,
        gameTime: 0,
        factoryProcessSequence: deriveProcessSequence(factories),
        factoryRoundRobin: 0,
        factoryAutofitSequence: 0,
        cameraResetSequence: 0,
        selectedAsteroidId: null,
        selectedFactoryId,
        rngSeed: generateSeed(),
        save: { ...initialSave, lastSave: Date.now() },
      };
    });
  },

  setLastSave: (timestamp) => {
    set((state) => ({ save: { ...state.save, lastSave: timestamp } }));
  },
});
