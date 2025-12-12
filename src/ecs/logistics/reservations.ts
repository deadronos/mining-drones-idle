import type { BuildableFactory } from '@/ecs/factories';
import type { TransportableResource } from './config';
import { logLogistics } from '@/lib/debug';
import { computeMinReserve } from './math';

/**
 * Validates that a proposed transfer is safe and doesn't violate invariants.
 * Checks that sufficient resources are available and minimum reserves are not violated.
 *
 * @param factory - Source factory.
 * @param resource - Resource to transfer.
 * @param amount - Amount to transfer.
 * @returns true if safe to transfer, false otherwise.
 */
export const validateTransfer = (
  factory: BuildableFactory,
  resource: TransportableResource,
  amount: number,
): boolean => {
  if (amount <= 0) return false;

  const current = factory.resources[resource as keyof typeof factory.resources] ?? 0;
  const reserved = factory.logisticsState?.outboundReservations[resource] ?? 0;
  const available = Math.max(0, current - reserved);

  if (available < amount) {
    logLogistics(
      'validateTransfer[%s] FAIL: factory=%s available=%o amount=%o current=%o reserved=%o',
      resource,
      factory.id,
      available,
      amount,
      current,
      reserved,
    );
    return false;
  }

  const minReserve = computeMinReserve(factory, resource);
  if (current - amount - reserved < minReserve) {
    logLogistics(
      'validateTransfer[%s] FAIL: factory=%s would drop below minReserve=%o (current=%o amount=%o reserved=%o)',
      resource,
      factory.id,
      minReserve,
      current,
      amount,
      reserved,
    );
    return false;
  }

  logLogistics(
    'validateTransfer[%s] OK: factory=%s amount=%o current=%o reserved=%o minReserve=%o',
    resource,
    factory.id,
    amount,
    current,
    reserved,
    minReserve,
  );
  return true;
};

/**
 * Books an outbound transfer reservation on a factory.
 * Updates the factory's outbound reservations immediately to prevent double-booking.
 * Must be called before physically executing the transfer.
 *
 * @param factory - Source factory.
 * @param resource - Resource to reserve.
 * @param amount - Amount to reserve.
 * @returns true if reservation successful, false if validation failed.
 */
export const reserveOutbound = (
  factory: BuildableFactory,
  resource: TransportableResource,
  amount: number,
): boolean => {
  if (!validateTransfer(factory, resource, amount)) {
    logLogistics(
      'reserveOutbound[%s] REJECTED for factory=%s amount=%o',
      resource,
      factory.id,
      amount,
    );
    return false;
  }

  // Initialize logistics state if needed
  factory.logisticsState ??= {
    outboundReservations: {},
    inboundSchedules: [],
  };

  if (!factory.logisticsState.outboundReservations) {
    factory.logisticsState.outboundReservations = {};
  }

  // Book the reservation
  factory.logisticsState.outboundReservations[resource] =
    (factory.logisticsState.outboundReservations[resource] ?? 0) + amount;

  logLogistics(
    'reserveOutbound[%s] OK: factory=%s reservedNow=%o (+%o)',
    resource,
    factory.id,
    factory.logisticsState.outboundReservations[resource],
    amount,
  );

  return true;
};

/**
 * Releases an outbound reservation (e.g., if a transfer is canceled).
 * Decrements the factory's outbound reservations for the given resource.
 *
 * @param factory - Source factory.
 * @param resource - Resource to release.
 * @param amount - Amount to release.
 */
export const releaseReservation = (
  factory: BuildableFactory,
  resource: TransportableResource,
  amount: number,
): void => {
  if (!factory.logisticsState?.outboundReservations) return;

  const current = factory.logisticsState.outboundReservations[resource] ?? 0;
  factory.logisticsState.outboundReservations[resource] = Math.max(0, current - amount);
  logLogistics(
    'releaseReservation[%s]: factory=%s reservedNow=%o (-%o)',
    resource,
    factory.id,
    factory.logisticsState.outboundReservations[resource],
    amount,
  );
};

/**
 * Executes an arrival (finalizes a transfer at destination).
 * Decrements source resources, increments destination, and cleans up inbound schedules.
 *
 * @param sourceFactory - Factory where resources came from.
 * @param destFactory - Factory where resources arrive.
 * @param resource - Resource type.
 * @param amount - Amount transferred.
 * @returns true if successful, false if amount is invalid.
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
    sourceFactory.resources[resource as keyof typeof sourceFactory.resources] = Math.max(
      0,
      sourceRes - amount,
    ) as never;
  }

  // Increment destination
  const destRes = destFactory.resources[resource as keyof typeof destFactory.resources];
  if (typeof destRes === 'number') {
    destFactory.resources[resource as keyof typeof destFactory.resources] = (destRes +
      amount) as never;
  }

  // Record in destination's inbound schedules for UI
  destFactory.logisticsState ??= {
    outboundReservations: {},
    inboundSchedules: [],
  };

  // Remove this transfer from inbound schedules (it's now completed)
  destFactory.logisticsState.inboundSchedules = (
    destFactory.logisticsState.inboundSchedules ?? []
  ).filter((s) => !(s.fromFactoryId === sourceFactory.id && s.resource === resource));

  logLogistics(
    'executeArrival[%s]: %s -> %s amount=%o',
    resource,
    sourceFactory.id,
    destFactory.id,
    amount,
  );

  return true;
};
