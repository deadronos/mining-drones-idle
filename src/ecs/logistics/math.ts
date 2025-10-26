import type { BuildableFactory } from '@/ecs/factories';
import type { HaulerConfig } from '@/state/store';
import type { TransportableResource } from './config';
import { logLogistics } from '@/lib/debug';
import { LOGISTICS_CONFIG } from './config';

/**
 * Computes the target buffer level (in items) for a factory's consumption of a given resource.
 * Buffer targets vary by resource type based on production/consumption patterns.
 *
 * @param factory Factory to compute buffer for
 * @param resource Resource type
 * @param bufferSeconds Number of seconds worth of resources to maintain (default from config)
 * @returns Target inventory level in items
 */
export const computeBufferTarget = (
  factory: BuildableFactory,
  resource: TransportableResource,
  bufferSeconds: number = LOGISTICS_CONFIG.buffer_seconds,
): number => {
  switch (resource) {
    case 'ore': {
      // Ore consumed by refineries to produce bars
      // Base consumption ~50 ore/min per active refine slot
      const orePerMinute = 50;
      const orePerSecond = orePerMinute / 60;
      return bufferSeconds * orePerSecond * Math.max(1, factory.refineSlots);
    }
    case 'bars': {
      // Bars are produced (output), not consumed at factory
      // Keep minimal working buffer for local operations
      return 5;
    }
    case 'metals':
    case 'crystals':
    case 'organics':
    case 'ice': {
      // Intermediate resources: conservative buffer
      return 20;
    }
    default: {
      // Fallback for unknown resources
      return 15;
    }
  }
};

/**
 * Computes the minimum reserve level (in items) that should never be transferred out.
 * Acts as a safety floor to prevent factories from becoming depleted.
 *
 * @param _factory Factory to compute reserve for
 * @param _resource Resource type
 * @param minReserveSeconds Seconds worth of resources to keep in reserve (default from config)
 * @returns Minimum reserve level in items
 */
export const computeMinReserve = (
  _factory: BuildableFactory,
  _resource: TransportableResource,
  minReserveSeconds: number = LOGISTICS_CONFIG.min_reserve_seconds,
): number => {
  return minReserveSeconds * 5; // Conservative: ~25 items for 5s
};

/**
 * Computes total travel time between two factories.
 * Includes pickup overhead, actual travel distance, and dropoff overhead.
 *
 * @param sourcePos Source factory position object with distanceTo method
 * @param destPos Destination position {x, y, z}
 * @param config Hauler configuration for speed and overhead values
 * @returns Total time in seconds
 */
export const computeTravelTime = (
  sourcePos: { distanceTo(other: { x: number; y: number; z: number }): number },
  destPos: { x: number; y: number; z: number },
  config: HaulerConfig,
): number => {
  const distance = sourcePos.distanceTo(destPos);
  const travelTime = distance / Math.max(0.1, config.speed);
  const total = config.pickupOverhead + travelTime + config.dropoffOverhead;
  logLogistics(
    'computeTravelTime distance=%o speed=%o overhead=[%o,%o] total=%o',
    distance,
    config.speed,
    config.pickupOverhead,
    config.dropoffOverhead,
    total,
  );
  return total;
};

/**
 * Computes the purchase cost for a hauler at a given level.
 * Uses exponential growth (1.15x multiplier per level) matching other upgrade costs.
 *
 * @param level Current hauler count for the factory (0-indexed)
 * @param baseCost Base cost of the first hauler (default: 10)
 * @param growth Growth multiplier per level (default: 1.15)
 * @returns Cost in ore/resources
 */
export const computeHaulerCost = (level: number, baseCost = 10, growth = 1.15): number => {
  return Math.ceil(baseCost * Math.pow(growth, level));
};

/**
 * Computes the maintenance cost per second for active haulers.
 * Maintenance is an energy drain to incentivize efficiency.
 *
 * @param haulersActive Number of active haulers
 * @param costPerHauler Energy drain per hauler per second (default: 0.5)
 * @returns Total energy drain per second
 */
export const computeHaulerMaintenanceCost = (
  haulersActive: number,
  costPerHauler = 0.5,
): number => {
  return haulersActive * costPerHauler;
};
