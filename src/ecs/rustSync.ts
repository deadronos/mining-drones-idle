import { Vector3 } from 'three';
import { snapshotToTravel } from '@/ecs/flights';
import { createAsteroidBiomeState, type BiomeRegionState } from '@/ecs/biomes';
import {
  bumpEntityIdCounterFromIds,
  DEFAULT_DRONE_BATTERY,
  DEFAULT_DRONE_CAPACITY,
  DEFAULT_DRONE_MINING_RATE,
  DEFAULT_DRONE_SPEED,
  gameWorld,
  type AsteroidEntity,
  type DroneEntity,
} from '@/ecs/world';
import { getDominantResource, normalizeResourceWeights, type ResourceWeights } from '@/lib/biomes';
import { createRng } from '@/lib/rng';
import type { RustSimBridge } from '@/lib/wasmSimBridge';
import type { DroneFlightState, StoreSnapshot } from '@/state/types';

type RustAsteroidExtra = {
  id: string;
  position: [number, number, number];
  oreRemaining: number;
  maxOre: number;
  gravityMultiplier?: number;
  resourceProfile?: Partial<ResourceWeights>;
  regions?:
    | Array<{
        id: string;
        weight: number;
        gravityMultiplier: number;
        offset: [number, number, number];
        hazard: BiomeRegionState['hazard'];
      }>
    | null;
};

const toDroneState = (value: number): DroneEntity['state'] => {
  const v = Math.round(Number.isFinite(value) ? value : 0);
  switch (v) {
    case 1:
      return 'toAsteroid';
    case 2:
      return 'mining';
    case 3:
      return 'returning';
    case 4:
      return 'unloading';
    case 0:
    default:
      return 'idle';
  }
};

const getRustAsteroidsFromSnapshot = (snapshot: unknown): RustAsteroidExtra[] | null => {
  const maybe = (snapshot as { asteroids?: unknown })?.asteroids;
  return Array.isArray(maybe) ? (maybe as RustAsteroidExtra[]) : null;
};

const buildWeightsFromRustArray = (values: Float32Array, base: number): ResourceWeights => ({
  ore: values[base] ?? 0,
  ice: values[base + 1] ?? 0,
  metals: values[base + 2] ?? 0,
  crystals: values[base + 3] ?? 0,
  organics: values[base + 4] ?? 0,
});

export const syncEcsWorldFromRust = (bridge: RustSimBridge, snapshot: StoreSnapshot & Record<string, unknown>) => {
  const rngSeed = snapshot.rngSeed;
  if (typeof rngSeed === 'number' && Number.isFinite(rngSeed)) {
    gameWorld.rng = createRng(rngSeed);
  }

  const droneIds = bridge.getDroneIds();
  const asteroidIds = bridge.getAsteroidIds();
  const factoryIds = (snapshot.factories ?? []).map((factory) => factory.id);
  bumpEntityIdCounterFromIds([...droneIds, ...asteroidIds, ...factoryIds]);

  // --- Asteroids ---
  const asteroidExtras = getRustAsteroidsFromSnapshot(snapshot);
  const asteroidExtraById = new Map<string, RustAsteroidExtra>();
  if (asteroidExtras) {
    for (const asteroid of asteroidExtras) {
      if (asteroid && typeof asteroid.id === 'string') {
        asteroidExtraById.set(asteroid.id, asteroid);
      }
    }
  }

  const asteroidPositions = bridge.getAsteroidPositions();
  const asteroidOre = bridge.getAsteroidOre();
  const asteroidMaxOre = bridge.getAsteroidMaxOre();
  const asteroidProfiles = bridge.getAsteroidResourceProfile();

  for (const asteroid of [...gameWorld.asteroidQuery.entities]) {
    gameWorld.world.remove(asteroid);
  }

  for (let i = 0; i < asteroidIds.length; i += 1) {
    const id = asteroidIds[i];
    const extra = asteroidExtraById.get(id);

    const pos = extra?.position ?? [
      asteroidPositions[i * 3] ?? 0,
      asteroidPositions[i * 3 + 1] ?? 0,
      asteroidPositions[i * 3 + 2] ?? 0,
    ];

    const oreRemaining = extra?.oreRemaining ?? (asteroidOre[i] ?? 0);
    const maxOre = extra?.maxOre ?? (asteroidMaxOre[i] ?? Math.max(oreRemaining, 1));
    const gravityMultiplier = extra?.gravityMultiplier ?? 1;

    const profile = extra?.resourceProfile
      ? normalizeResourceWeights(extra.resourceProfile as ResourceWeights)
      : normalizeResourceWeights(buildWeightsFromRustArray(asteroidProfiles, i * 5));

    const biome = createAsteroidBiomeState(gameWorld.rng);
    biome.gravityMultiplier = gravityMultiplier;
    biome.resourceProfile = profile;
    biome.dominantResource = getDominantResource(profile);

    const regions: BiomeRegionState[] | null = extra?.regions
      ? extra.regions.map((region) => ({
          id: region.id,
          biomeId: biome.biomeId,
          weight: region.weight,
          gravityMultiplier: region.gravityMultiplier,
          resourceProfile: profile,
          dominantResource: biome.dominantResource,
          hazard: region.hazard,
          offset: new Vector3(region.offset[0], region.offset[1], region.offset[2]),
        }))
      : null;

    const asteroidEntity: AsteroidEntity = {
      id,
      kind: 'asteroid',
      position: new Vector3(pos[0], pos[1], pos[2]),
      oreRemaining,
      richness: 1,
      radius: Math.max(0.6, Math.min(1.6, Math.cbrt(Math.max(0.01, maxOre) / 80))),
      rotation: 0,
      spin: 0,
      colorBias: 1,
      biome,
      gravityMultiplier,
      resourceProfile: profile,
      dominantResource: biome.dominantResource,
      regions,
    };

    gameWorld.world.add(asteroidEntity);
  }

  // --- Drones ---
  const droneOwners: Record<string, string | null> = snapshot.droneOwners ?? {};
  const flightByDroneId = new Map<string, DroneFlightState>();
  for (const flight of snapshot.droneFlights ?? []) {
    flightByDroneId.set(flight.droneId, flight);
  }

  const byId = new Map<string, DroneEntity>();
  for (const drone of gameWorld.droneQuery.entities) {
    byId.set(drone.id, drone);
  }

  for (const drone of [...gameWorld.droneQuery.entities]) {
    if (!droneIds.includes(drone.id)) {
      gameWorld.world.remove(drone);
      byId.delete(drone.id);
    }
  }

  const dronePositions = bridge.getDronePositions();
  const droneStates = bridge.getDroneStates();
  const droneCargo = bridge.getDroneCargo();
  const droneBattery = bridge.getDroneBattery();
  const droneMaxBattery = bridge.getDroneMaxBattery();
  const droneCapacity = bridge.getDroneCapacity();
  const droneMiningRate = bridge.getDroneMiningRate();
  const droneCharging = bridge.getDroneCharging();
  const droneCargoProfile = bridge.getDroneCargoProfile();

  for (let i = 0; i < droneIds.length; i += 1) {
    const id = droneIds[i];
    const flight = flightByDroneId.get(id);

    let drone = byId.get(id);
    if (!drone) {
      drone = {
        id,
        kind: 'drone',
        position: gameWorld.factory.position.clone(),
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
      };
      gameWorld.world.add(drone);
      byId.set(id, drone);
    }

    drone.position.set(
      dronePositions[i * 3] ?? drone.position.x,
      dronePositions[i * 3 + 1] ?? drone.position.y,
      dronePositions[i * 3 + 2] ?? drone.position.z,
    );

    const state = toDroneState(droneStates[i] ?? 0);
    drone.state = flight?.state ?? state;
    drone.cargo = droneCargo[i] ?? drone.cargo;
    drone.capacity = droneCapacity[i] ?? drone.capacity;
    drone.miningRate = droneMiningRate[i] ?? drone.miningRate;
    drone.battery = droneBattery[i] ?? drone.battery;
    drone.maxBattery = droneMaxBattery[i] ?? drone.maxBattery;
    drone.charging = (droneCharging[i] ?? 0) > 0.5;

    const base = i * 5;
    drone.cargoProfile.ore = droneCargoProfile[base] ?? 0;
    drone.cargoProfile.ice = droneCargoProfile[base + 1] ?? 0;
    drone.cargoProfile.metals = droneCargoProfile[base + 2] ?? 0;
    drone.cargoProfile.crystals = droneCargoProfile[base + 3] ?? 0;
    drone.cargoProfile.organics = droneCargoProfile[base + 4] ?? 0;

    drone.ownerFactoryId = droneOwners[id] ?? null;

    if (flight) {
      drone.targetId = flight.targetAsteroidId ?? null;
      drone.targetRegionId = flight.targetRegionId ?? null;
      drone.targetFactoryId = flight.targetFactoryId ?? null;
      drone.flightSeed = flight.pathSeed ?? null;
      try {
        drone.travel = flight.travel ? snapshotToTravel(flight.travel) : null;
      } catch {
        drone.travel = null;
      }
    }
  }
};
