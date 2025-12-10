/**
 * Step Parity Test Suite
 *
 * Validates that running N simulation steps with identical initial state
 * produces matching economic outcomes between TypeScript and Rust engines.
 *
 * These tests require WASM to be available. When WASM is not loaded,
 * tests will be skipped with a descriptive message.
 */

import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { StoreSnapshot } from '@/state/types';
import type { RustSimBridge } from '@/lib/wasmSimBridge';
import { createParityContext } from './parity-helpers';
import { serializeStore } from '@/state/store';
import { loadWasmBridge } from '@/lib/wasmLoader';
import { registerBridge } from '@/lib/rustBridgeRegistry';

// Mock the WASM module loader to load from disk in Node environment
vi.mock('@/gen/rust_engine', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@/gen/rust_engine')>();
  return {
    ...actual,
    default: async () => {
      // eslint-disable-next-line no-undef
      const wasmPath = path.resolve(process.cwd(), 'src/gen/rust_engine_bg.wasm');
      const buffer = fs.readFileSync(wasmPath);
      return actual.default(buffer);
    },
  };
});

// Constants for parity testing
const RESOURCE_EPSILON = 0.05;

// Test fixture: minimal snapshot for deterministic testing
function createTestSnapshot(seed: number): StoreSnapshot {
  return {
    resources: {
      ore: 100, // Re-enable global ore
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
      refinery: 1, // Re-enable global refinery
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
        id: 'factory-1', // Matches resetEntityIdCounter() -> nextId('factory')
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
    selectedFactoryId: 'factory-1',
    droneOwners: {},
    logisticsQueues: {
      pendingTransfers: [],
    },
  };
}

// Helper to check if two values are within epsilon
function withinEpsilon(a: number, b: number, epsilon: number): boolean {
  return Math.abs(a - b) <= epsilon;
}

// Helper to compare resource objects
function compareResources(
  tsResources: Partial<StoreSnapshot['resources']> | undefined,
  rustResources: Partial<StoreSnapshot['resources']> | undefined,
  epsilon: number
): string[] {
  const divergences: string[] = [];
  if (!tsResources || !rustResources) {
      if (!tsResources) divergences.push('TS Resources undefined');
      if (!rustResources) divergences.push('Rust Resources undefined');
      return divergences;
  }

  const keys: (keyof StoreSnapshot['resources'])[] = [
    'ore', 'ice', 'metals', 'crystals', 'organics', 'bars', 'energy', 'credits',
  ];

  for (const key of keys) {
    const tsVal = tsResources[key];
    const rustVal = rustResources[key];

    // Skip if either is undefined (e.g. factory resources don't have energy)
    if (typeof tsVal !== 'number' || typeof rustVal !== 'number') {
        continue;
    }

    if (!withinEpsilon(tsVal, rustVal, epsilon)) {
      divergences.push(
        `Resource ${key} diverged: TS=${tsVal.toFixed(4)}, Rust=${rustVal.toFixed(4)}, diff=${Math.abs(tsVal - rustVal).toFixed(6)}`
      );
    }
  }
  return divergences;
}

// Helper to compare module counts
function compareModules(
  tsModules: StoreSnapshot['modules'],
  rustModules: StoreSnapshot['modules']
): string[] {
  const divergences: string[] = [];
  const keys: (keyof StoreSnapshot['modules'])[] = [
    'droneBay', 'refinery', 'storage', 'solar', 'scanner',
    'haulerDepot', 'logisticsHub', 'routingProtocol',
  ];

  for (const key of keys) {
    if (tsModules[key] !== rustModules[key]) {
      divergences.push(
        `Module ${key} diverged: TS=${tsModules[key]}, Rust=${rustModules[key]}`
      );
    }
  }
  return divergences;
}

describe('Step Parity', () => {
  let bridge: RustSimBridge | null = null;

  beforeAll(async () => {
    try {
      // Manually load the bridge using our mock-enabled loader
      const snapshot = createTestSnapshot(1);
      const result = await loadWasmBridge(snapshot);
      if (result.bridge) {
        bridge = result.bridge;
        registerBridge(bridge);
        console.log('WASM Bridge loaded successfully');
      } else {
        console.warn('WASM Bridge failed to load:', result.fallbackReason);
      }
    } catch (err) {
      console.error('Error loading WASM bridge:', err);
    }
  });

  afterAll(() => {
    bridge = null;
  });

  describe('Single step parity', () => {
    it('produces matching resources after 1 step', async () => {
      const snapshot = createTestSnapshot(42);

      // Setup TS environment
      const tsContext = createParityContext(snapshot);

      // Setup Rust environment
      await bridge!.init(snapshot);

      // Run one step in both
      const dt = 0.1;
      tsContext.step(dt);
      bridge!.step(dt);

      // Compare
      const tsSnapshot = serializeStore(tsContext.store.getState());
      const rustSnapshot = bridge!.exportSnapshot();

      const resourceDivergences = compareResources(
        tsSnapshot.resources,
        rustSnapshot.resources,
        RESOURCE_EPSILON
      );
      if (resourceDivergences.length > 0) {
        console.error('Resource Divergences:', resourceDivergences);
      }
      expect(resourceDivergences).toEqual([]);
    });

    it('produces matching factory resources after 1 step', async () => {
        const snapshot = createTestSnapshot(42);
        const tsContext = createParityContext(snapshot);
        await bridge!.init(snapshot);

        const dt = 0.1;
        tsContext.step(dt);
        bridge!.step(dt);

        const tsSnapshot = serializeStore(tsContext.store.getState());
        const rustSnapshot = bridge!.exportSnapshot();

        // Check factory resources
        const tsFactory = tsSnapshot.factories![0];
        const rustFactory = rustSnapshot.factories![0];

        const divergences = compareResources(
          tsFactory.resources as unknown as Partial<StoreSnapshot['resources']>,
          rustFactory.resources as unknown as Partial<StoreSnapshot['resources']>,
          RESOURCE_EPSILON
        );
        if (divergences.length > 0) {
          console.error('Factory Resource Divergences:', divergences);
        }
        expect(divergences).toEqual([]);
    });
  });

  describe('Multi-step parity', () => {
    it('maintains parity over 60 steps (6 seconds)', async () => {
      const snapshot = createTestSnapshot(12345);

      const tsContext = createParityContext(snapshot);
      await bridge!.init(snapshot);

      // Run 60 steps
      const dt = 0.1;
      for (let i = 0; i < 60; i++) {
        tsContext.step(dt);
        bridge!.step(dt);
      }

      const tsSnapshot = serializeStore(tsContext.store.getState());
      const rustSnapshot = bridge!.exportSnapshot();

      const resourceDivergences = compareResources(
        tsSnapshot.resources,
        rustSnapshot.resources,
        RESOURCE_EPSILON
      );
      if (resourceDivergences.length > 0) {
          console.error('Resource Divergences (60 steps):', resourceDivergences);
      }
      expect(resourceDivergences).toEqual([]);

      // Also check modules haven't drifted (unlikely but good sanity check)
      const moduleDivergences = compareModules(tsSnapshot.modules, rustSnapshot.modules);
      expect(moduleDivergences).toEqual([]);
    });
  });
});
