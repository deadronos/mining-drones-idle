/**
 * Factory routing and placement logic.
 */

import type { Vector3 } from 'three';
import type { BuildableFactory } from './models';
import { getAvailableDockingSlots } from './docking';

/**
 * Finds the nearest factory to a given position with available docking capacity.
 * If multiple factories are equidistant, uses round-robin to select (based on counter).
 * Returns the factory and distance, or null if no factories available.
 */
export const findNearestAvailableFactory = (
  factories: BuildableFactory[],
  position: Vector3,
  roundRobinCounter = 0,
): { factory: BuildableFactory; distance: number } | null => {
  const candidates = factories.filter((f) => getAvailableDockingSlots(f) > 0);

  if (candidates.length === 0) {
    return null;
  }

  // Calculate distances
  const withDistances = candidates.map((factory) => ({
    factory,
    distance: position.distanceTo(factory.position),
  }));

  // Sort by distance
  withDistances.sort((a, b) => a.distance - b.distance);

  // If only one or distances are very different, return nearest
  if (withDistances.length === 1 || withDistances[0].distance + 0.01 < withDistances[1].distance) {
    return withDistances[0];
  }

  // Multiple equidistant factories: use round-robin
  const equidistant = [withDistances[0]];
  const tolerance = 0.5; // factories within 0.5 units are considered equidistant
  for (let i = 1; i < withDistances.length; i += 1) {
    if (withDistances[i].distance <= equidistant[0].distance + tolerance) {
      equidistant.push(withDistances[i]);
    } else {
      break;
    }
  }

  const selected = equidistant[roundRobinCounter % equidistant.length];
  return selected;
};

/**
 * Utility to compute distance between two Vector3 positions.
 * Helps with drone routing decisions.
 */
export const computeDistance = (from: Vector3, to: Vector3): number => from.distanceTo(to);
