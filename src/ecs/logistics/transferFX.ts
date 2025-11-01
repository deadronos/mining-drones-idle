import { Vector3 } from 'three';
import type { FactoryTransferEvent } from '@/ecs/world';
import { gameWorld } from '@/ecs/world';

const FX_HEIGHT_OFFSET = 0.6;
const MAX_TRANSFER_FX = 48;

/**
 * Create and emit a factory transfer visual effect.
 * Best-effort: failures are silently ignored to avoid crashing the scheduler.
 */
export function emitTransferFX(
  transferId: string,
  amount: number,
  fromPosition: Vector3,
  toPosition: Vector3,
  eta: number,
  currentGameTime: number,
): void {
  try {
    const fromPos = fromPosition.clone().add(new Vector3(0, FX_HEIGHT_OFFSET, 0));
    const toPos = toPosition.clone().add(new Vector3(0, FX_HEIGHT_OFFSET, 0));
    const duration = Math.max(0.1, eta - currentGameTime);
    const event: FactoryTransferEvent = {
      id: transferId,
      amount,
      from: fromPos,
      to: toPos,
      duration,
    };
    gameWorld.events.transfers.push(event);
    if (gameWorld.events.transfers.length > MAX_TRANSFER_FX) {
      gameWorld.events.transfers.splice(0, gameWorld.events.transfers.length - MAX_TRANSFER_FX);
    }
  } catch {
    // ignore FX failures
  }
}
