import { Vector3 } from 'three';
import type { StoreState, LogisticsQueues } from '../types';
import { RESOURCE_TYPES, generateTransferId, matchSurplusToNeed, reserveOutbound, executeArrival } from '@/ecs/logistics';
import { gameWorld } from '@/ecs/world';

/**
 * Pure function to process logistics scheduler and transfers.
 * Updates pending transfers queue and executes arrivals.
 * Returns the updated logistics queues and tick counter.
 */
export function processLogistics(
  state: StoreState,
): {
  logisticsQueues: LogisticsQueues;
  logisticsTick: number;
} {
  // Clone queues to avoid mutating input
  const updatedQueues: LogisticsQueues = {
    pendingTransfers: [...state.logisticsQueues.pendingTransfers],
  };

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
      updatedQueues.pendingTransfers.push({
        id: transferId,
        ...transfer,
        resource,
      });

      // Emit visual transfer event to game world for FX
      try {
        const fromPos = sourceFactory.position.clone().add(new Vector3(0, 0.6, 0));
        const toPos = destFactory.position.clone().add(new Vector3(0, 0.6, 0));
        const duration = Math.max(0.1, transfer.eta - state.gameTime);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event: any = {
          id: transferId,
          amount: transfer.amount,
          from: fromPos,
          to: toPos,
          duration,
        };
        // keep recent events bounded
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        gameWorld.events.transfers.push(event);
        if (gameWorld.events.transfers.length > 48) {
          gameWorld.events.transfers.splice(0, gameWorld.events.transfers.length - 48);
        }
      } catch {
        // best-effort: do not crash the scheduler if FX can't be emitted
      }
    }
  }

  // Execute arrivals (transfers that have completed travel)
  const completedTransfers: string[] = [];
  for (const transfer of updatedQueues.pendingTransfers) {
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
  updatedQueues.pendingTransfers = updatedQueues.pendingTransfers.filter(
    (t) => !completedTransfers.includes(t.id),
  );

  return {
    logisticsQueues: updatedQueues,
    logisticsTick: 0,
  };
}
