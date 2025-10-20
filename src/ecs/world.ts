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

export type DroneState = 'idle' | 'toAsteroid' | 'mining' | 'returning' | 'unloading';

export interface TravelData {
  from: Vector3;
  to: Vector3;
  elapsed: number;
  duration: number;
  control?: Vector3;
}

export interface FactoryActivityState {
  processing: number;
  throughput: number;
  boost: number;
  lastTransferAt: number;
}

export interface FactoryTransferEvent {
  id: string;
  amount: number;
  from: Vector3;
  to: Vector3;
  duration: number;
}

export interface FactoryEventState {
  transfers: FactoryTransferEvent[];
}

export interface DroneEntity {
  id: string;
  kind: 'drone';
  position: Vector3;
  state: DroneState;
  targetId: string | null;
  targetRegionId: string | null;
  targetFactoryId: string | null;
  cargo: number;
  capacity: number;
  speed: number;
  miningRate: number;
  travel: TravelData | null;
  miningAccumulator: number;
  battery: number;
  maxBattery: number;
  charging: boolean;
  lastDockingFrom: Vector3 | null;
  flightSeed: number | null;
  cargoProfile: ResourceWeights;
  ownerFactoryId: string | null;
}

export interface AsteroidEntity {
  id: string;
  kind: 'asteroid';
  position: Vector3;
  oreRemaining: number;
  richness: number;
  radius: number;
  rotation: number;
  spin: number;
  colorBias: number;
  biome: AsteroidBiomeState;
  gravityMultiplier: number;
  resourceProfile: ResourceWeights;
  dominantResource: ResourceKey;
  regions: BiomeRegionState[] | null;
}

export interface FactoryEntity {
  id: string;
  kind: 'factory';
  position: Vector3;
  orientation: Quaternion;
  activity: FactoryActivityState;
}

export interface WarehouseEntity {
  id: string;
  kind: 'warehouse';
  position: Vector3;
}

export type Entity = DroneEntity | AsteroidEntity | FactoryEntity;

export interface GameWorld {
  world: World<Entity>;
  factory: FactoryEntity;
  warehouse: WarehouseEntity;
  droneQuery: Query<DroneEntity>;
  asteroidQuery: Query<AsteroidEntity>;
  rng: RandomSource;
  events: FactoryEventState;
}

export interface CreateWorldOptions {
  asteroidCount?: number;
  rng?: RandomSource;
}

const nextId = (() => {
  let counter = 0;
  return (prefix: ModuleId | 'factory' | 'asteroid' | 'drone') =>
    `${prefix}-${(counter += 1).toString(16)}`;
})();

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

export const createAsteroid = (scannerLevel: number, rng: RandomSource): AsteroidEntity => {
  const position = randomOnRing(12, 48, 6, rng);
  const richnessBias = 1 + scannerLevel * 0.05;
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

export const DEFAULT_DRONE_CAPACITY = 40;
export const DEFAULT_DRONE_SPEED = 14;
export const DEFAULT_DRONE_MINING_RATE = 6;
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

export const WAREHOUSE_POSITION = new Vector3(8, 0, 5);

const createWarehouse = (): WarehouseEntity => ({
  id: 'warehouse-core',
  kind: 'warehouse',
  position: WAREHOUSE_POSITION.clone(),
});

const isDrone = (entity: Entity): entity is DroneEntity => entity.kind === 'drone';
const isAsteroid = (entity: Entity): entity is AsteroidEntity => entity.kind === 'asteroid';

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

export const gameWorld = createGameWorld({ rng: createRng(initialSeed) });

export const spawnDrone = (world: GameWorld) =>
  world.world.add(createDrone(world.factory.position));

export const removeDrone = (world: GameWorld, drone: DroneEntity) => world.world.remove(drone);

export const spawnAsteroid = (world: GameWorld, scannerLevel: number) =>
  world.world.add(createAsteroid(scannerLevel, world.rng));

export const removeAsteroid = (world: GameWorld, asteroid: AsteroidEntity) =>
  world.world.remove(asteroid);

export const ensureAsteroidTarget = (world: GameWorld, scannerLevel: number) => {
  while (world.asteroidQuery.size < ASTEROID_TARGET) {
    spawnAsteroid(world, scannerLevel);
  }
};
