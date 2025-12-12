import type { Vector3 } from 'three';
import { FACTORY_CONFIG } from './config';

/**
 * Represents a single refining process within a factory.
 * Tracks ore type, progress, and energy consumption.
 */
export interface RefineProcess {
  /** Unique identifier for this process instance. */
  id: string;
  /** The type of ore being refined (e.g., 'ore'). */
  oreType: string;
  /** The amount of ore involved in this batch. */
  amount: number;
  /** Current progress from 0.0 to 1.0. */
  progress: number;
  /** Total duration required for the process in seconds. */
  timeTotal: number; // seconds
  /** Energy required to sustain the process. */
  energyRequired: number;
  /** Factor modifying process speed (e.g., based on power availability). */
  speedMultiplier: number;
}

/**
 * Represents a factory's request for resources to fulfill an upgrade.
 * Factories request resources when local inventory is insufficient for the next upgrade cost.
 * Warehouse logistics scheduler prioritizes fulfilling these requests.
 */
export interface FactoryUpgradeRequest {
  /** The ID of the upgrade being requested (e.g., 'docking'). */
  upgrade: string;
  /** The exact resource cost required to complete the upgrade. */
  resourceNeeded: Partial<FactoryResources>;
  /** The amount of resources already delivered towards this request. */
  fulfilledAmount: Partial<FactoryResources>;
  /** Current status of the request. */
  status: 'pending' | 'partially_fulfilled' | 'fulfilled' | 'expired';
  /** Timestamp (ms) when the request was created. */
  createdAt: number;
  /** Timestamp (ms) when the request expires. */
  expiresAt: number;
}

/**
 * Represents the inventory and financial resources held by a factory.
 */
export interface FactoryResources {
  /** Raw ore available for refining. */
  ore: number;
  /** Refined metal bars. */
  bars: number;
  /** Refined metals. */
  metals: number;
  /** Refined crystals. */
  crystals: number;
  /** Refined organics. */
  organics: number;
  /** Refined ice. */
  ice: number;
  /** Liquid credits available. */
  credits: number;
}

/**
 * Tracks the level of installed upgrades in a factory.
 */
export interface FactoryUpgrades {
  /** Level of docking bay upgrade (capacity). */
  docking: number;
  /** Level of refinery upgrade (speed/slots). */
  refine: number;
  /** Level of storage upgrade (capacity). */
  storage: number;
  /** Level of energy system upgrade (capacity/recharge). */
  energy: number;
  /** Level of solar array upgrade (passive generation). */
  solar: number;
}

/**
 * Represents a purchasable, placeable Factory building.
 * Drones dock here to unload and refine resources.
 */
export interface BuildableFactory {
  /** Unique factory ID. */
  id: string;
  /** World position of the factory. */
  position: Vector3;
  /** Maximum number of drones that can dock simultaneously. */
  dockingCapacity: number;
  /** Number of parallel refining slots available. */
  refineSlots: number;
  /** Energy consumed per second when idle. */
  idleEnergyPerSec: number;
  /** Energy consumed per active refine process. */
  energyPerRefine: number;
  /** Maximum capacity for resource storage. */
  storageCapacity: number;
  /** Current volume of stored resources. */
  currentStorage: number;
  /** List of drone IDs currently in queue or docked. */
  queuedDrones: string[]; // queue order; first dockingCapacity entries are active docks
  /** Active refining processes. */
  activeRefines: RefineProcess[];
  /** Whether the factory is pinned in the UI/view. */
  pinned: boolean;
  /** Current stored energy. */
  energy: number;
  /** Maximum energy capacity. */
  energyCapacity: number;
  /** Current resource inventory. */
  resources: FactoryResources;
  /** Current upgrade levels. */
  upgrades: FactoryUpgrades;
  /** Active requests for upgrade resources. */
  upgradeRequests: FactoryUpgradeRequest[];
  /** Number of haulers assigned to this factory. */
  haulersAssigned?: number;
  /** Configuration for hauler behavior. */
  haulerConfig?: {
    /** Cargo capacity per hauler. */
    capacity: number;
    /** Movement speed of haulers. */
    speed: number;
    /** Time taken to pick up resources. */
    pickupOverhead: number;
    /** Time taken to drop off resources. */
    dropoffOverhead: number;
    /** Allowed resources for transport. */
    resourceFilters: string[];
    /** Logic mode for hauling. */
    mode: 'auto' | 'manual' | 'demand-first' | 'supply-first';
    /** Priority level for scheduling. */
    priority: number;
  };
  /** Applied upgrades for haulers. */
  haulerUpgrades?: {
    /** Additional capacity. */
    capacityBoost?: number;
    /** Additional speed. */
    speedBoost?: number;
    /** Efficiency improvements. */
    efficiencyBoost?: number;
  };
  /** Internal state for logistics system. */
  logisticsState?: {
    /** Tracked outbound reservations by resource type. */
    outboundReservations: Record<string, number>;
    /** Scheduled inbound deliveries. */
    inboundSchedules: Array<{
      fromFactoryId: string;
      resource: string;
      amount: number;
      eta: number;
    }>;
  };
}

/**
 * Creates a new factory instance at the given position with default configuration.
 * Called after purchase; position should be set by placement UI.
 *
 * @param id - The unique ID for the new factory.
 * @param position - The world position for the factory.
 * @returns A new BuildableFactory object initialized with defaults.
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
