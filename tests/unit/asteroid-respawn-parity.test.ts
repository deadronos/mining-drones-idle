import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import process from 'node:process';
import type { StoreSnapshot } from '@/state/types';
import type { RustSimBridge } from '@/lib/wasmSimBridge';
import { createAsteroid } from '@/ecs/world';
import { createRng } from '@/lib/rng';
import { getSinkBonuses } from '@/state/sinks';
import { loadWasmBridge } from '@/lib/wasmLoader';
import { registerBridge } from '@/lib/rustBridgeRegistry';
import { FACTORY_CONFIG } from '@/ecs/factories';

// Mock the WASM module loader to load from disk in Node environment
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

const ASTEROID_RNG_CALLS_PER_SPAWN = 11;

const burnRngForAsteroids = (rng: ReturnType<typeof createRng>, count: number) => {
  for (let i = 0; i < count; i += 1) {
    for (let j = 0; j < ASTEROID_RNG_CALLS_PER_SPAWN; j += 1) {
      rng.next();
    }
  }
};

const createRespawnSnapshot = (
  seed: number,
  scannerLevel: number
): StoreSnapshot & {
  specTechs: NonNullable<StoreSnapshot['specTechs']>;
  prestigeInvestments: NonNullable<StoreSnapshot['prestigeInvestments']>;
  extra: { asteroids: Array<Record<string, unknown>> };
} => ({
  resources: {
    ore: 0,
    ice: 0,
    metals: 0,
    crystals: 0,
    organics: 0,
    bars: 0,
    energy: 100,
    credits: 0,
  },
  modules: {
    droneBay: 1,
    refinery: 0,
    storage: 0,
    solar: 0,
    scanner: scannerLevel,
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
      refineSlots: FACTORY_CONFIG.refineSlots,
      idleEnergyPerSec: FACTORY_CONFIG.idleEnergyPerSec,
      energyPerRefine: FACTORY_CONFIG.energyPerRefine,
      storageCapacity: FACTORY_CONFIG.storageCapacity,
      currentStorage: 0,
      queuedDrones: [],
      activeRefines: [],
      pinned: false,
      energy: FACTORY_CONFIG.initialEnergy,
      energyCapacity: FACTORY_CONFIG.energyCapacity,
      resources: {
        ore: 0,
        bars: 0,
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
        solar: 0,
      },
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
  extra: {
    asteroids: [
      {
        id: 'asteroid-1',
        position: [0, 0, 0],
        oreRemaining: 0,
        maxOre: 80,
        resourceProfile: { ore: 1, ice: 0, metals: 0, crystals: 0, organics: 0 },
      },
    ],
  },
});

describe('Asteroid respawn parity', () => {
  let bridge: RustSimBridge | null = null;

  beforeAll(async () => {
    const snapshot = createRespawnSnapshot(1, 0);
    const result = await loadWasmBridge(snapshot);
    if (result.bridge) {
      bridge = result.bridge;
      registerBridge(bridge);
    }
  });

  afterAll(() => {
    bridge = null;
  });

  it('respawns with biome-driven resource profiles matching TS createAsteroid', async () => {
    if (!bridge) {
      expect(bridge).toBeDefined();
      return;
    }

    const seed = 1337;
    const scannerLevel = 2;
    const snapshot = createRespawnSnapshot(seed, scannerLevel);
    const sinkBonuses = getSinkBonuses({
      specTechs: snapshot.specTechs,
      prestigeInvestments: snapshot.prestigeInvestments,
    });

    const rng = createRng(seed);
    burnRngForAsteroids(rng, snapshot.extra.asteroids.length);
    const expected = createAsteroid(scannerLevel, rng, {
      richnessMultiplier: sinkBonuses.asteroidRichnessMultiplier,
    });

    await bridge.init(snapshot);
    bridge.step(0.1);
    type AsteroidSnapshot = {
      oreRemaining?: number;
      maxOre?: number;
      resourceProfile?: {
        ore: number;
        ice: number;
        metals: number;
        crystals: number;
        organics: number;
      };
    };

    const rustSnapshot = bridge.exportSnapshot() as StoreSnapshot & {
      extra?: { asteroids?: AsteroidSnapshot[] };
    };
    const rustAsteroid = rustSnapshot.extra?.asteroids?.[0];
    expect(rustAsteroid).toBeDefined();
    if (!rustAsteroid) return;

    expect(rustAsteroid.oreRemaining).toBeCloseTo(expected.oreRemaining, 4);
    expect(rustAsteroid.maxOre).toBeCloseTo(expected.oreRemaining, 4);

    const rustProfile = rustAsteroid.resourceProfile;
    expect(rustProfile).toBeDefined();
    if (!rustProfile) return;
    expect(rustProfile.ore).toBeCloseTo(expected.resourceProfile.ore, 4);
    expect(rustProfile.ice).toBeCloseTo(expected.resourceProfile.ice, 4);
    expect(rustProfile.metals).toBeCloseTo(expected.resourceProfile.metals, 4);
    expect(rustProfile.crystals).toBeCloseTo(expected.resourceProfile.crystals, 4);
    expect(rustProfile.organics).toBeCloseTo(expected.resourceProfile.organics, 4);
  });
});
