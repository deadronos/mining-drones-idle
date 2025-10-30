import type { StoreState, LogisticsQueues } from '@/state/types';
import {
  WAREHOUSE_NODE_ID,
  releaseReservation,
  executeArrival,
} from '@/ecs/logistics';
import { logLogistics } from '@/lib/debug';

export function processCompletedTransfers(
  state: StoreState,
  updatedQueues: LogisticsQueues,
  warehouseCapacity: number,
): { completedTransfers: string[]; throughputByFactory: Record<string, number> } {
  const completedTransfers: string[] = [];
  const throughputByFactory: Record<string, number> = {};

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

          const currentWarehouse = state.resources[transfer.resource] ?? 0;
          const updatedWarehouse = Math.min(warehouseCapacity, currentWarehouse + transfer.amount);
          state.resources[transfer.resource] = updatedWarehouse;

          throughputByFactory[sourceFactory.id] =
            (throughputByFactory[sourceFactory.id] ?? 0) + transfer.amount;
          completedTransfers.push(transfer.id);
        }
      } else if (transfer.fromFactoryId === WAREHOUSE_NODE_ID) {
        const destFactory = state.factories.find((f) => f.id === transfer.toFactoryId);
        if (destFactory) {
            const currentWarehouse = state.resources[transfer.resource] ?? 0;
            state.resources[transfer.resource] = Math.max(0, currentWarehouse - transfer.amount);

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

          throughputByFactory[destFactory.id] =
            (throughputByFactory[destFactory.id] ?? 0) + transfer.amount;
          completedTransfers.push(transfer.id);
        }
      } else {
        const sourceFactory = state.factories.find((f) => f.id === transfer.fromFactoryId);
        const destFactory = state.factories.find((f) => f.id === transfer.toFactoryId);

        if (sourceFactory && destFactory) {
          executeArrival(sourceFactory, destFactory, transfer.resource, transfer.amount);
          throughputByFactory[sourceFactory.id] =
            (throughputByFactory[sourceFactory.id] ?? 0) + transfer.amount;
          throughputByFactory[destFactory.id] =
            (throughputByFactory[destFactory.id] ?? 0) + transfer.amount;
          completedTransfers.push(transfer.id);
        }
      }
    }
  }

  return { completedTransfers, throughputByFactory };
}
