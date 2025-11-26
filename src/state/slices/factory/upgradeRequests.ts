import type { StoreApi } from 'zustand/vanilla';
import type { BuildableFactory, FactoryResources } from '@/ecs/factories';
import type { FactoryUpgradeCostVariantId, StoreState } from '../../types';
import { detectUpgradeShortfall } from '@/ecs/factories';
import { computeFactoryUpgradeCost } from '../../utils';
import { cloneFactory } from '../../serialization';
import { factoryUpgradeDefinitions } from '../../constants';
import { getBridge, isBridgeReady } from '@/lib/rustBridgeRegistry';

export const createFactoryUpgradeMethods = (
  set: StoreApi<StoreState>['setState'],
  get: StoreApi<StoreState>['getState'],
) => ({
  upgradeFactory: (factoryId: string, upgrade: string, variant?: FactoryUpgradeCostVariantId) => {
    const state = get();

    // Route through Rust bridge when enabled and ready
    if (state.settings.useRustSim && isBridgeReady()) {
      const bridge = getBridge();
      if (bridge) {
        bridge.applyCommand({
          type: 'PurchaseFactoryUpgrade',
          payload: {
            factoryId,
            upgradeType: upgrade,
            costVariant: variant,
          },
        });
        // Note: Full factory sync would require re-parsing the snapshot
        // For now, we also execute the TS logic to keep local state consistent
      }
    }

    // TypeScript logic (always executed for local state consistency)
    const index = state.factories.findIndex((f) => f.id === factoryId);
    if (index === -1) {
      return false;
    }
    const definition = factoryUpgradeDefinitions[upgrade as keyof typeof factoryUpgradeDefinitions];
    if (!definition) {
      return false;
    }
    const base = state.factories[index];
    const level = base.upgrades[upgrade as keyof typeof base.upgrades] ?? 0;
    const cost = computeFactoryUpgradeCost(upgrade as never, level, variant);
    for (const [key, value] of Object.entries(cost) as [keyof FactoryResources, number][]) {
      if (value > 0 && (base.resources[key] ?? 0) < value) {
        return false;
      }
    }
    const updated = cloneFactory(base);
    for (const [key, value] of Object.entries(cost) as [keyof FactoryResources, number][]) {
      if (value <= 0) continue;
      updated.resources[key] = Math.max(0, (updated.resources[key] ?? 0) - value);
      if (key === 'ore') {
        updated.currentStorage = updated.resources.ore;
      }
    }
    definition.apply(updated);

    // Clear any upgrade request for this upgrade (since it was just purchased)
    updated.upgradeRequests = updated.upgradeRequests.filter((req) => req.upgrade !== upgrade);

    set((current: StoreState) => {
      const factories = current.factories.map((factory: BuildableFactory, idx: number) =>
        idx === index ? updated : factory,
      );
      // Track secondary resource spending for specialization tech unlocks
      const specTechSpent = { ...current.specTechSpent };
      const secondaryResourceKeys: Array<'metals' | 'crystals' | 'organics' | 'ice'> = [
        'metals',
        'crystals',
        'organics',
        'ice',
      ];
      for (const key of secondaryResourceKeys) {
        if (key in cost) {
          const value = (cost as Record<string, number>)[key] ?? 0;
          if (value > 0) {
            specTechSpent[key] = (specTechSpent[key] ?? 0) + value;
          }
        }
      }
      return { factories, specTechSpent };
    });
    return true;
  },

  detectAndCreateUpgradeRequest: (factoryId: string) => {
    const state = get();
    const index = state.factories.findIndex((f) => f.id === factoryId);
    if (index === -1) {
      return false;
    }

    const factory = state.factories[index];
    const upgradeOrder: (keyof typeof factory.upgrades)[] = [
      'docking',
      'refine',
      'storage',
      'energy',
      'solar',
    ];

    const request = detectUpgradeShortfall(factory, upgradeOrder as unknown as string[]);
    if (!request) {
      return false;
    }

    set((current: StoreState) => {
      const updated = cloneFactory(current.factories[index]);
      updated.upgradeRequests.push(request);
      const factories = current.factories.map((f, idx) => (idx === index ? updated : f));
      return { factories };
    });
    return true;
  },

  updateUpgradeRequestFulfillment: (factoryId: string, resource: string, amount: number) => {
    if (amount <= 0) {
      return;
    }
    set((state: StoreState) => {
      const index = state.factories.findIndex((f) => f.id === factoryId);
      if (index === -1) {
        return {};
      }

      const updated = cloneFactory(state.factories[index]);
      let changed = false;

      // Update all pending/partially_fulfilled requests
      for (const request of updated.upgradeRequests) {
        if (request.status === 'expired') {
          continue;
        }

        const needed = request.resourceNeeded[resource as keyof FactoryResources] ?? 0;
        const fulfilled = request.fulfilledAmount[resource as keyof FactoryResources] ?? 0;
        if (needed <= 0 || fulfilled >= needed) {
          continue;
        }

        // Update fulfilled amount
        const additionalFulfilled = Math.min(amount, needed - fulfilled);
        request.fulfilledAmount[resource as keyof FactoryResources] =
          fulfilled + additionalFulfilled;
        changed = true;

        // Check if all resources are now fulfilled
        let allFulfilled = true;
        for (const [res, need] of Object.entries(request.resourceNeeded)) {
          if (typeof need === 'number' && need > 0) {
            const fulfilledAmount = request.fulfilledAmount[res as keyof FactoryResources] ?? 0;
            if (fulfilledAmount < need) {
              allFulfilled = false;
              break;
            }
          }
        }

        if (allFulfilled && request.status !== 'fulfilled') {
          request.status = 'fulfilled';
        } else if (fulfilled > 0 && request.status === 'pending') {
          request.status = 'partially_fulfilled';
        }
      }

      if (!changed) {
        return {};
      }

      const factories = state.factories.map((f: BuildableFactory, idx: number) =>
        idx === index ? updated : f,
      );
      return { factories };
    });
  },

  clearExpiredUpgradeRequests: (factoryId: string) => {
    const now = Date.now();
    set((state: StoreState) => {
      const index = state.factories.findIndex((f) => f.id === factoryId);
      if (index === -1) {
        return {};
      }

      const updated = cloneFactory(state.factories[index]);
      const beforeCount = updated.upgradeRequests.length;

      // Mark requests as expired if past their expiresAt time
      for (const request of updated.upgradeRequests) {
        if (request.status !== 'expired' && now >= request.expiresAt) {
          request.status = 'expired';
        }
      }

      // Remove expired requests
      updated.upgradeRequests = updated.upgradeRequests.filter((r) => r.status !== 'expired');

      if (updated.upgradeRequests.length === beforeCount) {
        return {};
      }

      const factories = state.factories.map((f: BuildableFactory, idx: number) =>
        idx === index ? updated : f,
      );
      return { factories };
    });
  },

  clearUpgradeRequests: (factoryId: string) => {
    set((state: StoreState) => {
      const index = state.factories.findIndex((f) => f.id === factoryId);
      if (index === -1) {
        return {};
      }

      const updated = cloneFactory(state.factories[index]);
      if (updated.upgradeRequests.length === 0) {
        return {};
      }

      updated.upgradeRequests = [];
      const factories = state.factories.map((f: BuildableFactory, idx: number) =>
        idx === index ? updated : f,
      );
      return { factories };
    });
  },
});
