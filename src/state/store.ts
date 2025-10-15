import { create } from 'zustand';
import {
  createStore as createVanillaStore,
  type StateCreator,
  type StoreApi,
} from 'zustand/vanilla';

const GROWTH = 1.15;
const PRESTIGE_THRESHOLD = 5_000;
const BASE_REFINERY_RATE = 1;
const ORE_PER_BAR = 10;
const ORE_CONVERSION_PER_SECOND = 10;
const BASE_STORAGE = 400;
const STORAGE_PER_LEVEL = 100;
const BASE_ENERGY_CAP = 100;
const ENERGY_PER_SOLAR = 25;
const SOLAR_BASE_GEN = 5;
const DRONE_ENERGY_COST = 1.2;

export const moduleDefinitions = {
  droneBay: { label: 'Drone Bay', baseCost: 50, description: '+1 drone, +5% travel speed' },
  refinery: { label: 'Refinery', baseCost: 80, description: '+10% bar output' },
  storage: { label: 'Storage', baseCost: 30, description: '+100 ore capacity' },
  solar: { label: 'Solar Array', baseCost: 40, description: '+5 energy/s, +25 max energy' },
  scanner: { label: 'Scanner', baseCost: 120, description: '+5% new asteroid richness' },
} as const;

export type ModuleId = keyof typeof moduleDefinitions;

export interface Resources {
  ore: number;
  bars: number;
  energy: number;
  credits: number;
}

export interface Modules {
  droneBay: number;
  refinery: number;
  storage: number;
  solar: number;
  scanner: number;
}

export interface Prestige {
  cores: number;
}

export interface SaveMeta {
  lastSave: number;
  version: string;
}

export interface StoreState {
  resources: Resources;
  modules: Modules;
  prestige: Prestige;
  save: SaveMeta;
  addOre(amount: number): void;
  buy(id: ModuleId): void;
  tick(dt: number): void;
  prestigeReady(): boolean;
  preview(): number;
  doPrestige(): void;
  setLastSave(timestamp: number): void;
}

export const costForLevel = (base: number, level: number) =>
  Math.ceil(base * Math.pow(GROWTH, level));

export const computePrestigeGain = (bars: number) => Math.floor(Math.pow(bars / 1_000, 0.6));

export const computePrestigeBonus = (cores: number) => {
  const capped = Math.min(cores, 100);
  const overflow = Math.max(0, cores - 100);
  return 1 + 0.05 * capped + 0.02 * overflow;
};

export const getStorageCapacity = (modules: Modules) =>
  BASE_STORAGE + modules.storage * STORAGE_PER_LEVEL;

export const getEnergyCapacity = (modules: Modules) =>
  BASE_ENERGY_CAP + modules.solar * ENERGY_PER_SOLAR;

export const getEnergyGeneration = (modules: Modules) => SOLAR_BASE_GEN * (modules.solar + 1);

export const getEnergyConsumption = (_modules: Modules, drones: number) =>
  drones * DRONE_ENERGY_COST;

const initialResources: Resources = { ore: 0, bars: 0, energy: BASE_ENERGY_CAP, credits: 0 };
const initialModules: Modules = { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0 };
const initialPrestige: Prestige = { cores: 0 };
const initialSave: SaveMeta = { lastSave: Date.now(), version: '0.1.0' };

const storeCreator: StateCreator<StoreState> = (set, get) => ({
  resources: { ...initialResources },
  modules: { ...initialModules },
  prestige: { ...initialPrestige },
  save: { ...initialSave },

  addOre: (amount) =>
    set((state) => {
      const capacity = getStorageCapacity(state.modules);
      const ore = Math.min(capacity, state.resources.ore + amount);
      return { resources: { ...state.resources, ore } };
    }),

  buy: (id) =>
    set((state) => {
      const definition = moduleDefinitions[id];
      const currentLevel = state.modules[id];
      const cost = costForLevel(definition.baseCost, currentLevel);
      if (state.resources.bars < cost) return state;
      const resources: Resources = { ...state.resources, bars: state.resources.bars - cost };
      const modules: Modules = { ...state.modules, [id]: currentLevel + 1 };
      return { resources, modules };
    }),

  tick: (dt) => {
    if (dt <= 0) return;
    const state = get();
    const prestigeMult = computePrestigeBonus(state.prestige.cores);
    const refineryMult = Math.pow(1.1, state.modules.refinery);
    const oreConversion = Math.min(state.resources.ore, ORE_CONVERSION_PER_SECOND * dt);
    const barsProduced =
      (oreConversion / ORE_PER_BAR) * BASE_REFINERY_RATE * refineryMult * prestigeMult;
    const nextOre = state.resources.ore - oreConversion;
    const nextBars = state.resources.bars + barsProduced;
    set({ resources: { ...state.resources, ore: nextOre, bars: nextBars } });
  },

  prestigeReady: () => get().resources.bars >= PRESTIGE_THRESHOLD,

  preview: () => computePrestigeGain(get().resources.bars),

  doPrestige: () =>
    set((state) => {
      if (state.resources.bars < PRESTIGE_THRESHOLD) return state;
      const gain = computePrestigeGain(state.resources.bars);
      const prestige = { cores: state.prestige.cores + gain };
      return {
        prestige,
        resources: { ...initialResources, energy: BASE_ENERGY_CAP },
        modules: { ...initialModules },
      };
    }),

  setLastSave: (timestamp) => set((state) => ({ save: { ...state.save, lastSave: timestamp } })),
});

export const createStoreInstance = () => createVanillaStore<StoreState>(storeCreator);

export const useStore = create<StoreState>()(storeCreator);

export type StoreApiType = StoreApi<StoreState>;

export const storeApi = useStore as unknown as StoreApiType;
