import { World, type Query } from 'miniplex';
import { Quaternion, Vector3 } from 'three';
import { randomOnRing, randomRange, TAU } from '@/lib/math';
import type { ModuleId } from '@/state/store';

export type DroneState = 'idle' | 'toAsteroid' | 'mining' | 'returning' | 'unloading';

export interface TravelData {
  from: Vector3;
  to: Vector3;
  elapsed: number;
  duration: number;
}

export interface DroneEntity {
  id: string;
  kind: 'drone';
  position: Vector3;
  state: DroneState;
  targetId: string | null;
  cargo: number;
  capacity: number;
  speed: number;
  miningRate: number;
  travel: TravelData | null;
  miningAccumulator: number;
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
}

export interface FactoryEntity {
  id: string;
  kind: 'factory';
  position: Vector3;
  orientation: Quaternion;
}

export type Entity = DroneEntity | AsteroidEntity | FactoryEntity;

export interface GameWorld {
  world: World<Entity>;
  factory: FactoryEntity;
  droneQuery: Query<DroneEntity>;
  asteroidQuery: Query<AsteroidEntity>;
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
});

export const createAsteroid = (scannerLevel: number): AsteroidEntity => {
  const position = randomOnRing(12, 48, 6);
  const richnessBias = 1 + scannerLevel * 0.05;
  const richness = randomRange(0.8, 1.2) * richnessBias;
  const oreRemaining = BASE_ASTEROID_RICHNESS * richness;
  const radius = randomRange(0.6, 1.4) * Math.cbrt(oreRemaining / BASE_ASTEROID_RICHNESS);
  return {
    id: nextId('asteroid'),
    kind: 'asteroid',
    position,
    oreRemaining,
    richness,
    radius,
    rotation: randomRange(0, TAU),
    spin: randomRange(-0.4, 0.4),
    colorBias: richness,
  };
};

const createDrone = (origin: Vector3): DroneEntity => ({
  id: nextId('drone'),
  kind: 'drone',
  position: origin.clone(),
  state: 'idle',
  targetId: null,
  cargo: 0,
  capacity: 40,
  speed: 14,
  miningRate: 6,
  travel: null,
  miningAccumulator: 0,
});

const isDrone = (entity: Entity): entity is DroneEntity => entity.kind === 'drone';
const isAsteroid = (entity: Entity): entity is AsteroidEntity => entity.kind === 'asteroid';

export const createGameWorld = (asteroidCount = ASTEROID_TARGET): GameWorld => {
  const world = new World<Entity>();
  const factory = world.add(createFactory());
  const droneQuery = world.where(isDrone).connect();
  const asteroidQuery = world.where(isAsteroid).connect();

  for (let i = 0; i < asteroidCount; i += 1) {
    world.add(createAsteroid(0));
  }

  return { world, factory, droneQuery, asteroidQuery };
};

export const gameWorld = createGameWorld();

export const spawnDrone = (world: GameWorld) =>
  world.world.add(createDrone(world.factory.position));

export const removeDrone = (world: GameWorld, drone: DroneEntity) => world.world.remove(drone);

export const spawnAsteroid = (world: GameWorld, scannerLevel: number) =>
  world.world.add(createAsteroid(scannerLevel));

export const removeAsteroid = (world: GameWorld, asteroid: AsteroidEntity) =>
  world.world.remove(asteroid);

export const ensureAsteroidTarget = (world: GameWorld, scannerLevel: number) => {
  while (world.asteroidQuery.size < ASTEROID_TARGET) {
    spawnAsteroid(world, scannerLevel);
  }
};
