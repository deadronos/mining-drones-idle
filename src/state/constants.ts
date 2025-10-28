import type {
  Resources,
  Modules,
  Prestige,
  SaveMeta,
  StoreSettings,
  RefineryStats,
  FactoryUpgradeId,
  FactoryUpgradeDefinition,
  SpecTechId,
  SpecTechState,
  SpecTechSpentState,
  PrestigeInvestmentId,
  PrestigeInvestmentState,
} from './types';

export const SAVE_VERSION = '0.3.5';
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
  showHaulerShips: true,
  performanceProfile: 'medium',
  inspectorCollapsed: false,
  metrics: {
    enabled: true,
    intervalSeconds: 5,
    retentionSeconds: 300,
  },
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

export const initialSpecTechs: SpecTechState = {
  oreMagnet: 0,
  crystalResonance: 0,
  biotechFarming: 0,
  cryoPreservation: 0,
};

export const initialSpecTechSpent: SpecTechSpentState = {
  metals: 0,
  crystals: 0,
  organics: 0,
  ice: 0,
};

export const initialPrestigeInvestments: PrestigeInvestmentState = {
  droneVelocity: 0,
  asteroidAbundance: 0,
  refineryMastery: 0,
  offlineEfficiency: 0,
};

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
    baseCost: { bars: 13 },
    alternativeCosts: {
      metals: { metals: 50 },
    },
    apply: (factory) => {
      factory.dockingCapacity += 1;
      factory.upgrades.docking += 1;
    },
  },
  refine: {
    label: 'Refinery Line',
    description: '+1 refine slot for parallel batches',
    baseCost: { bars: 13 },
    alternativeCosts: {
      organics: { organics: 25, metals: 25 },
    },
    apply: (factory) => {
      factory.refineSlots += 1;
      factory.upgrades.refine += 1;
    },
  },
  storage: {
    label: 'Bulk Storage',
    description: '+150 storage capacity',
    baseCost: { bars: 13 },
    alternativeCosts: {
      organics: { organics: 20 },
    },
    apply: (factory) => {
      factory.storageCapacity += 150;
      factory.upgrades.storage += 1;
    },
  },
  energy: {
    label: 'Capacitors',
    description: '+30 local energy capacity',
    baseCost: { bars: 13 },
    alternativeCosts: {
      ice: { ice: 30, metals: 15 },
    },
    apply: (factory) => {
      factory.energyCapacity += 30;
      factory.upgrades.energy += 1;
      factory.energy = Math.min(factory.energy, factory.energyCapacity);
    },
  },
  solar: {
    label: 'Solar Collectors',
    description: 'Regenerates local energy each second',
    baseCost: { bars: 13 },
    alternativeCosts: {
      crystals: { crystals: 25, metals: 10 },
    },
    apply: (factory) => {
      factory.upgrades.solar += 1;
      // Apply local bonus: +10 max energy per level
      factory.energyCapacity += FACTORY_SOLAR_MAX_ENERGY_PER_LEVEL;
    },
  },
};

export interface SpecTechDefinition {
  id: SpecTechId;
  label: string;
  description: string;
  resource: keyof SpecTechSpentState;
  unlockAt: number;
  baseCost: number;
  costGrowth: number;
  bonusPerLevel: number;
  maxLevel: number;
}

export const specTechDefinitions: Record<SpecTechId, SpecTechDefinition> = {
  oreMagnet: {
    id: 'oreMagnet',
    label: 'Ore Magnet',
    description: '+3% ore mined per level',
    resource: 'metals',
    unlockAt: 50_000,
    baseCost: 8_000,
    costGrowth: 1.28,
    bonusPerLevel: 0.03,
    maxLevel: 20,
  },
  crystalResonance: {
    id: 'crystalResonance',
    label: 'Crystal Resonance',
    description: '+2% asteroid richness per level',
    resource: 'crystals',
    unlockAt: 50_000,
    baseCost: 7_500,
    costGrowth: 1.3,
    bonusPerLevel: 0.02,
    maxLevel: 20,
  },
  biotechFarming: {
    id: 'biotechFarming',
    label: 'Biotech Farming',
    description: '+3% refinery yield per level',
    resource: 'organics',
    unlockAt: 50_000,
    baseCost: 6_500,
    costGrowth: 1.26,
    bonusPerLevel: 0.03,
    maxLevel: 20,
  },
  cryoPreservation: {
    id: 'cryoPreservation',
    label: 'Cryo-Preservation',
    description: '+5% offline gains per level',
    resource: 'ice',
    unlockAt: 50_000,
    baseCost: 5_000,
    costGrowth: 1.24,
    bonusPerLevel: 0.05,
    maxLevel: 15,
  },
};

export interface PrestigeInvestmentDefinition {
  id: PrestigeInvestmentId;
  label: string;
  description: string;
  resource: keyof SpecTechSpentState;
  baseCost: number;
  growthFactor: number;
  bonusPerTier: number;
}

export const prestigeInvestmentDefinitions: Record<
  PrestigeInvestmentId,
  PrestigeInvestmentDefinition
> = {
  droneVelocity: {
    id: 'droneVelocity',
    label: 'Drone Velocity',
    description: '+2% travel speed per tier',
    resource: 'metals',
    baseCost: 1_000,
    growthFactor: 1.5,
    bonusPerTier: 0.02,
  },
  asteroidAbundance: {
    id: 'asteroidAbundance',
    label: 'Asteroid Abundance',
    description: '+2% spawn rate per tier',
    resource: 'crystals',
    baseCost: 1_000,
    growthFactor: 1.5,
    bonusPerTier: 0.02,
  },
  refineryMastery: {
    id: 'refineryMastery',
    label: 'Refinery Mastery',
    description: '+1% refinery yield per tier',
    resource: 'organics',
    baseCost: 1_000,
    growthFactor: 1.5,
    bonusPerTier: 0.01,
  },
  offlineEfficiency: {
    id: 'offlineEfficiency',
    label: 'Offline Efficiency',
    description: '+3% offline gains per tier',
    resource: 'ice',
    baseCost: 1_000,
    growthFactor: 1.5,
    bonusPerTier: 0.03,
  },
};
