import { create } from 'zustand';
import {
  createStore as createVanillaStore,
  type StateCreator,
  type StoreApi,
} from 'zustand/vanilla';

const SAVE_VERSION = '0.1.0';

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

const initialSettings: StoreSettings = {
  autosaveEnabled: true,
  autosaveInterval: 10,
  offlineCapHours: 8,
  notation: 'standard',
  throttleFloor: 0.25,
};

export const saveVersion = SAVE_VERSION;

const generateSeed = () => {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buffer = new Uint32Array(2);
    crypto.getRandomValues(buffer);
    return (buffer[0] << 16) ^ buffer[1];
  }
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
};

export const moduleDefinitions = {
  droneBay: { label: 'Drone Bay', baseCost: 40, description: '+1 drone, +5% travel speed' },
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

export type NotationMode = 'standard' | 'engineering';

export interface StoreSettings {
  autosaveEnabled: boolean;
  autosaveInterval: number;
  offlineCapHours: number;
  notation: NotationMode;
  throttleFloor: number;
}

export interface RefineryStats {
  oreConsumed: number;
  barsProduced: number;
}

export interface StoreSnapshot {
  resources: Resources;
  modules: Modules;
  prestige: Prestige;
  save: SaveMeta;
  settings: StoreSettings;
  rngSeed?: number;
}

export interface StoreState {
  resources: Resources;
  modules: Modules;
  prestige: Prestige;
  save: SaveMeta;
  settings: StoreSettings;
  rngSeed: number;
  addOre(this: void, amount: number): void;
  buy(this: void, id: ModuleId): void;
  tick(this: void, dt: number): void;
  processRefinery(this: void, dt: number): RefineryStats;
  prestigeReady(this: void): boolean;
  preview(this: void): number;
  doPrestige(this: void): void;
  setLastSave(this: void, timestamp: number): void;
  updateSettings(this: void, patch: Partial<StoreSettings>): void;
  applySnapshot(this: void, snapshot: StoreSnapshot): void;
  exportState(this: void): string;
  importState(this: void, payload: string): boolean;
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
const initialSave: SaveMeta = { lastSave: Date.now(), version: SAVE_VERSION };

const coerceNumber = (value: unknown, fallback: number) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const normalizeResources = (snapshot?: Partial<Resources>): Resources => ({
  ore: coerceNumber(snapshot?.ore, initialResources.ore),
  bars: coerceNumber(snapshot?.bars, initialResources.bars),
  energy: coerceNumber(snapshot?.energy, initialResources.energy),
  credits: coerceNumber(snapshot?.credits, initialResources.credits),
});

const normalizeModules = (snapshot?: Partial<Modules>): Modules => ({
  droneBay: Math.max(0, Math.floor(coerceNumber(snapshot?.droneBay, initialModules.droneBay))),
  refinery: Math.max(0, Math.floor(coerceNumber(snapshot?.refinery, initialModules.refinery))),
  storage: Math.max(0, Math.floor(coerceNumber(snapshot?.storage, initialModules.storage))),
  solar: Math.max(0, Math.floor(coerceNumber(snapshot?.solar, initialModules.solar))),
  scanner: Math.max(0, Math.floor(coerceNumber(snapshot?.scanner, initialModules.scanner))),
});

const normalizePrestige = (snapshot?: Partial<Prestige>): Prestige => ({
  cores: Math.max(0, Math.floor(coerceNumber(snapshot?.cores, initialPrestige.cores))),
});

const normalizeSave = (snapshot?: Partial<SaveMeta>): SaveMeta => ({
  lastSave: coerceNumber(snapshot?.lastSave, initialSave.lastSave),
  version: typeof snapshot?.version === 'string' ? snapshot.version : SAVE_VERSION,
});

const normalizeNotation = (notation: unknown): NotationMode =>
  notation === 'engineering' ? 'engineering' : 'standard';

const normalizeSettings = (snapshot?: Partial<StoreSettings>): StoreSettings => ({
  autosaveEnabled:
    typeof snapshot?.autosaveEnabled === 'boolean'
      ? snapshot.autosaveEnabled
      : initialSettings.autosaveEnabled,
  autosaveInterval: Math.max(
    1,
    Math.floor(coerceNumber(snapshot?.autosaveInterval, initialSettings.autosaveInterval)),
  ),
  offlineCapHours: Math.max(
    0,
    coerceNumber(snapshot?.offlineCapHours, initialSettings.offlineCapHours),
  ),
  notation: normalizeNotation(snapshot?.notation),
  throttleFloor: Math.min(
    1,
    Math.max(0, coerceNumber(snapshot?.throttleFloor, initialSettings.throttleFloor)),
  ),
});

const normalizeSnapshot = (snapshot: Partial<StoreSnapshot>): StoreSnapshot => ({
  resources: normalizeResources(snapshot.resources),
  modules: normalizeModules(snapshot.modules),
  prestige: normalizePrestige(snapshot.prestige),
  save: normalizeSave(snapshot.save),
  settings: normalizeSettings(snapshot.settings),
  rngSeed:
    typeof snapshot.rngSeed === 'number' && Number.isFinite(snapshot.rngSeed)
      ? snapshot.rngSeed
      : undefined,
});

export const serializeStore = (state: StoreState): StoreSnapshot => ({
  resources: { ...state.resources },
  modules: { ...state.modules },
  prestige: { ...state.prestige },
  save: { ...state.save, version: SAVE_VERSION },
  settings: { ...state.settings },
  rngSeed: state.rngSeed,
});

export const stringifySnapshot = (snapshot: StoreSnapshot) => JSON.stringify(snapshot);

export const parseSnapshot = (payload: string): StoreSnapshot | null => {
  try {
    const parsed = JSON.parse(payload) as Partial<StoreSnapshot>;
    return normalizeSnapshot(parsed);
  } catch (error) {
    console.warn('Failed to parse snapshot payload', error);
    return null;
  }
};

const storeCreator: StateCreator<StoreState> = (set, get) => ({
  resources: { ...initialResources },
  modules: { ...initialModules },
  prestige: { ...initialPrestige },
  save: { ...initialSave },
  settings: { ...initialSettings },
  rngSeed: generateSeed(),

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
    get().processRefinery(dt);
  },

  processRefinery: (dt) => {
    if (dt <= 0) return { oreConsumed: 0, barsProduced: 0 };
    const state = get();
    const prestigeMult = computePrestigeBonus(state.prestige.cores);
    const refineryMult = Math.pow(1.1, state.modules.refinery);
    const oreConversion = Math.min(state.resources.ore, ORE_CONVERSION_PER_SECOND * dt);
    const barsProduced =
      (oreConversion / ORE_PER_BAR) * BASE_REFINERY_RATE * refineryMult * prestigeMult;
    const nextOre = state.resources.ore - oreConversion;
    const nextBars = state.resources.bars + barsProduced;
    set({ resources: { ...state.resources, ore: nextOre, bars: nextBars } });
    return { oreConsumed: oreConversion, barsProduced };
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

  updateSettings: (patch) =>
    set((state) => ({ settings: normalizeSettings({ ...state.settings, ...patch }) })),

  applySnapshot: (snapshot) =>
    set(() => {
      const normalized = normalizeSnapshot(snapshot);
      const save = { ...normalized.save, version: SAVE_VERSION };
      return {
        resources: normalized.resources,
        modules: normalized.modules,
        prestige: normalized.prestige,
        save,
        settings: normalized.settings,
        rngSeed: normalized.rngSeed ?? generateSeed(),
      };
    }),

  exportState: () => stringifySnapshot(serializeStore(get())),

  importState: (payload) => {
    const snapshot = parseSnapshot(payload);
    if (!snapshot) {
      return false;
    }
    get().applySnapshot(snapshot);
    return true;
  },
});

export const createStoreInstance = () => createVanillaStore<StoreState>(storeCreator);

export const useStore = create<StoreState>()(storeCreator);

export type StoreApiType = StoreApi<StoreState>;

export const storeApi = useStore as unknown as StoreApiType;
