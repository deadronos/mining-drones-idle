import { describe, it, expect } from 'vitest';
import {
  generateTransferId,
  LOGISTICS_CONFIG,
  RESOURCE_TYPES,
} from '@/ecs/logistics';

describe('Logistics System - Core Functions', () => {
  describe('ID Generation', () => {
    it('should generate unique transfer IDs', () => {
      const id1 = generateTransferId();
      const id2 = generateTransferId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^transfer-/);
      expect(id2).toMatch(/^transfer-/);
    });

    it('transfer IDs should be deterministic format', () => {
      const id = generateTransferId();
      expect(id).toMatch(/^transfer-\d+(-\d+)?$/); // Allows for timestamp-based or simple counter format
    });

    it('should generate multiple unique IDs sequentially', () => {
      const ids = new Set();
      for (let i = 0; i < 10; i++) {
        ids.add(generateTransferId());
      }
      expect(ids.size).toBe(10); // All unique
    });
  });

  describe('Configuration', () => {
    it('should define LOGISTICS_CONFIG with required properties', () => {
      expect(LOGISTICS_CONFIG).toBeDefined();
      expect(LOGISTICS_CONFIG.buffer_seconds).toBeGreaterThan(0);
      expect(LOGISTICS_CONFIG.min_reserve_seconds).toBeGreaterThan(0);
      expect(LOGISTICS_CONFIG.hauler_capacity).toBeGreaterThan(0);
      expect(LOGISTICS_CONFIG.hauler_speed).toBeGreaterThan(0);
      expect(LOGISTICS_CONFIG.pickup_overhead).toBeGreaterThanOrEqual(0);
      expect(LOGISTICS_CONFIG.dropoff_overhead).toBeGreaterThanOrEqual(0);
    });

    it('should have sensible default values', () => {
      // Buffer should be reasonable - not too short or long
      expect(LOGISTICS_CONFIG.buffer_seconds).toBeGreaterThanOrEqual(10);
      expect(LOGISTICS_CONFIG.buffer_seconds).toBeLessThan(120);

      // Min reserve should be small but positive
      expect(LOGISTICS_CONFIG.min_reserve_seconds).toBeGreaterThan(0);
      expect(LOGISTICS_CONFIG.min_reserve_seconds).toBeLessThan(60);

      // Hauler capacity should be reasonable
      expect(LOGISTICS_CONFIG.hauler_capacity).toBeGreaterThanOrEqual(50);
      expect(LOGISTICS_CONFIG.hauler_capacity).toBeLessThan(50000);

      // Speed should be reasonable (distance units per second)
      expect(LOGISTICS_CONFIG.hauler_speed).toBeGreaterThan(0);
      expect(LOGISTICS_CONFIG.hauler_speed).toBeLessThan(1000);
    });

    it('should maintain consistent scheduling interval', () => {
      expect(LOGISTICS_CONFIG.scheduling_interval).toBeGreaterThan(0);
      expect(LOGISTICS_CONFIG.scheduling_interval).toBeLessThan(10);
    });
  });

  describe('Resource Types', () => {
    it('should define all transportable resource types', () => {
      expect(RESOURCE_TYPES.length).toBeGreaterThan(0);
      expect(RESOURCE_TYPES).toContain('ore');
      expect(RESOURCE_TYPES).toContain('metals');
      expect(RESOURCE_TYPES).toContain('crystals');
    });

    it('should have valid resource type identifiers', () => {
      RESOURCE_TYPES.forEach((resource) => {
        expect(typeof resource).toBe('string');
        expect(resource.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Logistics Config Constraints', () => {
    it('should ensure min_reserve < buffer_seconds', () => {
      // Min reserve should be much smaller than buffer
      expect(LOGISTICS_CONFIG.min_reserve_seconds).toBeLessThan(LOGISTICS_CONFIG.buffer_seconds);
    });

    it('should ensure overhead times are reasonable', () => {
      const totalOverhead = LOGISTICS_CONFIG.pickup_overhead + LOGISTICS_CONFIG.dropoff_overhead;
      expect(totalOverhead).toBeLessThan(60); // Total overhead less than 1 minute
    });

    it('should ensure scheduling interval allows game to respond', () => {
      // Scheduling interval should be reasonable (can be up to a few seconds)
      expect(LOGISTICS_CONFIG.scheduling_interval).toBeGreaterThan(0);
      expect(LOGISTICS_CONFIG.scheduling_interval).toBeLessThan(10);
    });
  });
});
