/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { FACTORY_CONFIG } from '@/ecs/factories';
import type { BuildableFactory, RefineProcess } from '@/ecs/factories';
import type {
  VectorTuple,
  TravelSnapshot,
  DroneFlightState,
  RefineProcessSnapshot,
  FactoryResourceSnapshot,
  FactoryUpgradeSnapshot,
  FactorySnapshot,
  Resources,
  Modules,
  Prestige,
  SaveMeta,
  NotationMode,
  PerformanceProfile,
  StoreSettings,
  StoreSnapshot,
  StoreState,
} from './types';
import {
  SAVE_VERSION,
  initialResources,
  initialModules,
  initialPrestige,
  initialSave,
  initialSettings,
} from './constants';
import { coerceNumber, vector3ToTuple, tupleToVector3 } from './utils';

export const normalizeVectorTuple = (value: unknown): VectorTuple | null => {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const parsed = value.map((component) => Number(component));
  if (parsed.some((component) => !Number.isFinite(component))) {
    return null;
  }
  return [parsed[0], parsed[1], parsed[2]] as VectorTuple;
};

export const cloneVectorTuple = (value: VectorTuple): VectorTuple => [value[0], value[1], value[2]];

export const normalizeTravelSnapshot = (value: unknown): TravelSnapshot | null => {
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

export const cloneTravelSnapshot = (travel: TravelSnapshot): TravelSnapshot => ({
  from: cloneVectorTuple(travel.from),
  to: cloneVectorTuple(travel.to),
  elapsed: travel.elapsed,
  duration: travel.duration,
  control: travel.control ? cloneVectorTuple(travel.control) : undefined,
});

export const normalizeDroneFlight = (value: unknown): DroneFlightState | null => {
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

export const normalizeDroneFlights = (value: unknown): DroneFlightState[] => {
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

export const cloneRefineProcess = (process: RefineProcess): RefineProcess => ({
  id: process.id,
  oreType: process.oreType,
  amount: process.amount,
  progress: process.progress,
  timeTotal: process.timeTotal,
  energyRequired: process.energyRequired,
  speedMultiplier: process.speedMultiplier,
});

export const snapshotToRefineProcess = (snapshot: RefineProcessSnapshot): RefineProcess => ({
  id: snapshot.id,
  oreType: snapshot.oreType,
  amount: snapshot.amount,
  progress: snapshot.progress,
  timeTotal: snapshot.timeTotal,
  energyRequired: snapshot.energyRequired,
  speedMultiplier: snapshot.speedMultiplier,
});

export const normalizeFactoryResources = (value: unknown): FactoryResourceSnapshot => {
  if (typeof value !== 'object' || value === null) {
    return {
      ore: 0,
      bars: 0,
      metals: 0,
      crystals: 0,
      organics: 0,
      ice: 0,
      credits: 0,
    };
  }
  const raw = value as Partial<FactoryResourceSnapshot>;
  return {
    ore: Math.max(0, coerceNumber(raw.ore, 0)),
    bars: Math.max(0, coerceNumber(raw.bars, 0)),
    metals: Math.max(0, coerceNumber(raw.metals, 0)),
    crystals: Math.max(0, coerceNumber(raw.crystals, 0)),
    organics: Math.max(0, coerceNumber(raw.organics, 0)),
    ice: Math.max(0, coerceNumber(raw.ice, 0)),
    credits: Math.max(0, coerceNumber(raw.credits, 0)),
  };
};

export const normalizeFactoryUpgrades = (value: unknown): FactoryUpgradeSnapshot => {
  if (typeof value !== 'object' || value === null) {
    return { docking: 0, refine: 0, storage: 0, energy: 0, solar: 0 };
  }
  const raw = value as Partial<FactoryUpgradeSnapshot>;
  return {
    docking: Math.max(0, Math.floor(coerceNumber(raw.docking, 0))),
    refine: Math.max(0, Math.floor(coerceNumber(raw.refine, 0))),
    storage: Math.max(0, Math.floor(coerceNumber(raw.storage, 0))),
    energy: Math.max(0, Math.floor(coerceNumber(raw.energy, 0))),
    solar: Math.max(0, Math.floor(coerceNumber(raw.solar, 0))),
  };
};

export const normalizeDroneOwners = (value: unknown): Record<string, string | null> => {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  const result: Record<string, string | null> = {};
  for (const [key, owner] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== 'string') {
      continue;
    }
    result[key] = typeof owner === 'string' && owner.length > 0 ? owner : null;
  }
  return result;
};

export const normalizeRefineSnapshot = (value: unknown): RefineProcessSnapshot | null => {
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

export const refineProcessToSnapshot = (process: RefineProcess): RefineProcessSnapshot => ({
  id: process.id,
  oreType: process.oreType,
  amount: process.amount,
  progress: process.progress,
  timeTotal: process.timeTotal,
  energyRequired: process.energyRequired,
  speedMultiplier: process.speedMultiplier,
});

export const normalizeFactorySnapshot = (value: unknown): FactorySnapshot | null => {
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
    energy: Math.max(0, coerceNumber(raw.energy, FACTORY_CONFIG.initialEnergy)),
    energyCapacity: Math.max(1, coerceNumber(raw.energyCapacity, FACTORY_CONFIG.energyCapacity)),
    resources: normalizeFactoryResources(raw.resources),
    ownedDrones: Array.isArray(raw.ownedDrones)
      ? raw.ownedDrones.filter((id): id is string => typeof id === 'string')
      : [],
    upgrades: normalizeFactoryUpgrades(raw.upgrades),
    haulersAssigned: Math.max(0, Math.floor(coerceNumber(raw.haulersAssigned, 0))),
    haulerConfig:
      raw.haulerConfig && typeof raw.haulerConfig === 'object'
        ? {
            capacity: Math.max(1, Math.floor(coerceNumber((raw.haulerConfig as any).capacity, 50))),
            speed: Math.max(0.1, coerceNumber((raw.haulerConfig as any).speed, 1.0)),
            pickupOverhead: Math.max(
              0,
              coerceNumber((raw.haulerConfig as any).pickupOverhead, 1.0),
            ),
            dropoffOverhead: Math.max(
              0,
              coerceNumber((raw.haulerConfig as any).dropoffOverhead, 1.0),
            ),
            resourceFilters: Array.isArray((raw.haulerConfig as any).resourceFilters)
              ? (raw.haulerConfig as any).resourceFilters.filter(
                  (val: unknown): val is string => typeof val === 'string',
                )
              : [],
            mode: ['auto', 'manual', 'demand-first', 'supply-first'].includes(
              (raw.haulerConfig as any).mode,
            )
              ? ((raw.haulerConfig as any).mode as
                  | 'auto'
                  | 'manual'
                  | 'demand-first'
                  | 'supply-first')
              : 'auto',
            priority: Math.min(
              10,
              Math.max(0, Math.floor(coerceNumber((raw.haulerConfig as any).priority, 5))),
            ),
          }
        : undefined,
    logisticsState:
      raw.logisticsState && typeof raw.logisticsState === 'object'
        ? {
            outboundReservations:
              typeof (raw.logisticsState as any).outboundReservations === 'object'
                ? Object.entries((raw.logisticsState as any).outboundReservations).reduce(
                    (acc: Record<string, number>, [key, val]: [unknown, unknown]) => {
                      const amount = coerceNumber(val, 0);
                      if (amount > 0) acc[key as string] = amount;
                      return acc;
                    },
                    {},
                  )
                : {},
            inboundSchedules: Array.isArray((raw.logisticsState as any).inboundSchedules)
              ? (raw.logisticsState as any).inboundSchedules
                  .map((schedule: any) => ({
                    fromFactoryId:
                      typeof schedule.fromFactoryId === 'string' ? schedule.fromFactoryId : '',
                    resource: typeof schedule.resource === 'string' ? schedule.resource : '',
                    amount: Math.max(0, coerceNumber(schedule.amount, 0)),
                    eta: Math.max(0, coerceNumber(schedule.eta, 0)),
                  }))
                  .filter(
                    (s: { fromFactoryId: string; resource: string; amount: number; eta: number }) =>
                      s.fromFactoryId && s.resource,
                  )
              : [],
          }
        : undefined,
  };
};

export const cloneFactory = (factory: BuildableFactory): BuildableFactory => ({
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
  energy: factory.energy,
  energyCapacity: factory.energyCapacity,
  resources: { ...factory.resources },
  ownedDrones: [...factory.ownedDrones],
  upgrades: { ...factory.upgrades },
  haulersAssigned: factory.haulersAssigned,
  haulerConfig: factory.haulerConfig ? { ...factory.haulerConfig } : undefined,
  logisticsState: factory.logisticsState
    ? {
        outboundReservations: { ...factory.logisticsState.outboundReservations },
        inboundSchedules: [...factory.logisticsState.inboundSchedules],
      }
    : undefined,
});

export const snapshotToFactory = (snapshot: FactorySnapshot): BuildableFactory => ({
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
  energy: snapshot.energy,
  energyCapacity: snapshot.energyCapacity,
  resources: { ...snapshot.resources },
  ownedDrones: [...snapshot.ownedDrones],
  upgrades: { ...snapshot.upgrades },
  haulersAssigned: snapshot.haulersAssigned,
  haulerConfig: snapshot.haulerConfig ? { ...snapshot.haulerConfig } : undefined,
  logisticsState: snapshot.logisticsState
    ? {
        outboundReservations: { ...snapshot.logisticsState.outboundReservations },
        inboundSchedules: [...snapshot.logisticsState.inboundSchedules],
      }
    : undefined,
});

export const factoryToSnapshot = (factory: BuildableFactory): FactorySnapshot => ({
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
  energy: factory.energy,
  energyCapacity: factory.energyCapacity,
  resources: { ...factory.resources },
  ownedDrones: [...factory.ownedDrones],
  upgrades: { ...factory.upgrades },
  haulersAssigned: factory.haulersAssigned,
  haulerConfig: factory.haulerConfig ? { ...factory.haulerConfig } : undefined,
  logisticsState: factory.logisticsState
    ? {
        outboundReservations: { ...factory.logisticsState.outboundReservations },
        inboundSchedules: [...factory.logisticsState.inboundSchedules],
      }
    : undefined,
});

export const cloneDroneFlight = (flight: DroneFlightState): DroneFlightState => ({
  droneId: flight.droneId,
  state: flight.state,
  targetAsteroidId: flight.targetAsteroidId,
  targetRegionId: flight.targetRegionId,
  targetFactoryId: flight.targetFactoryId,
  pathSeed: flight.pathSeed,
  travel: cloneTravelSnapshot(flight.travel),
});

export const normalizeResources = (snapshot?: Partial<Resources>): Resources => ({
  ore: coerceNumber(snapshot?.ore, initialResources.ore),
  ice: coerceNumber(snapshot?.ice, initialResources.ice),
  metals: coerceNumber(snapshot?.metals, initialResources.metals),
  crystals: coerceNumber(snapshot?.crystals, initialResources.crystals),
  organics: coerceNumber(snapshot?.organics, initialResources.organics),
  bars: coerceNumber(snapshot?.bars, initialResources.bars),
  energy: coerceNumber(snapshot?.energy, initialResources.energy),
  credits: coerceNumber(snapshot?.credits, initialResources.credits),
});

export const normalizeModules = (snapshot?: Partial<Modules>): Modules => ({
  droneBay: Math.max(0, Math.floor(coerceNumber(snapshot?.droneBay, initialModules.droneBay))),
  refinery: Math.max(0, Math.floor(coerceNumber(snapshot?.refinery, initialModules.refinery))),
  storage: Math.max(0, Math.floor(coerceNumber(snapshot?.storage, initialModules.storage))),
  solar: Math.max(0, Math.floor(coerceNumber(snapshot?.solar, initialModules.solar))),
  scanner: Math.max(0, Math.floor(coerceNumber(snapshot?.scanner, initialModules.scanner))),
});

export const normalizePrestige = (snapshot?: Partial<Prestige>): Prestige => ({
  cores: Math.max(0, Math.floor(coerceNumber(snapshot?.cores, initialPrestige.cores))),
});

export const normalizeSave = (snapshot?: Partial<SaveMeta>): SaveMeta => ({
  lastSave: coerceNumber(snapshot?.lastSave, initialSave.lastSave),
  version: typeof snapshot?.version === 'string' ? snapshot.version : SAVE_VERSION,
});

export const normalizeNotation = (notation: unknown): NotationMode =>
  notation === 'engineering' ? 'engineering' : 'standard';

export const normalizePerformanceProfile = (profile: unknown): PerformanceProfile => {
  if (profile === 'low' || profile === 'high') {
    return profile;
  }
  return 'medium';
};

export const normalizeSettings = (snapshot?: Partial<StoreSettings>): StoreSettings => ({
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

export const normalizeSnapshot = (snapshot: Partial<StoreSnapshot>): StoreSnapshot => ({
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
  selectedFactoryId:
    typeof snapshot.selectedFactoryId === 'string' && snapshot.selectedFactoryId.length > 0
      ? snapshot.selectedFactoryId
      : null,
  droneOwners:
    snapshot.droneOwners && typeof snapshot.droneOwners === 'object'
      ? normalizeDroneOwners(snapshot.droneOwners)
      : undefined,
  logisticsQueues: snapshot.logisticsQueues ?? { pendingTransfers: [] },
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
  selectedFactoryId: state.selectedFactoryId,
  droneOwners: { ...state.droneOwners },
  logisticsQueues: { pendingTransfers: [...state.logisticsQueues.pendingTransfers] },
});

export const stringifySnapshot = (snapshot: StoreSnapshot) => JSON.stringify(snapshot);

export const parseSnapshot = (payload: string): StoreSnapshot | null => {
  try {
    const parsed = JSON.parse(payload) as Partial<StoreSnapshot>;
    // Note: migrations are applied during import in store.ts, using migration logic defined in migrations.ts
    return normalizeSnapshot(parsed);
  } catch (error) {
    console.warn('Failed to parse snapshot payload', error);
    return null;
  }
};

// Re-export from new modularized serialization modules for backwards compatibility
export * from './serialization/index';

// Re-export game logic for resource merging (extracted to lib/)
export { mergeResourceDelta } from '@/lib/resourceMerging';
