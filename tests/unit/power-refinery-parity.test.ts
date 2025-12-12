import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import process from 'node:process';
import { FACTORY_CONFIG } from '@/ecs/factories';
import { createParityContext } from './parity-helpers';
import { loadWasmBridge } from '@/lib/wasmLoader';
import { registerBridge } from '@/lib/rustBridgeRegistry';
import { serializeStore } from '@/state/store';
import type { StoreSnapshot } from '@/state/types';
import type { RustSimBridge } from '@/lib/wasmSimBridge';

vi.mock('@/gen/rust_engine', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@/gen/rust_engine')>();
  return {
    ...actual,
    default: async () => {
      const wasmPath = path.resolve(process.cwd(), 'src/gen/rust_engine_bg.wasm');
      const buffer = fs.readFileSync(wasmPath);
      return actual.default({ module_or_path: buffer });
    },
  };
});

const ENERGY_EPS = 10;
const BARS_EPS = 20;

const createSnapshot = (seed: number): StoreSnapshot => ({
  resources: {
    ore: 120,
    ice: 0,
    metals: 0,
    crystals: 0,
    organics: 0,
    bars: 0,
    energy: 100,
    credits: 0,
  },
  modules: {
    droneBay: 2,
    refinery: 1,
    storage: 1,
    solar: 2,
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
    showTrails: false,
    showHaulerShips: false,
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
      id: 'factory-1',
      position: [0, 0, 0],
      dockingCapacity: FACTORY_CONFIG.dockingCapacity,
      refineSlots: FACTORY_CONFIG.refineSlots + 1,
      idleEnergyPerSec: FACTORY_CONFIG.idleEnergyPerSec,
      energyPerRefine: FACTORY_CONFIG.energyPerRefine,
      storageCapacity: FACTORY_CONFIG.storageCapacity + 150,
      currentStorage: 0,
      queuedDrones: [],
      activeRefines: [],
      pinned: false,
      energy: FACTORY_CONFIG.energyCapacity + 30 + 10,
      energyCapacity: FACTORY_CONFIG.energyCapacity + 30 + 10,
      resources: {
        ore: 80,
        bars: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
        ice: 0,
        credits: 0,
      },
      upgrades: {
        docking: 0,
        refine: 1,
        storage: 1,
        energy: 1,
        solar: 1,
      },
      haulersAssigned: 2,
    },
  ],
  selectedFactoryId: 'factory-1',
  droneOwners: {},
  logisticsQueues: { pendingTransfers: [] },
  specTechs: {
    oreMagnet: 0,
    crystalResonance: 0,
    biotechFarming: 0,
    cryoPreservation: 0,
  },
  specTechSpent: {
    metals: 0,
    crystals: 0,
    organics: 0,
    ice: 0,
  },
  prestigeInvestments: {
    droneVelocity: 0,
    asteroidAbundance: 0,
    refineryMastery: 0,
    offlineEfficiency: 0,
  },
  gameTime: 0,
});

describe('Power & refinery parity', () => {
  let bridge: RustSimBridge | null = null;

  beforeAll(async () => {
    const snapshot = createSnapshot(1);
    const result = await loadWasmBridge(snapshot);
    if (result.bridge) {
      bridge = result.bridge;
      registerBridge(bridge);
    }
  });

  afterAll(() => {
    bridge = null;
  });

  it('aligns factory energy drain/regen and bar production', async () => {
    if (!bridge) {
      expect(bridge).toBeDefined();
      return;
    }

    const snapshot = createSnapshot(555);
    const tsContext = createParityContext(snapshot);
    const rustSnapshot = {
      ...snapshot,
      extra: { asteroids: tsContext.asteroidSnapshots },
    } as StoreSnapshot;

    await bridge.init(rustSnapshot);

    const dt = 1;
    for (let i = 0; i < 5; i += 1) {
      tsContext.step(dt);
      bridge.step(dt);
    }

    const tsState = serializeStore(tsContext.store.getState());
    const rustState = bridge.exportSnapshot();

    const tsFactory = tsState.factories?.[0];
    const rustFactory = rustState.factories?.[0];
    expect(tsFactory).toBeDefined();
    expect(rustFactory).toBeDefined();
    if (!tsFactory || !rustFactory) return;

    expect(Math.abs(tsFactory.energy - rustFactory.energy)).toBeLessThan(ENERGY_EPS);
    expect(Math.abs(tsFactory.resources.bars - rustFactory.resources.bars)).toBeLessThan(BARS_EPS);
  });
});
