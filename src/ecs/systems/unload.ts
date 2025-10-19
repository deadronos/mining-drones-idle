import { Vector3 } from 'three';
import type { GameWorld } from '@/ecs/world';
import type { FactoryResources, Resources, StoreApiType } from '@/state/store';
import { RESOURCE_KEYS } from '@/lib/biomes';

const TRANSFER_EVENT_LIMIT = 48;
const TRANSFER_DURATION = 0.65;
const TRANSFER_OFFSET = new Vector3(0, 0.6, 0);

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export const createUnloadSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery, factory, events } = world;
  return (_dt: number) => {
    for (const drone of droneQuery) {
      if (drone.state !== 'unloading') continue;
      const amount = drone.cargo;
      const state = store.getState();
      const fallbackFactoryId = state.factories[0]?.id ?? null;
      const dockingFactoryId = drone.targetFactoryId ?? fallbackFactoryId;
      const dockingFactory = dockingFactoryId ? state.getFactory(dockingFactoryId) : undefined;
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
        const remainder = amount - delivered;
        const oreForFactory = (breakdown.ore ?? 0) + (remainder > 1e-3 ? remainder : 0);
        const delta = { ...breakdown } as Partial<Resources>;
        delete delta.ore;

        if (oreForFactory > 0) {
          if (dockingFactory) {
            state.transferOreToFactory(dockingFactory.id, oreForFactory);
          } else {
            state.addResources({ ore: oreForFactory });
          }
        }
        const resourceKeys = Object.keys(delta) as (keyof Resources)[];
        if (resourceKeys.length > 0) {
          if (dockingFactoryId) {
            const factoryDelta: Partial<FactoryResources> = {};
            for (const key of resourceKeys) {
              factoryDelta[key as keyof FactoryResources] = delta[key];
            }
            state.addResourcesToFactory(dockingFactoryId, factoryDelta);
          } else {
            state.addResources(delta);
          }
        }
        const timestamp = now();
        const transfer = {
          id: `${drone.id}-${timestamp.toString(16)}`,
          amount,
          from: (drone.lastDockingFrom ?? drone.position).clone().add(TRANSFER_OFFSET),
          to: (dockingFactory?.position ?? factory.position).clone().add(TRANSFER_OFFSET),
          duration: TRANSFER_DURATION,
        };
        events.transfers.push(transfer);
        if (events.transfers.length > TRANSFER_EVENT_LIMIT) {
          events.transfers.splice(0, events.transfers.length - TRANSFER_EVENT_LIMIT);
        }
        factory.activity.lastTransferAt = timestamp;
      }
      if (dockingFactoryId) {
        state.undockDroneFromFactory(dockingFactoryId, drone.id, { transferOwnership: true });
        drone.ownerFactoryId = dockingFactoryId;
      } else {
        drone.ownerFactoryId = null;
      }
      drone.cargo = 0;
      for (const key of RESOURCE_KEYS) {
        drone.cargoProfile[key] = 0;
      }
      drone.state = 'idle';
      drone.targetId = null;
      drone.targetRegionId = null;
      drone.travel = null;
      const fallbackPosition = factory.position;
      const afterState = store.getState();
      const targetFactory = dockingFactoryId
        ? afterState.getFactory(dockingFactoryId)
        : afterState.factories[0];
      drone.position.copy(targetFactory?.position ?? fallbackPosition);
      drone.lastDockingFrom = null;
      drone.targetFactoryId = null;
    }
  };
};
