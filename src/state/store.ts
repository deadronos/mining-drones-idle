import { create } from 'zustand';
import { createStore as createVanillaStore, type StateCreator } from 'zustand/vanilla';
import { Vector3 } from 'three';
import { gameWorld } from '@/ecs/world';
import {
  LOGISTICS_CONFIG,
  RESOURCE_TYPES,
  generateTransferId,
  computeHaulerCost,
  computeHaulerMaintenanceCost,
  matchSurplusToNeed,
  reserveOutbound,
  executeArrival,
} from '@/ecs/logistics';
import {
  createFactory,
  attemptDockDrone,
  computeFactoryCost,
  enforceMinOneRefining,
  removeDroneFromFactory,
  startRefineProcess,
  tickRefineProcess,
  transferOreToFactory as factoryTransferOre,
} from '@/ecs/factories';

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
  Prestige,
  SaveMeta,
  NotationMode,
  StoreSettings,
  RefineryStats,
  StoreSnapshot,
  StoreState,
  StoreApiType,
  ModuleId,
  FactoryUpgradeId,
  FactoryUpgradeDefinition,
  FactoryResources,
  FactoryUpgrades,
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
  saveVersion,
  moduleDefinitions,
  factoryUpgradeDefinitions,
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
  computeRefineryProduction,
  applyRefineryProduction,
  costForLevel,
  computePrestigeGain,
  computePrestigeBonus,
  getStorageCapacity,
  getEnergyCapacity,
  getEnergyGeneration,
  getEnergyConsumption,
  computeEnergyThrottle,
} from './utils';

// Serialization exports
export { serializeStore, stringifySnapshot, parseSnapshot } from './serialization';

// Factory exports
export { createDefaultFactories } from './factory';

// Internal imports for store implementation
import type {
  StoreState,
  Resources,
  Modules,
  FactoryResources,
  StoreApiType,
} from './types';
import {
  PRESTIGE_THRESHOLD,
  emptyRefineryStats,
  SAVE_VERSION,
  initialResources,
  initialModules,
  initialPrestige,
  initialSave,
  initialSettings,
  moduleDefinitions,
  factoryUpgradeDefinitions,
  BASE_ENERGY_CAP,
} from './constants';
import {
  generateSeed,
  deriveProcessSequence,
  costForLevel,
  computePrestigeGain,
  computeRefineryProduction,
  applyRefineryProduction,
  computeFactoryPlacement,
  computeFactoryUpgradeCost,
} from './utils';
import {
  cloneFactory,
  snapshotToFactory,
  cloneDroneFlight,
  mergeResourceDelta,
  normalizeSnapshot,
  normalizeResources,
  normalizeModules,
  normalizePrestige,
  normalizeSettings,
  normalizeDroneOwners,
  serializeStore,
  stringifySnapshot,
  parseSnapshot,
} from './serialization';
import { createDefaultFactories } from './factory';

const storeCreator: StateCreator<StoreState> = (set, get) => {
  const defaultFactories = createDefaultFactories();
  const initialSelectedFactory = defaultFactories[0]?.id ?? null;
  return {
    resources: { ...initialResources },
    modules: { ...initialModules },
    prestige: { ...initialPrestige },
    save: { ...initialSave },
    settings: { ...initialSettings },
    rngSeed: generateSeed(),
    droneFlights: [],
    factories: createDefaultFactories(),
    logisticsQueues: { pendingTransfers: [] },
    gameTime: 0,
    factoryProcessSequence: 0,
    factoryRoundRobin: 0,
    factoryAutofitSequence: 0,
    cameraResetSequence: 0,
    logisticsTick: 0,
    selectedAsteroidId: null,
    selectedFactoryId: initialSelectedFactory,
    droneOwners: {},

    addResources: (delta, options) =>
      set((state) => {
        const capacityAware = options?.capacityAware ?? true;
        const resources = mergeResourceDelta(
          state.resources,
          delta ?? {},
          state.modules,
          capacityAware,
          state.prestige.cores,
        );
        return { resources };
      }),

    addOre: (amount) => get().addResources({ ore: amount }),

    buy: (id) =>
      set((state) => {
        const definition = moduleDefinitions[id];
        const currentLevel = state.modules[id];
        const cost = costForLevel(definition.baseCost, currentLevel);
        if (state.resources.bars < cost) return state;
        const resources: Resources = { ...state.resources, bars: state.resources.bars - cost };
        const modules: Modules = { ...state.modules, [id]: currentLevel + 1 };
        return { resources, modules };
      }),

    tick: (dt) => {
      if (dt <= 0) return;
      set((state) => ({ gameTime: state.gameTime + dt }));
      get().processRefinery(dt);
      get().processLogistics(dt);
      get().processFactories(dt);
    },

    processRefinery: (dt) => {
      if (dt <= 0) return emptyRefineryStats;
      const state = get();
      const stats = computeRefineryProduction(state, dt);
      if (stats.oreConsumed <= 0 && stats.barsProduced <= 0) {
        return emptyRefineryStats;
      }
      set(applyRefineryProduction(state, stats));
      return stats;
    },

    prestigeReady: () => get().resources.bars >= PRESTIGE_THRESHOLD,

    preview: () => computePrestigeGain(get().resources.bars),

    doPrestige: () =>
      set((state) => {
        if (state.resources.bars < PRESTIGE_THRESHOLD) return state;
        const gain = computePrestigeGain(state.resources.bars);
        const prestige = { cores: state.prestige.cores + gain };
        return {
          prestige,
          resources: { ...initialResources, energy: BASE_ENERGY_CAP },
          modules: { ...initialModules },
          droneFlights: [],
        };
      }),

    setLastSave: (timestamp) => set((state) => ({ save: { ...state.save, lastSave: timestamp } })),

    updateSettings: (patch) =>
      set((state) => ({ settings: normalizeSettings({ ...state.settings, ...patch }) })),

    setSelectedAsteroid: (asteroidId) => set(() => ({ selectedAsteroidId: asteroidId })),

    toggleInspector: () =>
      set((state) => ({
        settings: normalizeSettings({
          ...state.settings,
          inspectorCollapsed: !state.settings.inspectorCollapsed,
        }),
      })),

    setSelectedFactory: (factoryId) => set(() => ({ selectedFactoryId: factoryId })),

    cycleSelectedFactory: (direction) =>
      set((state) => {
        const total = state.factories.length;
        if (total === 0) {
          return { selectedFactoryId: null };
        }
        const currentIndex = state.factories.findIndex(
          (factory) => factory.id === state.selectedFactoryId,
        );
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextIndex = (baseIndex + direction + total) % total;
        return { selectedFactoryId: state.factories[nextIndex]?.id ?? null };
      }),

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
          resources: normalizeResources(normalized.resources),
          modules: normalizeModules(normalized.modules),
          prestige: normalizePrestige(normalized.prestige),
          save,
          settings: normalizeSettings(normalized.settings),
          rngSeed: restoredRng,
          droneFlights: (normalized.droneFlights ?? []).map(cloneDroneFlight),
          factories: restoredFactories,
          logisticsQueues: normalized.logisticsQueues || { pendingTransfers: [] },
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

    recordDroneFlight: (flight) =>
      set((state) => {
        const snapshot = cloneDroneFlight(flight);
        const remaining = state.droneFlights.filter((entry) => entry.droneId !== snapshot.droneId);
        return { droneFlights: [...remaining, snapshot] };
      }),

    clearDroneFlight: (droneId) =>
      set((state) => ({
        droneFlights: state.droneFlights.filter((entry) => entry.droneId !== droneId),
      })),

    addFactory: (factory) =>
      set((state) => ({
        factories: [...state.factories, cloneFactory(factory)],
      })),

    removeFactory: (factoryId) =>
      set((state) => {
        const factories = state.factories.filter((f) => f.id !== factoryId);
        const droneOwners = { ...state.droneOwners };
        for (const [droneId, owner] of Object.entries(droneOwners)) {
          if (owner === factoryId) {
            droneOwners[droneId] = null;
          }
        }
        const selectedFactoryId =
          state.selectedFactoryId === factoryId
            ? (factories[0]?.id ?? null)
            : state.selectedFactoryId;
        return { factories, droneOwners, selectedFactoryId };
      }),

    getFactory: (factoryId) => {
      const state = get();
      return state.factories.find((f) => f.id === factoryId);
    },

    purchaseFactory: () => {
      const state = get();
      const purchaseIndex = Math.max(0, state.factories.length - 1);
      const cost = computeFactoryCost(purchaseIndex);
      if (state.resources.metals < cost.metals || state.resources.crystals < cost.crystals) {
        return false;
      }
      const id = `factory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const position = computeFactoryPlacement(state.factories);
      const factory = createFactory(id, position);
      set((current) => ({
        resources: {
          ...current.resources,
          metals: current.resources.metals - cost.metals,
          crystals: current.resources.crystals - cost.crystals,
        },
        factories: [...current.factories, factory],
        factoryAutofitSequence: current.factoryAutofitSequence + 1,
        selectedFactoryId: factory.id,
      }));
      return true;
    },

    toggleFactoryPinned: (factoryId) =>
      set((state) => ({
        factories: state.factories.map((factory) =>
          factory.id === factoryId
            ? { ...cloneFactory(factory), pinned: !factory.pinned }
            : factory,
        ),
      })),

    setFactoryPinned: (factoryId, pinned) =>
      set((state) => ({
        factories: state.factories.map((factory) =>
          factory.id === factoryId ? { ...cloneFactory(factory), pinned } : factory,
        ),
      })),

    nextFactoryRoundRobin: () => {
      let currentValue = 0;
      set((state) => {
        currentValue = state.factoryRoundRobin;
        return { factoryRoundRobin: state.factoryRoundRobin + 1 };
      });
      return currentValue;
    },

    dockDroneAtFactory: (factoryId, droneId) => {
      const state = get();
      const index = state.factories.findIndex((f) => f.id === factoryId);
      if (index === -1) return 'queued';
      const base = state.factories[index];
      const updated = cloneFactory(base);
      const result = attemptDockDrone(updated, droneId);
      if (result === 'exists') {
        return base.queuedDrones.indexOf(droneId) < base.dockingCapacity ? 'docking' : 'queued';
      }
      set((current) => ({
        factories: current.factories.map((factory, idx) => (idx === index ? updated : factory)),
      }));
      return result;
    },

    undockDroneFromFactory: (factoryId, droneId, options) => {
      const state = get();
      const index = state.factories.findIndex((f) => f.id === factoryId);
      if (index === -1) {
        return;
      }
      const updated = cloneFactory(state.factories[index]);
      removeDroneFromFactory(updated, droneId);

      let nextDroneOwners = state.droneOwners;
      let factories = state.factories;

      if (options?.transferOwnership) {
        // Ensure single ownership: remove drone from all factories' ownedDrones first
        const previousOwnerId = state.droneOwners[droneId];
        nextDroneOwners = { ...state.droneOwners, [droneId]: factoryId };

        // Step 1: Remove drone from all factories' ownedDrones
        factories = state.factories.map((factory) => {
          if (factory.ownedDrones.includes(droneId)) {
            return {
              ...factory,
              ownedDrones: factory.ownedDrones.filter((id) => id !== droneId),
            };
          }
          return factory;
        });

        // Step 2: Add drone to target factory's ownedDrones
        factories = factories.map((factory, idx) => {
          if (idx === index) {
            // Use Set to prevent duplicates, then convert back to array
            const newOwned = Array.from(new Set([...factory.ownedDrones, droneId]));
            return {
              ...updated,
              ownedDrones: newOwned,
            };
          }
          return factory;
        });
      } else {
        factories = state.factories.map((factory, idx) => (idx === index ? updated : factory));
      }

      set(() => ({ factories, droneOwners: nextDroneOwners }));
    },

    transferOreToFactory: (factoryId, amount) => {
      const state = get();
      const index = state.factories.findIndex((f) => f.id === factoryId);
      if (index === -1) return 0;
      const updated = cloneFactory(state.factories[index]);
      const transferred = factoryTransferOre(updated, amount);
      set((current) => ({
        factories: current.factories.map((factory, idx) => (idx === index ? updated : factory)),
      }));
      return transferred;
    },

    addResourcesToFactory: (factoryId, delta) => {
      if (!delta) return;
      set((state) => {
        const index = state.factories.findIndex((f) => f.id === factoryId);
        if (index === -1) {
          return {};
        }
        const updated = cloneFactory(state.factories[index]);
        const keys: (keyof FactoryResources)[] = [
          'ore',
          'bars',
          'metals',
          'crystals',
          'organics',
          'ice',
          'credits',
        ];
        const globalDelta: Partial<Resources> = {};
        let changed = false;
        for (const key of keys) {
          const amount = delta[key];
          if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) {
            continue;
          }
          const nextValue = Math.max(0, (updated.resources[key] ?? 0) + amount);
          updated.resources[key] = nextValue;
          if (key === 'ore') {
            updated.currentStorage = updated.resources.ore;
          } else if (key in state.resources) {
            const resourceKey = key as keyof Resources;
            globalDelta[resourceKey] = (globalDelta[resourceKey] ?? 0) + amount;
          }
          changed = true;
        }
        if (!changed) {
          return {};
        }
        const factories = state.factories.map((factory, idx) =>
          idx === index ? updated : factory,
        );
        const resources =
          Object.keys(globalDelta).length > 0
            ? mergeResourceDelta(
                state.resources,
                globalDelta,
                state.modules,
                false,
                state.prestige.cores,
              )
            : state.resources;
        return { factories, resources };
      });
    },

    allocateFactoryEnergy: (factoryId, amount) => {
      const requested = Math.max(0, amount);
      if (requested <= 0) {
        return 0;
      }
      let granted = 0;
      set((state) => {
        const index = state.factories.findIndex((f) => f.id === factoryId);
        if (index === -1) {
          return {};
        }
        const availableGlobal = Math.max(0, state.resources.energy);
        if (availableGlobal <= 0) {
          return {};
        }
        const updated = cloneFactory(state.factories[index]);
        const availableCapacity = Math.max(0, updated.energyCapacity - updated.energy);
        if (availableCapacity <= 0) {
          return {};
        }
        const applied = Math.min(requested, availableCapacity, availableGlobal);
        if (applied <= 0) {
          return {};
        }
        updated.energy += applied;
        granted = applied;
        const factories = state.factories.map((factory, idx) =>
          idx === index ? updated : factory,
        );
        const resources = {
          ...state.resources,
          energy: Math.max(0, state.resources.energy - applied),
        };
        return { factories, resources };
      });
      return granted;
    },

    upgradeFactory: (factoryId, upgrade) => {
      const state = get();
      const index = state.factories.findIndex((f) => f.id === factoryId);
      if (index === -1) {
        return false;
      }
      const definition = factoryUpgradeDefinitions[upgrade];
      if (!definition) {
        return false;
      }
      const base = state.factories[index];
      const level = base.upgrades[upgrade];
      const cost = computeFactoryUpgradeCost(upgrade, level);
      for (const [key, value] of Object.entries(cost) as [keyof FactoryResources, number][]) {
        if (value > 0 && (base.resources[key] ?? 0) < value) {
          return false;
        }
      }
      const updated = cloneFactory(base);
      const globalDelta: Partial<Resources> = {};
      for (const [key, value] of Object.entries(cost) as [keyof FactoryResources, number][]) {
        if (value <= 0) continue;
        updated.resources[key] = Math.max(0, (updated.resources[key] ?? 0) - value);
        if (key === 'ore') {
          updated.currentStorage = updated.resources.ore;
        } else if (key in state.resources) {
          const resourceKey = key as keyof Resources;
          globalDelta[resourceKey] = (globalDelta[resourceKey] ?? 0) - value;
        }
      }
      definition.apply(updated);
      set((current) => {
        const factories = current.factories.map((factory, idx) =>
          idx === index ? updated : factory,
        );
        const resources =
          Object.keys(globalDelta).length > 0
            ? mergeResourceDelta(
                current.resources,
                globalDelta,
                current.modules,
                false,
                current.prestige.cores,
              )
            : current.resources;
        return { factories, resources };
      });
      return true;
    },

    assignHaulers: (factoryId, delta) => {
      if (!Number.isFinite(delta) || delta === 0) {
        return false;
      }

      if (delta > 0) {
        let purchaseSuccessful = false;
        set((current) => {
          const index = current.factories.findIndex((factory) => factory.id === factoryId);
          if (index === -1) {
            return current;
          }

          const factory = cloneFactory(current.factories[index]);
          let remaining = Math.trunc(delta);
          let nextCount = factory.haulersAssigned ?? 0;
          let barsAvailable = factory.resources.bars;

          while (remaining > 0) {
            const cost = computeHaulerCost(nextCount);
            if (barsAvailable < cost) {
              purchaseSuccessful = false;
              return current;
            }
            barsAvailable -= cost;
            nextCount += 1;
            remaining -= 1;
          }

          factory.haulersAssigned = nextCount;
          factory.resources = { ...factory.resources, bars: barsAvailable };
          purchaseSuccessful = true;

          const factories = current.factories.map((candidate, idx) =>
            idx === index ? factory : candidate,
          );
          return { factories };
        });
        return purchaseSuccessful;
      }

      let updated = false;
      set((current) => {
        const index = current.factories.findIndex((factory) => factory.id === factoryId);
        if (index === -1) {
          return current;
        }

        const factory = cloneFactory(current.factories[index]);
        const currentCount = factory.haulersAssigned ?? 0;
        const nextCount = Math.max(0, currentCount + Math.trunc(delta));

        if (nextCount === currentCount) {
          updated = false;
          return current;
        }

        factory.haulersAssigned = nextCount;
        updated = true;

        const factories = current.factories.map((candidate, idx) =>
          idx === index ? factory : candidate,
        );
        return { factories };
      });
      return updated;
    },

    updateHaulerConfig: (factoryId, config) => {
      const state = get();
      const index = state.factories.findIndex((f) => f.id === factoryId);
      if (index === -1) return;

      set((current) => {
        const factory = cloneFactory(current.factories[index]);
        const currentConfig = factory.haulerConfig || {
          capacity: 50,
          speed: 1.0,
          pickupOverhead: 1.0,
          dropoffOverhead: 1.0,
          resourceFilters: [],
          mode: 'auto',
          priority: 5,
        };
        factory.haulerConfig = { ...currentConfig, ...config };
        const factories = current.factories.map((f, idx) => (idx === index ? factory : f));
        return { factories };
      });
    },

    getLogisticsStatus: (factoryId) => {
      const factory = get().getFactory(factoryId);
      if (!factory) return null;
      return {
        haulersAssigned: factory.haulersAssigned ?? 0,
        config: factory.haulerConfig,
        state: factory.logisticsState,
      };
    },

    processLogistics: (dt: number) => {
      set((state) => {
        // Only run scheduler every N seconds to avoid excessive overhead
        const newLogisticsTick = state.logisticsTick + dt;
        if (newLogisticsTick < LOGISTICS_CONFIG.scheduling_interval) {
          return { logisticsTick: newLogisticsTick };
        }

        // For each resource type, match surplus to need
        for (const resource of RESOURCE_TYPES) {
          // Skip if no pending transfers possible
          if (state.factories.length < 2) continue;

          // Match factories: greedy pairing of high need with high surplus
          const proposedTransfers = matchSurplusToNeed(state.factories, resource, state.gameTime);

          // Apply reservations and schedule transfers
          for (const transfer of proposedTransfers) {
            const sourceFactory = state.factories.find((f) => f.id === transfer.fromFactoryId);
            const destFactory = state.factories.find((f) => f.id === transfer.toFactoryId);

            if (!sourceFactory || !destFactory) continue;

            // Try to reserve at source
            if (!reserveOutbound(sourceFactory, resource, transfer.amount)) {
              continue; // Cannot reserve, skip this transfer
            }

            // Add to pending transfers queue
            const transferId = generateTransferId();
            state.logisticsQueues.pendingTransfers.push({
              id: transferId,
              ...transfer,
              resource,
            });

            // Emit visual transfer event to game world for FX
            try {
              const fromPos = sourceFactory.position.clone().add(new Vector3(0, 0.6, 0));
              const toPos = destFactory.position.clone().add(new Vector3(0, 0.6, 0));
              const duration = Math.max(0.1, transfer.eta - state.gameTime);
              const event = { id: transferId, amount: transfer.amount, from: fromPos, to: toPos, duration };
              // keep recent events bounded
              gameWorld.events.transfers.push(event as any);
              if (gameWorld.events.transfers.length > 48) {
                gameWorld.events.transfers.splice(0, gameWorld.events.transfers.length - 48);
              }
            } catch (e) {
              // best-effort: do not crash the scheduler if FX can't be emitted
            }
          }
        }

        // Execute arrivals (transfers that have completed travel)
        const completedTransfers: string[] = [];
        for (const transfer of state.logisticsQueues.pendingTransfers) {
          if (state.gameTime >= transfer.eta && transfer.status === 'scheduled') {
            const sourceFactory = state.factories.find((f) => f.id === transfer.fromFactoryId);
            const destFactory = state.factories.find((f) => f.id === transfer.toFactoryId);

            if (sourceFactory && destFactory) {
              executeArrival(sourceFactory, destFactory, transfer.resource, transfer.amount);
              completedTransfers.push(transfer.id);
            }
          }
        }

        // Clean up completed transfers
        state.logisticsQueues.pendingTransfers = state.logisticsQueues.pendingTransfers.filter(
          (t) => !completedTransfers.includes(t.id),
        );

        return { logisticsTick: 0 };
      });
    },

    processFactories: (dt) => {
      if (dt <= 0 || get().factories.length === 0) return;

      set((state) => {
        let processesStarted = 0;
        let remainingEnergy = Math.max(0, state.resources.energy);
        let totalBarsProduced = 0;

        const updatedFactories = state.factories.map((factory) => {
          const working = cloneFactory(factory);

          const energyNeeded = Math.max(0, working.energyCapacity - working.energy);
          if (energyNeeded > 0 && remainingEnergy > 0) {
            const pulled = Math.min(energyNeeded, remainingEnergy);
            working.energy += pulled;
            remainingEnergy -= pulled;
          }

          const idleDrain = working.idleEnergyPerSec * dt;
          if (idleDrain > 0) {
            working.energy = Math.max(0, working.energy - idleDrain);
          }

          const haulerDrain =
            (working.haulersAssigned ?? 0) > 0
              ? computeHaulerMaintenanceCost(working.haulersAssigned ?? 0) * dt
              : 0;
          if (haulerDrain > 0) {
            working.energy = Math.max(0, working.energy - haulerDrain);
          }

          while (
            working.resources.ore > 0 &&
            working.activeRefines.length < working.refineSlots &&
            working.energy > 0
          ) {
            const slotTarget = Math.max(1, working.refineSlots);
            const batchSize = Math.min(
              working.resources.ore,
              Math.max(10, working.storageCapacity / slotTarget),
            );
            const processId = `${working.id}-p${state.factoryProcessSequence + processesStarted + 1}`;
            const started = startRefineProcess(working, 'ore', batchSize, processId);
            if (!started) {
              break;
            }
            processesStarted += 1;
          }

          if (working.activeRefines.length > 0) {
            enforceMinOneRefining(working, working.energy, working.energyCapacity);
          }

          for (let i = working.activeRefines.length - 1; i >= 0; i -= 1) {
            const process = working.activeRefines[i];
            const drain = working.energyPerRefine * dt * process.speedMultiplier;
            const consumed = Math.min(drain, working.energy);
            working.energy = Math.max(0, working.energy - consumed);
            const refined = tickRefineProcess(working, process, dt);
            if (refined > 0) {
              working.resources.bars += refined;
              totalBarsProduced += refined;
            }
          }

          working.currentStorage = working.resources.ore;

          return working;
        });

        const resources = {
          ...state.resources,
          energy: remainingEnergy,
          bars: state.resources.bars + totalBarsProduced,
        };

        return {
          resources,
          factories: updatedFactories,
          factoryProcessSequence: state.factoryProcessSequence + processesStarted,
        };
      });
    },

    triggerFactoryAutofit: () =>
      set((state) => ({ factoryAutofitSequence: state.factoryAutofitSequence + 1 })),

    resetCamera: () => set((state) => ({ cameraResetSequence: state.cameraResetSequence + 1 })),

    resetGame: () => {
      const currentSettings = get().settings;
      set(() => {
        const factories = createDefaultFactories();
        const selectedFactoryId = factories[0]?.id ?? null;
        return {
          resources: { ...initialResources },
          modules: { ...initialModules },
          prestige: { ...initialPrestige },
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
