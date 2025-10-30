import { Vector3 } from 'three';
import type { StoreState, LogisticsQueues } from '@/state/types';
import type { resolveFactoryHaulerConfig } from '@/lib/haulerUpgrades';
import type { FactoryTransferEvent } from '@/ecs/world';
import type { TransportableResource } from '@/ecs/logistics';
import {
  LOGISTICS_CONFIG,
  WAREHOUSE_NODE_ID,
  generateTransferId,
  computeTravelTime,
} from '@/ecs/logistics';
import { gameWorld } from '@/ecs/world';

const WAREHOUSE_POSITION = new Vector3(0, 0, 0);

export function scheduleUpgradeRequests(
  state: StoreState,
  resource: TransportableResource,
  warehouseAvailable: number,
  resolvedConfigs: Map<string, ReturnType<typeof resolveFactoryHaulerConfig>>,
  updatedQueues: LogisticsQueues,
): number {
  let remainingAvailable = warehouseAvailable;

  const upgradeRequests = state.factories
    .flatMap((factory) =>
      factory.upgradeRequests
        .filter((req) => req.status === 'pending' || req.status === 'partially_fulfilled')
        .map((req) => ({ factory, request: req })),
    )
    .sort((a, b) => a.request.createdAt - b.request.createdAt);

  for (const { factory, request } of upgradeRequests) {
    if (remainingAvailable <= 0) break;

    const config = resolvedConfigs.get(factory.id);
    if (!config) {
      continue;
    }
    const neededAmount = request.resourceNeeded[resource as keyof typeof request.resourceNeeded];
    const fulfilledAmount =
      request.fulfilledAmount[resource as keyof typeof request.fulfilledAmount] ?? 0;

    if (typeof neededAmount !== 'number' || neededAmount <= 0) {
      continue;
    }

    const remainingNeed = Math.max(0, neededAmount - fulfilledAmount);
    if (remainingNeed <= 0) {
      continue;
    }

    const capacity = config.capacity ?? LOGISTICS_CONFIG.hauler_capacity;
    const transferAmount = Math.min(remainingNeed, capacity, remainingAvailable);
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
      departedAt: state.gameTime,
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

    remainingAvailable = Math.max(0, remainingAvailable - transferAmount);
  }

  return remainingAvailable;
}
