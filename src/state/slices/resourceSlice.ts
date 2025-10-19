import type { StateCreator } from 'zustand';
import type { StoreState, Resources, Modules } from '../types';
import {
  PRESTIGE_THRESHOLD,
  initialResources,
  initialModules,
  BASE_ENERGY_CAP,
  moduleDefinitions,
} from '../constants';
import { costForLevel, computePrestigeGain } from '../utils';
import { mergeResourceDelta } from '../serialization';

export interface ResourceSliceState {
  resources: Resources;
  modules: Modules;
  prestige: { cores: number };
}

export interface ResourceSliceMethods {
  addResources: (
    delta: Partial<Resources>,
    options?: { capacityAware?: boolean },
  ) => void;
  addOre: (amount: number) => void;
  buy: (moduleId: string) => void;
  prestigeReady: () => boolean;
  preview: () => number;
  doPrestige: () => void;
  setLastSave: (timestamp: number) => void;
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
      return {
        prestige,
        resources: { ...initialResources, energy: BASE_ENERGY_CAP },
        modules: { ...initialModules },
        droneFlights: [],
      };
    });
  },

  setLastSave: (timestamp) => {
    set((state) => ({ save: { ...state.save, lastSave: timestamp } }));
  },
});
