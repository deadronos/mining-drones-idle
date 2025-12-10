import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import process from 'node:process';
import type { StoreSnapshot } from '@/state/types';
import { loadWasmBridge } from '@/lib/wasmLoader';

// Load the real WASM module from disk for integration tests
vi.mock('@/gen/rust_engine', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('@/gen/rust_engine');
  return {
    ...actual,
    default: async () => {
      const wasmPath = path.resolve(process.cwd(), 'src/gen/rust_engine_bg.wasm');
      const buffer = fs.readFileSync(wasmPath);
      return actual.default(buffer);
    },
  };
});

describe('WASM asteroid initialization', () => {
  it('initializes asteroid buffers from snapshot correctly', async () => {
    type AsteroidSnapshot = {
      id: string;
      position: [number, number, number];
      oreRemaining: number;
      maxOre: number;
      resourceProfile: { ore: number; ice: number; metals: number; crystals: number; organics: number };
    };

    type SnapshotWithAsteroids = StoreSnapshot & { asteroids: AsteroidSnapshot[] };

    const snapshot: SnapshotWithAsteroids = {
      resources: { ore: 0, ice: 0, metals: 0, crystals: 0, organics: 0, bars: 0, energy: 0, credits: 0 },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0, haulerDepot: 0, logisticsHub: 0, routingProtocol: 0 },
      prestige: { cores: 0 },
      save: { lastSave: Date.now(), version: 'test' },
      settings: { autosaveEnabled: false, autosaveInterval: 30, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.2, showTrails: false, showHaulerShips: false, showDebugPanel: false, performanceProfile: 'high', inspectorCollapsed: false, useRustSim: true, shadowMode: false, metrics: { enabled: false, intervalSeconds: 5, retentionSeconds: 300 } },
      rngSeed: 42,
      droneFlights: [],
      factories: [],
      selectedFactoryId: null,
      droneOwners: {},
      logisticsQueues: null,
      asteroids: [
          { id: 'a1', position: [10, 20, -5], oreRemaining: 100, maxOre: 100, resourceProfile: { ore: 1, ice: 0, metals: 0, crystals: 0, organics: 0 } },
          { id: 'a2', position: [-12.5, 4.2, 2.0], oreRemaining: 75, maxOre: 75, resourceProfile: { ore: 1, ice: 0, metals: 0, crystals: 0, organics: 0 } },
        ],
    };

    const res = await loadWasmBridge(snapshot);
    expect(res.bridge).not.toBeNull();
    const bridge = res.bridge!;

    // Layout should be non-empty
    const positions = bridge.getAsteroidPositions();
    const ore = bridge.getAsteroidOre();

    // Should have two asteroids -> positions length 6, ore length 2
    expect(positions.length).toBeGreaterThanOrEqual(6);
    expect(ore.length).toBeGreaterThanOrEqual(2);

    // Values should match the snapshot (first asteroid)
    expect(positions[0]).toBeCloseTo(10);
    expect(positions[1]).toBeCloseTo(20);
    expect(positions[2]).toBeCloseTo(-5);

    // After a step with no drones, positions should remain unchanged
    const before = Array.from(positions.slice(0, 3));
    bridge.step(0.1);
    const after = Array.from(bridge.getAsteroidPositions().slice(0, 3));
    expect(after).toEqual(before);
  });
});
