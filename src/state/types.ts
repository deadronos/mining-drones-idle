import type { StoreApi } from 'zustand/vanilla';
import type { BuildableFactory, FactoryResources, FactoryUpgrades } from '@/ecs/factories';
import type { TransportableResource } from '@/ecs/logistics';

export type { FactoryResources, FactoryUpgrades };

export type PerformanceProfile = 'low' | 'medium' | 'high';

export type VectorTuple = [number, number, number];

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

export interface FactoryResourceSnapshot {
  ore: number;
  bars: number;
  metals: number;
  crystals: number;
  organics: number;
  ice: number;
  credits: number;
}

export interface FactoryUpgradeSnapshot {
  docking: number;
  refine: number;
  storage: number;
  energy: number;
  solar: number;
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
  energy: number;
  energyCapacity: number;
  resources: FactoryResourceSnapshot;
  ownedDrones: string[];
  upgrades: FactoryUpgradeSnapshot;
  haulersAssigned?: number;
  haulerConfig?: HaulerConfig;
  logisticsState?: FactoryLogisticsState;
}

export interface HaulerConfig {
  capacity: number;
  speed: number;
  pickupOverhead: number;
  dropoffOverhead: number;
  resourceFilters: string[];
  mode: 'auto' | 'manual' | 'demand-first' | 'supply-first';
  priority: number;
}

export interface FactoryLogisticsState {
  outboundReservations: Record<string, number>;
  inboundSchedules: Array<{
    fromFactoryId: string;
    resource: string;
    amount: number;
    eta: number;
  }>;
}

export interface PendingTransfer {
  id: string;
  fromFactoryId: string;
  toFactoryId: string;
  resource: TransportableResource;
  amount: number;
  status: 'scheduled' | 'in-transit' | 'completed';
  eta: number;
}

export interface LogisticsQueues {
  pendingTransfers: PendingTransfer[];
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
  selectedFactoryId?: string | null;
  droneOwners?: Record<string, string | null>;
  logisticsQueues?: LogisticsQueues;
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
  logisticsQueues: LogisticsQueues;
  gameTime: number;
  factoryProcessSequence: number;
  factoryRoundRobin: number;
  factoryAutofitSequence: number;
  cameraResetSequence: number;
  logisticsTick: number;
  selectedAsteroidId: string | null;
  selectedFactoryId: string | null;
  droneOwners: Record<string, string | null>;
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
  setSelectedFactory(this: void, factoryId: string | null): void;
  cycleSelectedFactory(this: void, direction: 1 | -1): void;
  nextFactoryRoundRobin(this: void): number;
  dockDroneAtFactory(
    this: void,
    factoryId: string,
    droneId: string,
  ): import('@/ecs/factories').DockingResult;
  undockDroneFromFactory(
    this: void,
    factoryId: string,
    droneId: string,
    options?: { transferOwnership?: boolean },
  ): void;
  transferOreToFactory(this: void, factoryId: string, amount: number): number;
  addResourcesToFactory(this: void, factoryId: string, delta: Partial<FactoryResources>): void;
  allocateFactoryEnergy(this: void, factoryId: string, amount: number): number;
  upgradeFactory(this: void, factoryId: string, upgrade: keyof FactoryUpgrades): boolean;
  assignHaulers(this: void, factoryId: string, delta: number): boolean;
  updateHaulerConfig(this: void, factoryId: string, config: Partial<HaulerConfig>): void;
  getLogisticsStatus(
    this: void,
    factoryId: string,
  ): { haulersAssigned: number; config?: HaulerConfig; state?: FactoryLogisticsState } | null;
  processLogistics(this: void, dt: number): void;
  processFactories(this: void, dt: number): void;
  triggerFactoryAutofit(this: void): void;
  resetCamera(this: void): void;
  resetGame(this: void): void;
}

export type StoreApiType = StoreApi<StoreState>;

export type ModuleId = keyof typeof import('./constants').moduleDefinitions;

export type FactoryUpgradeId = keyof FactoryUpgrades;

export interface FactoryUpgradeDefinition {
  label: string;
  description: string;
  baseCost: Partial<FactoryResources>;
  apply(factory: BuildableFactory): void;
}
