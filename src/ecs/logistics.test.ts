import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  generateTransferId,
  LOGISTICS_CONFIG,
  RESOURCE_TYPES,
  computeHaulerCost,
  computeHaulerMaintenanceCost,
  matchSurplusToNeed,
} from '@/ecs/logistics';
import { createFactory } from '@/ecs/factories';

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

  describe('Scheduler', () => {
    const buildFactory = (id: string, ore: number, haulers: number, position: Vector3) => {
      const factory = createFactory(id, position);
      factory.resources.ore = ore;
      factory.haulersAssigned = haulers;
      return factory;
    };

    it('transfers ore from surplus to starving factory even if consumer has no haulers', () => {
      const producer = buildFactory('producer', 200, 4, new Vector3(0, 0, 0));
      const consumer = buildFactory('consumer', 0, 0, new Vector3(10, 0, 0));

      const transfers = matchSurplusToNeed([producer, consumer], 'ore', 0);

      expect(transfers.length).toBeGreaterThan(0);
      const transfer = transfers[0];
      expect(transfer.fromFactoryId).toBe('producer');
      expect(transfer.toFactoryId).toBe('consumer');
      expect(transfer.amount).toBeGreaterThan(0);
    });

    it('skips scheduling when no factory has surplus', () => {
      const factoryA = buildFactory('A', 10, 3, new Vector3(0, 0, 0));
      const factoryB = buildFactory('B', 5, 0, new Vector3(5, 0, 0));

      const transfers = matchSurplusToNeed([factoryA, factoryB], 'ore', 0);
      expect(transfers).toHaveLength(0);
    });

    it('skips scheduling entirely when no haulers are assigned anywhere', () => {
      const factoryA = buildFactory('A', 200, 0, new Vector3(0, 0, 0));
      const factoryB = buildFactory('B', 0, 0, new Vector3(5, 0, 0));

      const transfers = matchSurplusToNeed([factoryA, factoryB], 'ore', 0);
      expect(transfers).toHaveLength(0);
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

  describe('Hauler Costs', () => {
    it('should compute exponential hauler purchase costs', () => {
      const cost0 = computeHaulerCost(0);
      const cost1 = computeHaulerCost(1);
      const cost2 = computeHaulerCost(2);

      expect(cost0).toBeGreaterThan(0);
      expect(cost1).toBeGreaterThan(cost0);
      expect(cost2).toBeGreaterThan(cost1);
    });

    it('should default the first hauler to a 10-bar cost', () => {
      expect(computeHaulerCost(0)).toBe(10);
    });

    it('should use 1.15x growth multiplier by default', () => {
      const cost0 = computeHaulerCost(0);
      const cost1 = computeHaulerCost(1);
      const expectedCost1 = Math.ceil(cost0 * 1.15);

      expect(cost1).toBe(expectedCost1);
    });

    it('should allow custom base cost and growth', () => {
      const custom0 = computeHaulerCost(0, 500, 1.2);
      const custom1 = computeHaulerCost(1, 500, 1.2);

      expect(custom0).toBe(500);
      expect(custom1).toBe(Math.ceil(500 * 1.2));
    });

    it('should compute maintenance cost based on hauler count', () => {
      const cost0 = computeHaulerMaintenanceCost(0);
      const cost1 = computeHaulerMaintenanceCost(1);
      const cost5 = computeHaulerMaintenanceCost(5);

      expect(cost0).toBe(0);
      expect(cost1).toBeGreaterThan(0);
      expect(cost5).toBeGreaterThan(cost1);
      expect(cost5).toBe(cost1 * 5);
    });

    it('should use default maintenance cost per hauler', () => {
      const cost1 = computeHaulerMaintenanceCost(1);
      const cost2 = computeHaulerMaintenanceCost(2);

      // Default is 0.5 energy/sec per hauler
      expect(cost1).toBeCloseTo(0.5, 5);
      expect(cost2).toBeCloseTo(1.0, 5);
    });

    it('should allow custom maintenance cost', () => {
      const cost2 = computeHaulerMaintenanceCost(2, 1.0);
      expect(cost2).toBe(2.0);
    });
  });
});
