import { Vector3 } from 'three';
import type { StoreState, LogisticsQueues } from '@/state/types';
import type { FactoryTransferEvent } from '@/ecs/world';
import type { TransportableResource } from '@/ecs/logistics';
import {
  generateTransferId,
  matchSurplusToNeed,
  reserveOutbound,
} from '@/ecs/logistics';
import { gameWorld } from '@/ecs/world';
import { logLogistics } from '@/lib/debug';

export function scheduleFactoryToFactoryTransfers(
  state: StoreState,
  resource: TransportableResource,
  resolvedConfigs: Map<string, ReturnType<typeof import('@/lib/haulerUpgrades').resolveFactoryHaulerConfig>>,
  updatedQueues: LogisticsQueues,
): void {
  const proposedTransfers = matchSurplusToNeed(
    state.factories,
    resource,
    state.gameTime,
    resolvedConfigs,
  );
  logLogistics('resource[%s]: proposed factory-to-factory=%o', resource, proposedTransfers.length);

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
      departedAt: transfer.departedAt ?? state.gameTime,
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
      gameWorld.events.transfers.push(event);
      if (gameWorld.events.transfers.length > 48) {
        gameWorld.events.transfers.splice(0, gameWorld.events.transfers.length - 48);
      }
    } catch {
      // best-effort: do not crash the scheduler if FX can't be emitted
    }
  }
}
