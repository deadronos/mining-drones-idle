import { clamp } from '@/lib/math';
import type { DroneEntity } from '@/ecs/world';

const EPSILON = 1e-4;

export const computeDroneEnergyFraction = (drone: DroneEntity, throttleFloor: number) => {
  if (drone.maxBattery <= 0) {
    return 1;
  }
  const normalized = drone.battery / drone.maxBattery;
  if (!Number.isFinite(normalized)) {
    return 1;
  }
  return clamp(normalized, throttleFloor, 1);
};

export const consumeDroneEnergy = (
  drone: DroneEntity,
  dt: number,
  throttleFloor: number,
  rate: number,
) => {
  const fraction = computeDroneEnergyFraction(drone, throttleFloor);
  if (dt <= 0 || rate <= 0) {
    drone.charging = false;
    return { fraction, consumed: 0 };
  }
  const consumed = Math.min(drone.battery, Math.max(0, rate * dt * fraction));
  if (consumed > 0) {
    drone.battery = Math.max(0, drone.battery - consumed);
    if (drone.battery <= EPSILON) {
      drone.battery = 0;
    }
  }
  drone.charging = false;
  return { fraction, consumed };
};
