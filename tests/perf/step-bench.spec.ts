import { describe, it, expect, beforeAll } from 'vitest';
import type { StoreSnapshot } from '@/state/types';
import { createParityContext } from '../unit/parity-helpers';
import { loadWasmBridge } from '@/lib/wasmLoader';
import { registerBridge } from '@/lib/rustBridgeRegistry';
import { SCHEMA_VERSION, saveVersion } from '@/state/store';

const ITERATIONS = 100;

function createBenchSnapshot(seed: number): StoreSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    resources: {
      ore: 200,
      ice: 50,
      metals: 10,
      crystals: 5,
      organics: 2,
      bars: 100,
      energy: 150,
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
    save: { lastSave: Date.now(), version: saveVersion },
    settings: {
      autosaveEnabled: false,
      autosaveInterval: 30,
      offlineCapHours: 8,
      notation: 'standard',
      throttleFloor: 0.2,
      showTrails: true,
      showHaulerShips: true,
      showDebugPanel: false,
      useRustSim: false,
      shadowMode: false,
      performanceProfile: 'high',
      inspectorCollapsed: false,
      metrics: { enabled: false, intervalSeconds: 5, retentionSeconds: 300 },
    },
    rngSeed: seed,
    droneFlights: [],
    factories: [
      {
        id: 'factory-bench',
        position: [0, 0, 0],
        dockingCapacity: 2,
        refineSlots: 1,
        idleEnergyPerSec: 0.5,
        energyPerRefine: 2,
        storageCapacity: 400,
        currentStorage: 0,
        queuedDrones: [],
        activeRefines: [],
        pinned: false,
        energy: 80,
        energyCapacity: 120,
        resources: {
          ore: 80,
          bars: 10,
          metals: 0,
          crystals: 0,
          organics: 0,
          ice: 0,
          credits: 0,
        },
        upgrades: { docking: 0, refine: 0, storage: 0, energy: 0, solar: 1 },
        haulersAssigned: 0,
      },
    ],
    selectedFactoryId: 'factory-bench',
    droneOwners: {},
    logisticsQueues: { pendingTransfers: [] },
    gameTime: 0,
  };
}

describe('Step performance benchmark', () => {
  let wasmReady = false;
  let bridge: Awaited<ReturnType<typeof loadWasmBridge>>['bridge'] = null;

  beforeAll(async () => {
    const result = await loadWasmBridge(createBenchSnapshot(1));
    if (result.bridge) {
      bridge = result.bridge;
      registerBridge(result.bridge);
      wasmReady = true;
    }
  });

  it('measures TypeScript step throughput', () => {
    const snapshot = createBenchSnapshot(1234);
    const context = createParityContext(snapshot);

    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i += 1) {
      context.step(0.1);
    }
    const elapsedMs = performance.now() - start;

    expect(Number.isFinite(elapsedMs)).toBe(true);
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
    console.info(`TS step x${ITERATIONS} took ${elapsedMs.toFixed(2)}ms`);
  });

  it.skipIf(!wasmReady)('measures Rust step throughput', async () => {
    const snapshot = createBenchSnapshot(5678);
    await bridge!.init(snapshot);

    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i += 1) {
      bridge!.step(0.1);
    }
    const elapsedMs = performance.now() - start;

    expect(Number.isFinite(elapsedMs)).toBe(true);
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
    console.info(`Rust step x${ITERATIONS} took ${elapsedMs.toFixed(2)}ms`);
  });
});
