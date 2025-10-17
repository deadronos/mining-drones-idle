import { create } from 'zustand';
import {
  createStore as createVanillaStore,
  type StateCreator,
  type StoreApi,
} from 'zustand/vanilla';
import { getResourceModifiers, type ResourceModifierSnapshot } from '@/lib/resourceModifiers';

const SAVE_VERSION = '0.2.0';

const GROWTH = 1.15;
const PRESTIGE_THRESHOLD = 5_000;
const BASE_REFINERY_RATE = 1;
export const ORE_PER_BAR = 10;
export const ORE_CONVERSION_PER_SECOND = 10;
const BASE_STORAGE = 400;
const STORAGE_PER_LEVEL = 100;
const BASE_ENERGY_CAP = 100;
const ENERGY_PER_SOLAR = 25;
const SOLAR_BASE_GEN = 5;
export const DRONE_ENERGY_COST = 1.2;

export type PerformanceProfile = 'low' | 'medium' | 'high';

export type VectorTuple = [number, number, number];

export interface TravelSnapshot {
  from: VectorTuple;
  to: VectorTuple;
  elapsed: number;
  duration: number;
  control?: VectorTuple;
}

export type DroneFlightPhase = 'toAsteroid' | 'returning';

export interface DroneFlightState {
  droneId: string;
  state: DroneFlightPhase;
  targetAsteroidId: string | null;
  targetRegionId: string | null;
  pathSeed: number;
  travel: TravelSnapshot;
}

const initialSettings: StoreSettings = {
  autosaveEnabled: true,
  autosaveInterval: 10,
  offlineCapHours: 8,
  notation: 'standard',
  throttleFloor: 0.25,
  showTrails: true,
  performanceProfile: 'medium',
  inspectorCollapsed: false,
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
  ice: number;
  metals: number;
  crystals: number;
  organics: number;
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
  showTrails: boolean;
  performanceProfile: PerformanceProfile;
  inspectorCollapsed: boolean;
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
  droneFlights?: DroneFlightState[];
}

export interface StoreState {
  resources: Resources;
  modules: Modules;
  prestige: Prestige;
  save: SaveMeta;
  settings: StoreSettings;
  rngSeed: number;
  droneFlights: DroneFlightState[];
  selectedAsteroidId: string | null;
  addResources(this: void, delta: Partial<Resources>, options?: { capacityAware?: boolean }): void;
  addOre(this: void, amount: number): void;
  buy(this: void, id: ModuleId): void;
  tick(this: void, dt: number): void;
  processRefinery(this: void, dt: number): RefineryStats;
  prestigeReady(this: void): boolean;
  preview(this: void): number;
  doPrestige(this: void): void;
  setLastSave(this: void, timestamp: number): void;
  updateSettings(this: void, patch: Partial<StoreSettings>): void;
  setSelectedAsteroid(this: void, asteroidId: string | null): void;
  toggleInspector(this: void): void;
  applySnapshot(this: void, snapshot: StoreSnapshot): void;
  exportState(this: void): string;
  importState(this: void, payload: string): boolean;
  recordDroneFlight(this: void, flight: DroneFlightState): void;
  clearDroneFlight(this: void, droneId: string): void;
}

export type StoreApiType = StoreApi<StoreState>;

const emptyRefineryStats: RefineryStats = { oreConsumed: 0, barsProduced: 0 };

export const computeRefineryProduction = (
  state: Pick<StoreState, 'resources' | 'modules' | 'prestige'>,
  dt: number,
): RefineryStats => {
  if (dt <= 0) return emptyRefineryStats;
  const oreAvailable = state.resources.ore;
  if (oreAvailable <= 0) {
    return emptyRefineryStats;
  }
  const prestigeMult = computePrestigeBonus(state.prestige.cores);
  const refineryMult = Math.pow(1.1, state.modules.refinery);
  const modifiers = getResourceModifiers(state.resources);
  const oreConsumed = Math.min(oreAvailable, ORE_CONVERSION_PER_SECOND * dt);
  if (oreConsumed <= 0) {
    return emptyRefineryStats;
  }
  const barsProduced =
    (oreConsumed / ORE_PER_BAR) *
    BASE_REFINERY_RATE *
    refineryMult *
    prestigeMult *
    modifiers.refineryYieldMultiplier;
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

export const getStorageCapacity = (
  modules: Modules,
  modifiers?: ResourceModifierSnapshot,
) => {
  const base = BASE_STORAGE + modules.storage * STORAGE_PER_LEVEL;
  return base * (modifiers?.storageCapacityMultiplier ?? 1);
};

export const getEnergyCapacity = (modules: Modules, modifiers?: ResourceModifierSnapshot) => {
  const base = BASE_ENERGY_CAP + modules.solar * ENERGY_PER_SOLAR;
  return base * (modifiers?.energyStorageMultiplier ?? 1);
};

export const getEnergyGeneration = (
  modules: Modules,
  modifiers?: ResourceModifierSnapshot,
) => SOLAR_BASE_GEN * (modules.solar + 1) * (modifiers?.energyGenerationMultiplier ?? 1);

export const getEnergyConsumption = (
  _modules: Modules,
  drones: number,
  modifiers?: ResourceModifierSnapshot,
) => drones * DRONE_ENERGY_COST * (modifiers?.energyDrainMultiplier ?? 1);

export const computeEnergyThrottle = (
  state: Pick<StoreState, 'resources' | 'modules' | 'settings'>,
) => {
  const modifiers = getResourceModifiers(state.resources);
  const capacity = getEnergyCapacity(state.modules, modifiers);
  if (capacity <= 0) {
    return 1;
  }
  const normalized = Math.max(0, Math.min(1, state.resources.energy / capacity));
  return Math.max(state.settings.throttleFloor, normalized);
};

const initialResources: Resources = {
  ore: 0,
  ice: 0,
  metals: 0,
  crystals: 0,
  organics: 0,
  bars: 0,
  energy: BASE_ENERGY_CAP,
  credits: 0,
};
const initialModules: Modules = { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0 };
const initialPrestige: Prestige = { cores: 0 };
const initialSave: SaveMeta = { lastSave: Date.now(), version: SAVE_VERSION };

const rawResourceKeys = ['ore', 'ice', 'metals', 'crystals', 'organics'] as const;

const coerceNumber = (value: unknown, fallback: number) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const normalizeVectorTuple = (value: unknown): VectorTuple | null => {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const parsed = value.map((component) => Number(component));
  if (parsed.some((component) => !Number.isFinite(component))) {
    return null;
  }
  return [parsed[0], parsed[1], parsed[2]] as VectorTuple;
};

const cloneVectorTuple = (value: VectorTuple): VectorTuple => [value[0], value[1], value[2]];

const normalizeTravelSnapshot = (value: unknown): TravelSnapshot | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Partial<TravelSnapshot> & {
    from?: unknown;
    to?: unknown;
    control?: unknown;
    elapsed?: unknown;
    duration?: unknown;
  };
  const from = normalizeVectorTuple(raw.from);
  const to = normalizeVectorTuple(raw.to);
  if (!from || !to) {
    return null;
  }
  const duration = Math.max(0, coerceNumber(raw.duration, 0));
  const elapsed = Math.max(0, Math.min(duration, coerceNumber(raw.elapsed, 0)));
  const control = normalizeVectorTuple(raw.control ?? null) ?? undefined;
  return {
    from,
    to,
    elapsed,
    duration,
    control,
  };
};

const cloneTravelSnapshot = (travel: TravelSnapshot): TravelSnapshot => ({
  from: cloneVectorTuple(travel.from),
  to: cloneVectorTuple(travel.to),
  elapsed: travel.elapsed,
  duration: travel.duration,
  control: travel.control ? cloneVectorTuple(travel.control) : undefined,
});

const normalizeDroneFlight = (value: unknown): DroneFlightState | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Partial<DroneFlightState> & {
    travel?: unknown;
    pathSeed?: unknown;
    targetAsteroidId?: unknown;
  };
  if (typeof raw.droneId !== 'string' || raw.droneId.length === 0) {
    return null;
  }
  if (raw.state !== 'toAsteroid' && raw.state !== 'returning') {
    return null;
  }
  const travel = normalizeTravelSnapshot(raw.travel);
  if (!travel) {
    return null;
  }
  const pathSeed = coerceNumber(raw.pathSeed, 0);
  const targetAsteroidId =
    typeof raw.targetAsteroidId === 'string' ? raw.targetAsteroidId : null;
  const targetRegionId = typeof raw.targetRegionId === 'string' ? raw.targetRegionId : null;
  return {
    droneId: raw.droneId,
    state: raw.state,
    targetAsteroidId,
    targetRegionId,
    pathSeed,
    travel,
  };
};

const normalizeDroneFlights = (value: unknown): DroneFlightState[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const flights: DroneFlightState[] = [];
  for (const entry of value) {
    const normalized = normalizeDroneFlight(entry);
    if (normalized) {
      flights.push(normalized);
    }
  }
  return flights;
};

const cloneDroneFlight = (flight: DroneFlightState): DroneFlightState => ({
  droneId: flight.droneId,
  state: flight.state,
  targetAsteroidId: flight.targetAsteroidId,
  targetRegionId: flight.targetRegionId,
  pathSeed: flight.pathSeed,
  travel: cloneTravelSnapshot(flight.travel),
});

const mergeResourceDelta = (
  base: Resources,
  delta: Partial<Resources>,
  modules: Modules,
  capacityAware: boolean,
): Resources => {
  const next: Resources = { ...base };
  for (const key of rawResourceKeys) {
    const amount = delta[key];
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) continue;
    next[key] = base[key] + amount;
  }
  if (typeof delta.bars === 'number' && Number.isFinite(delta.bars) && delta.bars !== 0) {
    next.bars = Math.max(0, next.bars + delta.bars);
  }
  if (typeof delta.energy === 'number' && Number.isFinite(delta.energy) && delta.energy !== 0) {
    next.energy = Math.max(0, next.energy + delta.energy);
  }
  if (typeof delta.credits === 'number' && Number.isFinite(delta.credits) && delta.credits !== 0) {
    next.credits = Math.max(0, next.credits + delta.credits);
  }
  if (!capacityAware) {
    return next;
  }
  const modifiers = getResourceModifiers(next);
  const capacity = getStorageCapacity(modules, modifiers);
  for (const key of rawResourceKeys) {
    const value = next[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      next[key] = Math.max(0, Math.min(capacity, base[key]));
    } else {
      next[key] = Math.min(capacity, Math.max(0, value));
    }
  }
  return next;
};

const normalizeResources = (snapshot?: Partial<Resources>): Resources => ({
  ore: coerceNumber(snapshot?.ore, initialResources.ore),
  ice: coerceNumber(snapshot?.ice, initialResources.ice),
  metals: coerceNumber(snapshot?.metals, initialResources.metals),
  crystals: coerceNumber(snapshot?.crystals, initialResources.crystals),
  organics: coerceNumber(snapshot?.organics, initialResources.organics),
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

const normalizePerformanceProfile = (profile: unknown): PerformanceProfile => {
  if (profile === 'low' || profile === 'high') {
    return profile;
  }
  return 'medium';
};

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
  showTrails:
    typeof snapshot?.showTrails === 'boolean' ? snapshot.showTrails : initialSettings.showTrails,
  performanceProfile: normalizePerformanceProfile(snapshot?.performanceProfile),
  inspectorCollapsed:
    typeof snapshot?.inspectorCollapsed === 'boolean'
      ? snapshot.inspectorCollapsed
      : initialSettings.inspectorCollapsed,
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
  droneFlights: normalizeDroneFlights(snapshot.droneFlights),
});

export const serializeStore = (state: StoreState): StoreSnapshot => ({
  resources: { ...state.resources },
  modules: { ...state.modules },
  prestige: { ...state.prestige },
  save: { ...state.save, version: SAVE_VERSION },
  settings: { ...state.settings },
  rngSeed: state.rngSeed,
  droneFlights: state.droneFlights.map(cloneDroneFlight),
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
  droneFlights: [],
  selectedAsteroidId: null,

  addResources: (delta, options) =>
    set((state) => {
      const capacityAware = options?.capacityAware ?? true;
      const resources = mergeResourceDelta(
        state.resources,
        delta ?? {},
        state.modules,
        capacityAware,
      );
      return { resources };
    }),

  addOre: (amount) =>
    get().addResources({ ore: amount }),

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
    if (dt <= 0) return emptyRefineryStats;
    const state = get();
    const stats = computeRefineryProduction(state, dt);
    if (stats.oreConsumed <= 0 && stats.barsProduced <= 0) {
      return emptyRefineryStats;
    }
    set(applyRefineryProduction(state, stats));
    return stats;
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
        droneFlights: [],
      };
    }),

  setLastSave: (timestamp) => set((state) => ({ save: { ...state.save, lastSave: timestamp } })),

  updateSettings: (patch) =>
    set((state) => ({ settings: normalizeSettings({ ...state.settings, ...patch }) })),

  setSelectedAsteroid: (asteroidId) =>
    set(() => ({ selectedAsteroidId: asteroidId })),

  toggleInspector: () =>
    set((state) => ({
      settings: normalizeSettings({
        ...state.settings,
        inspectorCollapsed: !state.settings.inspectorCollapsed,
      }),
    })),

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
        droneFlights: normalized.droneFlights ?? [],
        selectedAsteroidId: null,
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

  recordDroneFlight: (flight) =>
    set((state) => {
      const snapshot = cloneDroneFlight(flight);
      const remaining = state.droneFlights.filter((entry) => entry.droneId !== snapshot.droneId);
      return { droneFlights: [...remaining, snapshot] };
    }),

  clearDroneFlight: (droneId) =>
    set((state) => ({
      droneFlights: state.droneFlights.filter((entry) => entry.droneId !== droneId),
    })),
});

export const createStoreInstance = () => createVanillaStore<StoreState>(storeCreator);

export const useStore = create<StoreState>()(storeCreator);

export const storeApi = useStore as unknown as StoreApiType;
