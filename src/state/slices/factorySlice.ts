import type { StateCreator } from 'zustand';
import type { BuildableFactory, FactoryResources } from '@/ecs/factories';
import type { FactoryUpgradeCostVariantId, StoreState } from '../types';
import {
  createFactory,
  attemptDockDrone,
  computeFactoryCost,
  removeDroneFromFactory,
  transferOreToFactory,
  computeFactoryPlacement,
} from '@/ecs/factories';
import { generateUniqueId } from '@/lib/utils';
import { cloneFactory } from '../serialization';
import { createFactoryUpgradeMethods } from './factory/upgradeRequests';

export interface FactorySliceState {
  factories: BuildableFactory[];
  factoryProcessSequence: number;
  factoryRoundRobin: number;
  factoryAutofitSequence: number;
  cameraResetSequence: number;
}

export interface FactorySliceMethods {
  addFactory: (factory: BuildableFactory) => void;
  removeFactory: (factoryId: string) => void;
  getFactory: (factoryId: string) => BuildableFactory | undefined;
  purchaseFactory: () => boolean;
  toggleFactoryPinned: (factoryId: string) => void;
  setFactoryPinned: (factoryId: string, pinned: boolean) => void;
  nextFactoryRoundRobin: () => number;
  dockDroneAtFactory: (factoryId: string, droneId: string) => 'docking' | 'queued' | 'exists';
  undockDroneFromFactory: (
    factoryId: string,
    droneId: string,
    options?: { transferOwnership?: boolean },
  ) => void;
  unstickDrone: (droneId: string) => void;
  transferOreToFactory: (factoryId: string, amount: number) => number;
  addResourcesToFactory: (factoryId: string, delta: Partial<FactoryResources>) => void;
  allocateFactoryEnergy: (factoryId: string, amount: number) => number;
  upgradeFactory: (
    factoryId: string,
    upgrade: string,
    variant?: FactoryUpgradeCostVariantId,
  ) => boolean;
  detectAndCreateUpgradeRequest: (factoryId: string) => boolean;
  updateUpgradeRequestFulfillment: (factoryId: string, resource: string, amount: number) => void;
  clearExpiredUpgradeRequests: (factoryId: string) => void;
  clearUpgradeRequests: (factoryId: string) => void;
  triggerFactoryAutofit: () => void;
  resetCamera: () => void;
}

export const createFactorySlice: StateCreator<
  StoreState,
  [],
  [],
  FactorySliceState & FactorySliceMethods
> = (set, get) => ({
  factories: [],
  factoryProcessSequence: 0,
  factoryRoundRobin: 0,
  factoryAutofitSequence: 0,
  cameraResetSequence: 0,

  addFactory: (factory) => {
    set((state) => ({
      factories: [...state.factories, cloneFactory(factory)],
    }));
  },

  removeFactory: (factoryId) => {
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
    });
  },

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
    const id = generateUniqueId('factory-');
    const position = computeFactoryPlacement(state.factories);
    const factory = createFactory(id, position);
    set((current) => {
      const specTechSpent = { ...current.specTechSpent };
      // Track metals and crystals spending for specialization tech unlocks
      if (cost.metals > 0) {
        specTechSpent.metals = (specTechSpent.metals ?? 0) + cost.metals;
      }
      if (cost.crystals > 0) {
        specTechSpent.crystals = (specTechSpent.crystals ?? 0) + cost.crystals;
      }
      return {
        resources: {
          ...current.resources,
          metals: current.resources.metals - cost.metals,
          crystals: current.resources.crystals - cost.crystals,
        },
        specTechSpent,
        factories: [...current.factories, factory],
        factoryAutofitSequence: current.factoryAutofitSequence + 1,
        selectedFactoryId: factory.id,
      };
    });
    return true;
  },

  toggleFactoryPinned: (factoryId) => {
    set((state) => ({
      factories: state.factories.map((factory) =>
        factory.id === factoryId ? { ...cloneFactory(factory), pinned: !factory.pinned } : factory,
      ),
    }));
  },

  setFactoryPinned: (factoryId, pinned) => {
    set((state) => ({
      factories: state.factories.map((factory) =>
        factory.id === factoryId ? { ...cloneFactory(factory), pinned } : factory,
      ),
    }));
  },

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
      nextDroneOwners = { ...state.droneOwners, [droneId]: factoryId };
      factories = state.factories.map((factory, idx) => (idx === index ? updated : factory));
    } else {
      factories = state.factories.map((factory, idx) => (idx === index ? updated : factory));
    }

    set(() => ({ factories, droneOwners: nextDroneOwners }));
  },

  unstickDrone: (droneId) => {
    set((state) => {
      // Remove droneId from any factory queuedDrones
      const factories = state.factories.map((factory) => ({ ...cloneFactory(factory) }));
      for (const f of factories) {
        if (Array.isArray(f.queuedDrones) && f.queuedDrones.includes(droneId)) {
          f.queuedDrones = f.queuedDrones.filter((d) => d !== droneId);
        }
      }

      // Clear owner mapping for the drone
      const droneOwners = { ...state.droneOwners };
      if (droneOwners[droneId] !== undefined) {
        droneOwners[droneId] = null;
      }

      return { factories, droneOwners };
    });
  },

  transferOreToFactory: (factoryId, amount) => {
    const state = get();
    const index = state.factories.findIndex((f) => f.id === factoryId);
    if (index === -1) return 0;
    const updated = cloneFactory(state.factories[index]);
    const transferred = transferOreToFactory(updated, amount);
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
        }
        changed = true;
      }
      if (!changed) {
        return {};
      }
      const factories = state.factories.map((factory, idx) => (idx === index ? updated : factory));
      return { factories };
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
      const factories = state.factories.map((factory, idx) => (idx === index ? updated : factory));
      const resources = {
        ...state.resources,
        energy: Math.max(0, state.resources.energy - applied),
      };
      return { factories, resources };
    });
    return granted;
  },

  ...createFactoryUpgradeMethods(set, get),
  triggerFactoryAutofit: () => {
    set((state) => ({ factoryAutofitSequence: state.factoryAutofitSequence + 1 }));
  },

  resetCamera: () => {
    set((state) => ({ cameraResetSequence: state.cameraResetSequence + 1 }));
  },
});
