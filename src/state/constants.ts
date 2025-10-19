import type {
  Resources,
  Modules,
  Prestige,
  SaveMeta,
  StoreSettings,
  RefineryStats,
  FactoryUpgradeId,
  FactoryUpgradeDefinition,
} from './types';

export const SAVE_VERSION = '0.3.0';
export const saveVersion = SAVE_VERSION;

export const GROWTH = 1.15;
export const PRESTIGE_THRESHOLD = 5_000;
export const BASE_REFINERY_RATE = 1;
export const ORE_PER_BAR = 10;
export const ORE_CONVERSION_PER_SECOND = 10;
export const BASE_STORAGE = 400;
export const STORAGE_PER_LEVEL = 100;
export const BASE_ENERGY_CAP = 100;
export const ENERGY_PER_SOLAR = 25;
export const SOLAR_BASE_GEN = 5;
export const DRONE_ENERGY_COST = 1.2;

export const FACTORY_MIN_DISTANCE = 10;
export const FACTORY_MAX_DISTANCE = 50;
export const FACTORY_PLACEMENT_ATTEMPTS = 100;
export const FACTORY_UPGRADE_GROWTH = 1.35;

export const initialSettings: StoreSettings = {
  autosaveEnabled: true,
  autosaveInterval: 10,
  offlineCapHours: 8,
  notation: 'standard',
  throttleFloor: 0.25,
  showTrails: true,
  performanceProfile: 'medium',
  inspectorCollapsed: false,
};

export const initialResources: Resources = {
  ore: 0,
  ice: 0,
  metals: 0,
  crystals: 0,
  organics: 0,
  bars: 0,
  energy: BASE_ENERGY_CAP,
  credits: 0,
};

export const initialModules: Modules = {
  droneBay: 1,
  refinery: 0,
  storage: 0,
  solar: 0,
  scanner: 0,
};

export const initialPrestige: Prestige = { cores: 0 };

export const initialSave: SaveMeta = { lastSave: Date.now(), version: SAVE_VERSION };

export const rawResourceKeys = ['ore', 'ice', 'metals', 'crystals', 'organics'] as const;

export const emptyRefineryStats: RefineryStats = { oreConsumed: 0, barsProduced: 0 };

export const moduleDefinitions = {
  droneBay: { label: 'Drone Bay', baseCost: 4, description: '+1 drone, +5% travel speed' },
  refinery: { label: 'Refinery', baseCost: 8, description: '+10% bar output' },
  storage: { label: 'Storage', baseCost: 3, description: '+100 ore capacity' },
  solar: { label: 'Solar Array', baseCost: 4, description: '+5 energy/s, +25 max energy' },
  scanner: { label: 'Scanner', baseCost: 12, description: '+5% new asteroid richness' },
} as const;

export const factoryUpgradeDefinitions: Record<FactoryUpgradeId, FactoryUpgradeDefinition> = {
  docking: {
    label: 'Landing Bay',
    description: '+1 docking slot for concurrent drones',
    baseCost: { metals: 40, crystals: 20 },
    apply: (factory) => {
      factory.dockingCapacity += 1;
      factory.upgrades.docking += 1;
    },
  },
  refine: {
    label: 'Refinery Line',
    description: '+1 refine slot for parallel batches',
    baseCost: { metals: 35, bars: 10 },
    apply: (factory) => {
      factory.refineSlots += 1;
      factory.upgrades.refine += 1;
    },
  },
  storage: {
    label: 'Bulk Storage',
    description: '+150 ore storage capacity',
    baseCost: { metals: 25, organics: 15 },
    apply: (factory) => {
      factory.storageCapacity += 150;
      factory.upgrades.storage += 1;
    },
  },
  energy: {
    label: 'Capacitors',
    description: '+30 local energy capacity',
    baseCost: { crystals: 30, ice: 10 },
    apply: (factory) => {
      factory.energyCapacity += 30;
      factory.upgrades.energy += 1;
      factory.energy = Math.min(factory.energy, factory.energyCapacity);
    },
  },
};
