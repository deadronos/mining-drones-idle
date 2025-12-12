import { gameWorld } from '@/ecs/world';
import type { DroneFlightState, StoreSnapshot } from '@/state/types';
import { serializeStore, normalizeSnapshot } from '@/state/serialization/store';
import { useStore } from '@/state/store';

export const buildRustSnapshotFromTs = (): StoreSnapshot & Record<string, unknown> => {
  // Ensure we pass a fully-normalized snapshot to the Rust engine so
  // required numeric fields (like `bars`) are always present.
  const currentSnapshot = normalizeSnapshot(serializeStore(useStore.getState()));

  // Inject asteroid data from ECS.
  // Rust relies on `gravityMultiplier` + `regions` (when present) to mirror TS biome targeting.
  const asteroids = gameWorld.asteroidQuery.entities.map((entity) => {
    const richness =
      typeof entity.richness === 'number' && Number.isFinite(entity.richness) ? entity.richness : 1;
    const maxOre = richness > 0 ? entity.oreRemaining / richness : entity.oreRemaining;

    return {
      id: entity.id,
      position: [entity.position.x, entity.position.y, entity.position.z],
      oreRemaining: entity.oreRemaining,
      maxOre,
      gravityMultiplier: entity.gravityMultiplier,
      resourceProfile: entity.resourceProfile ?? {
        ore: 1,
        ice: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
      },
      regions: entity.regions
        ? entity.regions.map((region) => ({
            id: region.id,
            weight: region.weight,
            gravityMultiplier: region.gravityMultiplier,
            offset: [region.offset.x, region.offset.y, region.offset.z],
            hazard: region.hazard,
          }))
        : null,
    };
  });

  // Inject drone data from ECS
  const droneFlights = gameWorld.droneQuery.entities.map((entity) => ({
    droneId: entity.id,
    state: entity.state as DroneFlightState['state'],
    targetAsteroidId: entity.targetId ?? null,
    targetRegionId: entity.targetRegionId ?? null,
    targetFactoryId: entity.targetFactoryId ?? null,
    ownerFactoryId: entity.ownerFactoryId ?? null,
    pathSeed: entity.flightSeed ?? 0,
    cargo: entity.cargo ?? 0,
    battery: entity.battery ?? 100,
    maxBattery: entity.maxBattery ?? 100,
    capacity: entity.capacity ?? 10,
    miningRate: entity.miningRate ?? 1,
    charging: entity.charging ?? false,
    cargoProfile: entity.cargoProfile ?? { ore: 0, ice: 0, metals: 0, crystals: 0, organics: 0 },
    travel: entity.travel
      ? {
          from: [
            entity.travel.from.x,
            entity.travel.from.y,
            entity.travel.from.z,
          ] as [number, number, number],
          to: [entity.travel.to.x, entity.travel.to.y, entity.travel.to.z] as [
            number,
            number,
            number,
          ],
          elapsed: entity.travel.elapsed,
          duration: entity.travel.duration,
          control: entity.travel.control
            ? [
                entity.travel.control.x,
                entity.travel.control.y,
                entity.travel.control.z,
              ] as [number, number, number]
            : undefined,
        }
      : {
          from: [entity.position.x, entity.position.y, entity.position.z] as [
            number,
            number,
            number,
          ],
          to: [entity.position.x, entity.position.y, entity.position.z] as [
            number,
            number,
            number,
          ],
          elapsed: 0,
          duration: 0,
        },
  }));

  const snapshotWithExtra = currentSnapshot as StoreSnapshot & Record<string, unknown>;

  // Place asteroid data at the top-level so Rust's `flatten`ed `extra` map
  // will pick up the `asteroids` key directly.
  snapshotWithExtra.asteroids = asteroids;
  snapshotWithExtra.droneFlights = droneFlights as DroneFlightState[];

  return snapshotWithExtra;
};
