import type {
  Resources,
  Modules,
  Prestige,
  SaveMeta,
  NotationMode,
  PerformanceProfile,
  StoreSettings,
  StoreSnapshot,
  StoreState,
  SpecTechState,
  SpecTechSpentState,
  PrestigeInvestmentState,
  PendingTransfer,
  LogisticsQueues,
} from '../types';
import {
  SAVE_VERSION,
  initialResources,
  initialModules,
  initialPrestige,
  initialSave,
  initialSettings,
  initialSpecTechs,
  initialSpecTechSpent,
  initialPrestigeInvestments,
  specTechDefinitions,
} from '../constants';
import { coerceNumber } from './types';
import { normalizeFactorySnapshot } from './factory';
import { normalizeDroneFlights, cloneDroneFlight } from './drones';
import { factoryToSnapshot } from './factory';
import { RESOURCE_TYPES, type TransportableResource } from '@/ecs/logistics/config';

const isTransportableResource = (value: unknown): value is PendingTransfer['resource'] =>
  typeof value === 'string' &&
  (RESOURCE_TYPES as readonly TransportableResource[]).includes(value as TransportableResource);

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
  haulerDepot: Math.max(
    0,
    Math.floor(coerceNumber(snapshot?.haulerDepot, initialModules.haulerDepot)),
  ),
  logisticsHub: Math.max(
    0,
    Math.floor(coerceNumber(snapshot?.logisticsHub, initialModules.logisticsHub)),
  ),
  routingProtocol: Math.max(
    0,
    Math.floor(coerceNumber(snapshot?.routingProtocol, initialModules.routingProtocol)),
  ),
});

export const normalizePrestige = (snapshot?: Partial<Prestige>): Prestige => ({
  cores: Math.max(0, Math.floor(coerceNumber(snapshot?.cores, initialPrestige.cores))),
});

const clampLevel = (value: number, max: number) => Math.max(0, Math.min(max, Math.floor(value)));

export const normalizeSpecTechs = (snapshot?: Partial<SpecTechState>): SpecTechState => ({
  oreMagnet: clampLevel(coerceNumber(snapshot?.oreMagnet, initialSpecTechs.oreMagnet), specTechDefinitions.oreMagnet.maxLevel),
  crystalResonance: clampLevel(
    coerceNumber(snapshot?.crystalResonance, initialSpecTechs.crystalResonance),
    specTechDefinitions.crystalResonance.maxLevel,
  ),
  biotechFarming: clampLevel(
    coerceNumber(snapshot?.biotechFarming, initialSpecTechs.biotechFarming),
    specTechDefinitions.biotechFarming.maxLevel,
  ),
  cryoPreservation: clampLevel(
    coerceNumber(snapshot?.cryoPreservation, initialSpecTechs.cryoPreservation),
    specTechDefinitions.cryoPreservation.maxLevel,
  ),
});

export const normalizeSpecTechSpent = (snapshot?: Partial<SpecTechSpentState>): SpecTechSpentState => ({
  metals: Math.max(0, Math.floor(coerceNumber(snapshot?.metals, initialSpecTechSpent.metals))),
  crystals: Math.max(0, Math.floor(coerceNumber(snapshot?.crystals, initialSpecTechSpent.crystals))),
  organics: Math.max(0, Math.floor(coerceNumber(snapshot?.organics, initialSpecTechSpent.organics))),
  ice: Math.max(0, Math.floor(coerceNumber(snapshot?.ice, initialSpecTechSpent.ice))),
});

const normalizePendingTransfer = (
  transfer?: Partial<PendingTransfer> | null,
): PendingTransfer | null => {
  if (!transfer || typeof transfer !== 'object') {
    return null;
  }

  const id = typeof transfer.id === 'string' && transfer.id.length > 0 ? transfer.id : null;
  const fromFactoryId =
    typeof transfer.fromFactoryId === 'string' && transfer.fromFactoryId.length > 0
      ? transfer.fromFactoryId
      : null;
  const toFactoryId =
    typeof transfer.toFactoryId === 'string' && transfer.toFactoryId.length > 0
      ? transfer.toFactoryId
      : null;

  if (!id || !fromFactoryId || !toFactoryId) {
    return null;
  }

  const eta = coerceNumber(transfer.eta, 0);
  const defaultDepartedAt = Math.max(0, eta - 0.1);
  const departedAt = Math.min(coerceNumber(transfer.departedAt, defaultDepartedAt), eta);
  const status: PendingTransfer['status'] =
    transfer.status === 'in-transit' || transfer.status === 'completed'
      ? transfer.status
      : 'scheduled';

  return {
    id,
    fromFactoryId,
    toFactoryId,
  resource: isTransportableResource(transfer.resource) ? transfer.resource : 'ore',
    amount: Math.max(0, coerceNumber(transfer.amount, 0)),
    status,
    eta,
    departedAt,
  };
};

const normalizeLogisticsQueues = (queues?: Partial<LogisticsQueues>): LogisticsQueues => {
  if (!queues || !Array.isArray(queues.pendingTransfers)) {
    return { pendingTransfers: [] };
  }

  const normalized = queues.pendingTransfers
    .map((entry) => normalizePendingTransfer(entry))
    .filter((entry): entry is PendingTransfer => entry !== null);

  return { pendingTransfers: normalized };
};

export const normalizePrestigeInvestments = (
  snapshot?: Partial<PrestigeInvestmentState>,
): PrestigeInvestmentState => ({
  droneVelocity: Math.max(
    0,
    Math.floor(coerceNumber(snapshot?.droneVelocity, initialPrestigeInvestments.droneVelocity)),
  ),
  asteroidAbundance: Math.max(
    0,
    Math.floor(coerceNumber(snapshot?.asteroidAbundance, initialPrestigeInvestments.asteroidAbundance)),
  ),
  refineryMastery: Math.max(
    0,
    Math.floor(coerceNumber(snapshot?.refineryMastery, initialPrestigeInvestments.refineryMastery)),
  ),
  offlineEfficiency: Math.max(
    0,
    Math.floor(coerceNumber(snapshot?.offlineEfficiency, initialPrestigeInvestments.offlineEfficiency)),
  ),
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
  showHaulerShips:
    typeof snapshot?.showHaulerShips === 'boolean'
      ? snapshot.showHaulerShips
      : initialSettings.showHaulerShips,
  performanceProfile: normalizePerformanceProfile(snapshot?.performanceProfile),
  inspectorCollapsed:
    typeof snapshot?.inspectorCollapsed === 'boolean'
      ? snapshot.inspectorCollapsed
      : initialSettings.inspectorCollapsed,
  metrics: {
    enabled:
      typeof snapshot?.metrics === 'object' && typeof snapshot.metrics.enabled === 'boolean'
        ? snapshot.metrics.enabled
        : initialSettings.metrics.enabled,
    intervalSeconds: Math.max(
      1,
      Math.floor(
        coerceNumber(
          snapshot?.metrics && 'intervalSeconds' in snapshot.metrics
            ? (snapshot.metrics as Partial<StoreSettings['metrics']>).intervalSeconds
            : initialSettings.metrics.intervalSeconds,
          initialSettings.metrics.intervalSeconds,
        ),
      ),
    ),
    retentionSeconds: Math.max(
      initialSettings.metrics.intervalSeconds,
      Math.floor(
        coerceNumber(
          snapshot?.metrics && 'retentionSeconds' in snapshot.metrics
            ? (snapshot.metrics as Partial<StoreSettings['metrics']>).retentionSeconds
            : initialSettings.metrics.retentionSeconds,
          initialSettings.metrics.retentionSeconds,
        ),
      ),
    ),
  },
});

export const normalizeSnapshot = (snapshot: Partial<StoreSnapshot>): StoreSnapshot => ({
  resources: normalizeResources(snapshot.resources),
  modules: normalizeModules(snapshot.modules),
  prestige: normalizePrestige(snapshot.prestige),
  save: normalizeSave(snapshot.save),
  settings: normalizeSettings(snapshot.settings),
  specTechs: normalizeSpecTechs(snapshot.specTechs),
  specTechSpent: normalizeSpecTechSpent(snapshot.specTechSpent),
  prestigeInvestments: normalizePrestigeInvestments(snapshot.prestigeInvestments),
  rngSeed:
    typeof snapshot.rngSeed === 'number' && Number.isFinite(snapshot.rngSeed)
      ? snapshot.rngSeed
      : undefined,
  droneFlights: normalizeDroneFlights(snapshot.droneFlights),
  factories: Array.isArray(snapshot.factories)
    ? snapshot.factories
        .map((entry) => normalizeFactorySnapshot(entry))
        .filter((entry): entry is Exclude<typeof entry, null> => entry !== null)
    : undefined,
  selectedFactoryId:
    typeof snapshot.selectedFactoryId === 'string' && snapshot.selectedFactoryId.length > 0
      ? snapshot.selectedFactoryId
      : null,
  droneOwners:
    snapshot.droneOwners && typeof snapshot.droneOwners === 'object'
      ? Object.entries(snapshot.droneOwners).reduce(
          (acc: Record<string, string | null>, [key, owner]) => {
            acc[key] = typeof owner === 'string' && owner.length > 0 ? owner : null;
            return acc;
          },
          {},
        )
      : undefined,
  logisticsQueues: normalizeLogisticsQueues(snapshot.logisticsQueues),
});

export const serializeStore = (state: StoreState): StoreSnapshot => ({
  resources: { ...state.resources },
  modules: { ...state.modules },
  prestige: { ...state.prestige },
  save: { ...state.save, version: SAVE_VERSION },
  settings: { ...state.settings },
  specTechs: { ...state.specTechs },
  specTechSpent: { ...state.specTechSpent },
  prestigeInvestments: { ...state.prestigeInvestments },
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
