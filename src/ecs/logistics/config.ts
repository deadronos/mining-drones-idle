import { WAREHOUSE_CONFIG } from '@/state/constants';

/**
 * Logistics configuration constants.
 * Defines default hauler behavior, scheduling intervals, and resource buffers.
 */
export const LOGISTICS_CONFIG = {
  buffer_seconds: WAREHOUSE_CONFIG.bufferSeconds, // Target inventory level
  min_reserve_seconds: WAREHOUSE_CONFIG.minReserveSeconds, // Never drop below min reserve
  hauler_capacity: 50, // Default items per trip
  hauler_speed: 1.0, // Default tiles per second
  pickup_overhead: 1.0, // Default seconds for pickup
  dropoff_overhead: 1.0, // Default seconds for dropoff
  scheduling_interval: 2.0, // Run scheduler every 2 seconds
  hysteresis_threshold: 0.2, // 20% difference threshold before transfer
  cooldown_period: 10.0, // Seconds before reversing same transfer
} as const;

/**
 * Resource types that can be transported between factories.
 */
export const RESOURCE_TYPES = ['ore', 'bars', 'metals', 'crystals', 'organics', 'ice'] as const;

/**
 * Type representing a transportable resource.
 */
export type TransportableResource = (typeof RESOURCE_TYPES)[number];

/**
 * Special warehouse node identifier for central resource distribution.
 */
export const WAREHOUSE_NODE_ID = 'warehouse' as const;

/**
 * Generates a unique transfer ID using timestamp and random component.
 * Ensures each scheduled transfer has a unique identifier.
 *
 * @returns Unique transfer ID string
 */
export const generateTransferId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `transfer-${timestamp}-${random}`;
};
