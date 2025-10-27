/**
 * Factory docking and queue management operations.
 */

import type { BuildableFactory } from './models';

/**
 * Attempts to dock a drone to a factory.
 * Returns true if successfully queued (or immediately docked).
 */
export type DockingResult = 'docking' | 'queued' | 'exists';

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
 */
export const removeDroneFromFactory = (factory: BuildableFactory, droneId: string): void => {
  factory.queuedDrones = factory.queuedDrones.filter((id) => id !== droneId);
};

/**
 * Returns the number of docked drones (includes those in queue).
 */
export const getDockedDroneCount = (factory: BuildableFactory): number =>
  Math.min(factory.queuedDrones.length, factory.dockingCapacity);

/**
 * Returns the number of available docking slots.
 */
export const getAvailableDockingSlots = (factory: BuildableFactory): number =>
  Math.max(0, factory.dockingCapacity - factory.queuedDrones.length);
