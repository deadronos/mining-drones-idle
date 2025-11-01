import { Vector3 } from 'three';
import type { StoreState, LogisticsQueues } from '@/state/types';
import type { resolveFactoryHaulerConfig } from '@/lib/haulerUpgrades';
import type { TransportableResource } from '@/ecs/logistics';
import {
  generateTransferId,
  matchSurplusToNeed,
  reserveOutbound,
  emitTransferFX,
} from '@/ecs/logistics';
import { logLogistics } from '@/lib/debug';

export function scheduleFactoryToFactoryTransfers(
  state: StoreState,
  resource: TransportableResource,
  resolvedConfigs: Map<string, ReturnType<typeof resolveFactoryHaulerConfig>>,
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

    emitTransferFX(
      transferId,
      transfer.amount,
      sourceFactory.position,
      destFactory.position,
      transfer.eta,
      state.gameTime,
    );
  }
}
