import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  createAsteroidBiomeState,
  generateFractureRegions,
  pickRegionForDrone,
  updateFractureTimer,
  type AsteroidBiomeState,
  type BiomeRegionState,
} from '@/ecs/biomes';
import type { AsteroidEntity } from '@/ecs/world';
import { createRng } from '@/lib/rng';
import { RESOURCE_KEYS } from '@/lib/biomes';

const cloneBiomeState = (state: AsteroidBiomeState): AsteroidBiomeState => ({
  ...state,
  resourceProfile: { ...state.resourceProfile },
  hazard: state.hazard ? { ...state.hazard } : null,
});

const sanitizeRegion = (region: BiomeRegionState) => {
  const { id: _ignored, ...rest } = region;
  void _ignored;
  return {
    ...rest,
    resourceProfile: { ...region.resourceProfile },
    hazard: region.hazard ? { ...region.hazard } : null,
    offset: { x: region.offset.x, y: region.offset.y, z: region.offset.z },
  };
};

const sanitizeRegions = (regions: BiomeRegionState[]) => regions.map(sanitizeRegion);

const makeAsteroid = (seed: number): AsteroidEntity => {
  const biome = createAsteroidBiomeState(createRng(seed));
  return {
    id: `asteroid-${seed}`,
    kind: 'asteroid',
    position: new Vector3(),
    oreRemaining: 100,
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

describe('biomes', () => {
  it('generates deterministic fracture regions for identical seeds', () => {
    const asteroidA = makeAsteroid(11);
    const asteroidB: AsteroidEntity = {
      ...asteroidA,
      id: 'asteroid-copy',
      position: new Vector3().copy(asteroidA.position),
      biome: cloneBiomeState(asteroidA.biome),
      resourceProfile: { ...asteroidA.resourceProfile },
      regions: null,
    };
    const regionsA = generateFractureRegions(asteroidA, asteroidA.biome);
    const regionsB = generateFractureRegions(asteroidB, asteroidB.biome);
    expect(sanitizeRegions(regionsB)).toEqual(sanitizeRegions(regionsA));
  });

  it('updates fracture timer and resets within bounds', () => {
    const asteroid = makeAsteroid(21);
    const rng = createRng(21);
    const originalTimer = asteroid.biome.fractureTimer;
    const triggered = updateFractureTimer(asteroid.biome, originalTimer + 0.1, rng);
    expect(triggered).toBe(true);
    expect(asteroid.biome.fractureTimer).toBeLessThanOrEqual(64);
    expect(asteroid.biome.fractureTimer).toBeGreaterThanOrEqual(24);
  });

  it('prefers safer regions when selecting for drones', () => {
    const asteroid = makeAsteroid(33);
    const regions = generateFractureRegions(asteroid, asteroid.biome);
    if (regions.length < 2) {
      regions.push({
        id: 'synthetic-region',
        biomeId: asteroid.biome.biomeId,
        weight: 0.4,
        gravityMultiplier: asteroid.gravityMultiplier,
        resourceProfile: asteroid.resourceProfile,
        dominantResource: asteroid.dominantResource,
        hazard: null,
        offset: new Vector3(0.2, 0.1, 0.3),
      });
    }
    // Mark the first region as hazardous and ensure picker avoids it.
    const hazardous: BiomeRegionState = {
      ...regions[0],
      hazard: { id: 'ionStorm', severity: 'high' },
    };
    regions[0] = hazardous;
    asteroid.regions = regions;
    const rng = createRng(55);
    const selection = pickRegionForDrone(asteroid, asteroid.biome, regions, rng);
    expect(selection).not.toBeNull();
    expect(selection?.hazard?.severity).not.toBe('high');
    const totalWeight = regions.reduce((sum, region) => sum + region.weight, 0);
    expect(totalWeight).toBeGreaterThan(0);
  });

  it('normalizes resource profiles used during fractures', () => {
    const asteroid = makeAsteroid(45);
    const regions = generateFractureRegions(asteroid, asteroid.biome);
    for (const region of regions) {
      const total = RESOURCE_KEYS.reduce((sum, key) => sum + (region.resourceProfile[key] ?? 0), 0);
      expect(total).toBeCloseTo(1, 5);
    }
  });
});
