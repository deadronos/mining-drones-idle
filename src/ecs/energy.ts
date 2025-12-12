import { clamp } from '@/lib/math';
import type { DroneEntity } from '@/ecs/world';

const EPSILON = 1e-4;

/**
 * Computes the energy availability fraction for a drone based on its battery level and throttle floor.
 * If the battery is depleted, the fraction will be limited by the throttle floor.
 *
 * @param drone - The drone entity.
 * @param throttleFloor - The minimum performance factor (0-1) when battery is low.
 * @returns A value between throttleFloor and 1 representing the energy availability factor.
 */
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

/**
 * Consumes energy from a drone's battery based on the requested rate and delta time.
 * Calculates the actual consumption and the resulting performance fraction.
 *
 * @param drone - The drone entity to consume energy from.
 * @param dt - Delta time in seconds.
 * @param throttleFloor - The minimum performance factor.
 * @param rate - The energy consumption rate per second.
 * @returns An object containing the effective performance `fraction` and the `consumed` energy amount.
 */
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
