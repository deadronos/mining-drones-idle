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
import { parityDebugLog } from '@/lib/parityDebug';

/**
 * Represents the state of a hazard in a biome region.
 */
export interface HazardState {
  /** The unique identifier of the hazard. */
  id: HazardId;
  /** The severity level of the hazard. */
  severity: HazardSeverity;
}

/**
 * Represents a specific region within an asteroid biome.
 * Regions can have their own gravity modifiers, resource profiles, and hazards.
 */
export interface BiomeRegionState {
  /** Unique identifier for the region. */
  id: string;
  /** The biome ID this region belongs to. */
  biomeId: BiomeId;
  /** The relative weight of this region determining its probability or size. */
  weight: number;
  /** Gravity multiplier specific to this region. */
  gravityMultiplier: number;
  /** Resource distribution weights for this region. */
  resourceProfile: ResourceWeights;
  /** The most abundant resource in this region. */
  dominantResource: ResourceKey;
  /** The active hazard state, if any. */
  hazard: HazardState | null;
  /** Positional offset for visual or logical separation. */
  offset: Vector3;
}

/**
 * Represents the overall biome state of an asteroid, including fracture dynamics.
 */
export interface AsteroidBiomeState {
  /** The primary biome ID. */
  biomeId: BiomeId;
  /** Base gravity multiplier for the asteroid. */
  gravityMultiplier: number;
  /** Aggregated resource profile for the asteroid. */
  resourceProfile: ResourceWeights;
  /** The overall dominant resource. */
  dominantResource: ResourceKey;
  /** Global hazard state for the asteroid. */
  hazard: HazardState | null;
  /** Countdown timer until the next fracture event. */
  fractureTimer: number;
  /** Seed used for generating fracture regions. */
  fractureSeed: number;
  /** Number of times the asteroid has fractured. */
  fractureCount: number;
}

/** Default weight assigned to a region if not specified. */
export const DEFAULT_REGION_WEIGHT = 1;
const REGION_OFFSET_RADIUS = 0.7;
const FRACTURE_TIMER_MIN = 24;
const FRACTURE_TIMER_MAX = 64;

const tempVec = new Vector3();

const toHazardState = (hazard: HazardDefinition | null): HazardState | null =>
  hazard ? { id: hazard.id, severity: hazard.severity } : null;

/**
 * Creates an initial biome state for an asteroid.
 * Selects a biome, normalizes resources, and initializes fracture timers.
 *
 * @param rng - The random number source.
 * @returns A new AsteroidBiomeState initialized with random values.
 */
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
  tempVec.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
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

/**
 * Options for configuring fracture generation.
 */
export interface FractureOptions {
  /** Minimum number of regions to generate. Defaults to 2. */
  minRegions?: number;
  /** Maximum number of regions to generate. Defaults to 4. */
  maxRegions?: number;
}

/**
 * Generates a list of fracture regions for an asteroid based on its biome state.
 *
 * @param asteroid - The asteroid entity to fracture.
 * @param biomeState - The current biome state of the asteroid.
 * @param options - Configuration options for the fracture process.
 * @returns An array of generated BiomeRegionState objects.
 */
export const generateFractureRegions = (
  asteroid: AsteroidEntity,
  biomeState: AsteroidBiomeState,
  options: FractureOptions = {},
): BiomeRegionState[] => {
  const minRegions = Math.max(2, options.minRegions ?? 2);
  const maxRegions = Math.max(minRegions, options.maxRegions ?? 4);
  const rng: RandomGenerator = createRng(
    mixSeed(biomeState.fractureSeed, biomeState.fractureCount),
  );
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

/**
 * Updates the fracture timer for an asteroid and increments the fracture count if the timer expires.
 *
 * @param biomeState - The biome state to update.
 * @param dt - Delta time in seconds.
 * @param rng - The random number source for resetting the timer.
 * @returns True if a fracture event occurred (timer expired), false otherwise.
 */
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

/**
 * Retrieves a region by its ID from a list of regions.
 *
 * @param regions - The list of biome regions to search, or null.
 * @param regionId - The ID of the region to find, or null.
 * @returns The matching BiomeRegionState, or null if not found or inputs are invalid.
 */
export const getRegionById = (regions: BiomeRegionState[] | null, regionId: string | null) => {
  if (!regions || !regionId) return null;
  return regions.find((region) => region.id === regionId) ?? null;
};

/**
 * Selects a suitable region for a drone to target on an asteroid.
 * Prefers safe regions and weights selection by region size/probability.
 *
 * @param asteroid - The asteroid entity.
 * @param biomeState - The asteroid's biome state.
 * @param regions - The available regions on the asteroid.
 * @param rng - The random number source.
 * @returns The selected BiomeRegionState, or null/default if fallback is needed.
 */
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
  const rawRoll = rng.next();
  parityDebugLog('[parity][ts][pickRegionForDrone]', {
    asteroidId: asteroid.id,
    rawRoll,
    total,
    pool: pool.map((region) => ({ id: region.id, weight: region.weight, hazard: region.hazard })),
  });
  const roll = rawRoll * total;
  let acc = 0;
  for (const entry of weighted) {
    acc += entry.weight;
    if (roll <= acc) {
      return entry.region;
    }
  }
  return weighted.at(-1)?.region ?? null;
};

/**
 * Applies the generated fracture regions to the asteroid entity.
 * Updates the asteroid's gravity, resource profile, and biome state to reflect the aggregated regions.
 *
 * @param asteroid - The asteroid entity to update.
 * @param biomeState - The biome state to synchronize.
 * @param regions - The list of regions to apply.
 */
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
      regions.reduce(
        (acc, region) => {
          (Object.keys(region.resourceProfile) as ResourceKey[]).forEach((key) => {
            acc[key] = (acc[key] ?? 0) + region.resourceProfile[key] * region.weight;
          });
          return acc;
        },
        { ore: 0, metals: 0, crystals: 0, organics: 0, ice: 0 } as ResourceWeights,
      ),
    );
    asteroid.dominantResource = getDominantResource(asteroid.resourceProfile);
    biomeState.resourceProfile = { ...asteroid.resourceProfile };
    biomeState.gravityMultiplier = asteroid.gravityMultiplier;
    biomeState.dominantResource = asteroid.dominantResource;
  }
};

/**
 * Handles the reassignment of drones when an asteroid fractures or regions change.
 * Drones targeting lost or dangerous regions are reassigned or recalled.
 *
 * @param asteroid - The asteroid entity.
 * @param regions - The new list of valid regions.
 * @param drones - The iterable collection of drone entities.
 * @param rng - The random number source.
 */
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
