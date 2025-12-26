import { create } from 'zustand';
import { createStore as createVanillaStore, type StateCreator } from 'zustand/vanilla';
import type { StoreState, StoreApiType, HighlightedFactories, DroneFlightState } from './types';
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
  createMetricsState,
  collectFactoryMetrics as collectMetrics,
  accumulateHaulerThroughput,
  resetMetricsState,
} from './metrics';
import {
  normalizeSnapshot,
  snapshotToFactory,
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

// Re-export all types and utilities
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
  MetricsState,
  MetricSample,
  FactoryMetricSeries,
  FactoryMetricSeriesId,
  FactoryMetricSnapshot,
} from './types';

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
  SCHEMA_VERSION,
  moduleDefinitions,
  factoryUpgradeDefinitions,
  specTechDefinitions,
  prestigeInvestmentDefinitions,
} from './constants';

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

export { serializeStore, stringifySnapshot, parseSnapshot } from './serialization';

export { createDefaultFactories } from './factory';

/**
 * Main store creator that composes all slices and implements game loop orchestration.
 * Refactored into modular functions in src/state/store/ for better maintainability.
 *
 * @param set - Zustand set function.
 * @param get - Zustand get function.
 * @returns The complete store state definition.
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
  const settingsSlice = createSettingsSlice(sliceSet, sliceGet);
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
    metrics: createMetricsState(),
    highlightedFactories: { sourceId: null, destId: null },

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

    // Process factories (called from tick)
    processFactories: (dt) => {
      if (dt <= 0 || get().factories.length === 0) return;
      const state = get();
      const result = processFactories(state, dt);
      set((current) => ({
        factories: result.factories,
        resources: result.resources,
        factoryProcessSequence: result.factoryProcessSequence,
        metrics: collectMetrics({
          metrics: current.metrics,
          factories: result.factories,
          telemetry: result.metrics,
          settings: current.settings,
          dt,
          gameTime: current.gameTime,
        }),
      }));

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
      const { logisticsQueues, throughputByFactory } = processLogistics(state);
      set((current) => ({
        logisticsQueues,
        logisticsTick: newLogisticsTick - LOGISTICS_CONFIG.scheduling_interval,
        metrics: accumulateHaulerThroughput(current.metrics, throughputByFactory),
      }));
    },

    // Snapshot and import/export
    applySnapshot: (snapshot) =>
      set(() => {
        // normalizeSnapshot now returns StoreSnapshot (Array based)
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
          // Convert array to Record for runtime StoreState
          droneFlights: (normalized.droneFlights ?? []).reduce((acc, flight) => {
            acc[flight.droneId] = flight;
            return acc;
          }, {} as Record<string, DroneFlightState>),
          factories: restoredFactories,
          logisticsQueues: normalized.logisticsQueues ?? { pendingTransfers: [] },
          gameTime: normalized.gameTime ?? 0,
          factoryProcessSequence: deriveProcessSequence(restoredFactories),
          factoryRoundRobin: 0,
          factoryAutofitSequence: 0,
          cameraResetSequence: 0,
          logisticsTick: 0,
          selectedAsteroidId: null,
          selectedFactoryId,
          droneOwners: normalizeDroneOwners(normalized.droneOwners ?? {}),
          highlightedFactories: { sourceId: null, destId: null },
          metrics: resetMetricsState(),
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
          droneFlights: {},
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
          highlightedFactories: { sourceId: null, destId: null },
          metrics: resetMetricsState(),
        };
      });
    },

    setHighlightedFactories: (highlight: HighlightedFactories) => {
      set((state) => {
        if (
          state.highlightedFactories.sourceId === highlight.sourceId &&
          state.highlightedFactories.destId === highlight.destId
        ) {
          return state;
        }
        return {
          highlightedFactories: {
            sourceId: highlight.sourceId,
            destId: highlight.destId,
          },
        };
      });
    },

    syncLogisticsQueues: (queues) => {
      set({ logisticsQueues: queues });
    },

    syncResources: (resources) => {
      set({ resources });
    },

    // Sync per-factory buffers coming from Rust. This updates only the
    // fields that are represented by the bridge (resources, energy, energyCapacity, haulersAssigned)
    syncFactoriesFromRust: (buffers) => {
      set((current) => {
        const factories = current.factories;
        if (!factories || factories.length === 0) return current;

        const { resources: resBuf, energy: energyBuf, maxEnergy: maxEnergyBuf, haulers: haulersBuf } = buffers || {};

        const resourcesArray: Float32Array | null = Array.isArray(resBuf) ? new Float32Array(resBuf) : resBuf instanceof Float32Array ? resBuf : null;
        const energyArray: Float32Array | null = Array.isArray(energyBuf) ? new Float32Array(energyBuf) : energyBuf instanceof Float32Array ? energyBuf : null;
        const maxEnergyArray: Float32Array | null = Array.isArray(maxEnergyBuf) ? new Float32Array(maxEnergyBuf) : maxEnergyBuf instanceof Float32Array ? maxEnergyBuf : null;
        const haulersArray: Float32Array | null = Array.isArray(haulersBuf) ? new Float32Array(haulersBuf) : haulersBuf instanceof Float32Array ? haulersBuf : null;

        const newFactories = factories.map((factory, idx) => {
          let changed = false;
          const clone = { ...factory };

          // Resources buffer expected as 7 floats per factory
          if (resourcesArray && resourcesArray.length >= (idx * 7 + 7)) {
            const base = idx * 7;
            const currentRes = clone.resources;
            const newRes = {
              ore: Number.isFinite(resourcesArray[base]) ? resourcesArray[base] : currentRes.ore,
              ice: Number.isFinite(resourcesArray[base + 1]) ? resourcesArray[base + 1] : currentRes.ice,
              metals: Number.isFinite(resourcesArray[base + 2]) ? resourcesArray[base + 2] : currentRes.metals,
              crystals: Number.isFinite(resourcesArray[base + 3]) ? resourcesArray[base + 3] : currentRes.crystals,
              organics: Number.isFinite(resourcesArray[base + 4]) ? resourcesArray[base + 4] : currentRes.organics,
              bars: Number.isFinite(resourcesArray[base + 5]) ? resourcesArray[base + 5] : currentRes.bars,
              credits: Number.isFinite(resourcesArray[base + 6]) ? resourcesArray[base + 6] : currentRes.credits,
            };
            clone.resources = { ...clone.resources, ...newRes };
            changed = true;
          }

          if (energyArray && energyArray.length > idx && Number.isFinite(energyArray[idx])) {
            clone.energy = energyArray[idx];
            changed = true;
          }

          if (maxEnergyArray && maxEnergyArray.length > idx && Number.isFinite(maxEnergyArray[idx])) {
            clone.energyCapacity = maxEnergyArray[idx];
            changed = true;
          }

          if (haulersArray && haulersArray.length > idx) {
            const rawHaulers = haulersArray[idx];
            if (Number.isFinite(rawHaulers)) {
              clone.haulersAssigned = Math.max(0, Math.trunc(rawHaulers));
              changed = true;
            }
          }

          return changed ? clone : factory;
        });

        return { factories: newFactories };
      });
    },
  };
};

/**
 * Creates a vanilla (non-React) store instance.
 * Useful for testing or usage outside of React components.
 *
 * @returns A fresh StoreState instance.
 */
export const createStoreInstance = () => createVanillaStore<StoreState>(storeCreator);

/**
 * The React hook for accessing the store.
 */
export const useStore = create<StoreState>()(storeCreator);

/**
 * Singleton API access to the store, useful for imperative updates.
 */
export const storeApi = useStore as unknown as StoreApiType;
