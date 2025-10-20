import {
  DEFAULT_DRONE_BATTERY,
  DEFAULT_DRONE_CAPACITY,
  DEFAULT_DRONE_MINING_RATE,
  DEFAULT_DRONE_SPEED,
  type DroneEntity,
  type GameWorld,
  removeDrone,
  spawnDrone,
} from '@/ecs/world';
import { RESOURCE_KEYS } from '@/lib/biomes';
import { getResourceModifiers, type ResourceModifierSnapshot } from '@/lib/resourceModifiers';
import type { Modules, StoreApiType } from '@/state/store';

const updateDroneStats = (
  drone: DroneEntity,
  modules: Modules,
  modifiers: ResourceModifierSnapshot,
) => {
  const speedBonus = 1 + Math.max(0, modules.droneBay - 1) * 0.05;
  const baseSpeed = DEFAULT_DRONE_SPEED * speedBonus;
  drone.speed = baseSpeed * modifiers.droneProductionSpeedMultiplier;

  const capacityBase = DEFAULT_DRONE_CAPACITY + modules.storage * 5;
  const targetCapacity = capacityBase * modifiers.droneCapacityMultiplier;
  if (drone.cargo > targetCapacity) {
    const scale = targetCapacity > 0 ? targetCapacity / drone.cargo : 0;
    if (scale <= 0) {
      drone.cargo = 0;
      for (const key of RESOURCE_KEYS) {
        drone.cargoProfile[key] = 0;
      }
    } else {
      for (const key of RESOURCE_KEYS) {
        drone.cargoProfile[key] *= scale;
      }
      drone.cargo = targetCapacity;
    }
  }
  drone.capacity = targetCapacity;

  const miningBase = DEFAULT_DRONE_MINING_RATE + modules.refinery * 0.5;
  drone.miningRate = miningBase * modifiers.droneProductionSpeedMultiplier;

  const previousMax = drone.maxBattery > 0 ? drone.maxBattery : DEFAULT_DRONE_BATTERY;
  const fraction = previousMax > 0 ? drone.battery / previousMax : 0;
  const targetMaxBattery = DEFAULT_DRONE_BATTERY * modifiers.droneBatteryMultiplier;
  drone.maxBattery = targetMaxBattery;
  drone.battery = Math.min(drone.maxBattery, Math.max(0, fraction * drone.maxBattery));
};

export const createFleetSystem = (world: GameWorld, store: StoreApiType) => {
  const { droneQuery, factory } = world;
  const removeDroneReferences = (droneId: string) => {
    const state = store.getState();
    for (const candidate of state.factories) {
      if (candidate.queuedDrones.includes(droneId)) {
        state.undockDroneFromFactory(candidate.id, droneId);
      }
    }
  };

  return (_dt: number) => {
    const { modules, resources } = store.getState();
    const modifiers = getResourceModifiers(resources);
    const target = Math.max(1, modules.droneBay);
    while (droneQuery.size < target) {
      const drone = spawnDrone(world);
      const primaryFactory = store.getState().factories[0];
      drone.position.copy(primaryFactory?.position ?? factory.position);
    }
    while (droneQuery.size > target) {
      const drone = droneQuery.entities[droneQuery.size - 1];
      removeDroneReferences(drone.id);
      removeDrone(world, drone);
    }
    for (const drone of droneQuery) {
      updateDroneStats(drone, modules, modifiers);
    }
  };
};
