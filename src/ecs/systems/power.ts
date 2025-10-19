import type { GameWorld } from '@/ecs/world';
import {
  DRONE_ENERGY_COST,
  getEnergyCapacity,
  getEnergyGeneration,
  type StoreApiType,
} from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';

export const createPowerSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery } = world;
  return (dt: number) => {
    if (dt <= 0) return;
    const state = store.getState();
    const modifiers = getResourceModifiers(state.resources, state.prestige.cores);
    const generation = getEnergyGeneration(state.modules, modifiers);
    const cap = getEnergyCapacity(state.modules, modifiers);
    let stored = Math.min(cap, Math.max(0, state.resources.energy + generation * dt));

    const chargeRate = DRONE_ENERGY_COST * 2;
    const factoryEnergyUse = new Map<string, number>();
    const factoriesById = new Map(state.factories.map((factory) => [factory.id, factory] as const));
    for (const drone of droneQuery) {
      const isChargingCandidate =
        (drone.state === 'idle' || drone.state === 'unloading') &&
        drone.battery < drone.maxBattery - 1e-4;
      if (!isChargingCandidate) {
        drone.charging = false;
        continue;
      }
      const deficit = drone.maxBattery - drone.battery;
      const maxChargeThisTick = Math.min(deficit, chargeRate * dt);
      if (maxChargeThisTick <= 1e-6) {
        drone.charging = false;
        continue;
      }

      let chargeApplied = 0;
      const fromGlobal = Math.min(maxChargeThisTick, stored);
      if (fromGlobal > 0) {
        stored -= fromGlobal;
        chargeApplied += fromGlobal;
      }

      let remainingNeed = maxChargeThisTick - fromGlobal;
      if (remainingNeed > 1e-6) {
        const dockingFactoryId = drone.ownerFactoryId ?? drone.targetFactoryId ?? null;
        if (dockingFactoryId) {
          const dockingFactory = factoriesById.get(dockingFactoryId);
          if (dockingFactory) {
            const alreadyUsed = factoryEnergyUse.get(dockingFactoryId) ?? 0;
            const available = Math.max(0, dockingFactory.energy - alreadyUsed);
            const fromFactory = Math.min(remainingNeed, available);
            if (fromFactory > 0) {
              factoryEnergyUse.set(dockingFactoryId, alreadyUsed + fromFactory);
              chargeApplied += fromFactory;
              remainingNeed -= fromFactory;
            }
          } else {
            drone.ownerFactoryId = null;
          }
        }
      }

      if (chargeApplied > 0) {
        drone.battery += chargeApplied;
        if (drone.battery > drone.maxBattery) {
          drone.battery = drone.maxBattery;
        }
        drone.charging = true;
      } else {
        drone.charging = false;
      }
    }

    const finalStored = Math.min(cap, Math.max(0, stored));
    const resourceChanged = Math.abs(finalStored - state.resources.energy) > 1e-4;
    const factoriesChanged = factoryEnergyUse.size > 0;
    if (factoriesChanged || resourceChanged) {
      store.setState((current) => {
        const partial: Partial<typeof current> = {};
        if (factoriesChanged) {
          partial.factories = current.factories.map((factory) => {
            const usage = factoryEnergyUse.get(factory.id);
            if (!usage || usage <= 1e-8) {
              return factory;
            }
            const nextEnergy = Math.max(0, factory.energy - usage);
            if (Math.abs(nextEnergy - factory.energy) <= 1e-10) {
              return factory;
            }
            return { ...factory, energy: nextEnergy };
          });
        }
        if (resourceChanged) {
          partial.resources = { ...current.resources, energy: finalStored };
        }
        if (!('factories' in partial) && !('resources' in partial)) {
          return {};
        }
        return partial;
      });
    }
  };
};
