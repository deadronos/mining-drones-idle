import type { StoreApi } from 'zustand/vanilla';
import type {
  BuildableFactory,
  FactoryResources,
  FactoryUpgrades,
  DockingResult,
} from '@/ecs/factories';
import type { TransportableResource } from '@/ecs/logistics';
import type {
  moduleDefinitions,
  haulerModuleDefinitions,
  factoryHaulerUpgradeDefinitions,
} from './constants';

export type { FactoryResources, FactoryUpgrades };

/** Graphical performance preset affecting visual effects and rendering quality. */
export type PerformanceProfile = 'low' | 'medium' | 'high';

/** Array representing a 3D vector [x, y, z]. */
export type VectorTuple = [number, number, number];

/**
 * Serializable snapshot of travel data used for persistence.
 */
export interface TravelSnapshot {
  /** Start position of the journey. */
  from: VectorTuple;
  /** Destination position. */
  to: VectorTuple;
  /** Seconds elapsed since travel began. */
  elapsed: number;
  /** Total duration of travel in seconds. */
  duration: number;
  /** Optional control point for curve calculation. */
  control?: VectorTuple;
}

/**
 * Serializable snapshot of a factory refining process.
 */
export interface RefineProcessSnapshot {
  /** Unique ID of the process. */
  id: string;
  /** Type of ore being refined. */
  oreType: string;
  /** Amount of input ore. */
  amount: number;
  /** Progress towards completion (0-1). */
  progress: number;
  /** Total time required for the process. */
  timeTotal: number;
  /** Energy cost per unit of progress. */
  energyRequired: number;
  /** Speed multiplier currently applied. */
  speedMultiplier: number;
}

/**
 * Snapshot of factory resource inventory.
 */
export interface FactoryResourceSnapshot {
  /** Raw ore count. */
  ore: number;
  /** Refined bars count. */
  bars: number;
  /** Processed metals count. */
  metals: number;
  /** Processed crystals count. */
  crystals: number;
  /** Processed organics count. */
  organics: number;
  /** Processed ice count. */
  ice: number;
  /** Local credits (if applicable). */
  credits: number;
}

/**
 * Snapshot of factory upgrade levels.
 */
export interface FactoryUpgradeSnapshot {
  /** Docking bay level. */
  docking: number;
  /** Refinery level. */
  refine: number;
  /** Storage level. */
  storage: number;
  /** Energy system level. */
  energy: number;
  /** Solar array level. */
  solar: number;
}

/**
 * Snapshot of an active factory upgrade request.
 */
export interface FactoryUpgradeRequestSnapshot {
  /** The upgrade identifier. */
  upgrade: string;
  /** Resources required to complete the upgrade. */
  resourceNeeded: Partial<FactoryResourceSnapshot>;
  /** Resources already delivered. */
  fulfilledAmount: Partial<FactoryResourceSnapshot>;
  /** Status of the request. */
  status: 'pending' | 'partially_fulfilled' | 'fulfilled' | 'expired';
  /** Creation timestamp. */
  createdAt: number;
  /** Expiration timestamp. */
  expiresAt: number;
}

/**
 * Serializable snapshot of a factory entity.
 */
export interface FactorySnapshot {
  /** Unique factory ID. */
  id: string;
  /** Position in world space. */
  position: VectorTuple;
  /** Maximum concurrent docking capacity. */
  dockingCapacity: number;
  /** Number of refining slots. */
  refineSlots: number;
  /** Idle energy drain per second. */
  idleEnergyPerSec: number;
  /** Energy cost per refine operation. */
  energyPerRefine: number;
  /** Maximum storage capacity. */
  storageCapacity: number;
  /** Current storage usage. */
  currentStorage: number;
  /** List of drone IDs in docking queue. */
  queuedDrones: string[];
  /** Active refining processes. */
  activeRefines: RefineProcessSnapshot[];
  /** Whether factory is pinned in UI. */
  pinned: boolean;
  /** Current energy stored. */
  energy: number;
  /** Maximum energy capacity. */
  energyCapacity: number;
  /** Resource inventory. */
  resources: FactoryResourceSnapshot;
  /** Upgrade levels. */
  upgrades: FactoryUpgradeSnapshot;
  /** Active upgrade resource requests. */
  upgradeRequests?: FactoryUpgradeRequestSnapshot[];
  /** Number of haulers assigned. */
  haulersAssigned?: number;
  /** Configuration for haulers. */
  haulerConfig?: HaulerConfig;
  /** Applied hauler upgrades. */
  haulerUpgrades?: FactoryHaulerUpgrades;
  /** Internal logistics state. */
  logisticsState?: FactoryLogisticsState;
}

/**
 * Configuration for hauler behavior at a factory.
 */
export interface HaulerConfig {
  /** Cargo capacity per trip. */
  capacity: number;
  /** Travel speed. */
  speed: number;
  /** Delay at pickup. */
  pickupOverhead: number;
  /** Delay at dropoff. */
  dropoffOverhead: number;
  /** Allowed resources to transport. */
  resourceFilters: string[];
  /** Dispatching mode logic. */
  mode: 'auto' | 'manual' | 'demand-first' | 'supply-first';
  /** Scheduler priority. */
  priority: number;
}

/**
 * Upgrades applied to haulers at a specific factory.
 */
export interface FactoryHaulerUpgrades {
  /** Capacity multiplier or addition. */
  capacityBoost?: number;
  /** Speed multiplier or addition. */
  speedBoost?: number;
  /** Efficiency modifier. */
  efficiencyBoost?: number;
}

/**
 * Internal state for factory logistics reservations and schedules.
 */
export interface FactoryLogisticsState {
  /** Reserved outbound amounts keyed by resource. */
  outboundReservations: Record<string, number>;
  /** Scheduled inbound deliveries. */
  inboundSchedules: Array<{
    fromFactoryId: string;
    resource: string;
    amount: number;
    eta: number;
  }>;
}

/**
 * Represents a pending resource transfer between factories.
 */
export interface PendingTransfer {
  /** Unique transfer ID. */
  id: string;
  /** ID of source factory. */
  fromFactoryId: string;
  /** ID of destination factory. */
  toFactoryId: string;
  /** Resource being transferred. */
  resource: TransportableResource;
  /** Amount being transferred. */
  amount: number;
  /** Current status of the transfer. */
  status: 'scheduled' | 'in-transit' | 'completed';
  /** Estimated arrival time (game time). */
  eta: number;
  /** Departure time (game time). */
  departedAt: number;
}

/**
 * Global queues for logistics operations.
 */
export interface LogisticsQueues {
  /** List of all active/pending transfers. */
  pendingTransfers: PendingTransfer[];
}

/**
 * State for highlighting factory interactions in the UI.
 */
export interface HighlightedFactories {
  /** ID of the source factory (e.g., drag start). */
  sourceId: string | null;
  /** ID of the destination factory (e.g., drag target). */
  destId: string | null;
}

/**
 * A single data point for metrics.
 */
export interface MetricSample {
  /** Timestamp of the sample. */
  ts: number;
  /** Value of the metric. */
  value: number;
}

/** IDs for factory-specific metric series. */
export type FactoryMetricSeriesId = 'oreIn' | 'barsOut' | 'energyUse' | 'haulerThroughput';

/** Collection of metric series for a factory. */
export type FactoryMetricSeries = Record<FactoryMetricSeriesId, MetricSample[]>;

/** Snapshot of factory metrics at a point in time. */
export interface FactoryMetricSnapshot {
  ore: number;
  bars: number;
  energy: number;
  timestamp: number;
}

/**
 * Global state for the metrics system.
 */
export interface MetricsState {
  /** Historical series data keyed by factory ID. */
  series: Record<string, FactoryMetricSeries>;
  /** Latest snapshots keyed by factory ID. */
  snapshots: Record<string, FactoryMetricSnapshot>;
  /** Accumulators for pending hauler throughput. */
  pendingHauler: Record<string, number>;
  /** Time accumulator for metric intervals. */
  accumulatorMs: number;
}

/** Current phase of a drone's flight. */
export type DroneFlightPhase = 'toAsteroid' | 'returning';

/**
 * Persistent state of a drone's flight.
 */
export interface DroneFlightState {
  /** ID of the drone. */
  droneId: string;
  /** Current flight phase. */
  state: DroneFlightPhase;
  /** Target asteroid ID (if going to asteroid). */
  targetAsteroidId: string | null;
  /** Target region ID on asteroid. */
  targetRegionId: string | null;
  /** Target factory ID (if returning). */
  targetFactoryId: string | null;
  /** RNG seed for path reconstruction. */
  pathSeed: number;
  /** Travel data snapshot. */
  travel: TravelSnapshot;
}

/**
 * Global resource inventory.
 */
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

/**
 * State of global module levels.
 */
export interface Modules {
  droneBay: number;
  refinery: number;
  storage: number;
  solar: number;
  scanner: number;
  haulerDepot: number;
  logisticsHub: number;
  routingProtocol: number;
}

/**
 * Prestige currency state.
 */
export interface Prestige {
  /** Number of prestige cores owned. */
  cores: number;
}

/**
 * Metadata for saved games.
 */
export interface SaveMeta {
  /** Timestamp of last save. */
  lastSave: number;
  /** Version string of the save format. */
  version: string;
}

/** Numeric notation preference. */
export type NotationMode = 'standard' | 'engineering';

/**
 * User settings configuration.
 */
export interface StoreSettings {
  /** Whether autosave is active. */
  autosaveEnabled: boolean;
  /** Interval between autosaves in seconds. */
  autosaveInterval: number;
  /** Maximum offline progress time in hours. */
  offlineCapHours: number;
  /** Number formatting style. */
  notation: NotationMode;
  /** Minimum performance floor for battery throttling. */
  throttleFloor: number;
  /** Show visual trails for drones. */
  showTrails: boolean;
  /** Show visual ships for haulers. */
  showHaulerShips: boolean;
  /** Toggle visibility of the floating debug panel */
  showDebugPanel: boolean;
  /** Enable the experimental Rust/WASM simulation engine */
  useRustSim: boolean;
  /** Run Rust simulation in background to verify parity */
  shadowMode: boolean;
  /** Graphics quality profile. */
  performanceProfile: PerformanceProfile;
  /** Whether the inspector panel is collapsed. */
  inspectorCollapsed: boolean;
  /** Metrics collection settings. */
  metrics: {
    enabled: boolean;
    intervalSeconds: number;
    retentionSeconds: number;
  };
}

/**
 * Stats returned from refinery processing tick.
 */
export interface RefineryStats {
  oreConsumed: number;
  barsProduced: number;
}

/**
 * Full serializable snapshot of the application store.
 */
export interface StoreSnapshot {
  /** Version tag for snapshot schema used across Rust/TS. */
  schemaVersion?: string;
  resources: Resources;
  modules: Modules;
  prestige: Prestige;
  save: SaveMeta;
  settings: StoreSettings;
  rngSeed?: number;
  droneFlights?: DroneFlightState[];
  factories?: FactorySnapshot[];
  selectedFactoryId?: string | null;
  droneOwners?: Record<string, string | null>;
  logisticsQueues?: LogisticsQueues;
  specTechs?: SpecTechState;
  specTechSpent?: SpecTechSpentState;
  prestigeInvestments?: PrestigeInvestmentState;
  gameTime?: number;
}

/**
 * The full Zustand store state definition, including actions.
 */
export interface StoreState {
  // State properties
  resources: Resources;
  modules: Modules;
  prestige: Prestige;
  save: SaveMeta;
  settings: StoreSettings;
  rngSeed: number;
  droneFlights: DroneFlightState[];
  factories: BuildableFactory[];
  logisticsQueues: LogisticsQueues;
  specTechs: SpecTechState;
  specTechSpent: SpecTechSpentState;
  prestigeInvestments: PrestigeInvestmentState;
  gameTime: number;
  factoryProcessSequence: number;
  factoryRoundRobin: number;
  factoryAutofitSequence: number;
  cameraResetSequence: number;
  logisticsTick: number;
  metrics: MetricsState;
  selectedAsteroidId: string | null;
  selectedFactoryId: string | null;
  droneOwners: Record<string, string | null>;
  highlightedFactories: HighlightedFactories;

  // Actions
  /** Adds resources to the global inventory. */
  addResources(this: void, delta: Partial<Resources>, options?: { capacityAware?: boolean }): void;
  /** Adds raw ore to global inventory. */
  addOre(this: void, amount: number): void;
  /** Purchases a global module upgrade. */
  buy(this: void, id: ModuleId): void;
  /** Advances the game simulation by dt seconds. */
  tick(this: void, dt: number): void;
  /** Processes refinery logic for offline simulation. */
  processRefinery(this: void, dt: number): RefineryStats;
  /** Checks if a prestige reset is available. */
  prestigeReady(this: void): boolean;
  /** Calculates estimated prestige currency gain. */
  preview(this: void): number;
  /** Executes a prestige reset. */
  doPrestige(this: void): void;
  /** Updates the last save timestamp. */
  setLastSave(this: void, timestamp: number): void;
  /** Updates user settings. */
  updateSettings(this: void, patch: Partial<StoreSettings>): void;
  /** Sets the currently selected asteroid. */
  setSelectedAsteroid(this: void, asteroidId: string | null): void;
  /** Toggles the inspector visibility. */
  toggleInspector(this: void): void;
  /** Applies a full state snapshot (load game). */
  applySnapshot(this: void, snapshot: StoreSnapshot): void;
  /** Serializes current state to JSON string. */
  exportState(this: void): string;
  /** Imports state from JSON string. */
  importState(this: void, payload: string): boolean;
  /** Persists a drone flight state. */
  recordDroneFlight(this: void, flight: DroneFlightState): void;
  /** Clears a persisted drone flight. */
  clearDroneFlight(this: void, droneId: string): void;
  /** Adds a new factory to the world state. */
  addFactory(this: void, factory: BuildableFactory): void;
  /** Removes a factory from the world state. */
  removeFactory(this: void, factoryId: string): void;
  /** Retrieves a factory by ID. */
  getFactory(this: void, factoryId: string): BuildableFactory | undefined;
  /** Purchases and places a new factory. */
  purchaseFactory(this: void): boolean;
  /** Toggles the pinned status of a factory. */
  toggleFactoryPinned(this: void, factoryId: string): void;
  /** Sets the pinned status of a factory. */
  setFactoryPinned(this: void, factoryId: string, pinned: boolean): void;
  /** Sets the currently selected factory. */
  setSelectedFactory(this: void, factoryId: string | null): void;
  /** Cycles selection through available factories. */
  cycleSelectedFactory(this: void, direction: 1 | -1): void;
  /** Advances the round-robin counter for factory logic. */
  nextFactoryRoundRobin(this: void): number;
  /** Docks a drone at a specific factory. */
  dockDroneAtFactory(this: void, factoryId: string, droneId: string): DockingResult;
  /** Undocks a drone from a factory. */
  undockDroneFromFactory(
    this: void,
    factoryId: string,
    droneId: string,
    options?: { transferOwnership?: boolean },
  ): void;
  /**
   * Forcefully remove a drone from any factory queues/docks, clear its ownership, and persist the change.
   * Intended for developer tooling (e.g. debug panel) to recover stuck drones.
   */
  unstickDrone(this: void, droneId: string): void;
  /** Transfers ore from global/other to factory storage. */
  transferOreToFactory(this: void, factoryId: string, amount: number): number;
  /** Adds arbitrary resources to a factory (cheat/debug/logic). */
  addResourcesToFactory(this: void, factoryId: string, delta: Partial<FactoryResources>): void;
  /** Allocates energy to a factory. */
  allocateFactoryEnergy(this: void, factoryId: string, amount: number): number;
  /** Upgrades a factory module. */
  upgradeFactory(
    this: void,
    factoryId: string,
    upgrade: keyof FactoryUpgrades,
    variant?: FactoryUpgradeCostVariantId,
  ): boolean;
  /** Assigns or unassigns haulers to a factory. */
  assignHaulers(this: void, factoryId: string, delta: number): boolean;
  /** Updates hauler configuration for a factory. */
  updateHaulerConfig(this: void, factoryId: string, config: Partial<HaulerConfig>): void;
  /** Purchases a global hauler module. */
  purchaseHaulerModule(this: void, moduleId: HaulerModuleId): boolean;
  /** Purchases a specific hauler upgrade for a factory. */
  purchaseFactoryHaulerUpgrade(
    this: void,
    factoryId: string,
    upgradeId: FactoryHaulerUpgradeId,
  ): boolean;
  /** Purchases a specialized technology. */
  purchaseSpecTech(this: void, techId: SpecTechId): boolean;
  /** Invests prestige currency into upgrades. */
  investPrestige(this: void, investmentId: PrestigeInvestmentId): boolean;
  /** Retrieves logistics status for a factory. */
  getLogisticsStatus(
    this: void,
    factoryId: string,
  ): { haulersAssigned: number; config?: HaulerConfig; state?: FactoryLogisticsState } | null;
  /** Processes logistics ticks. */
  processLogistics(this: void, dt: number): void;
  /** Processes factory logic ticks. */
  processFactories(this: void, dt: number): void;
  /** Triggers the camera autofit sequence. */
  triggerFactoryAutofit(this: void): void;
  /** Triggers camera reset. */
  resetCamera(this: void): void;
  /** Resets the entire game state. */
  resetGame(this: void): void;
  /** Sets the highlighted factories for UI interaction. */
  setHighlightedFactories(this: void, highlight: HighlightedFactories): void;
  /** Syncs logistics queues from an external source (e.g. Rust). */
  syncLogisticsQueues(this: void, queues: LogisticsQueues): void;
  syncResources(this: void, resources: Resources): void;
}

/** Type alias for the StoreApi. */
export type StoreApiType = StoreApi<StoreState>;

/** Keys for global modules. */
export type ModuleId = keyof typeof moduleDefinitions;

/** Keys for hauler modules. */
export type HaulerModuleId = keyof typeof haulerModuleDefinitions;

/** Keys for factory-specific hauler upgrades. */
export type FactoryHaulerUpgradeId = keyof typeof factoryHaulerUpgradeDefinitions;

/** Keys for factory upgrades. */
export type FactoryUpgradeId = keyof FactoryUpgrades;

/** Resource types that can be used as alternative costs. */
export type FactoryUpgradeCostVariantId = 'bars' | 'metals' | 'crystals' | 'organics' | 'ice';

/** IDs for specialized technologies. */
export type SpecTechId = 'oreMagnet' | 'crystalResonance' | 'biotechFarming' | 'cryoPreservation';

/** IDs for prestige investments. */
export type PrestigeInvestmentId =
  | 'droneVelocity'
  | 'asteroidAbundance'
  | 'refineryMastery'
  | 'offlineEfficiency';

/** Map of resource costs for upgrades. */
export type FactoryUpgradeCostMap = Partial<FactoryResources>;

/** Definition of a factory upgrade logic. */
export interface FactoryUpgradeDefinition {
  label: string;
  description: string;
  baseCost: FactoryUpgradeCostMap;
  alternativeCosts?: Partial<Record<FactoryUpgradeCostVariantId, FactoryUpgradeCostMap>>;
  apply(factory: BuildableFactory): void;
}

/** State mapping spec tech IDs to levels. */
export type SpecTechState = Record<SpecTechId, number>;

/** State mapping resources spent on spec tech. */
export type SpecTechSpentState = Record<'metals' | 'crystals' | 'organics' | 'ice', number>;

/** State mapping prestige investment IDs to levels. */
export type PrestigeInvestmentState = Record<PrestigeInvestmentId, number>;
