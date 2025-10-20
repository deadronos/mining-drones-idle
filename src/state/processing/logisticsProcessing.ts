import { Vector3 } from 'three';
import type { StoreState, LogisticsQueues, HaulerConfig } from '../types';
import type { FactoryTransferEvent } from '@/ecs/world';
import {
  RESOURCE_TYPES,
  generateTransferId,
  matchSurplusToNeed,
  reserveOutbound,
  releaseReservation,
  executeArrival,
  computeBufferTarget,
  computeMinReserve,
  computeTravelTime,
  LOGISTICS_CONFIG,
  WAREHOUSE_NODE_ID,
} from '@/ecs/logistics';
import { computeWarehouseCapacity } from '@/state/utils';
import { getResourceModifiers } from '@/lib/resourceModifiers';
import { gameWorld } from '@/ecs/world';
import { logLogistics } from '@/lib/debug';

const WAREHOUSE_POSITION = new Vector3(0, 0, 0);

/**
 * Pure function to process logistics scheduler and transfers.
 * Updates pending transfers queue and executes arrivals.
 * Returns the updated logistics queues and tick counter.
 */
export function processLogistics(state: StoreState): {
  logisticsQueues: LogisticsQueues;
  logisticsTick: number;
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

  const resolveHaulerConfig = (factory: { haulerConfig?: HaulerConfig }): HaulerConfig => ({
    capacity: factory.haulerConfig?.capacity ?? LOGISTICS_CONFIG.hauler_capacity,
    speed: factory.haulerConfig?.speed ?? LOGISTICS_CONFIG.hauler_speed,
    pickupOverhead: factory.haulerConfig?.pickupOverhead ?? LOGISTICS_CONFIG.pickup_overhead,
    dropoffOverhead: factory.haulerConfig?.dropoffOverhead ?? LOGISTICS_CONFIG.dropoff_overhead,
    resourceFilters: factory.haulerConfig?.resourceFilters ?? [],
    mode: factory.haulerConfig?.mode ?? 'auto',
    priority: factory.haulerConfig?.priority ?? 5,
  });

  const modifiers = getResourceModifiers(state.resources, state.prestige.cores);
  const warehouseCapacity = computeWarehouseCapacity(state.modules, modifiers);

  const warehouseInboundReservations = new Map<string, number>();
  const warehouseOutboundReservations = new Map<string, number>();

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

    const warehouseStock = (state.resources as unknown as Record<string, number>)[resource] ?? 0;
    let warehouseSpace =
      warehouseCapacity - warehouseStock - (warehouseInboundReservations.get(resource) ?? 0);
    let warehouseAvailable = warehouseStock - (warehouseOutboundReservations.get(resource) ?? 0);

    warehouseSpace = Math.max(0, warehouseSpace);
    warehouseAvailable = Math.max(0, warehouseAvailable);

    const proposedTransfers = matchSurplusToNeed(state.factories, resource, state.gameTime);
    logLogistics(
      'resource[%s]: warehouse stock=%o space=%o available=%o proposed=%o',
      resource,
      warehouseStock,
      warehouseSpace,
      warehouseAvailable,
      proposedTransfers.length,
    );

    for (const transfer of proposedTransfers) {
      const sourceFactory = state.factories.find((f) => f.id === transfer.fromFactoryId);
      const destFactory = state.factories.find((f) => f.id === transfer.toFactoryId);

      if (!sourceFactory || !destFactory) {
        logLogistics(
          'discard proposed transfer: missing factories from=%s to=%s',
          transfer.fromFactoryId,
          transfer.toFactoryId,
        );
        continue;
      }

      if (!reserveOutbound(sourceFactory, resource, transfer.amount)) {
        logLogistics(
          'reserve failed for proposed transfer: from=%s to=%s amount=%o',
          transfer.fromFactoryId,
          transfer.toFactoryId,
          transfer.amount,
        );
        continue;
      }

      const transferId = generateTransferId();
      updatedQueues.pendingTransfers.push({
        id: transferId,
        ...transfer,
        resource,
      });

      try {
        const fromPos = sourceFactory.position.clone().add(new Vector3(0, 0.6, 0));
        const toPos = destFactory.position.clone().add(new Vector3(0, 0.6, 0));
        const duration = Math.max(0.1, transfer.eta - state.gameTime);
        const event: FactoryTransferEvent = {
          id: transferId,
          amount: transfer.amount,
          from: fromPos,
          to: toPos,
          duration,
        };
        // keep recent events bounded
        gameWorld.events.transfers.push(event);
        if (gameWorld.events.transfers.length > 48) {
          gameWorld.events.transfers.splice(0, gameWorld.events.transfers.length - 48);
        }
      } catch {
        // best-effort: do not crash the scheduler if FX can't be emitted
      }
    }

    if (!networkHasHaulers) {
      logLogistics(
        'resource[%s]: skipping factory<->warehouse scheduling: no haulers assigned',
        resource,
      );
      continue;
    }

    if (warehouseSpace > 0) {
      for (const factory of state.factories) {
        if (warehouseSpace <= 0) break;
        const haulersAssigned = factory.haulersAssigned ?? 0;
        if (haulersAssigned <= 0) continue;

        const config = resolveHaulerConfig(factory);
        const target = computeBufferTarget(factory, resource);
        const current = factory.resources[resource as keyof typeof factory.resources] ?? 0;
        const minReserve = computeMinReserve(factory, resource);
        const reservedOutbound = factory.logisticsState?.outboundReservations?.[resource] ?? 0;
        let available = Math.max(0, current - target - minReserve - reservedOutbound);

        while (available > 0 && warehouseSpace > 0) {
          const capacity = config.capacity ?? LOGISTICS_CONFIG.hauler_capacity;
          const transferAmount = Math.min(available, capacity, warehouseSpace);
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
          });

          try {
            const fromPos = factory.position.clone().add(new Vector3(0, 0.6, 0));
            const toPos = WAREHOUSE_POSITION.clone().add(new Vector3(0, 0.6, 0));
            const duration = Math.max(0.1, eta - state.gameTime);
            const event: FactoryTransferEvent = {
              id: transferId,
              amount: transferAmount,
              from: fromPos,
              to: toPos,
              duration,
            };
            gameWorld.events.transfers.push(event);
            if (gameWorld.events.transfers.length > 48) {
              gameWorld.events.transfers.splice(0, gameWorld.events.transfers.length - 48);
            }
          } catch {
            // ignore FX failures
          }

          warehouseSpace = Math.max(0, warehouseSpace - transferAmount);
          available -= transferAmount;
        }
      }
    }

    if (warehouseAvailable > 0) {
      for (const factory of state.factories) {
        if (warehouseAvailable <= 0) break;

        const config = resolveHaulerConfig(factory);
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

        while (remainingNeed > 0 && warehouseAvailable > 0) {
          const capacity = config.capacity ?? LOGISTICS_CONFIG.hauler_capacity;
          const transferAmount = Math.min(remainingNeed, capacity, warehouseAvailable);
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

          try {
            const fromPos = WAREHOUSE_POSITION.clone().add(new Vector3(0, 0.6, 0));
            const toPos = factory.position.clone().add(new Vector3(0, 0.6, 0));
            const duration = Math.max(0.1, eta - state.gameTime);
            const event: FactoryTransferEvent = {
              id: transferId,
              amount: transferAmount,
              from: fromPos,
              to: toPos,
              duration,
            };
            gameWorld.events.transfers.push(event);
            if (gameWorld.events.transfers.length > 48) {
              gameWorld.events.transfers.splice(0, gameWorld.events.transfers.length - 48);
            }
          } catch {
            // ignore FX failures
          }

          warehouseAvailable = Math.max(0, warehouseAvailable - transferAmount);
          remainingNeed -= transferAmount;
        }
      }
    }

    // Handle upgrade requests: factories requesting resources for upgrades
    // Sort by creation time (older requests have higher priority)
    const upgradeRequests = state.factories
      .flatMap((factory) =>
        factory.upgradeRequests
          .filter((req) => req.status === 'pending' || req.status === 'partially_fulfilled')
          .map((req) => ({ factory, request: req })),
      )
      .sort((a, b) => a.request.createdAt - b.request.createdAt);

    for (const { factory, request } of upgradeRequests) {
      if (warehouseAvailable <= 0) break;

      const config = resolveHaulerConfig(factory);
      const neededAmount = request.resourceNeeded[resource as keyof typeof request.resourceNeeded];
      const fulfilledAmount =
        request.fulfilledAmount[resource as keyof typeof request.fulfilledAmount] ?? 0;

      if (typeof neededAmount !== 'number' || neededAmount <= 0) {
        continue;
      }

      const remainingNeed = Math.max(0, neededAmount - fulfilledAmount);
      if (remainingNeed <= 0) {
        continue; // This resource is already fulfilled for this request
      }

      const capacity = config.capacity ?? LOGISTICS_CONFIG.hauler_capacity;
      const transferAmount = Math.min(remainingNeed, capacity, warehouseAvailable);
      if (transferAmount <= 0) continue;

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
      });

      factory.logisticsState ??= {
        outboundReservations: {},
        inboundSchedules: [],
      };

      factory.logisticsState.inboundSchedules = [
        ...(factory.logisticsState.inboundSchedules ?? []),
        {
          fromFactoryId: WAREHOUSE_NODE_ID,
          resource,
          amount: transferAmount,
          eta,
        },
      ];

      try {
        const fromPos = WAREHOUSE_POSITION.clone().add(new Vector3(0, 0.6, 0));
        const toPos = factory.position.clone().add(new Vector3(0, 0.6, 0));
        const duration = Math.max(0.1, eta - state.gameTime);
        const event: FactoryTransferEvent = {
          id: transferId,
          amount: transferAmount,
          from: fromPos,
          to: toPos,
          duration,
        };
        gameWorld.events.transfers.push(event);
        if (gameWorld.events.transfers.length > 48) {
          gameWorld.events.transfers.splice(0, gameWorld.events.transfers.length - 48);
        }
      } catch {
        // ignore FX failures
      }

      warehouseAvailable = Math.max(0, warehouseAvailable - transferAmount);
    }
  }

  const completedTransfers: string[] = [];
  for (const transfer of updatedQueues.pendingTransfers) {
    if (state.gameTime >= transfer.eta && transfer.status === 'scheduled') {
      logLogistics(
        'transfer due: id=%s res=%s amount=%o from=%s to=%s',
        transfer.id,
        transfer.resource,
        transfer.amount,
        transfer.fromFactoryId,
        transfer.toFactoryId,
      );
      if (transfer.toFactoryId === WAREHOUSE_NODE_ID) {
        const sourceFactory = state.factories.find((f) => f.id === transfer.fromFactoryId);
        if (sourceFactory) {
          releaseReservation(sourceFactory, transfer.resource, transfer.amount);

          const key = transfer.resource as keyof typeof sourceFactory.resources;
          const currentValue = sourceFactory.resources[key] ?? 0;
          sourceFactory.resources[key] = Math.max(0, currentValue - transfer.amount) as never;
          if (transfer.resource === 'ore') {
            sourceFactory.currentStorage = sourceFactory.resources.ore;
          }

          const currentWarehouse =
            (state.resources as unknown as Record<string, number>)[transfer.resource] ?? 0;
          const updatedWarehouse = Math.min(warehouseCapacity, currentWarehouse + transfer.amount);
          (state.resources as unknown as Record<string, number>)[transfer.resource] =
            updatedWarehouse;

          completedTransfers.push(transfer.id);
        }
      } else if (transfer.fromFactoryId === WAREHOUSE_NODE_ID) {
        const destFactory = state.factories.find((f) => f.id === transfer.toFactoryId);
        if (destFactory) {
          const currentWarehouse =
            (state.resources as unknown as Record<string, number>)[transfer.resource] ?? 0;
          (state.resources as unknown as Record<string, number>)[transfer.resource] = Math.max(
            0,
            currentWarehouse - transfer.amount,
          );

          const key = transfer.resource as keyof typeof destFactory.resources;
          const currentValue = destFactory.resources[key] ?? 0;
          destFactory.resources[key] = (currentValue + transfer.amount) as never;
          if (transfer.resource === 'ore') {
            destFactory.currentStorage = destFactory.resources.ore;
          }

          // Update upgrade request fulfillment with arrived resources
          for (const request of destFactory.upgradeRequests) {
            if (request.status === 'expired' || request.status === 'fulfilled') {
              continue;
            }

            const neededAmount =
              request.resourceNeeded[transfer.resource as keyof typeof request.resourceNeeded] ?? 0;
            if (typeof neededAmount !== 'number' || neededAmount <= 0) {
              continue;
            }

            const fulfilledAmount =
              request.fulfilledAmount[transfer.resource as keyof typeof request.fulfilledAmount] ??
              0;
            const additionalFulfilled = Math.min(transfer.amount, neededAmount - fulfilledAmount);

            if (additionalFulfilled > 0) {
              request.fulfilledAmount[transfer.resource as keyof typeof request.fulfilledAmount] =
                fulfilledAmount + additionalFulfilled;

              // Check if all resources are now fulfilled
              let allFulfilled = true;
              for (const [res, needed] of Object.entries(request.resourceNeeded)) {
                if (typeof needed === 'number' && needed > 0) {
                  const fulfilled =
                    request.fulfilledAmount[res as keyof typeof request.fulfilledAmount] ?? 0;
                  if (fulfilled < needed) {
                    allFulfilled = false;
                    break;
                  }
                }
              }

              if (allFulfilled) {
                request.status = 'fulfilled';
              } else if (request.status === 'pending') {
                request.status = 'partially_fulfilled';
              }
            }
          }

          if (destFactory.logisticsState?.inboundSchedules) {
            destFactory.logisticsState.inboundSchedules =
              destFactory.logisticsState.inboundSchedules.filter(
                (schedule) =>
                  !(
                    schedule.fromFactoryId === transfer.fromFactoryId &&
                    schedule.resource === transfer.resource &&
                    schedule.eta === transfer.eta
                  ),
              );
          }

          completedTransfers.push(transfer.id);
        }
      } else {
        const sourceFactory = state.factories.find((f) => f.id === transfer.fromFactoryId);
        const destFactory = state.factories.find((f) => f.id === transfer.toFactoryId);

        if (sourceFactory && destFactory) {
          executeArrival(sourceFactory, destFactory, transfer.resource, transfer.amount);
          completedTransfers.push(transfer.id);
        }
      }
    }
  }

  updatedQueues.pendingTransfers = updatedQueues.pendingTransfers.filter(
    (t) => !completedTransfers.includes(t.id),
  );

  return {
    logisticsQueues: updatedQueues,
    logisticsTick: 0,
  };
}
