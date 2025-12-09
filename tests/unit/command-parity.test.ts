import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { StoreSnapshot } from '@/state/types';
import type { RustSimBridge } from '@/lib/wasmSimBridge';
import { loadWasmBridge } from '@/lib/wasmLoader';
import { registerBridge } from '@/lib/rustBridgeRegistry';

// Mock the WASM module loader
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

function createTestSnapshot(seed: number): StoreSnapshot {
  return {
    resources: {
      ore: 1000,
      ice: 100,
      metals: 100,
      crystals: 100,
      organics: 100,
      bars: 1000,
      energy: 100,
      credits: 0,
    },
    modules: {
      droneBay: 1,
      refinery: 1,
      storage: 1,
      solar: 1,
      scanner: 0,
      haulerDepot: 1,
      logisticsHub: 0,
      routingProtocol: 0,
    },
    prestige: { cores: 0 },
    save: { lastSave: Date.now(), version: '0.1.0' },
    settings: {
        autosaveEnabled: false,
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
        metrics: { enabled: false, intervalSeconds: 5, retentionSeconds: 300 }
    },
    rngSeed: seed,
    droneFlights: [],
    factories: [
      {
        id: 'factory-1',
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
        resources: { ore: 0, bars: 0, metals: 0, crystals: 0, organics: 0, ice: 0, credits: 0 },
        upgrades: { docking: 0, refine: 0, storage: 0, energy: 0, solar: 0 },
        haulersAssigned: 0
      },
    ],
    selectedFactoryId: 'factory-1',
    droneOwners: {},
    logisticsQueues: { pendingTransfers: [] },
  };
}

describe('Command Parity', () => {
  let bridge: RustSimBridge | null = null;

  beforeAll(async () => {
    try {
      const snapshot = createTestSnapshot(1);
      const result = await loadWasmBridge(snapshot);
      if (result.bridge) {
        bridge = result.bridge;
        registerBridge(bridge);
      }
    } catch (err) {
      console.error('Error loading WASM bridge:', err);
    }
  });

  afterAll(() => {
    bridge = null;
  });

  it('ApplyCommand: AssignHauler updates state', async () => {
    const snapshot = createTestSnapshot(101);
    await bridge!.init(snapshot);

    bridge!.applyCommand({
        type: 'AssignHauler',
        payload: { factoryId: 'factory-1', count: 1 }
    });

    const rustSnapshot = bridge!.exportSnapshot();
    if (!rustSnapshot.factories) throw new Error('Factories missing');
    const rustFactory = rustSnapshot.factories[0];

    if (rustFactory.haulersAssigned !== 1) {
        console.log('Rust Factory:', JSON.stringify(rustFactory, null, 2));
    }
    expect(rustFactory.haulersAssigned).toBe(1);
  });

  it('ApplyCommand: BuyModule updates state', async () => {
    const snapshot = createTestSnapshot(102);
    await bridge!.init(snapshot);

    const initialStorage = snapshot.modules.storage;
    bridge!.applyCommand({
        type: 'BuyModule',
        payload: { moduleType: 'storage', factoryId: undefined }
    });

    const rustSnapshot = bridge!.exportSnapshot();
    expect(rustSnapshot.modules.storage).toBe(initialStorage + 1);
    expect(rustSnapshot.resources.bars).toBeLessThan(snapshot.resources.bars);
  });

  it('ApplyCommand: PurchaseFactoryUpgrade updates state', async () => {
    const snapshot = createTestSnapshot(103);
    if (!snapshot.factories) throw new Error('Factories missing');
    snapshot.factories[0].resources.bars = 1000;
    await bridge!.init(snapshot);

    const initialLevel = snapshot.factories[0].upgrades.storage;
    bridge!.applyCommand({
        type: 'PurchaseFactoryUpgrade',
        payload: { factoryId: 'factory-1', upgradeType: 'storage' }
    });

    const rustSnapshot = bridge!.exportSnapshot();
    if (!rustSnapshot.factories) throw new Error('Factories missing');
    expect(rustSnapshot.factories[0].upgrades.storage).toBe(initialLevel + 1);
    expect(rustSnapshot.factories[0].resources.bars).toBeLessThan(snapshot.factories[0].resources.bars || 0);
  });
});
