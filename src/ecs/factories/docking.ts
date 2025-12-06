/**
 * Factory docking and queue management operations.
 */

import type { BuildableFactory } from './models';

/**
 * Result status of a docking attempt.
 * - 'docking': Drone is actively docking (first in queue).
 * - 'queued': Drone is in the queue but not yet docking.
 * - 'exists': Drone was already in the queue.
 */
export type DockingResult = 'docking' | 'queued' | 'exists';

/**
 * Attempts to dock a drone to a factory.
 * If the drone is already queued, returns its current status.
 * Otherwise, adds the drone to the queue.
 *
 * @param factory - The factory to dock at.
 * @param droneId - The ID of the drone.
 * @returns The result of the docking attempt.
 */
export const attemptDockDrone = (factory: BuildableFactory, droneId: string): DockingResult => {
  const existingIndex = factory.queuedDrones.indexOf(droneId);
  if (existingIndex !== -1) {
    return existingIndex < factory.dockingCapacity ? 'docking' : 'queued';
  }
  factory.queuedDrones.push(droneId);
  const position = factory.queuedDrones.length - 1;
  return position < factory.dockingCapacity ? 'docking' : 'queued';
};

/**
 * Removes a drone from the factory queue/dock.
 *
 * @param factory - The factory to undock from.
 * @param droneId - The ID of the drone to remove.
 */
export const removeDroneFromFactory = (factory: BuildableFactory, droneId: string): void => {
  factory.queuedDrones = factory.queuedDrones.filter((id) => id !== droneId);
};

/**
 * Returns the number of docked drones (includes those in queue).
 * Note: This implementation seems to cap at dockingCapacity, implying 'docked' means 'active'.
 *
 * @param factory - The factory.
 * @returns The count of actively docked drones.
 */
export const getDockedDroneCount = (factory: BuildableFactory): number =>
  Math.min(factory.queuedDrones.length, factory.dockingCapacity);

/**
 * Returns the number of available docking slots.
 *
 * @param factory - The factory.
 * @returns The number of free slots.
 */
export const getAvailableDockingSlots = (factory: BuildableFactory): number =>
  Math.max(0, factory.dockingCapacity - factory.queuedDrones.length);
