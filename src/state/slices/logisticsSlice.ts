import type { StateCreator } from 'zustand';
import type { StoreState, HaulerConfig, FactoryLogisticsState } from '../types';
import { computeHaulerCost } from '@/ecs/logistics';
import { cloneFactory } from '../serialization';

export interface LogisticsSliceState {
  logisticsTick: number;
}

export interface LogisticsSliceMethods {
  assignHaulers: (factoryId: string, delta: number) => boolean;
  updateHaulerConfig: (factoryId: string, config: Partial<HaulerConfig>) => void;
  getLogisticsStatus: (
    factoryId: string,
  ) => { haulersAssigned: number; config?: HaulerConfig; state?: FactoryLogisticsState } | null;
}

export const createLogisticsSlice: StateCreator<
  StoreState,
  [],
  [],
  LogisticsSliceState & LogisticsSliceMethods
> = (set, get) => ({
  logisticsTick: 0,

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
      const currentConfig = factory.haulerConfig ?? {
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
});
