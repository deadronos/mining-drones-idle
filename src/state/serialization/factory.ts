import { FACTORY_CONFIG } from '@/ecs/factories';
import type { BuildableFactory, FactoryUpgradeRequest } from '@/ecs/factories';
import type {
  FactorySnapshot,
  FactoryUpgradeRequestSnapshot,
  HaulerConfig,
  FactoryLogisticsState,
  FactoryHaulerUpgrades,
} from '../types';
import { normalizeVectorTuple } from './vectors';
import {
  normalizeFactoryResources,
  normalizeFactoryUpgrades,
  normalizeRefineSnapshot,
  cloneRefineProcess,
  snapshotToRefineProcess,
  refineProcessToSnapshot,
} from './resources';
import { coerceNumber, vector3ToTuple, tupleToVector3 } from '../utils';

// Type guard for hauler config objects
function isHaulerConfig(value: unknown): value is Partial<HaulerConfig> {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('capacity' in value ||
      'speed' in value ||
      'pickupOverhead' in value ||
      'dropoffOverhead' in value ||
      'resourceFilters' in value ||
      'mode' in value ||
      'priority' in value)
  );
}

function isFactoryHaulerUpgrades(value: unknown): value is Partial<FactoryHaulerUpgrades> {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('capacityBoost' in value || 'speedBoost' in value || 'efficiencyBoost' in value)
  );
}

// Type guard for logistics state objects
function isLogisticsState(value: unknown): value is Partial<FactoryLogisticsState> {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('outboundReservations' in value || 'inboundSchedules' in value)
  );
}

// Normalize upgrade request snapshot
function normalizeUpgradeRequest(value: unknown): FactoryUpgradeRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const req = value as Partial<FactoryUpgradeRequestSnapshot>;
  if (typeof req.upgrade !== 'string' || typeof req.status !== 'string') {
    return null;
  }

  const resourceNeeded = normalizeFactoryResources(req.resourceNeeded);
  const fulfilledAmount = normalizeFactoryResources(req.fulfilledAmount);
  const validStatuses = ['pending', 'partially_fulfilled', 'fulfilled', 'expired'];

  return {
    upgrade: req.upgrade,
    resourceNeeded,
    fulfilledAmount,
    status: validStatuses.includes(req.status) ? req.status : 'pending',
    createdAt: Math.max(0, coerceNumber(req.createdAt, Date.now())),
    expiresAt: Math.max(0, coerceNumber(req.expiresAt, Date.now() + 60000)),
  };
}

export const normalizeFactorySnapshot = (value: unknown): FactorySnapshot | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Partial<FactorySnapshot> & { position?: unknown };
  const position = normalizeVectorTuple(raw.position);
  if (!position) {
    return null;
  }

  // Normalize activeRefines
  const activeRefines: FactorySnapshot['activeRefines'] = [];
  if (Array.isArray(raw.activeRefines)) {
    for (const entry of raw.activeRefines) {
      const normalized = normalizeRefineSnapshot(entry);
      if (normalized !== null) {
        activeRefines.push(normalized);
      }
    }
  }

  // Normalize haulerConfig
  let haulerConfig: HaulerConfig | undefined;
  if (isHaulerConfig(raw.haulerConfig)) {
    const hc = raw.haulerConfig;
    haulerConfig = {
      capacity: Math.max(1, Math.floor(coerceNumber(hc.capacity, 50))),
      speed: Math.max(0.1, coerceNumber(hc.speed, 1.0)),
      pickupOverhead: Math.max(0, coerceNumber(hc.pickupOverhead, 1.0)),
      dropoffOverhead: Math.max(0, coerceNumber(hc.dropoffOverhead, 1.0)),
      resourceFilters: Array.isArray(hc.resourceFilters)
        ? hc.resourceFilters.filter((val): val is string => typeof val === 'string')
        : [],
      mode: ['auto', 'manual', 'demand-first', 'supply-first'].includes(String(hc.mode))
        ? (hc.mode as unknown as 'auto' | 'manual' | 'demand-first' | 'supply-first')
        : 'auto',
      priority: Math.min(10, Math.max(0, Math.floor(coerceNumber(hc.priority, 5)))),
    };
  }

  let haulerUpgrades: FactoryHaulerUpgrades | undefined;
  if (isFactoryHaulerUpgrades(raw.haulerUpgrades)) {
    haulerUpgrades = {};
    if (typeof raw.haulerUpgrades.capacityBoost === 'number') {
      haulerUpgrades.capacityBoost = Math.max(0, Math.floor(raw.haulerUpgrades.capacityBoost));
    }
    if (typeof raw.haulerUpgrades.speedBoost === 'number') {
      haulerUpgrades.speedBoost = Math.max(0, Math.floor(raw.haulerUpgrades.speedBoost));
    }
    if (typeof raw.haulerUpgrades.efficiencyBoost === 'number') {
      haulerUpgrades.efficiencyBoost = Math.max(
        0,
        Math.floor(raw.haulerUpgrades.efficiencyBoost),
      );
    }
    if (
      haulerUpgrades.capacityBoost === undefined &&
      haulerUpgrades.speedBoost === undefined &&
      haulerUpgrades.efficiencyBoost === undefined
    ) {
      haulerUpgrades = undefined;
    }
  }

  // Normalize logisticsState
  let logisticsState: FactoryLogisticsState | undefined;
  if (isLogisticsState(raw.logisticsState)) {
    const ls = raw.logisticsState;
    const outboundReservations: Record<string, number> = {};
    if (typeof ls.outboundReservations === 'object' && ls.outboundReservations !== null) {
      for (const [key, val] of Object.entries(ls.outboundReservations)) {
        const amount = coerceNumber(val, 0);
        if (amount > 0) {
          outboundReservations[key] = amount;
        }
      }
    }

    const inboundSchedules: FactoryLogisticsState['inboundSchedules'] = [];
    if (Array.isArray(ls.inboundSchedules)) {
      for (const schedule of ls.inboundSchedules) {
        if (
          typeof schedule === 'object' &&
          schedule !== null &&
          typeof (schedule as Partial<FactoryLogisticsState['inboundSchedules'][number]>)
            .fromFactoryId === 'string' &&
          typeof (schedule as Partial<FactoryLogisticsState['inboundSchedules'][number]>)
            .resource === 'string'
        ) {
          const sched = schedule as Partial<FactoryLogisticsState['inboundSchedules'][number]>;
          inboundSchedules.push({
            fromFactoryId: sched.fromFactoryId ?? '',
            resource: sched.resource ?? '',
            amount: Math.max(0, coerceNumber(sched.amount, 0)),
            eta: Math.max(0, coerceNumber(sched.eta, 0)),
          });
        }
      }
    }

    logisticsState = {
      outboundReservations,
      inboundSchedules,
    };
  }

  // Normalize upgradeRequests
  const upgradeRequests: FactoryUpgradeRequest[] = [];
  if (Array.isArray(raw.upgradeRequests)) {
    for (const req of raw.upgradeRequests) {
      const normalized = normalizeUpgradeRequest(req);
      if (normalized !== null) {
        upgradeRequests.push(normalized);
      }
    }
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
    activeRefines,
    pinned: Boolean(raw.pinned),
    energy: Math.max(0, coerceNumber(raw.energy, FACTORY_CONFIG.initialEnergy)),
    energyCapacity: Math.max(1, coerceNumber(raw.energyCapacity, FACTORY_CONFIG.energyCapacity)),
    resources: normalizeFactoryResources(raw.resources),
    ownedDrones: Array.isArray(raw.ownedDrones)
      ? raw.ownedDrones.filter((id): id is string => typeof id === 'string')
      : [],
    upgrades: normalizeFactoryUpgrades(raw.upgrades),
    upgradeRequests,
    haulersAssigned: Math.max(0, Math.floor(coerceNumber(raw.haulersAssigned, 0))),
    haulerConfig,
    haulerUpgrades,
    logisticsState,
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
  upgradeRequests: factory.upgradeRequests.map((req) => ({
    upgrade: req.upgrade,
    resourceNeeded: { ...req.resourceNeeded },
    fulfilledAmount: { ...req.fulfilledAmount },
    status: req.status,
    createdAt: req.createdAt,
    expiresAt: req.expiresAt,
  })),
  haulersAssigned: factory.haulersAssigned,
  haulerConfig: factory.haulerConfig ? { ...factory.haulerConfig } : undefined,
  haulerUpgrades: factory.haulerUpgrades ? { ...factory.haulerUpgrades } : undefined,
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
  upgradeRequests: (snapshot.upgradeRequests ?? []).map((req) => ({
    upgrade: req.upgrade,
    resourceNeeded: { ...req.resourceNeeded },
    fulfilledAmount: { ...req.fulfilledAmount },
    status: req.status,
    createdAt: req.createdAt,
    expiresAt: req.expiresAt,
  })),
  haulersAssigned: snapshot.haulersAssigned,
  haulerConfig: snapshot.haulerConfig ? { ...snapshot.haulerConfig } : undefined,
  haulerUpgrades: snapshot.haulerUpgrades ? { ...snapshot.haulerUpgrades } : undefined,
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
  upgradeRequests: factory.upgradeRequests.map((req) => ({
    upgrade: req.upgrade,
    resourceNeeded: { ...req.resourceNeeded },
    fulfilledAmount: { ...req.fulfilledAmount },
    status: req.status,
    createdAt: req.createdAt,
    expiresAt: req.expiresAt,
  })),
  haulersAssigned: factory.haulersAssigned,
  haulerConfig: factory.haulerConfig ? { ...factory.haulerConfig } : undefined,
  haulerUpgrades: factory.haulerUpgrades ? { ...factory.haulerUpgrades } : undefined,
  logisticsState: factory.logisticsState
    ? {
        outboundReservations: { ...factory.logisticsState.outboundReservations },
        inboundSchedules: [...factory.logisticsState.inboundSchedules],
      }
    : undefined,
});
