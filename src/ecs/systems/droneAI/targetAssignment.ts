import { Vector3 } from 'three';
import type { AsteroidEntity, DroneEntity } from '@/ecs/world';
import type { RandomSource } from '@/lib/rng';
import { pickRegionForDrone } from '@/ecs/biomes';
import { parityDebugLog } from '@/lib/parityDebug';

const nearestTemp = new Vector3();
const NEARBY_LIMIT = 4;

interface TargetCandidate {
  asteroid: AsteroidEntity;
  distance: number;
  weight: number;
}

export interface AssignmentResult {
  target: AsteroidEntity;
  pathSeed: number;
  destination: Vector3;
  regionId: string | null;
  gravityMultiplier: number;
}

const toWeight = (distance: number) => 1 / Math.max(distance, 1);

const buildCandidates = (
  drone: DroneEntity,
  asteroids: Iterable<AsteroidEntity>,
): TargetCandidate[] => {
  const candidates: TargetCandidate[] = [];
  for (const asteroid of asteroids) {
    if (asteroid.oreRemaining <= 0) continue;
    const distance = nearestTemp.copy(asteroid.position).distanceTo(drone.position);
    candidates.push({ asteroid, distance, weight: 0 });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, Math.min(NEARBY_LIMIT, candidates.length));
};

export const assignDroneTarget = (
  drone: DroneEntity,
  asteroids: Iterable<AsteroidEntity>,
  rng: RandomSource,
): AssignmentResult | null => {
  const candidates = buildCandidates(drone, asteroids);
  if (candidates.length === 0) {
    return null;
  }
  let totalWeight = 0;
  for (const candidate of candidates) {
    candidate.weight = toWeight(candidate.distance);
    totalWeight += candidate.weight;
  }
  const rawRoll = rng.next();
  parityDebugLog('[parity][ts][assignDroneTarget]', {
    droneId: drone.id,
    rawRoll,
    totalWeight,
    candidates: candidates.map((c) => ({ id: c.asteroid.id, distance: c.distance })),
  });
  const roll = rawRoll * (totalWeight || 1);
  let accumulated = 0;
  let chosen = candidates[candidates.length - 1];
  for (const candidate of candidates) {
    accumulated += candidate.weight;
    if (roll <= accumulated) {
      chosen = candidate;
      break;
    }
  }
  const target = chosen.asteroid;
  let regionId: string | null = null;
  let destination = target.position.clone();
  let gravityMultiplier = target.gravityMultiplier;
  if (target.regions && target.regions.length > 0) {
    const region = pickRegionForDrone(target, target.biome, target.regions, rng);
    if (region) {
      regionId = region.id;
      destination = target.position.clone().add(region.offset);
      gravityMultiplier = region.gravityMultiplier;
    }
  }
  // Draw path seed after region selection so RNG consumption order matches Rust
  // Ensure seed fits in i32 for Rust compatibility (max 2,147,483,647)
  const seed = Math.max(1, Math.floor(rng.next() * 0x7fffffff));
  return { target, pathSeed: seed, destination, regionId, gravityMultiplier };
};
