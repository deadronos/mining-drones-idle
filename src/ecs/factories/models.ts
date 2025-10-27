import type { Vector3 } from 'three';
import { FACTORY_CONFIG } from './config';

/**
 * Represents a single refining process within a factory.
 * Tracks ore type, progress, and energy consumption.
 */
export interface RefineProcess {
  id: string;
  oreType: string;
  amount: number;
  progress: number; // 0..1
  timeTotal: number; // seconds
  energyRequired: number;
  speedMultiplier: number; // reduces speed if energy low
}

/**
 * Represents a factory's request for resources to fulfill an upgrade.
 * Factories request resources when local inventory is insufficient for the next upgrade cost.
 * Warehouse logistics scheduler prioritizes fulfilling these requests.
 */
export interface FactoryUpgradeRequest {
  upgrade: string; // FactoryUpgradeId
  resourceNeeded: Partial<FactoryResources>; // exact cost breakdown for the upgrade
  fulfilledAmount: Partial<FactoryResources>; // how much has been delivered so far
  status: 'pending' | 'partially_fulfilled' | 'fulfilled' | 'expired';
  createdAt: number; // timestamp (Date.now()) for diagnostics and priority
  expiresAt: number; // expiration timestamp (createdAt + 60s)
}

/**
 * Represents a purchasable, placeable Factory building.
 * Drones dock here to unload and refine resources.
 */
export interface FactoryResources {
  ore: number;
  bars: number;
  metals: number;
  crystals: number;
  organics: number;
  ice: number;
  credits: number;
}

export interface FactoryUpgrades {
  docking: number;
  refine: number;
  storage: number;
  energy: number;
  solar: number;
}

export interface BuildableFactory {
  id: string;
  position: Vector3;
  dockingCapacity: number;
  refineSlots: number;
  idleEnergyPerSec: number;
  energyPerRefine: number;
  storageCapacity: number;
  currentStorage: number;
  queuedDrones: string[]; // queue order; first dockingCapacity entries are active docks
  activeRefines: RefineProcess[];
  pinned: boolean;
  energy: number;
  energyCapacity: number;
  resources: FactoryResources;
  upgrades: FactoryUpgrades;
  upgradeRequests: FactoryUpgradeRequest[]; // active upgrade resource requests
  haulersAssigned?: number;
  haulerConfig?: {
    capacity: number;
    speed: number;
    pickupOverhead: number;
    dropoffOverhead: number;
    resourceFilters: string[];
    mode: 'auto' | 'manual' | 'demand-first' | 'supply-first';
    priority: number;
  };
  haulerUpgrades?: {
    capacityBoost?: number;
    speedBoost?: number;
    efficiencyBoost?: number;
  };
  logisticsState?: {
    outboundReservations: Record<string, number>;
    inboundSchedules: Array<{
      fromFactoryId: string;
      resource: string;
      amount: number;
      eta: number;
    }>;
  };
}

/**
 * Creates a new factory at the given position.
 * Called after purchase; position should be set by placement UI.
 */
export const createFactory = (id: string, position: Vector3): BuildableFactory => ({
  id,
  position: position.clone(),
  dockingCapacity: FACTORY_CONFIG.dockingCapacity,
  refineSlots: FACTORY_CONFIG.refineSlots,
  idleEnergyPerSec: FACTORY_CONFIG.idleEnergyPerSec,
  energyPerRefine: FACTORY_CONFIG.energyPerRefine,
  storageCapacity: FACTORY_CONFIG.storageCapacity,
  currentStorage: 0,
  queuedDrones: [],
  activeRefines: [],
  pinned: false,
  energy: FACTORY_CONFIG.initialEnergy,
  energyCapacity: FACTORY_CONFIG.energyCapacity,
  resources: {
    ore: 0,
    bars: 0,
    metals: 0,
    crystals: 0,
    organics: 0,
    ice: 0,
    credits: 0,
  },
  upgrades: { docking: 0, refine: 0, storage: 0, energy: 0, solar: 0 },
  upgradeRequests: [],
  haulersAssigned: 0,
  haulerConfig: {
    capacity: 50,
    speed: 1.0,
    pickupOverhead: 1.0,
    dropoffOverhead: 1.0,
    resourceFilters: [],
    mode: 'auto',
    priority: 5,
  },
  haulerUpgrades: undefined,
  logisticsState: {
    outboundReservations: {},
    inboundSchedules: [],
  },
});
