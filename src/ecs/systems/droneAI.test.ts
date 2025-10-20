import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { assignDroneTarget, createDroneAISystem } from '@/ecs/systems/droneAI';
import { computeWaypointWithOffset } from '@/ecs/systems/travel';
import type { AsteroidEntity, DroneEntity } from '@/ecs/world';
import { createRng } from '@/lib/rng';
import { createAsteroidBiomeState } from '@/ecs/biomes';

const createAsteroid = (id: string, position: Vector3, oreRemaining = 100): AsteroidEntity => {
  const biome = createAsteroidBiomeState(createRng(7));
  return {
    id,
    kind: 'asteroid',
    position,
    oreRemaining,
    richness: 1,
    radius: 1,
    rotation: 0,
    spin: 0,
    colorBias: 1,
    biome,
    gravityMultiplier: biome.gravityMultiplier,
    resourceProfile: biome.resourceProfile,
    dominantResource: biome.dominantResource,
    regions: null,
  };
};

const createDrone = (position: Vector3): DroneEntity => ({
  id: 'drone-test',
  kind: 'drone',
  position: position.clone(),
  state: 'idle',
  targetId: null,
  targetRegionId: null,
  cargo: 0,
  capacity: 40,
  speed: 14,
  miningRate: 6,
  travel: null,
  miningAccumulator: 0,
  battery: 24,
  maxBattery: 24,
  charging: false,
  lastDockingFrom: null,
  flightSeed: null,
  targetFactoryId: null,
  cargoProfile: { ore: 0, metals: 0, crystals: 0, organics: 0, ice: 0 },
  ownerFactoryId: null,
});

describe('assignDroneTarget', () => {
  it('distributes targets across nearby asteroids using randomness', () => {
    const drone = createDrone(new Vector3(0, 0, 0));
    const asteroids = [
      createAsteroid('asteroid-a', new Vector3(5, 0, 0)),
      createAsteroid('asteroid-b', new Vector3(6, 0, 1)),
      createAsteroid('asteroid-c', new Vector3(12, 0, -2)),
    ];
    const rng = createRng(42);
    const selections = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      const result = assignDroneTarget(drone, asteroids, rng);
      expect(result).not.toBeNull();
      selections.add(result!.target.id);
    }
    expect(selections.size).toBeGreaterThan(1);
  });
});

describe('computeWaypointWithOffset', () => {
  it('produces deterministic offsets for identical seeds and indices', () => {
    const base = new Vector3(10, 1, -3);
    const first = computeWaypointWithOffset(base, 12345, 0);
    const second = computeWaypointWithOffset(base, 12345, 0);
    expect(first.equals(second)).toBe(true);
    expect(base.equals(new Vector3(10, 1, -3))).toBe(true);
    const different = computeWaypointWithOffset(base, 12345, 1);
    expect(first.equals(different)).toBe(false);
  });
});

describe('createDroneAISystem', () => {
  it('clears stale factory assignments when drone state is idle', () => {
    const drone = createDrone(new Vector3(0, 0, 0));
    const factoryId = 'factory-stub';
    const factory = {
      id: factoryId,
      dockingCapacity: 1,
      queuedDrones: [drone.id],
      position: new Vector3(5, 0, 0),
    };
    const state = {
      factories: [factory],
      droneFlights: [] as Array<typeof drone>,
      getFactory: (id: string) => (id === factory.id ? factory : undefined),
      undockDroneFromFactory: (_factoryId: string, droneId: string) => {
        factory.queuedDrones = factory.queuedDrones.filter((id) => id !== droneId);
      },
      clearDroneFlight: (_droneId: string) => {
        // Clears the drone flight state
      },
    };
    const store = {
      getState: () => state,
    };
    const world = {
      droneQuery: {
        entities: [drone],
        [Symbol.iterator]: function* () {
          yield drone;
        },
      },
      asteroidQuery: {
        entities: [] as AsteroidEntity[],
        [Symbol.iterator]: function* () {
          yield* [];
        },
      },
      rng: createRng(1),
      events: { transfers: [] },
      factory: {
        id: factoryId,
        kind: 'factory',
        position: factory.position.clone(),
        orientation: new Quaternion(),
        activity: { processing: 0, throughput: 0, boost: 0, lastTransferAt: 0 },
      },
      world: {} as unknown,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiSystem = createDroneAISystem(world as any, store as any);

    drone.state = 'idle';
    drone.targetFactoryId = factory.id;

    aiSystem(0.016);

    expect(drone.targetFactoryId).toBeNull();
    expect(factory.queuedDrones.includes(drone.id)).toBe(false);
    expect(drone.state).toBe('idle');
  });
});
