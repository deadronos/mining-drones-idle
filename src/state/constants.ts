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

export const SAVE_VERSION = '0.3.3';
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
// Solar Collector upgrade (factory-local)
export const FACTORY_SOLAR_BASE_REGEN = 1.25;
export const FACTORY_SOLAR_REGEN_PER_LEVEL = 0.5;
export const FACTORY_SOLAR_MAX_ENERGY_PER_LEVEL = 10; // +10 max energy per Solar Collector level

// Solar Array module (global, provides local bonuses to all factories)
export const SOLAR_ARRAY_LOCAL_REGEN_PER_LEVEL = 0.15;
export const SOLAR_ARRAY_LOCAL_MAX_ENERGY_PER_LEVEL = 3;

export const FACTORY_MIN_DISTANCE = 10;
export const FACTORY_MAX_DISTANCE = 50;
export const FACTORY_PLACEMENT_ATTEMPTS = 100;
export const FACTORY_UPGRADE_GROWTH = 1.35;

export const WAREHOUSE_CONFIG = {
  storageMultiplier: 8,
  starterFactoryHaulers: 1,
  starterFactoryStock: {
    ore: 50,
    bars: 10,
  },
  bufferSeconds: 30,
  minReserveSeconds: 5,
} as const;

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
  haulerDepot: 0,
  logisticsHub: 0,
  routingProtocol: 0,
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

export const HAULER_DEPOT_CAPACITY_PER_LEVEL = 10;
export const HAULER_DEPOT_SPEED_MULT_PER_LEVEL = 0.05;
export const LOGISTICS_HUB_OVERHEAD_REDUCTION_PER_LEVEL = 0.1;
export const ROUTING_PROTOCOL_MATCHING_BONUS_PER_LEVEL = 0.02;

export const FACTORY_HAULER_CAPACITY_PER_LEVEL = 5;
export const FACTORY_HAULER_SPEED_PER_LEVEL = 0.1;
export const FACTORY_HAULER_EFFICIENCY_PER_LEVEL = 0.05;

export const haulerModuleDefinitions = {
  haulerDepot: {
    label: 'Hauler Depot',
    description: '+10 capacity, +5% speed per level',
    maxLevel: 20,
    baseCost: { metals: 60 },
    costGrowth: 1.18,
  },
  logisticsHub: {
    label: 'Logistics Hub',
    description: '−10% pickup/dropoff overhead per level',
    maxLevel: 15,
    baseCost: { metals: 80, bars: 10 },
    costGrowth: 1.16,
  },
  routingProtocol: {
    label: 'Routing Protocol',
    description: '+2% routing efficiency per level',
    maxLevel: 10,
    baseCost: { crystals: 100, bars: 15 },
    costGrowth: 1.2,
  },
} as const;

export const factoryHaulerUpgradeDefinitions = {
  capacityBoost: {
    label: 'Capacity Boost',
    description: '+5 capacity per level',
    maxLevel: 15,
    baseCost: { metals: 50, bars: 20 },
    costGrowth: 1.22,
  },
  speedBoost: {
    label: 'Thruster Overdrive',
    description: '+0.1 speed per level',
    maxLevel: 12,
    baseCost: { metals: 40, bars: 15 },
    costGrowth: 1.18,
  },
  efficiencyBoost: {
    label: 'Efficiency Suite',
    description: '−5% overhead per level',
    maxLevel: 10,
    baseCost: { crystals: 60, bars: 25 },
    costGrowth: 1.2,
  },
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
  solar: {
    label: 'Solar Collectors',
    description: 'Regenerates local energy each second',
    baseCost: { metals: 30, crystals: 15 },
    apply: (factory) => {
      factory.upgrades.solar += 1;
      // Apply local bonus: +10 max energy per level
      factory.energyCapacity += FACTORY_SOLAR_MAX_ENERGY_PER_LEVEL;
    },
  },
};
