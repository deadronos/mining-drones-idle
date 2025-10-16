import { Vector3 } from 'three';
import type { GameWorld } from '@/ecs/world';
import type { Resources, StoreApiType } from '@/state/store';
import { RESOURCE_KEYS } from '@/lib/biomes';

const TRANSFER_EVENT_LIMIT = 48;
const TRANSFER_DURATION = 0.65;
const TRANSFER_OFFSET = new Vector3(0, 0.6, 0);

const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now());

export const createUnloadSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery, factory, events } = world;
  return (_dt: number) => {
    for (const drone of droneQuery) {
      if (drone.state !== 'unloading') continue;
      const amount = drone.cargo;
      if (amount > 0) {
        const breakdown: Record<string, number> = {};
        let delivered = 0;
        for (const key of RESOURCE_KEYS) {
          const portion = drone.cargoProfile[key];
          if (portion > 0) {
            breakdown[key] = portion;
            delivered += portion;
          }
        }
        const delta = { ...breakdown } as Partial<Resources>;
        const remainder = amount - delivered;
        if (remainder > 1e-3) {
          delta.ore = (delta.ore ?? 0) + remainder;
        }
        store.getState().addResources(delta);
        const timestamp = now();
        const transfer = {
          id: `${drone.id}-${timestamp.toString(16)}`,
          amount,
          from: (drone.lastDockingFrom ?? drone.position).clone().add(TRANSFER_OFFSET),
          to: factory.position.clone().add(TRANSFER_OFFSET),
          duration: TRANSFER_DURATION,
        };
        events.transfers.push(transfer);
        if (events.transfers.length > TRANSFER_EVENT_LIMIT) {
          events.transfers.splice(0, events.transfers.length - TRANSFER_EVENT_LIMIT);
        }
        factory.activity.lastTransferAt = timestamp;
      }
      drone.cargo = 0;
      for (const key of RESOURCE_KEYS) {
        drone.cargoProfile[key] = 0;
      }
      drone.state = 'idle';
      drone.targetId = null;
      drone.targetRegionId = null;
      drone.travel = null;
      drone.position.copy(factory.position);
      drone.lastDockingFrom = null;
    }
  };
};
