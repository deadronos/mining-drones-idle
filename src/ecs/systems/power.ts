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
    const modifiers = getResourceModifiers(state.resources);
    const generation = getEnergyGeneration(state.modules, modifiers);
    const cap = getEnergyCapacity(state.modules, modifiers);
    let stored = Math.min(cap, Math.max(0, state.resources.energy + generation * dt));

    const chargeRate = DRONE_ENERGY_COST * 2;
    for (const drone of droneQuery) {
      const isChargingCandidate =
        (drone.state === 'idle' || drone.state === 'unloading') &&
        drone.battery < drone.maxBattery - 1e-4;
      if (!isChargingCandidate) {
        drone.charging = false;
        continue;
      }
      if (stored <= 0) {
        drone.charging = false;
        continue;
      }
      const deficit = drone.maxBattery - drone.battery;
      const potential = Math.min(deficit, chargeRate * dt, stored);
      if (potential > 0) {
        drone.battery += potential;
        if (drone.battery > drone.maxBattery) {
          drone.battery = drone.maxBattery;
        }
        stored -= potential;
        drone.charging = true;
      } else {
        drone.charging = false;
      }
    }

    stored = Math.min(cap, Math.max(0, stored));
    if (Math.abs(stored - state.resources.energy) > 1e-4) {
      store.setState({ resources: { ...state.resources, energy: stored } });
    }
  };
};
