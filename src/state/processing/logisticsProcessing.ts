import type { StoreState, LogisticsQueues } from '@/state/types';
import {
  RESOURCE_TYPES,
  WAREHOUSE_NODE_ID,
} from '@/ecs/logistics';
import { computeWarehouseCapacity } from '@/state/utils';
import { getResourceModifiers } from '@/lib/resourceModifiers';
import { resolveFactoryHaulerConfig } from '@/lib/haulerUpgrades';
import { logLogistics } from '@/lib/debug';
import { scheduleFactoryToFactoryTransfers } from './logistics/factoryTransfers';
import { scheduleFactoryToWarehouseTransfers, scheduleWarehouseToFactoryTransfers } from './logistics/warehouseOperations';
import { scheduleUpgradeRequests } from './logistics/upgradeRequests';
import { processCompletedTransfers } from './logistics/transferCompletion';

/**
 * Pure function to process logistics scheduler and transfers.
 * Updates pending transfers queue and executes arrivals.
 * Returns the updated logistics queues and tick counter.
 */
export function processLogistics(state: StoreState): {
  logisticsQueues: LogisticsQueues;
  logisticsTick: number;
  throughputByFactory: Record<string, number>;
} {
  const updatedQueues: LogisticsQueues = {
    pendingTransfers: [...state.logisticsQueues.pendingTransfers],
  };
  logLogistics(
    'processLogistics: factories=%o transfers=%o gameTime=%o',
    state.factories.length,
    updatedQueues.pendingTransfers.length,
    state.gameTime,
  );

  const modifiers = getResourceModifiers(state.resources, state.prestige.cores);
  const warehouseCapacity = computeWarehouseCapacity(state.modules, modifiers);

  const warehouseInboundReservations = new Map<string, number>();
  const warehouseOutboundReservations = new Map<string, number>();

  const resolvedConfigs = new Map<string, ReturnType<typeof resolveFactoryHaulerConfig>>();
  for (const factory of state.factories) {
    resolvedConfigs.set(
      factory.id,
      resolveFactoryHaulerConfig({
        baseConfig: factory.haulerConfig,
        modules: state.modules,
        upgrades: factory.haulerUpgrades,
      }),
    );
  }

  for (const transfer of updatedQueues.pendingTransfers) {
    if (transfer.toFactoryId === WAREHOUSE_NODE_ID) {
      warehouseInboundReservations.set(
        transfer.resource,
        (warehouseInboundReservations.get(transfer.resource) ?? 0) + transfer.amount,
      );
    }
    if (transfer.fromFactoryId === WAREHOUSE_NODE_ID) {
      warehouseOutboundReservations.set(
        transfer.resource,
        (warehouseOutboundReservations.get(transfer.resource) ?? 0) + transfer.amount,
      );
    }
  }

  const networkHasHaulers = state.factories.some((factory) => (factory.haulersAssigned ?? 0) > 0);

  for (const resource of RESOURCE_TYPES) {
    if (state.factories.length === 0) continue;

    // state.resources is strongly typed with known resource keys; index directly
    const warehouseStock = state.resources[resource] ?? 0;
    let warehouseSpace =
      warehouseCapacity - warehouseStock - (warehouseInboundReservations.get(resource) ?? 0);
    let warehouseAvailable = warehouseStock - (warehouseOutboundReservations.get(resource) ?? 0);

    warehouseSpace = Math.max(0, warehouseSpace);
    warehouseAvailable = Math.max(0, warehouseAvailable);

    logLogistics(
      'resource[%s]: warehouse stock=%o space=%o available=%o',
      resource,
      warehouseStock,
      warehouseSpace,
      warehouseAvailable,
    );

    scheduleFactoryToFactoryTransfers(state, resource, resolvedConfigs, updatedQueues);

    if (!networkHasHaulers) {
      logLogistics(
        'resource[%s]: skipping factory<->warehouse scheduling: no haulers assigned',
        resource,
      );
      continue;
    }

    if (warehouseSpace > 0) {
      warehouseSpace = scheduleFactoryToWarehouseTransfers(state, resource, warehouseSpace, resolvedConfigs, updatedQueues);
    }

    if (warehouseAvailable > 0) {
      warehouseAvailable = scheduleWarehouseToFactoryTransfers(state, resource, warehouseAvailable, resolvedConfigs, updatedQueues);
    }

    if (warehouseAvailable > 0) {
      warehouseAvailable = scheduleUpgradeRequests(state, resource, warehouseAvailable, resolvedConfigs, updatedQueues);
    }
  }

  const { completedTransfers, throughputByFactory } = processCompletedTransfers(
    state,
    updatedQueues,
    warehouseCapacity,
  );

  updatedQueues.pendingTransfers = updatedQueues.pendingTransfers.filter(
    (t) => !completedTransfers.includes(t.id),
  );

  return {
    logisticsQueues: updatedQueues,
    logisticsTick: 0,
    throughputByFactory,
  };
}
