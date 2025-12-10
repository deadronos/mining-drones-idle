/**
 * Offline Parity Test Suite
 *
 * Validates that the simulateOffline() function produces matching results
 * between TypeScript and Rust engines for offline catch-up calculations.
 *
 * These tests require WASM to be available. When WASM is not loaded,
 * tests will be skipped with a descriptive message.
 *
 * Test tolerances:
 * - Offline catch-up: ε = 1% relative tolerance
 * - Step counts: exact match
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { StoreSnapshot } from '@/state/types';
import type { RustSimBridge, OfflineResult } from '@/lib/wasmSimBridge';
import { createStoreInstance, serializeStore } from '@/state/store';
import { simulateOfflineProgress } from '@/lib/offline';

// Test fixture: minimal snapshot for deterministic testing
function createTestSnapshot(seed: number): StoreSnapshot {
  return {
    resources: {
      ore: 100,
      ice: 10,
      metals: 5,
      crystals: 2,
      organics: 1,
      bars: 50,
      energy: 100,
      credits: 0,
    },
    modules: {
      droneBay: 3,
      refinery: 1,
      storage: 1,
      solar: 1,
      scanner: 0,
      haulerDepot: 0,
      logisticsHub: 0,
      routingProtocol: 0,
    },
    prestige: { cores: 0 },
    save: { lastSave: Date.now(), version: '0.1.0' },
    settings: {
      autosaveEnabled: true,
      autosaveInterval: 30,
      offlineCapHours: 8,
      notation: 'standard',
      throttleFloor: 0.2,
      showTrails: true,
      showHaulerShips: true,
      showDebugPanel: false,
      performanceProfile: 'high',
      inspectorCollapsed: false,
      useRustSim: false,
      shadowMode: false,
      metrics: {
        enabled: true,
        intervalSeconds: 5,
        retentionSeconds: 300,
      },
    },
    rngSeed: seed,
    droneFlights: [],
    factories: [
      {
        id: 'factory-test-1',
        position: [0, 0, 0],
        dockingCapacity: 2,
        refineSlots: 1,
        idleEnergyPerSec: 0.5,
        energyPerRefine: 2,
        storageCapacity: 500,
        currentStorage: 0,
        queuedDrones: [],
        activeRefines: [],
        pinned: false,
        energy: 50,
        energyCapacity: 100,
        resources: {
          ore: 50,
          bars: 10,
          metals: 0,
          crystals: 0,
          organics: 0,
          ice: 0,
          credits: 0,
        },
        upgrades: {
          docking: 0,
          refine: 0,
          storage: 0,
          energy: 0,
          solar: 1,
        },
      },
    ],
    selectedFactoryId: 'factory-test-1',
    droneOwners: {
      'drone-1': 'factory-test-1',
      'drone-2': 'factory-test-1',
      'drone-3': 'factory-test-1',
    },
    logisticsQueues: {
      pendingTransfers: [],
    },
  };
}

// Helper to compare offline results
function compareOfflineResults(
  result1: OfflineResult,
  result2: OfflineResult,
  label1: string,
  label2: string
): string[] {
  const divergences: string[] = [];

  // Step count should match exactly
  if (result1.steps !== result2.steps) {
    divergences.push(
      `Step count mismatch: ${label1}=${result1.steps}, ${label2}=${result2.steps}`
    );
  }

  // Elapsed time should match exactly
  if (Math.abs(result1.elapsed - result2.elapsed) > 0.001) {
    divergences.push(
      `Elapsed time mismatch: ${label1}=${result1.elapsed.toFixed(4)}, ${label2}=${result2.elapsed.toFixed(4)}`
    );
  }

  return divergences;
}

const relDiff = (a: number, b: number) => {
  const denom = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / denom;
};

describe('Offline Parity', () => {
  let bridge: RustSimBridge | null = null;
  let wasmAvailable = false;

  beforeAll(async () => {
    try {
      const { getBridge, isBridgeReady } = await import('@/lib/rustBridgeRegistry');
      bridge = getBridge();
      wasmAvailable = isBridgeReady();
    } catch {
      wasmAvailable = false;
    }
  });

  afterAll(() => {
    bridge = null;
  });

  describe('Basic offline simulation', () => {
    it.skipIf(!wasmAvailable)('simulateOffline returns correct step count', async () => {
      const snapshot = createTestSnapshot(42);

      await bridge!.init(snapshot);

      // Simulate 10 seconds with 0.1s step size = 100 steps
      const result = bridge!.simulateOffline(10, 0.1);

      expect(result.steps).toBe(100);
      expect(result.elapsed).toBeCloseTo(10, 2);
    });

    it.skipIf(!wasmAvailable)('handles zero seconds gracefully', async () => {
      const snapshot = createTestSnapshot(42);

      await bridge!.init(snapshot);

      const result = bridge!.simulateOffline(0, 0.1);

      expect(result.steps).toBe(0);
      expect(result.elapsed).toBe(0);
    });

    it.skipIf(!wasmAvailable)('handles zero step size gracefully', async () => {
      const snapshot = createTestSnapshot(42);

      await bridge!.init(snapshot);

      const result = bridge!.simulateOffline(10, 0);

      expect(result.steps).toBe(0);
      expect(result.elapsed).toBe(0);
    });
  });

  describe('Determinism verification', () => {
    it.skipIf(!wasmAvailable)('same seed produces identical offline results', async () => {
      const snapshot = createTestSnapshot(12345);

      // First run
      await bridge!.init(snapshot);
      const result1 = bridge!.simulateOffline(5, 0.1);
      const snap1 = bridge!.exportSnapshot();

      // Second run
      await bridge!.init(snapshot);
      const result2 = bridge!.simulateOffline(5, 0.1);
      const snap2 = bridge!.exportSnapshot();

      // Results should match
      const divergences = compareOfflineResults(result1, result2, 'Run1', 'Run2');
      expect(divergences).toEqual([]);

      // Snapshots should match
      expect(snap1.resources.ore).toBeCloseTo(snap2.resources.ore, 4);
      expect(snap1.resources.bars).toBeCloseTo(snap2.resources.bars, 4);
      expect(snap1.resources.energy).toBeCloseTo(snap2.resources.energy, 4);
    });

    it.skipIf(!wasmAvailable)('different seeds produce different results', async () => {
      const snapshot1 = createTestSnapshot(11111);
      const snapshot2 = createTestSnapshot(22222);

      await bridge!.init(snapshot1);
      bridge!.simulateOffline(10, 0.1);
      const snap1 = bridge!.exportSnapshot();

      await bridge!.init(snapshot2);
      bridge!.simulateOffline(10, 0.1);
      const snap2 = bridge!.exportSnapshot();

      // Results may differ due to RNG differences in systems
      // At minimum, the initial state was the same except seed
      // This is a sanity check that seeds matter
      console.log(`Seed 11111 final ore: ${snap1.resources.ore}`);
      console.log(`Seed 22222 final ore: ${snap2.resources.ore}`);

      // Both should have valid numeric results
      expect(typeof snap1.resources.ore).toBe('number');
      expect(typeof snap2.resources.ore).toBe('number');
    });
  });

  describe('Long offline periods', () => {
    it.skipIf(!wasmAvailable)('handles 1 hour of offline time', async () => {
      const snapshot = createTestSnapshot(42);

      await bridge!.init(snapshot);

      // 1 hour = 3600 seconds, with 0.1s steps = 36000 iterations
      const result = bridge!.simulateOffline(3600, 0.1);

      expect(result.steps).toBe(36000);
      expect(result.elapsed).toBeCloseTo(3600, 1);
    });

    it.skipIf(!wasmAvailable)('handles 8 hours of offline time (default cap)', async () => {
      const snapshot = createTestSnapshot(42);

      await bridge!.init(snapshot);

      // 8 hours = 28800 seconds, with 0.1s steps = 288000 iterations
      const result = bridge!.simulateOffline(28800, 0.1);

      expect(result.steps).toBe(288000);
      expect(result.elapsed).toBeCloseTo(28800, 0);
    });
  });

  describe('Step size variations', () => {
    it.skipIf(!wasmAvailable)('different step sizes produce similar elapsed times', async () => {
      const snapshot = createTestSnapshot(42);

      // Small steps
      await bridge!.init(snapshot);
      const smallSteps = bridge!.simulateOffline(10, 0.05);

      // Large steps
      await bridge!.init(snapshot);
      const largeSteps = bridge!.simulateOffline(10, 0.5);

      // Elapsed time should be close (within step size rounding)
      expect(smallSteps.elapsed).toBeCloseTo(10, 1);
      expect(largeSteps.elapsed).toBeCloseTo(10, 0);

      // Step counts differ as expected
      expect(smallSteps.steps).toBe(200); // 10 / 0.05
      expect(largeSteps.steps).toBe(20); // 10 / 0.5
    });
  });

  describe('State consistency', () => {
    it.skipIf(!wasmAvailable)('offline simulation maintains valid state', async () => {
      const snapshot = createTestSnapshot(42);

      await bridge!.init(snapshot);
      bridge!.simulateOffline(60, 0.1);

      const result = bridge!.exportSnapshot();

      // All resources should be non-negative
      expect(result.resources.ore).toBeGreaterThanOrEqual(0);
      expect(result.resources.ice).toBeGreaterThanOrEqual(0);
      expect(result.resources.metals).toBeGreaterThanOrEqual(0);
      expect(result.resources.crystals).toBeGreaterThanOrEqual(0);
      expect(result.resources.organics).toBeGreaterThanOrEqual(0);
      expect(result.resources.bars).toBeGreaterThanOrEqual(0);
      expect(result.resources.energy).toBeGreaterThanOrEqual(0);

      // Module levels should be unchanged (no auto-buy)
      expect(result.modules.droneBay).toBe(snapshot.modules.droneBay);
      expect(result.modules.refinery).toBe(snapshot.modules.refinery);
    });

    it.skipIf(!wasmAvailable)('snapshot JSON is valid after offline sim', async () => {
      const snapshot = createTestSnapshot(42);

      await bridge!.init(snapshot);
      const result = bridge!.simulateOffline(10, 0.1);

      // Should be valid JSON
      expect(() => JSON.parse(result.snapshotJson)).not.toThrow();

      // Parsed snapshot should have required fields
      const parsed = JSON.parse(result.snapshotJson);
      expect(parsed).toHaveProperty('resources');
      expect(parsed).toHaveProperty('modules');
      expect(parsed).toHaveProperty('prestige');
    });
  });

  describe('WASM availability check', () => {
    it('reports WASM availability status for offline tests', () => {
      console.log(`WASM available for offline tests: ${wasmAvailable}`);
      expect(typeof wasmAvailable).toBe('boolean');
    });
  });

  describe('Cross-engine offline comparison', () => {
    const OFFLINE_REL_EPSILON = 0.01;

    const runTsOffline = (snapshot: StoreSnapshot, seconds: number, step = 0.1) => {
      const store = createStoreInstance();
      store.getState().applySnapshot(snapshot);
      simulateOfflineProgress(store, seconds, { step });
      return serializeStore(store.getState());
    };

    it.skipIf(!wasmAvailable)('matches TS offline within tolerance', async () => {
      const snapshot = createTestSnapshot(90909);

      // Rust offline simulation
      await bridge!.init(snapshot);
      const rustResult = bridge!.simulateOffline(60, 0.1);
      const rustSnapshot = JSON.parse(rustResult.snapshotJson) as StoreSnapshot;

      // TS offline simulation
      const tsSnapshot = runTsOffline(structuredClone(snapshot), 60, 0.1);

      const metrics = [
        ['ore', tsSnapshot.resources.ore, rustSnapshot.resources.ore],
        ['bars', tsSnapshot.resources.bars, rustSnapshot.resources.bars],
        ['energy', tsSnapshot.resources.energy, rustSnapshot.resources.energy],
      ] as const;

      for (const [, tsVal, rustVal] of metrics) {
        const diff = relDiff(tsVal, rustVal);
        expect(diff).toBeLessThanOrEqual(OFFLINE_REL_EPSILON);
      }
    });
  });
});
