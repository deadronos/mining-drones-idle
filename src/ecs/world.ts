import { World, type Query } from 'miniplex';
import { Quaternion, Vector3 } from 'three';
import { randomOnRing, randomRange, TAU } from '@/lib/math';
import { createRng, type RandomSource } from '@/lib/rng';
import {
  createAsteroidBiomeState,
  type AsteroidBiomeState,
  type BiomeRegionState,
} from '@/ecs/biomes';
import type { ResourceKey, ResourceWeights } from '@/lib/biomes';
import { storeApi, type ModuleId } from '@/state/store';

/** Represents the current activity state of a drone. */
export type DroneState = 'idle' | 'toAsteroid' | 'mining' | 'returning' | 'unloading';

/**
 * Data describing an entity's travel path.
 */
export interface TravelData {
  /** Starting position of the travel. */
  from: Vector3;
  /** Destination position. */
  to: Vector3;
  /** Time elapsed since travel started (seconds). */
  elapsed: number;
  /** Total duration of the travel (seconds). */
  duration: number;
  /** Optional control point for curved paths (Bézier). */
  control?: Vector3;
}

/**
 * State tracking factory processing and transfers.
 */
export interface FactoryActivityState {
  /** Current processing progress (0-1?). */
  processing: number;
  /** Current throughput rate. */
  throughput: number;
  /** Boost level applied. */
  boost: number;
  /** Timestamp of the last resource transfer. */
  lastTransferAt: number;
}

/**
 * Represents a resource transfer event between locations.
 */
export interface FactoryTransferEvent {
  /** Unique ID of the transfer event. */
  id: string;
  /** Amount of resource transferred. */
  amount: number;
  /** Origin position. */
  from: Vector3;
  /** Destination position. */
  to: Vector3;
  /** Duration of the transfer visual/effect. */
  duration: number;
}

/**
 * Collection of events occurring at the factory.
 */
export interface FactoryEventState {
  /** List of active transfer events. */
  transfers: FactoryTransferEvent[];
}

/**
 * Entity representing a mining drone.
 */
export interface DroneEntity {
  /** Unique ID. */
  id: string;
  /** Entity discriminant. */
  kind: 'drone';
  /** Current world position. */
  position: Vector3;
  /** Current logic state. */
  state: DroneState;
  /** ID of the target asteroid or entity. */
  targetId: string | null;
  /** ID of the specific region on the target asteroid. */
  targetRegionId: string | null;
  /** ID of the target factory (destination). */
  targetFactoryId: string | null;
  /** Current cargo amount. */
  cargo: number;
  /** Maximum cargo capacity. */
  capacity: number;
  /** Movement speed units/sec. */
  speed: number;
  /** Resource extraction rate units/sec. */
  miningRate: number;
  /** Active travel data if moving. */
  travel: TravelData | null;
  /** Accumulator for fractional mining progress. */
  miningAccumulator: number;
  /** Current battery level. */
  battery: number;
  /** Maximum battery capacity. */
  maxBattery: number;
  /** Whether the drone is currently charging. */
  charging: boolean;
  /** Position of the last dock (for return paths). */
  lastDockingFrom: Vector3 | null;
  /** Seed for flight path randomization. */
  flightSeed: number | null;
  /** Profile of resources currently held in cargo. */
  cargoProfile: ResourceWeights;
  /** ID of the factory that owns this drone. */
  ownerFactoryId: string | null;
}

/**
 * Entity representing an asteroid to be mined.
 */
export interface AsteroidEntity {
  /** Unique ID. */
  id: string;
  /** Entity discriminant. */
  kind: 'asteroid';
  /** World position. */
  position: Vector3;
  /** Amount of ore remaining. */
  oreRemaining: number;
  /** Richness multiplier for yield. */
  richness: number;
  /** Physical radius of the asteroid. */
  radius: number;
  /** Current rotation angle. */
  rotation: number;
  /** Spin speed (radians/sec). */
  spin: number;
  /** Visual color bias based on richness. */
  colorBias: number;
  /** Biome state data (fractures, hazards). */
  biome: AsteroidBiomeState;
  /** Gravity multiplier affecting drone flight/mining. */
  gravityMultiplier: number;
  /** Resource distribution for this asteroid. */
  resourceProfile: ResourceWeights;
  /** The most abundant resource type. */
  dominantResource: ResourceKey;
  /** Defined sub-regions on the asteroid surface. */
  regions: BiomeRegionState[] | null;
}

/**
 * Entity representing a production factory.
 */
export interface FactoryEntity {
  /** Unique ID. */
  id: string;
  /** Entity discriminant. */
  kind: 'factory';
  /** World position. */
  position: Vector3;
  /** Orientation quaternion. */
  orientation: Quaternion;
  /** Activity state (processing, throughput). */
  activity: FactoryActivityState;
}

/**
 * Entity representing the central warehouse.
 */
export interface WarehouseEntity {
  /** Unique ID. */
  id: string;
  /** Entity discriminant. */
  kind: 'warehouse';
  /** World position. */
  position: Vector3;
}

/** Union type of all game entities. */
export type Entity = DroneEntity | AsteroidEntity | FactoryEntity;

/**
 * Container for the ECS world and core singleton entities.
 */
export interface GameWorld {
  /** The Miniplex world instance. */
  world: World<Entity>;
  /** The main factory entity. */
  factory: FactoryEntity;
  /** The warehouse entity. */
  warehouse: WarehouseEntity;
  /** Live query for drone entities. */
  droneQuery: Query<DroneEntity>;
  /** Live query for asteroid entities. */
  asteroidQuery: Query<AsteroidEntity>;
  /** Random number source for deterministic simulation. */
  rng: RandomSource;
  /** Event state for the factory. */
  events: FactoryEventState;
}

/** Options for creating a new game world. */
export interface CreateWorldOptions {
  /** Number of asteroids to spawn initially. */
  asteroidCount?: number;
  /** RNG source to use. */
  rng?: RandomSource;
}

let idCounter = 0;
export const resetEntityIdCounter = () => {
  idCounter = 0;
};

const parseHexSuffix = (id: string): number | null => {
  const idx = id.lastIndexOf('-');
  if (idx < 0 || idx === id.length - 1) return null;
  const suffix = id.slice(idx + 1);
  const parsed = Number.parseInt(suffix, 16);
  return Number.isFinite(parsed) ? parsed : null;
};

export const bumpEntityIdCounterFromIds = (ids: string[]) => {
  let maxSuffix = idCounter;
  for (const id of ids) {
    const suffix = parseHexSuffix(id);
    if (suffix !== null) {
      maxSuffix = Math.max(maxSuffix, suffix);
    }
  }
  idCounter = Math.max(idCounter, maxSuffix);
};
const nextId = (prefix: ModuleId | 'factory' | 'asteroid' | 'drone') => {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(16)}`;
};

const BASE_ASTEROID_RICHNESS = 80;
const ASTEROID_TARGET = 200;

const createFactory = (): FactoryEntity => ({
  id: nextId('factory'),
  kind: 'factory',
  position: new Vector3(0, 0, 0),
  orientation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), TAU / 8),
  activity: {
    processing: 0,
    throughput: 0,
    boost: 0,
    lastTransferAt: 0,
  },
});

/**
 * Options for spawning a single asteroid.
 */
export interface SpawnAsteroidOptions {
  /** Multiplier for asteroid richness (affects yield). */
  richnessMultiplier?: number;
}

/**
 * Creates a new asteroid entity with randomized properties.
 *
 * @param scannerLevel - Current scanner level affecting richness discovery.
 * @param rng - Random number source.
 * @param options - Spawn options.
 * @returns A new AsteroidEntity.
 */
export const createAsteroid = (
  scannerLevel: number,
  rng: RandomSource,
  options?: SpawnAsteroidOptions,
): AsteroidEntity => {
  const position = randomOnRing(12, 48, 6, rng);
  const richnessMultiplier = Math.max(0, options?.richnessMultiplier ?? 1);
  const richnessBias = (1 + scannerLevel * 0.05) * richnessMultiplier;
  const richness = randomRange(0.8, 1.2, rng) * richnessBias;
  const oreRemaining = BASE_ASTEROID_RICHNESS * richness;
  const radius = randomRange(0.6, 1.4, rng) * Math.cbrt(oreRemaining / BASE_ASTEROID_RICHNESS);
  const biome = createAsteroidBiomeState(rng);
  return {
    id: nextId('asteroid'),
    kind: 'asteroid',
    position,
    oreRemaining,
    richness,
    radius,
    rotation: randomRange(0, TAU, rng),
    spin: randomRange(-0.4, 0.4, rng),
    colorBias: richness,
    biome,
    gravityMultiplier: biome.gravityMultiplier,
    resourceProfile: biome.resourceProfile,
    dominantResource: biome.dominantResource,
    regions: null,
  };
};

/** Default drone capacity. */
export const DEFAULT_DRONE_CAPACITY = 40;
/** Default drone speed. */
export const DEFAULT_DRONE_SPEED = 14;
/** Default drone mining rate. */
export const DEFAULT_DRONE_MINING_RATE = 6;
/** Default drone battery capacity. */
export const DEFAULT_DRONE_BATTERY = 24;

const createDrone = (origin: Vector3): DroneEntity => ({
  id: nextId('drone'),
  kind: 'drone',
  position: origin.clone(),
  state: 'idle',
  targetId: null,
  targetRegionId: null,
  targetFactoryId: null,
  cargo: 0,
  capacity: DEFAULT_DRONE_CAPACITY,
  speed: DEFAULT_DRONE_SPEED,
  miningRate: DEFAULT_DRONE_MINING_RATE,
  travel: null,
  miningAccumulator: 0,
  battery: DEFAULT_DRONE_BATTERY,
  maxBattery: DEFAULT_DRONE_BATTERY,
  charging: false,
  lastDockingFrom: null,
  flightSeed: null,
  cargoProfile: { ore: 0, metals: 0, crystals: 0, organics: 0, ice: 0 },
  ownerFactoryId: null,
});

/** Fixed position of the warehouse. */
export const WAREHOUSE_POSITION = new Vector3(-8, -3, 3);

const createWarehouse = (): WarehouseEntity => ({
  id: 'warehouse-core',
  kind: 'warehouse',
  position: WAREHOUSE_POSITION.clone(),
});

const isDrone = (entity: Entity): entity is DroneEntity => entity.kind === 'drone';
const isAsteroid = (entity: Entity): entity is AsteroidEntity => entity.kind === 'asteroid';

/**
 * Initializes the game world with factory, warehouse, and initial asteroids.
 *
 * @param options - Creation options including asteroid count and RNG.
 * @returns The initialized GameWorld object.
 */
export const createGameWorld = (options: CreateWorldOptions = {}): GameWorld => {
  const {
    asteroidCount = ASTEROID_TARGET,
    rng = createRng(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
  } = options;
  const world = new World<Entity>();
  const factory = world.add(createFactory());
  const warehouse = createWarehouse();
  const droneQuery = world.where(isDrone).connect();
  const asteroidQuery = world.where(isAsteroid).connect();
  const events: FactoryEventState = { transfers: [] };

  for (let i = 0; i < asteroidCount; i += 1) {
    world.add(createAsteroid(0, rng));
  }

  return { world, factory, warehouse, droneQuery, asteroidQuery, rng, events };
};

let initialSeed = Date.now();
try {
  if (storeApi && typeof storeApi.getState === 'function') {
    initialSeed = storeApi.getState().rngSeed;
  }
} catch {
  // Fallback to time-based seed if store API is not yet initialized (e.g., during tests).
  initialSeed = Date.now();
}

/** Global singleton instance of the game world. */
export const gameWorld = createGameWorld({ rng: createRng(initialSeed) });

/**
 * Resets the game world to a fresh state with a new seed.
 * Clears all entities and recreates the factory and warehouse.
 *
 * @param seed - The new RNG seed.
 */
export const resetWorld = (seed: number) => {
  gameWorld.rng = createRng(seed);
  const entities = [...gameWorld.world.entities];
  for (const e of entities) {
    gameWorld.world.remove(e);
  }
  gameWorld.factory = gameWorld.world.add(createFactory());
  gameWorld.warehouse = createWarehouse();
  gameWorld.events.transfers = [];
};

/**
 * Spawns a new drone at the factory's position.
 *
 * @param world - The game world.
 * @returns The created DroneEntity (which is already added to the world).
 */
export const spawnDrone = (world: GameWorld) =>
  world.world.add(createDrone(world.factory.position));

/**
 * Removes a drone from the world.
 *
 * @param world - The game world.
 * @param drone - The drone entity to remove.
 */
export const removeDrone = (world: GameWorld, drone: DroneEntity) => world.world.remove(drone);

/**
 * Spawns a new asteroid in the world.
 *
 * @param world - The game world.
 * @param scannerLevel - Current scanner level.
 * @param options - Spawn options.
 * @returns The created AsteroidEntity.
 */
export const spawnAsteroid = (
  world: GameWorld,
  scannerLevel: number,
  options?: SpawnAsteroidOptions,
) => world.world.add(createAsteroid(scannerLevel, world.rng, options));

/**
 * Removes an asteroid from the world.
 *
 * @param world - The game world.
 * @param asteroid - The asteroid entity to remove.
 */
export const removeAsteroid = (world: GameWorld, asteroid: AsteroidEntity) =>
  world.world.remove(asteroid);

/**
 * Options for ensuring a minimum number of asteroids.
 */
export interface EnsureAsteroidOptions extends SpawnAsteroidOptions {
  /** Scanner level to use for new asteroids. */
  scannerLevel: number;
  /** Multiplier for the target asteroid count. */
  spawnMultiplier?: number;
}

/**
 * Ensures that the number of asteroids in the world meets the target count.
 * Spawns new asteroids if the current count is below the target.
 *
 * @param world - The game world.
 * @param options - Options defining the target and spawn parameters.
 */
export const ensureAsteroidTarget = (world: GameWorld, options: EnsureAsteroidOptions) => {
  const spawnMultiplier = Math.max(0, options.spawnMultiplier ?? 1);
  const target = Math.round(ASTEROID_TARGET * spawnMultiplier);
  while (world.asteroidQuery.size < target) {
    spawnAsteroid(world, options.scannerLevel, { richnessMultiplier: options.richnessMultiplier });
  }
};
