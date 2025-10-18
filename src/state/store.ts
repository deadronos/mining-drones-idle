import { create } from 'zustand';
import {
  createStore as createVanillaStore,
  type StateCreator,
  type StoreApi,
} from 'zustand/vanilla';
import { Vector3 } from 'three';
import { getResourceModifiers, type ResourceModifierSnapshot } from '@/lib/resourceModifiers';
import type { BuildableFactory, RefineProcess } from '@/ecs/factories';
import {
  FACTORY_CONFIG,
  attemptDockDrone,
  createFactory,
  computeFactoryCost,
  enforceMinOneRefining,
  removeDroneFromFactory,
  startRefineProcess,
  tickRefineProcess,
  transferOreToFactory as factoryTransferOre,
} from '@/ecs/factories';

const SAVE_VERSION = '0.2.0';

const GROWTH = 1.15;
export const PRESTIGE_THRESHOLD = 5_000;
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

const vector3ToTuple = (vector: Vector3): VectorTuple => [vector.x, vector.y, vector.z];

const tupleToVector3 = (tuple: VectorTuple): Vector3 => new Vector3(tuple[0], tuple[1], tuple[2]);

export interface TravelSnapshot {
  from: VectorTuple;
  to: VectorTuple;
  elapsed: number;
  duration: number;
  control?: VectorTuple;
}

export interface RefineProcessSnapshot {
  id: string;
  oreType: string;
  amount: number;
  progress: number;
  timeTotal: number;
  energyRequired: number;
  speedMultiplier: number;
}

export interface FactorySnapshot {
  id: string;
  position: VectorTuple;
  dockingCapacity: number;
  refineSlots: number;
  idleEnergyPerSec: number;
  energyPerRefine: number;
  storageCapacity: number;
  currentStorage: number;
  queuedDrones: string[];
  activeRefines: RefineProcessSnapshot[];
  pinned: boolean;
}

export type DroneFlightPhase = 'toAsteroid' | 'returning';

export interface DroneFlightState {
  droneId: string;
  state: DroneFlightPhase;
  targetAsteroidId: string | null;
  targetRegionId: string | null;
  targetFactoryId: string | null;
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

const createDefaultFactories = (): BuildableFactory[] => [
  createFactory('factory-0', new Vector3(0, 0, 0)),
];

export const FACTORY_MIN_DISTANCE = 10;
export const FACTORY_MAX_DISTANCE = 50;
const FACTORY_PLACEMENT_ATTEMPTS = 100;

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

const deriveProcessSequence = (factories: BuildableFactory[]): number => {
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

export const moduleDefinitions = {
  droneBay: { label: 'Drone Bay', baseCost: 4, description: '+1 drone, +5% travel speed' },
  refinery: { label: 'Refinery', baseCost: 8, description: '+10% bar output' },
  storage: { label: 'Storage', baseCost: 3, description: '+100 ore capacity' },
  solar: { label: 'Solar Array', baseCost: 4, description: '+5 energy/s, +25 max energy' },
  scanner: { label: 'Scanner', baseCost: 12, description: '+5% new asteroid richness' },
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
  factories?: FactorySnapshot[];
}

export interface StoreState {
  resources: Resources;
  modules: Modules;
  prestige: Prestige;
  save: SaveMeta;
  settings: StoreSettings;
  rngSeed: number;
  droneFlights: DroneFlightState[];
  factories: BuildableFactory[];
  factoryProcessSequence: number;
  factoryRoundRobin: number;
  factoryAutofitSequence: number;
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
  addFactory(this: void, factory: BuildableFactory): void;
  removeFactory(this: void, factoryId: string): void;
  getFactory(this: void, factoryId: string): BuildableFactory | undefined;
  purchaseFactory(this: void): boolean;
  toggleFactoryPinned(this: void, factoryId: string): void;
  setFactoryPinned(this: void, factoryId: string, pinned: boolean): void;
  nextFactoryRoundRobin(this: void): number;
  dockDroneAtFactory(this: void, factoryId: string, droneId: string): boolean;
  undockDroneFromFactory(this: void, factoryId: string, droneId: string): void;
  transferOreToFactory(this: void, factoryId: string, amount: number): number;
  processFactories(this: void, dt: number): void;
  triggerFactoryAutofit(this: void): void;
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
  const modifiers = getResourceModifiers(state.resources, state.prestige.cores);
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

export const getStorageCapacity = (modules: Modules, modifiers?: ResourceModifierSnapshot) => {
  const base = BASE_STORAGE + modules.storage * STORAGE_PER_LEVEL;
  return base * (modifiers?.storageCapacityMultiplier ?? 1);
};

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
    targetFactoryId?: unknown;
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
  const targetAsteroidId = typeof raw.targetAsteroidId === 'string' ? raw.targetAsteroidId : null;
  const targetRegionId = typeof raw.targetRegionId === 'string' ? raw.targetRegionId : null;
  const targetFactoryId = typeof raw.targetFactoryId === 'string' ? raw.targetFactoryId : null;
  return {
    droneId: raw.droneId,
    state: raw.state,
    targetAsteroidId,
    targetRegionId,
    targetFactoryId,
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

const cloneRefineProcess = (process: RefineProcess): RefineProcess => ({
  id: process.id,
  oreType: process.oreType,
  amount: process.amount,
  progress: process.progress,
  timeTotal: process.timeTotal,
  energyRequired: process.energyRequired,
  speedMultiplier: process.speedMultiplier,
});

const snapshotToRefineProcess = (snapshot: RefineProcessSnapshot): RefineProcess => ({
  id: snapshot.id,
  oreType: snapshot.oreType,
  amount: snapshot.amount,
  progress: snapshot.progress,
  timeTotal: snapshot.timeTotal,
  energyRequired: snapshot.energyRequired,
  speedMultiplier: snapshot.speedMultiplier,
});

const normalizeRefineSnapshot = (value: unknown): RefineProcessSnapshot | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Partial<RefineProcessSnapshot>;
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    return null;
  }
  if (typeof raw.oreType !== 'string' || raw.oreType.length === 0) {
    return null;
  }
  const amount = Math.max(0, coerceNumber(raw.amount, 0));
  const timeTotal = Math.max(0.01, coerceNumber(raw.timeTotal, FACTORY_CONFIG.refineTime));
  const progress = Math.min(1, Math.max(0, coerceNumber(raw.progress, 0)));
  const energyRequired = Math.max(
    0,
    coerceNumber(raw.energyRequired, FACTORY_CONFIG.energyPerRefine),
  );
  const speedMultiplier = Math.max(0, coerceNumber(raw.speedMultiplier, 1));
  return {
    id: raw.id,
    oreType: raw.oreType,
    amount,
    progress,
    timeTotal,
    energyRequired,
    speedMultiplier,
  };
};

const refineProcessToSnapshot = (process: RefineProcess): RefineProcessSnapshot => ({
  id: process.id,
  oreType: process.oreType,
  amount: process.amount,
  progress: process.progress,
  timeTotal: process.timeTotal,
  energyRequired: process.energyRequired,
  speedMultiplier: process.speedMultiplier,
});

const normalizeFactorySnapshot = (value: unknown): FactorySnapshot | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Partial<FactorySnapshot> & { position?: unknown };
  const position = normalizeVectorTuple(raw.position);
  if (!position) {
    return null;
  }
  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `factory-${Date.now()}`,
    position,
    dockingCapacity: Math.max(
      1,
      Math.floor(coerceNumber(raw.dockingCapacity, FACTORY_CONFIG.dockingCapacity)),
    ),
    refineSlots: Math.max(1, Math.floor(coerceNumber(raw.refineSlots, FACTORY_CONFIG.refineSlots))),
    idleEnergyPerSec: Math.max(
      0,
      coerceNumber(raw.idleEnergyPerSec, FACTORY_CONFIG.idleEnergyPerSec),
    ),
    energyPerRefine: Math.max(0, coerceNumber(raw.energyPerRefine, FACTORY_CONFIG.energyPerRefine)),
    storageCapacity: Math.max(1, coerceNumber(raw.storageCapacity, FACTORY_CONFIG.storageCapacity)),
    currentStorage: Math.max(0, coerceNumber(raw.currentStorage, 0)),
    queuedDrones: Array.isArray(raw.queuedDrones)
      ? raw.queuedDrones.filter((id): id is string => typeof id === 'string')
      : [],
    activeRefines: Array.isArray(raw.activeRefines)
      ? raw.activeRefines
          .map((entry) => normalizeRefineSnapshot(entry))
          .filter((entry): entry is RefineProcessSnapshot => entry !== null)
      : [],
    pinned: Boolean(raw.pinned),
  };
};

const cloneFactory = (factory: BuildableFactory): BuildableFactory => ({
  id: factory.id,
  position: factory.position.clone(),
  dockingCapacity: factory.dockingCapacity,
  refineSlots: factory.refineSlots,
  idleEnergyPerSec: factory.idleEnergyPerSec,
  energyPerRefine: factory.energyPerRefine,
  storageCapacity: factory.storageCapacity,
  currentStorage: factory.currentStorage,
  queuedDrones: [...factory.queuedDrones],
  activeRefines: factory.activeRefines.map(cloneRefineProcess),
  pinned: factory.pinned,
});

const snapshotToFactory = (snapshot: FactorySnapshot): BuildableFactory => ({
  id: snapshot.id,
  position: tupleToVector3(snapshot.position),
  dockingCapacity: snapshot.dockingCapacity,
  refineSlots: snapshot.refineSlots,
  idleEnergyPerSec: snapshot.idleEnergyPerSec,
  energyPerRefine: snapshot.energyPerRefine,
  storageCapacity: snapshot.storageCapacity,
  currentStorage: snapshot.currentStorage,
  queuedDrones: [...snapshot.queuedDrones],
  activeRefines: snapshot.activeRefines.map(snapshotToRefineProcess),
  pinned: snapshot.pinned,
});

const factoryToSnapshot = (factory: BuildableFactory): FactorySnapshot => ({
  id: factory.id,
  position: vector3ToTuple(factory.position),
  dockingCapacity: factory.dockingCapacity,
  refineSlots: factory.refineSlots,
  idleEnergyPerSec: factory.idleEnergyPerSec,
  energyPerRefine: factory.energyPerRefine,
  storageCapacity: factory.storageCapacity,
  currentStorage: factory.currentStorage,
  queuedDrones: [...factory.queuedDrones],
  activeRefines: factory.activeRefines.map(refineProcessToSnapshot),
  pinned: factory.pinned,
});

const cloneDroneFlight = (flight: DroneFlightState): DroneFlightState => ({
  droneId: flight.droneId,
  state: flight.state,
  targetAsteroidId: flight.targetAsteroidId,
  targetRegionId: flight.targetRegionId,
  targetFactoryId: flight.targetFactoryId,
  pathSeed: flight.pathSeed,
  travel: cloneTravelSnapshot(flight.travel),
});

const mergeResourceDelta = (
  base: Resources,
  delta: Partial<Resources>,
  modules: Modules,
  capacityAware: boolean,
  prestigeCores = 0,
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
  const modifiers = getResourceModifiers(next, prestigeCores);
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
  factories: Array.isArray(snapshot.factories)
    ? snapshot.factories
        .map((entry) => normalizeFactorySnapshot(entry))
        .filter((entry): entry is FactorySnapshot => entry !== null)
    : undefined,
});

export const serializeStore = (state: StoreState): StoreSnapshot => ({
  resources: { ...state.resources },
  modules: { ...state.modules },
  prestige: { ...state.prestige },
  save: { ...state.save, version: SAVE_VERSION },
  settings: { ...state.settings },
  rngSeed: state.rngSeed,
  droneFlights: state.droneFlights.map(cloneDroneFlight),
  factories: state.factories.map(factoryToSnapshot),
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
  factories: createDefaultFactories(),
  factoryProcessSequence: 0,
  factoryRoundRobin: 0,
  factoryAutofitSequence: 0,
  selectedAsteroidId: null,

  addResources: (delta, options) =>
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
    }),

  addOre: (amount) => get().addResources({ ore: amount }),

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

  setSelectedAsteroid: (asteroidId) => set(() => ({ selectedAsteroidId: asteroidId })),

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
      const restoredFactories =
        normalized.factories && normalized.factories.length > 0
          ? normalized.factories.map(snapshotToFactory)
          : createDefaultFactories();
      return {
        resources: normalized.resources,
        modules: normalized.modules,
        prestige: normalized.prestige,
        save,
        settings: normalized.settings,
        rngSeed: normalized.rngSeed ?? generateSeed(),
        droneFlights: normalized.droneFlights ?? [],
        factories: restoredFactories,
        factoryProcessSequence: deriveProcessSequence(restoredFactories),
        factoryRoundRobin: 0,
        factoryAutofitSequence: 0,
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

  addFactory: (factory) =>
    set((state) => ({
      factories: [...state.factories, cloneFactory(factory)],
    })),

  removeFactory: (factoryId) =>
    set((state) => ({
      factories: state.factories.filter((f) => f.id !== factoryId),
    })),

  getFactory: (factoryId) => {
    const state = get();
    return state.factories.find((f) => f.id === factoryId);
  },

  purchaseFactory: () => {
    const state = get();
    const purchaseIndex = Math.max(0, state.factories.length - 1);
    const cost = computeFactoryCost(purchaseIndex);
    if (state.resources.metals < cost.metals || state.resources.crystals < cost.crystals) {
      return false;
    }
    const id = `factory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const position = computeFactoryPlacement(state.factories);
    const factory = createFactory(id, position);
    set((current) => ({
      resources: {
        ...current.resources,
        metals: current.resources.metals - cost.metals,
        crystals: current.resources.crystals - cost.crystals,
      },
      factories: [...current.factories, factory],
      factoryAutofitSequence: current.factoryAutofitSequence + 1,
    }));
    return true;
  },

  toggleFactoryPinned: (factoryId) =>
    set((state) => ({
      factories: state.factories.map((factory) =>
        factory.id === factoryId ? { ...cloneFactory(factory), pinned: !factory.pinned } : factory,
      ),
    })),

  setFactoryPinned: (factoryId, pinned) =>
    set((state) => ({
      factories: state.factories.map((factory) =>
        factory.id === factoryId ? { ...cloneFactory(factory), pinned } : factory,
      ),
    })),

  nextFactoryRoundRobin: () => {
    let currentValue = 0;
    set((state) => {
      currentValue = state.factoryRoundRobin;
      return { factoryRoundRobin: state.factoryRoundRobin + 1 };
    });
    return currentValue;
  },

  dockDroneAtFactory: (factoryId, droneId) => {
    const state = get();
    const index = state.factories.findIndex((f) => f.id === factoryId);
    if (index === -1) return false;
    const base = state.factories[index];
    if (base.queuedDrones.includes(droneId)) {
      return true;
    }
    const updated = cloneFactory(base);
    const success = attemptDockDrone(updated, droneId);
    if (!success) {
      return false;
    }
    set((current) => ({
      factories: current.factories.map((factory, idx) => (idx === index ? updated : factory)),
    }));
    return true;
  },

  undockDroneFromFactory: (factoryId, droneId) => {
    const state = get();
    const index = state.factories.findIndex((f) => f.id === factoryId);
    if (index === -1) {
      return;
    }
    const updated = cloneFactory(state.factories[index]);
    removeDroneFromFactory(updated, droneId);
    set((current) => ({
      factories: current.factories.map((factory, idx) => (idx === index ? updated : factory)),
    }));
  },

  transferOreToFactory: (factoryId, amount) => {
    const state = get();
    const index = state.factories.findIndex((f) => f.id === factoryId);
    if (index === -1) return 0;
    const updated = cloneFactory(state.factories[index]);
    const transferred = factoryTransferOre(updated, amount);
    set((current) => ({
      factories: current.factories.map((factory, idx) => (idx === index ? updated : factory)),
    }));
    return transferred;
  },

  processFactories: (dt) => {
    if (dt <= 0 || get().factories.length === 0) return;

    set((state) => {
      let totalEnergyDrain = 0;
      let totalRefinedOre = 0;
      let processesStarted = 0;

      const modifiers = getResourceModifiers(state.resources, state.prestige.cores);
      const capacity = getEnergyCapacity(state.modules, modifiers);

      const updatedFactories = state.factories.map((factory) => {
        const working = cloneFactory(factory);

        totalEnergyDrain += working.idleEnergyPerSec * dt;

        while (working.currentStorage > 0 && working.activeRefines.length < working.refineSlots) {
          const slotTarget = Math.max(1, working.refineSlots);
          const batchSize = Math.min(
            working.currentStorage,
            Math.max(10, working.storageCapacity / slotTarget),
          );
          const processId = `${working.id}-p${state.factoryProcessSequence + processesStarted + 1}`;
          const started = startRefineProcess(working, 'ore', batchSize, processId);
          if (!started) {
            break;
          }
          processesStarted += 1;
        }

        enforceMinOneRefining(working, Math.max(0, state.resources.energy), capacity);

        for (let i = working.activeRefines.length - 1; i >= 0; i -= 1) {
          const process = working.activeRefines[i];
          totalEnergyDrain += working.energyPerRefine * dt * process.speedMultiplier;
          const refined = tickRefineProcess(working, process, dt);
          if (refined > 0) {
            totalRefinedOre += refined;
          }
        }

        return working;
      });

      const energy = Math.max(0, state.resources.energy - totalEnergyDrain);
      const ore = Math.max(0, state.resources.ore + totalRefinedOre);

      return {
        resources: { ...state.resources, energy, ore },
        factories: updatedFactories,
        factoryProcessSequence: state.factoryProcessSequence + processesStarted,
      };
    });
  },

  triggerFactoryAutofit: () =>
    set((state) => ({ factoryAutofitSequence: state.factoryAutofitSequence + 1 })),
});

export const createStoreInstance = () => createVanillaStore<StoreState>(storeCreator);

export const useStore = create<StoreState>()(storeCreator);

export const storeApi = useStore as unknown as StoreApiType;
