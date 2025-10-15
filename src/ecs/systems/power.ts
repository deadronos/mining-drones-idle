import type { GameWorld } from '@/ecs/world';
import {
  getEnergyCapacity,
  getEnergyConsumption,
  getEnergyGeneration,
  type StoreApiType,
} from '@/state/store';

export const createPowerSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery } = world;
  return (dt: number) => {
    if (dt <= 0) return;
    const state = store.getState();
    const generation = getEnergyGeneration(state.modules);
    const consumption = getEnergyConsumption(state.modules, droneQuery.size);
    const cap = getEnergyCapacity(state.modules);
    const nextEnergy = Math.min(
      cap,
      Math.max(0, state.resources.energy + (generation - consumption) * dt),
    );
    if (Math.abs(nextEnergy - state.resources.energy) > 1e-4) {
      store.setState({ resources: { ...state.resources, energy: nextEnergy } });
    }
  };
};
