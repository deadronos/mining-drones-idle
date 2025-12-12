import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import process from 'node:process';
import { LOGISTICS_CONFIG } from '@/ecs/logistics';
import type { StoreSnapshot } from '@/state/types';
import { loadWasmBridge } from '@/lib/wasmLoader';
import { registerBridge } from '@/lib/rustBridgeRegistry';
import type { RustSimBridge } from '@/lib/wasmSimBridge';

// Mock the WASM module loader to load from disk in Node environment
vi.mock('@/gen/rust_engine', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@/gen/rust_engine')>();
  return {
    ...actual,
    default: async () => {
      const wasmPath = path.resolve(process.cwd(), 'src/gen/rust_engine_bg.wasm');
      const buffer = fs.readFileSync(wasmPath);
      return actual.default(buffer);
    },
  };
});

const createSnapshot = (seed: number) => ({
  resources: { ore: 0, ice: 0, metals: 0, crystals: 0, organics: 0, bars: 0, energy: 0, credits: 0 },
  modules: { droneBay: 0, refinery: 0, storage: 1, solar: 0, scanner: 0, haulerDepot: 0, logisticsHub: 0, routingProtocol: 0 },
  prestige: { cores: 0 },
  save: { lastSave: Date.now(), version: '0.1.0' },
  settings: { autosaveEnabled: true, autosaveInterval: 30, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.2, showTrails: false, showHaulerShips: false, showDebugPanel: false, performanceProfile: 'high', inspectorCollapsed: false, useRustSim: true, shadowMode: false, metrics: { enabled: false, intervalSeconds: 5, retentionSeconds: 300 } },
  rngSeed: seed,
  droneFlights: [],
  factories: [
    {
      id: 'factory-a', position: [0,0,0], dockingCapacity: 1, refineSlots: 0, idleEnergyPerSec:0, energyPerRefine: 0, storageCapacity: 1000, currentStorage: 0, queuedDrones: [], activeRefines: [], pinned: false, energy: 0, energyCapacity: 0,
      resources: { ore: 0, bars: 150, metals: 0, crystals: 0, organics: 0, ice: 0, credits: 0 },
      upgrades: { docking: 0, refine: 0, storage: 0, energy: 0, solar: 0 },
      upgradeRequests: [], haulersAssigned: 1, haulerConfig: { capacity: 50, speed: 1, pickupOverhead: 1, dropoffOverhead: 1, resourceFilters: [], mode: 'auto', priority: 5 }, haulerUpgrades: undefined, logisticsState: { outboundReservations: {}, inboundSchedules: [] },
    }
  ],
  selectedFactoryId: 'factory-a',
  droneOwners: {},
  logisticsQueues: { pendingTransfers: [] },
  specTechs: { oreMagnet: 0, crystalResonance: 0, biotechFarming: 0, cryoPreservation: 0 },
  specTechSpent: { metals: 0, crystals: 0, organics: 0, ice: 0 },
  prestigeInvestments: { droneVelocity: 0, asteroidAbundance: 0, refineryMastery: 0, offlineEfficiency: 0 },
  gameTime: 0,
  extra: { asteroids: [] }
});

describe('Rust bridge logistics warehouse behavior', () => {
  let bridge: RustSimBridge | null = null;

  beforeAll(async () => {
    const snapshot = createSnapshot(1);
    const res = await loadWasmBridge(snapshot as unknown as StoreSnapshot);
    if (res.bridge) {
      bridge = res.bridge;
      registerBridge(bridge);
    }
  });

  afterAll(() => {
    bridge = null;
  });

  it('schedules and completes a bars transfer to warehouse and increases global bars', async () => {
    if (!bridge) {
      expect(bridge).toBeDefined();
      return;
    }

    const snapshot = createSnapshot(42);
    await bridge.init(snapshot as unknown as StoreSnapshot);

    // Run scheduler
    bridge.step(LOGISTICS_CONFIG.scheduling_interval);

    const queues = bridge.getLogisticsQueues();
    const transfers = queues.pendingTransfers;
    expect(transfers.length).toBeGreaterThan(0);
    const toWh = transfers.find((t) => t.toFactoryId === 'warehouse');
    expect(toWh).toBeDefined();

    // Step forward to the ETA to complete
    const eta = toWh!.eta;
    bridge.step(eta + 0.1);
    const rustState = bridge.exportSnapshot();
    expect(rustState.resources.bars).toBeGreaterThan(0);
  });
});
