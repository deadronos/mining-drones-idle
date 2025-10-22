import { create } from 'zustand';
import { createStore as createVanillaStore, type StateCreator } from 'zustand/vanilla';
import type { StoreState, StoreApiType } from './types';
import {
  createResourceSlice,
  createSettingsSlice,
  createFactorySlice,
  createDroneSlice,
  createLogisticsSlice,
  type FactorySliceMethods,
} from './slices';
import { processRefinery, processFactories } from './processing/gameProcessing';
import { processLogistics } from './processing/logisticsProcessing';
import { LOGISTICS_CONFIG } from '@/ecs/logistics';
import { logLogistics } from '@/lib/debug';
import {
  normalizeSnapshot,
  snapshotToFactory,
  cloneDroneFlight,
  normalizeDroneOwners,
  serializeStore,
  stringifySnapshot,
  parseSnapshot,
  normalizeModules,
  normalizePrestige,
  normalizeSettings,
} from './serialization';
import { createDefaultFactories } from './factory';
import { generateSeed, deriveProcessSequence } from './utils';
import {
  SAVE_VERSION,
  initialResources,
  initialSave,
  initialModules,
  initialPrestige,
  initialSpecTechs,
  initialSpecTechSpent,
  initialPrestigeInvestments,
} from './constants';

// Type exports
export type {
  PerformanceProfile,
  VectorTuple,
  TravelSnapshot,
  RefineProcessSnapshot,
  FactoryResourceSnapshot,
  FactoryUpgradeSnapshot,
  FactorySnapshot,
  HaulerConfig,
  FactoryLogisticsState,
  PendingTransfer,
  LogisticsQueues,
  DroneFlightPhase,
  DroneFlightState,
  Resources,
  Modules,
  FactoryHaulerUpgrades,
  Prestige,
  SaveMeta,
  NotationMode,
  StoreSettings,
  RefineryStats,
  StoreSnapshot,
  StoreState,
  StoreApiType,
  ModuleId,
  HaulerModuleId,
  FactoryUpgradeId,
  FactoryUpgradeCostVariantId,
  FactoryHaulerUpgradeId,
  FactoryUpgradeDefinition,
  FactoryResources,
  FactoryUpgrades,
  SpecTechState,
  SpecTechSpentState,
  PrestigeInvestmentState,
  SpecTechId,
  PrestigeInvestmentId,
} from './types';

// Constants exports
export {
  PRESTIGE_THRESHOLD,
  ORE_PER_BAR,
  ORE_CONVERSION_PER_SECOND,
  DRONE_ENERGY_COST,
  FACTORY_MIN_DISTANCE,
  FACTORY_MAX_DISTANCE,
  FACTORY_SOLAR_BASE_REGEN,
  FACTORY_SOLAR_REGEN_PER_LEVEL,
  FACTORY_SOLAR_MAX_ENERGY_PER_LEVEL,
  SOLAR_ARRAY_LOCAL_REGEN_PER_LEVEL,
  SOLAR_ARRAY_LOCAL_MAX_ENERGY_PER_LEVEL,
  saveVersion,
  moduleDefinitions,
  factoryUpgradeDefinitions,
  specTechDefinitions,
  prestigeInvestmentDefinitions,
} from './constants';

// Utils exports
export {
  vector3ToTuple,
  tupleToVector3,
  generateSeed,
  computeFactoryPlacement,
  deriveProcessSequence,
  computeFactoryUpgradeCost,
  getFactoryUpgradeCost,
  getFactorySolarRegen,
  getSolarArrayLocalRegen,
  getSolarArrayLocalMaxEnergy,
  getFactoryEffectiveEnergyCapacity,
  computeRefineryProduction,
  applyRefineryProduction,
  costForLevel,
  computePrestigeGain,
  computePrestigeBonus,
  getStorageCapacity,
  computeWarehouseCapacity,
  getEnergyCapacity,
  getEnergyGeneration,
  getEnergyConsumption,
  computeEnergyThrottle,
} from './utils';

// Serialization exports
export { serializeStore, stringifySnapshot, parseSnapshot } from './serialization';

// Factory exports
export { createDefaultFactories } from './factory';

/**
 * Zustand store creator that composes all slices and processing functions.
 * Each slice is responsible for a specific domain:
 * - resourceSlice: resources, modules, prestige operations
 * - settingsSlice: UI state and selections
 * - factorySlice: factory CRUD and operations
 * - droneSlice: drone flights and ownership
 * - logisticsSlice: hauler configuration and status
 *
 * Processing functions handle game loop orchestration:
 * - gameProcessing: refinery and factory processing
 * - logisticsProcessing: hauler logistics scheduler
 */
const storeCreator: StateCreator<StoreState> = (set, get) => {
  const defaultFactories = createDefaultFactories();
  const initialSelectedFactory = defaultFactories[0]?.id ?? null;

  // Build composed state from slices
  const sliceSet = set as unknown;

  const sliceGet = get as unknown;

  // @ts-expect-error - StateCreator generics don't compose well with spread operator

  const resourceSlice = createResourceSlice(sliceSet, sliceGet);
  // @ts-expect-error - StateCreator generics don't compose well with spread operator

  const settingsSlice = createSettingsSlice(sliceSet);
  // @ts-expect-error - StateCreator generics don't compose well with spread operator

  const factorySlice = createFactorySlice(sliceSet, sliceGet);
  // @ts-expect-error - StateCreator generics don't compose well with spread operator

  const droneSlice = createDroneSlice(sliceSet);
  // @ts-expect-error - StateCreator generics don't compose well with spread operator

  const logisticsSlice = createLogisticsSlice(sliceSet, sliceGet);

  return {
    // Compose all slices
    ...resourceSlice,
    ...settingsSlice,
    ...factorySlice,
    ...droneSlice,
    ...logisticsSlice,

    // Initial state for fields not covered by slices
    save: { ...initialSave },
    rngSeed: generateSeed(),
    gameTime: 0,
    selectedFactoryId: initialSelectedFactory,
    factories: defaultFactories,
    logisticsQueues: { pendingTransfers: [] },

    // Game loop tick orchestrator
    tick: (dt) => {
      if (dt <= 0) return;
      set((state) => ({ gameTime: state.gameTime + dt }));
      logLogistics('tick dt=%o gameTime=%o', dt, get().gameTime);
      get().processRefinery(dt);
      get().processLogistics(dt);
      get().processFactories(dt);
    },

    // Process refinery production (called from tick)
    processRefinery: (dt) => {
      if (dt <= 0) return { oreConsumed: 0, barsProduced: 0 };
      const state = get();
      const { resources, refineryStats } = processRefinery(state, dt);
      set({ resources });
      return refineryStats;
    },

    // Process factories (called from tick, already handled in tick orchestrator)
    processFactories: (dt) => {
      // This is now handled within tick() via tickGameLoop
      // Kept for backward compatibility if called directly
      if (dt <= 0 || get().factories.length === 0) return;
      const state = get();
      const { factories, resources, factoryProcessSequence } = processFactories(state, dt);
      set({ factories, resources, factoryProcessSequence });

      // Detect upgrade shortfalls and create requests, then clear expired ones
      const getState = get as () => StoreState & FactorySliceMethods;
      for (const factory of getState().factories) {
        getState().detectAndCreateUpgradeRequest(factory.id);
      }
      for (const factory of getState().factories) {
        getState().clearExpiredUpgradeRequests(factory.id);
      }
    },

    // Process logistics (called from tick)
    processLogistics: (dt) => {
      if (dt <= 0) return;
      const state = get();
      const newLogisticsTick = state.logisticsTick + dt;

      if (newLogisticsTick < LOGISTICS_CONFIG.scheduling_interval) {
        set({ logisticsTick: newLogisticsTick });
        logLogistics(
          'scheduler skip: tick=%o/<%o>',
          newLogisticsTick,
          LOGISTICS_CONFIG.scheduling_interval,
        );
        return;
      }

      logLogistics(
        'scheduler run: tick=%o interval=%o',
        newLogisticsTick,
        LOGISTICS_CONFIG.scheduling_interval,
      );
      const { logisticsQueues } = processLogistics(state);
      set({
        logisticsQueues,
        logisticsTick: newLogisticsTick - LOGISTICS_CONFIG.scheduling_interval,
      });
    },

    // Snapshot and import/export
    applySnapshot: (snapshot) =>
      set(() => {
        const normalized = normalizeSnapshot(snapshot);
        const save = { ...normalized.save, version: SAVE_VERSION };
        const restoredFactories =
          normalized.factories && normalized.factories.length > 0
            ? normalized.factories.map(snapshotToFactory)
            : createDefaultFactories();
        const restoredRng =
          typeof normalized.rngSeed === 'number' && Number.isFinite(normalized.rngSeed)
            ? normalized.rngSeed
            : generateSeed();
        const selectedFactoryId =
          normalized.selectedFactoryId &&
          restoredFactories.some((factory) => factory.id === normalized.selectedFactoryId)
            ? normalized.selectedFactoryId
            : (restoredFactories[0]?.id ?? null);
        return {
          resources: normalized.resources
            ? { ...initialResources, ...normalized.resources }
            : initialResources,
          modules: normalized.modules
            ? { ...normalizeModules(normalized.modules) }
            : initialModules,
          prestige: normalized.prestige
            ? { ...normalizePrestige(normalized.prestige) }
            : { cores: 0 },
          settings: normalizeSettings(normalized.settings ?? {}),
          specTechs: normalized.specTechs
            ? { ...normalized.specTechs }
            : { ...initialSpecTechs },
          specTechSpent: normalized.specTechSpent
            ? { ...normalized.specTechSpent }
            : { ...initialSpecTechSpent },
          prestigeInvestments: normalized.prestigeInvestments
            ? { ...normalized.prestigeInvestments }
            : { ...initialPrestigeInvestments },
          save,
          rngSeed: restoredRng,
          droneFlights: (normalized.droneFlights ?? []).map(cloneDroneFlight),
          factories: restoredFactories,
          logisticsQueues: normalized.logisticsQueues ?? { pendingTransfers: [] },
          factoryProcessSequence: deriveProcessSequence(restoredFactories),
          factoryRoundRobin: 0,
          factoryAutofitSequence: 0,
          cameraResetSequence: 0,
          logisticsTick: 0,
          selectedAsteroidId: null,
          selectedFactoryId,
          droneOwners: normalizeDroneOwners(normalized.droneOwners ?? {}),
        };
      }),

    exportState: () => stringifySnapshot(serializeStore(get())),

    importState: (payload) => {
      const snapshot = parseSnapshot(payload);
      if (!snapshot) {
        return false;
      }
      get().applySnapshot(snapshot);
      return true;
    },

    // Game reset
    resetGame: () => {
      const currentSettings = get().settings;
      set(() => {
        const factories = createDefaultFactories();
        const selectedFactoryId = factories[0]?.id ?? null;
        return {
          resources: { ...initialResources },
          modules: { ...initialModules },
          prestige: { ...initialPrestige },
          specTechs: { ...initialSpecTechs },
          specTechSpent: { ...initialSpecTechSpent },
          prestigeInvestments: { ...initialPrestigeInvestments },
          save: { ...initialSave, lastSave: Date.now() },
          settings: { ...currentSettings },
          rngSeed: generateSeed(),
          droneFlights: [],
          factories,
          logisticsQueues: { pendingTransfers: [] },
          gameTime: 0,
          factoryProcessSequence: 0,
          factoryRoundRobin: 0,
          factoryAutofitSequence: 0,
          cameraResetSequence: 0,
          logisticsTick: 0,
          selectedAsteroidId: null,
          selectedFactoryId,
          droneOwners: {},
        };
      });
    },
  };
};

export const createStoreInstance = () => createVanillaStore<StoreState>(storeCreator);

export const useStore = create<StoreState>()(storeCreator);

export const storeApi = useStore as unknown as StoreApiType;
