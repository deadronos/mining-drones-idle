import type { Vector3 } from 'three';

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
 * Factory configuration with sensible defaults.
 */
export const FACTORY_CONFIG = {
  baseCost: { metals: 100, crystals: 50 },
  dockingCapacity: 3,
  refineSlots: 2,
  refineTime: 10, // seconds per batch
  idleEnergyPerSec: 1,
  energyPerRefine: 2,
  storageCapacity: 300,
  energyCapacity: 80,
  initialEnergy: 40,
  priceScaleIncrement: 50, // linear price scaling
} as const;

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

/**
 * Computes the cost to purchase the Nth factory (0-indexed).
 * Uses linear scaling: base + n * increment.
 */
export const computeFactoryCost = (factoryCount: number) => {
  const n = factoryCount; // 0-indexed
  const baseCost = FACTORY_CONFIG.baseCost;
  const priceIncrease = FACTORY_CONFIG.priceScaleIncrement * n;
  return {
    metals: baseCost.metals + priceIncrease,
    crystals: baseCost.crystals + priceIncrease,
  };
};

/**
 * Computes total energy upkeep for all factories.
 * Scales linearly: count * idleEnergyPerSec.
 */
export const computeFactoryEnergyUpkeep = (factoryCount: number): number =>
  factoryCount * FACTORY_CONFIG.idleEnergyPerSec;

/**
 * Attempts to dock a drone to a factory.
 * Returns true if successfully queued (or immediately docked).
 */
export type DockingResult = 'docking' | 'queued' | 'exists';

export const attemptDockDrone = (factory: BuildableFactory, droneId: string): DockingResult => {
  const existingIndex = factory.queuedDrones.indexOf(droneId);
  if (existingIndex !== -1) {
    return existingIndex < factory.dockingCapacity ? 'docking' : 'queued';
  }
  factory.queuedDrones.push(droneId);
  const position = factory.queuedDrones.length - 1;
  return position < factory.dockingCapacity ? 'docking' : 'queued';
};

/**
 * Removes a drone from the factory queue/dock.
 */
export const removeDroneFromFactory = (factory: BuildableFactory, droneId: string): void => {
  factory.queuedDrones = factory.queuedDrones.filter((id) => id !== droneId);
};

/**
 * Returns the number of docked drones (includes those in queue).
 */
export const getDockedDroneCount = (factory: BuildableFactory): number =>
  Math.min(factory.queuedDrones.length, factory.dockingCapacity);

/**
 * Returns the number of available docking slots.
 */
export const getAvailableDockingSlots = (factory: BuildableFactory): number =>
  Math.max(0, factory.dockingCapacity - factory.queuedDrones.length);

/**
 * Returns the number of available refine slots.
 */
export const getAvailableRefineSlots = (factory: BuildableFactory): number =>
  Math.max(0, factory.refineSlots - factory.activeRefines.length);

/**
 * Transfers ore from drone to factory storage.
 * Returns amount actually stored (capped by storage remaining).
 */
export const transferOreToFactory = (factory: BuildableFactory, amount: number): number => {
  const available = factory.storageCapacity - factory.resources.ore;
  const transferred = Math.min(amount, available);
  if (transferred <= 0) {
    return 0;
  }
  factory.resources.ore += transferred;
  factory.currentStorage = factory.resources.ore;
  return transferred;
};

/**
 * Starts a refine process if conditions are met.
 * Returns the created RefineProcess or null if unable to start.
 */
export const startRefineProcess = (
  factory: BuildableFactory,
  oreType: string,
  amount: number,
  processId: string,
): RefineProcess | null => {
  if (factory.activeRefines.length >= factory.refineSlots) {
    return null; // All slots occupied
  }
  if (factory.resources.ore <= 0 || amount <= 0) {
    return null; // No ore to refine
  }

  const toRefine = Math.min(amount, factory.resources.ore);
  const process: RefineProcess = {
    id: processId,
    oreType,
    amount: toRefine,
    progress: 0,
    timeTotal: FACTORY_CONFIG.refineTime,
    energyRequired: FACTORY_CONFIG.energyPerRefine,
    speedMultiplier: 1,
  };

  factory.activeRefines.push(process);
  factory.resources.ore = Math.max(0, factory.resources.ore - toRefine);
  factory.currentStorage = factory.resources.ore;
  return process;
};

/**
 * Advances a refine process by dt seconds.
 * Returns the amount of refined output if completed (and removes from active).
 * Applies speedMultiplier to the time increment.
 */
export const tickRefineProcess = (
  factory: BuildableFactory,
  process: RefineProcess,
  dt: number,
): number => {
  const adjustedDt = dt * process.speedMultiplier;
  process.progress = Math.min(1, process.progress + adjustedDt / process.timeTotal);

  if (process.progress >= 1) {
    // Refine completed
    factory.activeRefines = factory.activeRefines.filter((p) => p.id !== process.id);
    return process.amount; // Return refined amount
  }

  return 0;
};

/**
 * Ensures at least one refine slot is allowed to run.
 * Under low energy, reduces speedMultiplier of active refines.
 * Returns true if at least one refine is active.
 */
export const enforceMinOneRefining = (
  factory: BuildableFactory,
  energyAvailable: number,
  energyCapacity: number,
): boolean => {
  if (factory.activeRefines.length === 0) {
    return false;
  }

  // Compute energy fraction (0..1)
  const energyFraction = energyCapacity > 0 ? Math.max(0, energyAvailable / energyCapacity) : 0;

  // Under low energy, reduce speed; but ensure at least one runs
  if (energyFraction < 0.2 && factory.activeRefines.length > 0) {
    // Low energy: run one at reduced speed, pause others
    factory.activeRefines[0].speedMultiplier = Math.max(0.1, energyFraction * 2); // 0.1x..0.4x
    for (let i = 1; i < factory.activeRefines.length; i += 1) {
      factory.activeRefines[i].speedMultiplier = 0; // Paused
    }
  } else {
    // Normal energy: all can run at normal speed
    factory.activeRefines.forEach((p) => {
      p.speedMultiplier = 1;
    });
  }

  return true;
};

/**
 * Computes the total energy demand for a factory in its current state.
 * Includes idle drain and per-active-refine costs.
 */
export const computeFactoryEnergyDemand = (factory: BuildableFactory): number => {
  const idleDrain = factory.idleEnergyPerSec;
  const activeRefineCost = factory.activeRefines.length * factory.energyPerRefine;
  return idleDrain + activeRefineCost;
};

/**
 * Finds the nearest factory to a given position with available docking capacity.
 * If multiple factories are equidistant, uses round-robin to select (based on counter).
 * Returns the factory and distance, or null if no factories available.
 */
export const findNearestAvailableFactory = (
  factories: BuildableFactory[],
  position: Vector3,
  roundRobinCounter = 0,
): { factory: BuildableFactory; distance: number } | null => {
  const candidates = factories.filter((f) => getAvailableDockingSlots(f) > 0);

  if (candidates.length === 0) {
    return null;
  }

  // Calculate distances
  const withDistances = candidates.map((factory) => ({
    factory,
    distance: position.distanceTo(factory.position),
  }));

  // Sort by distance
  withDistances.sort((a, b) => a.distance - b.distance);

  // If only one or distances are very different, return nearest
  if (withDistances.length === 1 || withDistances[0].distance + 0.01 < withDistances[1].distance) {
    return withDistances[0];
  }

  // Multiple equidistant factories: use round-robin
  const equidistant = [withDistances[0]];
  const tolerance = 0.5; // factories within 0.5 units are considered equidistant
  for (let i = 1; i < withDistances.length; i += 1) {
    if (withDistances[i].distance <= equidistant[0].distance + tolerance) {
      equidistant.push(withDistances[i]);
    } else {
      break;
    }
  }

  const selected = equidistant[roundRobinCounter % equidistant.length];
  return selected;
};

/**
 * Utility to compute distance between two Vector3 positions.
 * Helps with drone routing decisions.
 */
export const computeDistance = (from: Vector3, to: Vector3): number => from.distanceTo(to);

/**
 * Detects if a factory needs resources for its next upgrade.
 * Returns a FactoryUpgradeRequest if a shortfall is detected, null otherwise.
 *
 * This function:
 * 1. Iterates through available upgrades in priority order
 * 2. Computes cost for next affordable level of each upgrade
 * 3. Checks if factory has insufficient local resources
 * 4. Returns request if shortfall detected
 *
 * @param factory Factory to check for upgrade shortfalls
 * @param upgradeIds Array of upgrade IDs to check (in priority order)
 * @returns FactoryUpgradeRequest if shortfall detected, null otherwise
 */
export const detectUpgradeShortfall = (
  factory: BuildableFactory,
  upgradeIds: string[],
): FactoryUpgradeRequest | null => {
  // Don't create duplicate requests for upgrades already pending
  for (const existing of factory.upgradeRequests) {
    if (existing.status !== 'expired') {
      // Request exists and not expired; skip detection for now
      // Multiple requests per factory are allowed for different resources,
      // but we only create one per upgrade ID to avoid duplicate detection
      return null;
    }
  }

  // Check each upgrade in order for shortfall
  for (const upgradeId of upgradeIds) {
    const currentLevel = factory.upgrades[upgradeId as keyof typeof factory.upgrades] ?? 0;
    const nextCost = computeUpgradeCost(upgradeId as keyof typeof factory.upgrades, currentLevel);

    if (!nextCost || Object.keys(nextCost).length === 0) {
      continue; // Skip if no cost defined
    }

    // Check if factory has all required resources locally
    let hasShortfall = false;
    for (const [resource, needed] of Object.entries(nextCost)) {
      if (typeof needed === 'number' && needed > 0) {
        const available = factory.resources[resource as keyof FactoryResources] ?? 0;
        if (available < needed) {
          hasShortfall = true;
          break;
        }
      }
    }

    if (hasShortfall) {
      // Create upgrade request with exact cost breakdown
      const now = Date.now();
      return {
        upgrade: upgradeId,
        resourceNeeded: nextCost,
        fulfilledAmount: {},
        status: 'pending' as const,
        createdAt: now,
        expiresAt: now + 60000, // 60 second timeout
      };
    }
  }

  return null;
};

/**
 * Helper to compute upgrade cost by ID and level.
 * Uses the same logic as state/utils.ts computeFactoryUpgradeCost.
 */
export const computeUpgradeCost = (
  upgradeId: keyof FactoryUpgrades,
  currentLevel: number,
): Partial<FactoryResources> => {
  const upgradeMap: Record<
    keyof FactoryUpgrades,
    { baseCost: Partial<FactoryResources>; growth: number }
  > = {
    docking: {
      baseCost: { bars: 1350 },
      growth: 1.35,
    },
    refine: {
      baseCost: { bars: 1350 },
      growth: 1.35,
    },
    storage: {
      baseCost: { bars: 1350 },
      growth: 1.35,
    },
    energy: {
      baseCost: { bars: 1350 },
      growth: 1.35,
    },
    solar: {
      baseCost: { bars: 1350 },
      growth: 1.35,
    },
  };

  const def = upgradeMap[upgradeId];
  if (!def) return {};

  const result: Partial<FactoryResources> = {};
  for (const [key, value] of Object.entries(def.baseCost)) {
    if (typeof value === 'number') {
      result[key as keyof FactoryResources] = Math.ceil(value * Math.pow(def.growth, currentLevel));
    }
  }
  return result;
};
