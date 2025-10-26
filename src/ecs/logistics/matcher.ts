import type { BuildableFactory } from '@/ecs/factories';
import type { PendingTransfer, HaulerConfig } from '@/state/store';
import type { TransportableResource } from './config';
import { logLogistics } from '@/lib/debug';
import { LOGISTICS_CONFIG } from './config';
import { computeBufferTarget, computeMinReserve, computeTravelTime } from './math';

/**
 * Matches factories with surplus to factories with need.
 * Uses a greedy algorithm to pair highest need with closest/fastest supplier.
 *
 * @param factories All factories in the network
 * @param resource Resource type to transfer
 * @param gameTime Current game time (for ETA calculation)
 * @param resolvedConfigs Optional map of factory IDs to hauler configs (overrides factory.haulerConfig)
 * @returns Array of proposed transfers
 */
export const matchSurplusToNeed = (
  factories: BuildableFactory[],
  resource: TransportableResource,
  gameTime: number,
  resolvedConfigs?: Map<string, HaulerConfig>,
): Omit<PendingTransfer, 'id'>[] => {
  const transfers: Omit<PendingTransfer, 'id'>[] = [];

  if (factories.length < 2) {
    logLogistics('matchSurplusToNeed[%s]: not enough factories (%o)', resource, factories.length);
    return transfers;
  }

  const networkHasHaulers = factories.some((factory) => (factory.haulersAssigned ?? 0) > 0);
  if (!networkHasHaulers) {
    logLogistics('matchSurplusToNeed[%s]: no haulers assigned anywhere', resource);
    return transfers;
  }

  // Compute needs and surpluses
  interface NeedEntry {
    factory: BuildableFactory;
    need: number;
    config?: HaulerConfig;
  }
  interface SurplusEntry {
    factory: BuildableFactory;
    surplus: number;
    config?: HaulerConfig;
  }

  const needs: NeedEntry[] = [];
  const surpluses: SurplusEntry[] = [];

  for (const factory of factories) {
    const target = computeBufferTarget(factory, resource);
    const current = factory.resources[resource as keyof typeof factory.resources] ?? 0;
    const need = Math.max(0, target - current);

    if (need > 0) {
      const config = resolvedConfigs?.get(factory.id) ?? factory.haulerConfig;
      needs.push({ factory, need, config });
    }

    const haulersAssigned = factory.haulersAssigned ?? 0;
    if (haulersAssigned <= 0) {
      continue;
    }

    const minReserve = computeMinReserve(factory, resource);
    const surplus = Math.max(0, current - target - minReserve);

    if (surplus > 0) {
      const config = resolvedConfigs?.get(factory.id) ?? factory.haulerConfig;
      surpluses.push({ factory, surplus, config });
    }
  }

  logLogistics(
    'matchSurplusToNeed[%s]: needs=%o surpluses=%o',
    resource,
    needs.map((n) => ({ id: n.factory.id, need: n.need })),
    surpluses.map((s) => ({ id: s.factory.id, surplus: s.surplus })),
  );

  // Sort needs and surpluses descending (highest first)
  needs.sort((a, b) => b.need - a.need);
  surpluses.sort((a, b) => b.surplus - a.surplus);

  // Greedy matching: pair high need with high surplus
  for (const needEntry of needs) {
    for (const surplusEntry of surpluses) {
      if (needEntry.need <= 0) break;
      if (surplusEntry.surplus <= 0) continue;

      // Respect resource filters if set
      const needHasFilters =
        needEntry.config?.resourceFilters && needEntry.config.resourceFilters.length > 0;
      if (
        needHasFilters &&
        needEntry.config &&
        !needEntry.config.resourceFilters.includes(resource)
      ) {
        continue;
      }

      const surplusHasFilters =
        surplusEntry.config?.resourceFilters && surplusEntry.config.resourceFilters.length > 0;
      if (
        surplusHasFilters &&
        surplusEntry.config &&
        !surplusEntry.config.resourceFilters.includes(resource)
      ) {
        continue;
      }

      // Compute transfer amount: min of need, surplus, hauler capacity
      const capacity = surplusEntry.config?.capacity ?? LOGISTICS_CONFIG.hauler_capacity;
      const transferAmount = Math.min(needEntry.need, surplusEntry.surplus, capacity);

      if (transferAmount <= 0) continue;

      // Compute travel time
      const travelTime = computeTravelTime(
        surplusEntry.factory.position,
        needEntry.factory.position,
        surplusEntry.config ?? {
          capacity: LOGISTICS_CONFIG.hauler_capacity,
          speed: LOGISTICS_CONFIG.hauler_speed,
          pickupOverhead: LOGISTICS_CONFIG.pickup_overhead,
          dropoffOverhead: LOGISTICS_CONFIG.dropoff_overhead,
          resourceFilters: [],
          mode: 'auto',
          priority: 5,
        },
      );

      const eta = gameTime + travelTime;

      transfers.push({
        fromFactoryId: surplusEntry.factory.id,
        toFactoryId: needEntry.factory.id,
        resource,
        amount: transferAmount,
        status: 'scheduled',
        eta,
      });
      logLogistics(
        'proposed transfer [%s]: %s -> %s amount=%o eta=%o',
        resource,
        surplusEntry.factory.id,
        needEntry.factory.id,
        transferAmount,
        eta - gameTime,
      );

      // Update remaining need/surplus
      needEntry.need -= transferAmount;
      surplusEntry.surplus -= transferAmount;
    }
  }

  return transfers;
};
