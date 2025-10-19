import { describe, it, expect } from 'vitest';
import {
  normalizeVectorTuple,
  cloneVectorTuple,
  normalizeTravelSnapshot,
  cloneTravelSnapshot,
} from '@/state/serialization/vectors';
import { normalizeDroneFlight, cloneDroneFlight } from '@/state/serialization/drones';
import {
  normalizeFactoryResources,
  normalizeFactoryUpgrades,
  normalizeDroneOwners,
} from '@/state/serialization/resources';

describe('Serialization Modules', () => {
  describe('vectors.ts', () => {
    it('normalizeVectorTuple converts arrays to tuples', () => {
      const result = normalizeVectorTuple([1.5, 2.5, 3.5]);
      expect(result).toEqual([1.5, 2.5, 3.5]);
    });

    it('normalizeVectorTuple returns null for invalid input', () => {
      expect(normalizeVectorTuple([1, 2])).toBeNull();
      expect(normalizeVectorTuple('not an array')).toBeNull();
      expect(normalizeVectorTuple([1, 2, NaN])).toBeNull();
    });

    it('cloneVectorTuple creates independent copy', () => {
      const original: [number, number, number] = [1, 2, 3];
      const cloned = cloneVectorTuple(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    it('normalizeTravelSnapshot handles valid travel data', () => {
      const travelData = {
        from: [0, 0, 0],
        to: [1, 1, 1],
        elapsed: 0.5,
        duration: 1.0,
        control: [0.5, 0.5, 0.5],
      };
      const result = normalizeTravelSnapshot(travelData);
      expect(result).toBeDefined();
      expect(result?.elapsed).toBe(0.5);
      expect(result?.duration).toBe(1.0);
    });

    it('normalizeTravelSnapshot clamps elapsed to duration', () => {
      const travelData = {
        from: [0, 0, 0],
        to: [1, 1, 1],
        elapsed: 2.0, // exceeds duration
        duration: 1.0,
      };
      const result = normalizeTravelSnapshot(travelData);
      expect(result?.elapsed).toBe(1.0); // clamped to duration
    });

    it('cloneTravelSnapshot preserves control point', () => {
      const original = {
        from: [0, 0, 0] as [number, number, number],
        to: [1, 1, 1] as [number, number, number],
        elapsed: 0.5,
        duration: 1.0,
        control: [0.5, 0.5, 0.5] as [number, number, number],
      };
      const cloned = cloneTravelSnapshot(original);
      expect(cloned.control).toBeDefined();
      expect(cloned.control).toEqual(original.control);
    });
  });

  describe('drones.ts', () => {
    it('normalizeDroneFlight creates valid drone state', () => {
      const flightData = {
        droneId: 'drone-1',
        state: 'toAsteroid' as const,
        targetAsteroidId: 'asteroid-1',
        targetRegionId: 'region-1',
        targetFactoryId: null,
        pathSeed: 12345,
        travel: {
          from: [0, 0, 0],
          to: [1, 1, 1],
          elapsed: 0,
          duration: 1.0,
        },
      };
      const result = normalizeDroneFlight(flightData);
      expect(result).toBeDefined();
      expect(result?.droneId).toBe('drone-1');
      expect(result?.state).toBe('toAsteroid');
    });

    it('normalizeDroneFlight returns null for invalid state', () => {
      const invalidFlight = {
        droneId: 'drone-1',
        state: 'invalid',
        travel: { from: [0, 0, 0], to: [1, 1, 1], elapsed: 0, duration: 1 },
      };
      expect(normalizeDroneFlight(invalidFlight)).toBeNull();
    });

    it('cloneDroneFlight creates independent copy', () => {
      const original = {
        droneId: 'drone-1',
        state: 'returning' as const,
        targetAsteroidId: null,
        targetRegionId: null,
        targetFactoryId: 'factory-1',
        pathSeed: 999,
        travel: {
          from: [0, 0, 0] as [number, number, number],
          to: [1, 1, 1] as [number, number, number],
          elapsed: 0.5,
          duration: 1.0,
        },
      };
      const cloned = cloneDroneFlight(original);
      expect(cloned.droneId).toBe(original.droneId);
      expect(cloned.travel).toEqual(original.travel);
      expect(cloned.travel).not.toBe(original.travel);
    });
  });

  describe('resources.ts', () => {
    it('normalizeFactoryResources fills defaults', () => {
      const result = normalizeFactoryResources({
        ore: 100,
        bars: 50,
      });
      expect(result.ore).toBe(100);
      expect(result.bars).toBe(50);
      expect(result.metals).toBe(0);
      expect(result.credits).toBe(0);
    });

    it('normalizeFactoryResources clamps negative values', () => {
      const result = normalizeFactoryResources({
        ore: -10,
        bars: 50,
      });
      expect(result.ore).toBe(0);
      expect(result.bars).toBe(50);
    });

    it('normalizeFactoryUpgrades floors values', () => {
      const result = normalizeFactoryUpgrades({
        docking: 2.7,
        refine: 1.3,
        storage: 3.9,
      });
      expect(result.docking).toBe(2);
      expect(result.refine).toBe(1);
      expect(result.storage).toBe(3);
    });

    it('normalizeDroneOwners filters invalid entries', () => {
      const result = normalizeDroneOwners({
        'drone-1': 'factory-1',
        'drone-2': '',
        'drone-3': null,
        'drone-4': 'factory-2',
      });
      expect(result['drone-1']).toBe('factory-1');
      expect(result['drone-2']).toBeNull();
      expect(result['drone-3']).toBeNull();
      expect(result['drone-4']).toBe('factory-2');
    });
  });
});
