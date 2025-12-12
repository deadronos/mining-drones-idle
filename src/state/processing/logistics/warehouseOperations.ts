import { Vector3 } from 'three';
import type { StoreState, LogisticsQueues } from '@/state/types';
import type { resolveFactoryHaulerConfig } from '@/lib/haulerUpgrades';
import type { TransportableResource } from '@/ecs/logistics';
import {
  LOGISTICS_CONFIG,
  WAREHOUSE_NODE_ID,
  generateTransferId,
  computeBufferTarget,
  computeMinReserve,
  computeTravelTime,
  reserveOutbound,
  emitTransferFX,
} from '@/ecs/logistics';
import { logLogistics } from '@/lib/debug';

const WAREHOUSE_POSITION = new Vector3(0, 0, 0);

export function scheduleWarehouseToFactoryTransfers(
  state: StoreState,
  resource: TransportableResource,
  warehouseAvailable: number,
  resolvedConfigs: Map<string, ReturnType<typeof resolveFactoryHaulerConfig>>,
  updatedQueues: LogisticsQueues,
): number {
  let remainingAvailable = warehouseAvailable;

  for (const factory of state.factories) {
    if (remainingAvailable <= 0) break;

    const config = resolvedConfigs.get(factory.id);
    if (!config) continue;
    const target = computeBufferTarget(factory, resource);
    const current = factory.resources[resource as keyof typeof factory.resources] ?? 0;
    const reservedInbound =
      factory.logisticsState?.inboundSchedules
        ?.filter((schedule) => schedule.resource === resource)
        .reduce((sum, schedule) => sum + schedule.amount, 0) ?? 0;

    let remainingNeed = Math.max(0, target - current - reservedInbound);

    if (remainingNeed <= 0) {
      continue;
    }

    factory.logisticsState ??= {
      outboundReservations: {},
      inboundSchedules: [],
    };

    while (remainingNeed > 0 && remainingAvailable > 0) {
      const capacity = config.capacity ?? LOGISTICS_CONFIG.hauler_capacity;
      const transferAmount = Math.min(remainingNeed, capacity, remainingAvailable);
      if (transferAmount <= 0) break;

      const travelTime = computeTravelTime(WAREHOUSE_POSITION, factory.position, config);
      const eta = state.gameTime + travelTime;
      const transferId = generateTransferId();

      updatedQueues.pendingTransfers.push({
        id: transferId,
        fromFactoryId: WAREHOUSE_NODE_ID,
        toFactoryId: factory.id,
        resource,
        amount: transferAmount,
        status: 'scheduled',
        eta,
        departedAt: state.gameTime,
      });

      factory.logisticsState.inboundSchedules = [
        ...(factory.logisticsState.inboundSchedules ?? []),
        {
          fromFactoryId: WAREHOUSE_NODE_ID,
          resource,
          amount: transferAmount,
          eta,
        },
      ];

      emitTransferFX(
        transferId,
        transferAmount,
        WAREHOUSE_POSITION,
        factory.position,
        eta,
        state.gameTime,
      );

      remainingAvailable = Math.max(0, remainingAvailable - transferAmount);
      remainingNeed -= transferAmount;
    }
  }

  return remainingAvailable;
}

export function scheduleFactoryToWarehouseTransfers(
  state: StoreState,
  resource: TransportableResource,
  warehouseSpace: number,
  resolvedConfigs: Map<string, ReturnType<typeof resolveFactoryHaulerConfig>>,
  updatedQueues: LogisticsQueues,
): number {
  let remainingSpace = warehouseSpace;

  for (const factory of state.factories) {
    if (remainingSpace <= 0) break;
    const haulersAssigned = factory.haulersAssigned ?? 0;
    if (haulersAssigned <= 0) continue;

    const config = resolvedConfigs.get(factory.id);
    if (!config) continue;
    const target = computeBufferTarget(factory, resource);
    const current = factory.resources[resource as keyof typeof factory.resources] ?? 0;
    const minReserve = computeMinReserve(factory, resource);
    const reservedOutbound = factory.logisticsState?.outboundReservations?.[resource] ?? 0;
    let available = Math.max(0, current - target - minReserve - reservedOutbound);

    while (available > 0 && remainingSpace > 0) {
      const capacity = config.capacity ?? LOGISTICS_CONFIG.hauler_capacity;
      const transferAmount = Math.min(available, capacity, remainingSpace);
      if (transferAmount <= 0) break;

      if (!reserveOutbound(factory, resource, transferAmount)) {
        logLogistics(
          'reserve to-warehouse failed: factory=%s res=%s amount=%o avail=%o',
          factory.id,
          resource,
          transferAmount,
          available,
        );
        break;
      }

      const travelTime = computeTravelTime(factory.position, WAREHOUSE_POSITION, config);
      const eta = state.gameTime + travelTime;
      const transferId = generateTransferId();

      updatedQueues.pendingTransfers.push({
        id: transferId,
        fromFactoryId: factory.id,
        toFactoryId: WAREHOUSE_NODE_ID,
        resource,
        amount: transferAmount,
        status: 'scheduled',
        eta,
        departedAt: state.gameTime,
      });

      emitTransferFX(
        transferId,
        transferAmount,
        factory.position,
        WAREHOUSE_POSITION,
        eta,
        state.gameTime,
      );

      remainingSpace = Math.max(0, remainingSpace - transferAmount);
      available -= transferAmount;
    }
  }

  return remainingSpace;
}
