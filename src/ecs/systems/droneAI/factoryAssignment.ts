import type { Vector3 } from 'three';
import type { DroneEntity } from '@/ecs/world';
import type { RandomSource } from '@/lib/rng';
import type { StoreApiType } from '@/state/store';
import { parityDebugLog } from '@/lib/parityDebug';

const FACTORY_VARIETY_CHANCE = 0.25;
const FACTORY_WEIGHT_EPSILON = 0.001;

export const assignReturnFactory = (
  drone: DroneEntity,
  store: StoreApiType,
  rng: RandomSource,
): { targetId: string; position: Vector3 } | null => {
  const state = store.getState();
  if (state.factories.length === 0) {
    drone.targetFactoryId = null;
    return null;
  }

  if (drone.targetFactoryId) {
    const existing = state.factories.find((item) => item.id === drone.targetFactoryId);
    if (existing) {
      const queueIndex = existing.queuedDrones.indexOf(drone.id);
      if (queueIndex !== -1 && queueIndex < existing.dockingCapacity) {
        return { targetId: existing.id, position: existing.position.clone() };
      }
      return null;
    }
    state.undockDroneFromFactory(drone.targetFactoryId, drone.id);
    drone.targetFactoryId = null;
  }

  const withDistances = state.factories.map((factory) => {
    const distance = drone.position.distanceTo(factory.position);
    const occupied = Math.min(factory.queuedDrones.length, factory.dockingCapacity);
    const available = Math.max(0, factory.dockingCapacity - occupied);
    return {
      factory,
      distance,
      available,
      queueLength: factory.queuedDrones.length,
    };
  });

  const candidates = withDistances.filter((entry) => entry.available > 0);
  let selected = null as (typeof withDistances)[number] | null;

  if (candidates.length > 0) {
    // Sort by least occupied docks (primary), then by distance (secondary)
    candidates.sort((a, b) => {
      const occupiedA = a.queueLength;
      const occupiedB = b.queueLength;
      if (occupiedA !== occupiedB) {
        return occupiedA - occupiedB; // Prefer less-filled docking
      }
      return a.distance - b.distance; // Break ties by distance
    });
    selected = candidates[0];
    const varietyRoll = rng.next();
    parityDebugLog('[parity][ts][assignReturnFactory-variety]', {
      droneId: drone.id,
      varietyRoll,
      FACTORY_VARIETY_CHANCE,
      candidateIds: candidates.map((entry) => entry.factory.id),
    });
    if (candidates.length > 1 && varietyRoll < FACTORY_VARIETY_CHANCE) {
      const others = candidates.slice(1);
      const weights = others.map((entry) => 1 / Math.max(entry.distance, FACTORY_WEIGHT_EPSILON));
      const totalWeight = weights.reduce((sum, value) => sum + value, 0);
      const rawRoll = rng.next();
      parityDebugLog('[parity][ts][assignReturnFactory-weighted]', {
        droneId: drone.id,
        rawRoll,
        totalWeight,
        others: others.map((entry) => ({ id: entry.factory.id, distance: entry.distance })),
      });
      let roll = rawRoll * totalWeight;
      for (let i = 0; i < others.length; i += 1) {
        roll -= weights[i];
        if (roll <= 0) {
          selected = others[i];
          break;
        }
      }
    }
  } else {
    selected = withDistances.reduce<(typeof withDistances)[number] | null>((best, entry) => {
      if (!best) return entry;
      if (entry.queueLength < best.queueLength) return entry;
      if (entry.queueLength === best.queueLength && entry.distance < best.distance) {
        return entry;
      }
      return best;
    }, null);
  }

  if (!selected) {
    return null;
  }

  const result = state.dockDroneAtFactory(selected.factory.id, drone.id);
  if (result === 'queued') {
    drone.targetFactoryId = selected.factory.id;
    return null;
  }
  if (result === 'docking') {
    drone.targetFactoryId = selected.factory.id;
    return { targetId: selected.factory.id, position: selected.factory.position.clone() };
  }

  // Already exists in queue; check if now within docking range
  const current = state.getFactory(selected.factory.id);
  if (current) {
    const queueIndex = current.queuedDrones.indexOf(drone.id);
    if (queueIndex !== -1 && queueIndex < current.dockingCapacity) {
      drone.targetFactoryId = current.id;
      return { targetId: current.id, position: current.position.clone() };
    }
  }
  return null;
};
