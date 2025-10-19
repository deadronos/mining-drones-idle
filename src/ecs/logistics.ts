/**
 * Hauler Logistics System
 * 
 * Manages resource distribution between factories using configurable hauler drones.
 * Uses reservation-based scheduling to prevent double-booking and ensure deterministic behavior.
 */

import type { BuildableFactory } from './factories';
import type { PendingTransfer, HaulerConfig } from '@/state/store';

// Configuration constants (can be moved to config file later)
export const LOGISTICS_CONFIG = {
  buffer_seconds: 30,           // Target inventory level (30s worth of consumption)
  min_reserve_seconds: 5,       // Never drop below 5s worth of resources
  hauler_capacity: 50,          // Default items per trip
  hauler_speed: 1.0,            // Default tiles per second
  pickup_overhead: 1.0,         // Default seconds for pickup
  dropoff_overhead: 1.0,        // Default seconds for dropoff
  scheduling_interval: 2.0,     // Run scheduler every 2 seconds
  hysteresis_threshold: 0.2,    // 20% difference threshold before transfer
  cooldown_period: 10.0,        // Seconds before reversing same transfer
} as const;

// Resource types that can be transported
export const RESOURCE_TYPES = [
  'ore',
  'bars',
  'metals',
  'crystals',
  'organics',
  'ice',
] as const;

export type TransportableResource = typeof RESOURCE_TYPES[number];

/**
 * Generates a unique transfer ID using timestamp and random component
 */
export const generateTransferId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `transfer-${timestamp}-${random}`;
};

/**
 * Computes the target buffer level (in items) for a factory's consumption of a given resource
 * 
 * @param factory Factory to compute buffer for
 * @param resource Resource type
 * @param bufferSeconds Number of seconds worth of resources to maintain (default 30s)
 * @returns Target inventory level
 */
export const computeBufferTarget = (
  factory: BuildableFactory,
  _resource: TransportableResource,
  bufferSeconds: number = LOGISTICS_CONFIG.buffer_seconds,
): number => {
  // Simplified: assume ore is consumed at a predictable rate based on refine slots
  // For now, return a fixed target. Actual consumption rate should be computed from factory state
  // This is a placeholder that will be improved when consumption rate data is available
  
  // Base consumption depends on refine slots and current activity
  // Conservative estimate: assume ~50 ore per minute per active slot
  const orePerMinute = 50;
  const orePerSecond = orePerMinute / 60;
  return bufferSeconds * orePerSecond * Math.max(1, factory.refineSlots);
};

/**
 * Computes the minimum reserve level (in items) for a factory
 * Should never transfer resources below this level
 * 
 * @param _factory Factory to compute reserve for
 * @param _resource Resource type
 * @param minReserveSeconds Seconds worth of resources to keep in reserve (default 5s)
 * @returns Minimum reserve level
 */
export const computeMinReserve = (
  _factory: BuildableFactory,
  _resource: TransportableResource,
  minReserveSeconds: number = LOGISTICS_CONFIG.min_reserve_seconds,
): number => {
  return minReserveSeconds * 5; // Conservative: ~25 items for 5s
};

/**
 * Computes travel time between two factories
 * Includes pickup overhead, travel, and dropoff overhead
 * 
 * @param sourcePos Position of source factory
 * @param destPos Position of destination factory
 * @param config Hauler configuration for speed and overhead
 * @returns Total time in seconds
 */
export const computeTravelTime = (
  sourcePos: { distanceTo(other: { x: number; y: number; z: number }): number },
  destPos: { x: number; y: number; z: number },
  config: HaulerConfig,
): number => {
  const distance = sourcePos.distanceTo(destPos);
  const travelTime = distance / Math.max(0.1, config.speed);
  return config.pickupOverhead + travelTime + config.dropoffOverhead;
};

/**
 * Matches factories with surplus to factories with need
 * Greedily pairs highest need with closest/fastest supplier
 * 
 * @param factories All factories in the network
 * @param resource Resource type to transfer
 * @param gameTime Current game time (for ETA calculation)
 * @returns Array of proposed transfers
 */
export const matchSurplusToNeed = (
  factories: BuildableFactory[],
  resource: TransportableResource,
  gameTime: number,
): Omit<PendingTransfer, 'id'>[] => {
  const transfers: Omit<PendingTransfer, 'id'>[] = [];

  // Filter factories that have non-zero resources of this type
  const activeFactories = factories.filter((f) => {
    const amount = f.resources[resource as keyof typeof f.resources];
    return typeof amount === 'number' && amount > 0;
  });

  if (activeFactories.length < 2) {
    return transfers; // Need at least 2 factories
  }

  // Compute needs and surpluses
  interface NeedEntry {
    factory: BuildableFactory;
    need: number;
    config?: HaulerConfig;
  }
  interface SurplusEntry {
    factory: BuildableFactory;
    surplus: number;
    config?: HaulerConfig;
  }

  const needs: NeedEntry[] = [];
  const surpluses: SurplusEntry[] = [];

  for (const factory of activeFactories) {
    if ((factory.haulersAssigned ?? 0) === 0) {
      continue; // Skip if no haulers assigned
    }

    const target = computeBufferTarget(factory, resource);
    const current = factory.resources[resource as keyof typeof factory.resources] ?? 0;
    const need = Math.max(0, target - current);

    if (need > 0) {
      needs.push({ factory, need, config: factory.haulerConfig });
    }

    const minReserve = computeMinReserve(factory, resource);
    const surplus = Math.max(0, current - target - minReserve);

    if (surplus > 0) {
      surpluses.push({ factory, surplus, config: factory.haulerConfig });
    }
  }

  // Sort needs descending (highest first) and surpluses descending
  needs.sort((a, b) => b.need - a.need);
  surpluses.sort((a, b) => b.surplus - a.surplus);

  // Greedy matching: pair high need with high surplus
  for (const needEntry of needs) {
    for (const surplusEntry of surpluses) {
      if (needEntry.need <= 0) break;
      if (surplusEntry.surplus <= 0) continue;

      // Respect resource filters if set
      const needHasFilters = needEntry.config && needEntry.config.resourceFilters && needEntry.config.resourceFilters.length > 0;
      if (needHasFilters && needEntry.config && !needEntry.config.resourceFilters.includes(resource)) {
        continue;
      }

      const surplusHasFilters = surplusEntry.config && surplusEntry.config.resourceFilters && surplusEntry.config.resourceFilters.length > 0;
      if (surplusHasFilters && surplusEntry.config && !surplusEntry.config.resourceFilters.includes(resource)) {
        continue;
      }

      // Compute transfer amount: min of need, surplus, hauler capacity
      const capacity = surplusEntry.config?.capacity ?? LOGISTICS_CONFIG.hauler_capacity;
      const transferAmount = Math.min(needEntry.need, surplusEntry.surplus, capacity);

      if (transferAmount <= 0) continue;

      // Compute travel time
      const travelTime = computeTravelTime(
        surplusEntry.factory.position,
        needEntry.factory.position,
        surplusEntry.config ?? {
          capacity: LOGISTICS_CONFIG.hauler_capacity,
          speed: LOGISTICS_CONFIG.hauler_speed,
          pickupOverhead: LOGISTICS_CONFIG.pickup_overhead,
          dropoffOverhead: LOGISTICS_CONFIG.dropoff_overhead,
          resourceFilters: [],
          mode: 'auto',
          priority: 5,
        },
      );

      const eta = gameTime + travelTime;

      transfers.push({
        fromFactoryId: surplusEntry.factory.id,
        toFactoryId: needEntry.factory.id,
        resource,
        amount: transferAmount,
        status: 'scheduled',
        eta,
      });

      // Update remaining need/surplus
      needEntry.need -= transferAmount;
      surplusEntry.surplus -= transferAmount;
    }
  }

  return transfers;
};

/**
 * Validates that a proposed transfer is safe and doesn't violate invariants
 * 
 * @param factory Source factory
 * @param resource Resource to transfer
 * @param amount Amount to transfer
 * @returns true if safe to transfer
 */
export const validateTransfer = (
  factory: BuildableFactory,
  resource: TransportableResource,
  amount: number,
): boolean => {
  if (amount <= 0) return false;

  const current = (factory.resources[resource as keyof typeof factory.resources] as number) ?? 0;
  const reserved = factory.logisticsState?.outboundReservations[resource] ?? 0;
  const available = Math.max(0, current - reserved);

  if (available < amount) {
    return false; // Not enough available
  }

  const minReserve = computeMinReserve(factory, resource);
  if (current - amount - reserved < minReserve) {
    return false; // Would drop below minimum reserve
  }

  return true;
};

/**
 * Books a reservation for an outbound transfer
 * Updates the factory's outbound reservations immediately to prevent double-booking
 * 
 * @param factory Source factory
 * @param resource Resource to reserve
 * @param amount Amount to reserve
 * @returns true if reservation successful
 */
export const reserveOutbound = (
  factory: BuildableFactory,
  resource: TransportableResource,
  amount: number,
): boolean => {
  if (!validateTransfer(factory, resource, amount)) {
    return false;
  }

  // Initialize logistics state if needed
  if (!factory.logisticsState) {
    factory.logisticsState = {
      outboundReservations: {},
      inboundSchedules: [],
    };
  }

  if (!factory.logisticsState.outboundReservations) {
    factory.logisticsState.outboundReservations = {};
  }

  // Book the reservation
  factory.logisticsState.outboundReservations[resource] =
    (factory.logisticsState.outboundReservations[resource] ?? 0) + amount;

  return true;
};

/**
 * Releases an outbound reservation (e.g., if transfer was canceled)
 * 
 * @param factory Source factory
 * @param resource Resource to release
 * @param amount Amount to release
 */
export const releaseReservation = (
  factory: BuildableFactory,
  resource: TransportableResource,
  amount: number,
): void => {
  if (!factory.logisticsState?.outboundReservations) return;

  const current = factory.logisticsState.outboundReservations[resource] ?? 0;
  factory.logisticsState.outboundReservations[resource] = Math.max(0, current - amount);
};

/**
 * Executes an arrival (finalizes a transfer at destination)
 * 
 * @param sourceFactory Factory where resources came from
 * @param destFactory Factory where resources arrive
 * @param resource Resource type
 * @param amount Amount transferred
 * @returns true if successful
 */
export const executeArrival = (
  sourceFactory: BuildableFactory,
  destFactory: BuildableFactory,
  resource: TransportableResource,
  amount: number,
): boolean => {
  if (amount <= 0) return false;

  // Release source reservation
  releaseReservation(sourceFactory, resource, amount);

  // Decrement source
  const sourceRes = sourceFactory.resources[resource as keyof typeof sourceFactory.resources];
  if (typeof sourceRes === 'number') {
    sourceFactory.resources[resource as keyof typeof sourceFactory.resources] = Math.max(0, sourceRes - amount) as never;
  }

  // Increment destination
  const destRes = destFactory.resources[resource as keyof typeof destFactory.resources];
  if (typeof destRes === 'number') {
    destFactory.resources[resource as keyof typeof destFactory.resources] = (destRes + amount) as never;
  }

  // Record in destination's inbound schedules for UI
  if (!destFactory.logisticsState) {
    destFactory.logisticsState = {
      outboundReservations: {},
      inboundSchedules: [],
    };
  }

  // Remove this transfer from inbound schedules (it's now completed)
  destFactory.logisticsState.inboundSchedules = (
    destFactory.logisticsState.inboundSchedules ?? []
  ).filter(
    (s) => !(s.fromFactoryId === sourceFactory.id && s.resource === resource),
  );

  return true;
};
