import { Vector3 } from 'three';
import { randomRange } from '@/lib/math';
import { createRng, type RandomGenerator, type RandomSource } from '@/lib/rng';
import {
  applyGravityModifier,
  chooseBiome,
  getBiomeDefinition,
  getDominantResource,
  normalizeResourceWeights,
  rollHazard,
  type BiomeDefinition,
  type BiomeId,
  type HazardDefinition,
  type HazardId,
  type HazardSeverity,
  type ResourceKey,
  type ResourceWeights,
} from '@/lib/biomes';
import type { AsteroidEntity, DroneEntity } from '@/ecs/world';

export interface HazardState {
  id: HazardId;
  severity: HazardSeverity;
}

export interface BiomeRegionState {
  id: string;
  biomeId: BiomeId;
  weight: number;
  gravityMultiplier: number;
  resourceProfile: ResourceWeights;
  dominantResource: ResourceKey;
  hazard: HazardState | null;
  offset: Vector3;
}

export interface AsteroidBiomeState {
  biomeId: BiomeId;
  gravityMultiplier: number;
  resourceProfile: ResourceWeights;
  dominantResource: ResourceKey;
  hazard: HazardState | null;
  fractureTimer: number;
  fractureSeed: number;
  fractureCount: number;
}

export const DEFAULT_REGION_WEIGHT = 1;
const REGION_OFFSET_RADIUS = 0.7;
const FRACTURE_TIMER_MIN = 24;
const FRACTURE_TIMER_MAX = 64;

const tempVec = new Vector3();

const toHazardState = (hazard: HazardDefinition | null): HazardState | null =>
  hazard ? { id: hazard.id, severity: hazard.severity } : null;

export const createAsteroidBiomeState = (rng: RandomSource): AsteroidBiomeState => {
  const biome = chooseBiome(rng);
  const resourceProfile = normalizeResourceWeights(biome.resourceWeights);
  return {
    biomeId: biome.id,
    gravityMultiplier: biome.gravityMultiplier,
    resourceProfile,
    dominantResource: getDominantResource(resourceProfile),
    hazard: toHazardState(rollHazard(rng, biome)),
    fractureTimer: randomRange(FRACTURE_TIMER_MIN, FRACTURE_TIMER_MAX, rng),
    fractureSeed: Math.max(1, Math.floor(rng.next() * 0xffffffff)),
    fractureCount: 0,
  };
};

const mixSeed = (seed: number, iteration: number) => (seed ^ ((iteration + 1) * 0x9e3779b9)) >>> 0;

const randomRegionOffset = (rng: RandomSource, radius: number) => {
  const u = rng.next();
  const v = rng.next();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  tempVec.set(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
  tempVec.multiplyScalar(radius * REGION_OFFSET_RADIUS);
  return tempVec.clone();
};

const buildRegion = (
  asteroid: AsteroidEntity,
  biome: BiomeDefinition,
  regionId: string,
  weight: number,
  rng: RandomSource,
): BiomeRegionState => {
  const resourceProfile = normalizeResourceWeights(biome.resourceWeights);
  return {
    id: regionId,
    biomeId: biome.id,
    weight,
    gravityMultiplier: applyGravityModifier(1, biome),
    resourceProfile,
    dominantResource: getDominantResource(resourceProfile),
    hazard: toHazardState(rollHazard(rng, biome)),
    offset: randomRegionOffset(rng, asteroid.radius),
  };
};

const normalizeRegionWeights = (weights: number[]): number[] => {
  const total = weights.reduce((sum, value) => sum + Math.max(0.01, value), 0);
  return weights.map((value) => Math.max(0.01, value) / total);
};

export interface FractureOptions {
  minRegions?: number;
  maxRegions?: number;
}

export const generateFractureRegions = (
  asteroid: AsteroidEntity,
  biomeState: AsteroidBiomeState,
  options: FractureOptions = {},
): BiomeRegionState[] => {
  const minRegions = Math.max(2, options.minRegions ?? 2);
  const maxRegions = Math.max(minRegions, options.maxRegions ?? 4);
  const rng: RandomGenerator = createRng(mixSeed(biomeState.fractureSeed, biomeState.fractureCount));
  const span = Math.max(0, maxRegions - minRegions);
  const count = Math.min(maxRegions, minRegions + (span > 0 ? rng.nextInt(0, span) : 0));
  const weights = normalizeRegionWeights(
    Array.from({ length: count }, () => rng.nextRange(0.3, 1.5)),
  );
  const regions: BiomeRegionState[] = [];
  for (let i = 0; i < count; i += 1) {
    const preferred = i === 0 ? { [biomeState.biomeId]: 1.6 } : undefined;
    const biome = preferred ? chooseBiome(rng, { bias: preferred }) : chooseBiome(rng);
    const regionId = `${asteroid.id}-r${biomeState.fractureCount}-${i}`;
    regions.push(buildRegion(asteroid, biome, regionId, weights[i], rng));
  }
  return regions;
};

export const updateFractureTimer = (
  biomeState: AsteroidBiomeState,
  dt: number,
  rng: RandomSource,
): boolean => {
  biomeState.fractureTimer -= dt;
  if (biomeState.fractureTimer > 0) {
    return false;
  }
  biomeState.fractureCount += 1;
  biomeState.fractureTimer = randomRange(FRACTURE_TIMER_MIN, FRACTURE_TIMER_MAX, rng);
  return true;
};

export const getRegionById = (regions: BiomeRegionState[] | null, regionId: string | null) => {
  if (!regions || !regionId) return null;
  return regions.find((region) => region.id === regionId) ?? null;
};

export const pickRegionForDrone = (
  asteroid: AsteroidEntity,
  biomeState: AsteroidBiomeState,
  regions: BiomeRegionState[] | null,
  rng: RandomSource,
): BiomeRegionState | null => {
  if (!regions || regions.length === 0) {
    const biome = getBiomeDefinition(biomeState.biomeId);
    return buildRegion(asteroid, biome, `${asteroid.id}-primary`, DEFAULT_REGION_WEIGHT, rng);
  }
  const candidates = regions.filter((region) => region.hazard?.severity !== 'high');
  const pool = candidates.length > 0 ? candidates : regions;
  let total = 0;
  const weighted = pool.map((region) => {
    const weight = Math.max(0.01, region.weight) * (region.hazard?.severity === 'medium' ? 0.7 : 1);
    total += weight;
    return { region, weight };
  });
  if (total <= 0) {
    return pool[0] ?? null;
  }
  const roll = rng.next() * total;
  let acc = 0;
  for (const entry of weighted) {
    acc += entry.weight;
    if (roll <= acc) {
      return entry.region;
    }
  }
  return weighted.at(-1)?.region ?? null;
};

export const applyFractureToAsteroid = (
  asteroid: AsteroidEntity,
  biomeState: AsteroidBiomeState,
  regions: BiomeRegionState[],
) => {
  asteroid.regions = regions;
  if (regions.length > 0) {
    const blendedGravity = regions.reduce(
      (sum, region) => sum + region.gravityMultiplier * region.weight,
      0,
    );
    asteroid.gravityMultiplier = blendedGravity;
    asteroid.resourceProfile = normalizeResourceWeights(
      regions.reduce((acc, region) => {
        (Object.keys(region.resourceProfile) as ResourceKey[]).forEach((key) => {
          acc[key] = (acc[key] ?? 0) + region.resourceProfile[key] * region.weight;
        });
        return acc;
      }, { ore: 0, metals: 0, crystals: 0, organics: 0, ice: 0 } as ResourceWeights),
    );
    asteroid.dominantResource = getDominantResource(asteroid.resourceProfile);
    biomeState.resourceProfile = { ...asteroid.resourceProfile };
    biomeState.gravityMultiplier = asteroid.gravityMultiplier;
    biomeState.dominantResource = asteroid.dominantResource;
  }
};

export const handleDroneReassignment = (
  asteroid: AsteroidEntity,
  regions: BiomeRegionState[],
  drones: Iterable<DroneEntity>,
  rng: RandomSource,
) => {
  for (const drone of drones) {
    if (drone.targetId !== asteroid.id) continue;
    const current = getRegionById(regions, drone.targetRegionId);
    if (current && current.hazard?.severity !== 'high') {
      drone.targetRegionId = current.id;
      continue;
    }
    const safeRegion = regions.find((region) => region.hazard?.severity !== 'high');
    if (safeRegion) {
      drone.targetRegionId = safeRegion.id;
      drone.state = 'toAsteroid';
      drone.travel = null;
      drone.flightSeed = Math.max(1, Math.floor(rng.next() * 0xffffffff));
      continue;
    }
    drone.state = 'returning';
    drone.targetRegionId = null;
    drone.targetId = null;
    drone.travel = null;
  }
};
