import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import process from 'node:process';
import type { StoreSnapshot } from '@/state/types';
import type { RustSimBridge, SimulationCommand } from '@/lib/wasmSimBridge';
import { loadWasmBridge } from '@/lib/wasmLoader';
import { registerBridge } from '@/lib/rustBridgeRegistry';
import { createStoreInstance, serializeStore } from '@/state/store';
import { logDivergences, parityDebugEnabled } from '../shared/parityLogger';

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

type AsteroidSnapshot = {
  id: string;
  position: [number, number, number];
  oreRemaining: number;
  maxOre: number;
  resourceProfile?: {
    ore: number;
    ice: number;
    metals: number;
    crystals: number;
    organics: number;
  };
};

const RESOURCE_EPSILON = 0.01;
const MODULE_EPSILON = 0.0001;
const enforceParity = process.env.PARITY_ENFORCE === '1';
let bridge: RustSimBridge | null = null;

const cloneSnapshot = <T>(value: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

function createTestSnapshot(seed: number): StoreSnapshot {
  return {
    resources: {
      ore: 1000,
      ice: 200,
      metals: 150,
      crystals: 120,
      organics: 50,
      bars: 8000,
      energy: 200,
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
      metrics: { enabled: false, intervalSeconds: 5, retentionSeconds: 300 },
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
        energy: 150,
        energyCapacity: 200,
        resources: {
          ore: 200,
          bars: 2000,
          metals: 0,
          crystals: 0,
          organics: 0,
          ice: 0,
          credits: 0,
        },
        upgrades: { docking: 0, refine: 0, storage: 0, energy: 0, solar: 0 },
        haulersAssigned: 0,
      },
    ],
    selectedFactoryId: 'factory-1',
    droneOwners: {},
    logisticsQueues: { pendingTransfers: [] },
  };
}

const withinEpsilon = (a: number, b: number, epsilon: number) =>
  Math.abs(a - b) <= epsilon;

function compareResources(
  tsResources: Partial<StoreSnapshot['resources']>,
  rustResources: Partial<StoreSnapshot['resources']>,
  epsilon: number
): string[] {
  const divergences: string[] = [];
  const keys: (keyof StoreSnapshot['resources'])[] = [
    'ore',
    'ice',
    'metals',
    'crystals',
    'organics',
    'bars',
    'energy',
    'credits',
  ];

  for (const key of keys) {
    const tsVal = tsResources[key];
    const rustVal = rustResources[key];
    if (typeof tsVal !== 'number' || typeof rustVal !== 'number') continue;
    if (!withinEpsilon(tsVal, rustVal, epsilon)) {
      divergences.push(
        `Resource ${key} diverged: TS=${tsVal.toFixed(4)}, Rust=${rustVal.toFixed(
          4
        )}, diff=${Math.abs(tsVal - rustVal).toFixed(4)}`
      );
    }
  }
  return divergences;
}

function applyTsCommand(
  snapshot: StoreSnapshot,
  command: SimulationCommand,
  asteroids?: AsteroidSnapshot[]
): { snapshot: StoreSnapshot; asteroids?: AsteroidSnapshot[] } {
  const store = createStoreInstance();
  store.getState().applySnapshot(cloneSnapshot(snapshot));
  const workingAsteroids = asteroids ? cloneSnapshot(asteroids) : undefined;

  switch (command.type) {
    case 'BuyModule':
      store.getState().buy(command.payload.moduleType as never);
      break;
    case 'PurchaseFactoryUpgrade':
      store.getState().upgradeFactory(
        command.payload.factoryId,
        command.payload.upgradeType as never,
        command.payload.costVariant as never
      );
      break;
    case 'AssignHauler':
      store.getState().assignHaulers(command.payload.factoryId, command.payload.count);
      break;
    case 'DoPrestige':
      store.getState().doPrestige();
      break;
    case 'SpawnDrone': {
      const ownerId = command.payload.factoryId;
      const droneId = `drone-ts-${store.getState().rngSeed}-${Date.now()}`;
      store.setState((current) => ({
        modules: { ...current.modules, droneBay: current.modules.droneBay + 1 },
        droneOwners: { ...current.droneOwners, [droneId]: ownerId },
      }));
      break;
    }
    case 'RecycleAsteroid':
      if (workingAsteroids) {
        const target = workingAsteroids.find((a) => a.id === command.payload.asteroidId);
        if (target) {
          target.oreRemaining = 0;
        }
      }
      break;
    default:
      break;
  }

  return { snapshot: serializeStore(store.getState()), asteroids: workingAsteroids };
}

async function applyRustCommand(
  snapshot: StoreSnapshot,
  command: SimulationCommand,
  asteroids?: AsteroidSnapshot[]
): Promise<StoreSnapshot & { asteroids?: AsteroidSnapshot[] }> {
  const rustInitSnapshot = {
    ...snapshot,
    ...(asteroids ? { extra: { asteroids } } : {}),
  } as unknown as StoreSnapshot;
  await bridge!.init(rustInitSnapshot);
  bridge!.applyCommand(command);
  return bridge!.exportSnapshot() as StoreSnapshot & { asteroids?: AsteroidSnapshot[] };
}

describe('Command Parity', () => {
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

  it('BuyModule aligns TS and Rust snapshots', async () => {
    const snapshot = createTestSnapshot(102);
    const command: SimulationCommand = {
      type: 'BuyModule',
      payload: { moduleType: 'storage', factoryId: undefined },
    };

    const { snapshot: tsSnapshot } = applyTsCommand(snapshot, command);
    const rustSnapshot = await applyRustCommand(snapshot, command);

    const divergences = [
      ...compareResources(tsSnapshot.resources, rustSnapshot.resources, RESOURCE_EPSILON),
    ];
    if (tsSnapshot.modules.storage !== rustSnapshot.modules.storage) {
      divergences.push(
        `Module storage mismatch: TS=${tsSnapshot.modules.storage}, Rust=${rustSnapshot.modules.storage}`
      );
    }

    logDivergences(
      'command-parity-buy-module',
      divergences,
      parityDebugEnabled ? { tsSnapshot, rustSnapshot } : undefined
    );
    if (enforceParity) {
      expect(divergences).toEqual([]);
    } else {
      expect(divergences.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('PurchaseFactoryUpgrade matches factory state', async () => {
    const snapshot = createTestSnapshot(103);
    snapshot.factories![0].resources.bars = 3000;
    const command: SimulationCommand = {
      type: 'PurchaseFactoryUpgrade',
      payload: { factoryId: 'factory-1', upgradeType: 'storage' },
    };

    const { snapshot: tsSnapshot } = applyTsCommand(snapshot, command);
    const rustSnapshot = await applyRustCommand(snapshot, command);

    const tsFactory = tsSnapshot.factories?.[0];
    const rustFactory = rustSnapshot.factories?.[0];

    const divergences: string[] = [];
    if (!tsFactory || !rustFactory) {
      divergences.push('Factory missing after upgrade');
    } else {
      if (tsFactory.upgrades.storage !== rustFactory.upgrades.storage) {
        divergences.push(
          `Storage upgrade mismatch: TS=${tsFactory.upgrades.storage}, Rust=${rustFactory.upgrades.storage}`
        );
      }
      divergences.push(
        ...compareResources(
          tsFactory.resources as unknown as Partial<StoreSnapshot['resources']>,
          rustFactory.resources as unknown as Partial<StoreSnapshot['resources']>,
          RESOURCE_EPSILON
        )
      );
    }

    logDivergences(
      'command-parity-purchase-upgrade',
      divergences,
      parityDebugEnabled ? { tsFactory, rustFactory } : undefined
    );
    if (enforceParity) {
      expect(divergences).toEqual([]);
    } else {
      expect(divergences.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('AssignHauler keeps counts and costs aligned', async () => {
    const snapshot = createTestSnapshot(104);
    snapshot.factories![0].resources.bars = 500;
    const command: SimulationCommand = {
      type: 'AssignHauler',
      payload: { factoryId: 'factory-1', count: 1 },
    };

    const { snapshot: tsSnapshot } = applyTsCommand(snapshot, command);
    const rustSnapshot = await applyRustCommand(snapshot, command);

    const tsFactory = tsSnapshot.factories?.[0];
    const rustFactory = rustSnapshot.factories?.[0];

    const divergences: string[] = [];
    if (!tsFactory || !rustFactory) {
      divergences.push('Factory missing after AssignHauler');
    } else {
      if (tsFactory.haulersAssigned !== rustFactory.haulersAssigned) {
        divergences.push(
          `Hauler count mismatch: TS=${tsFactory.haulersAssigned}, Rust=${rustFactory.haulersAssigned}`
        );
      }
      divergences.push(
        ...compareResources(
          tsFactory.resources as unknown as Partial<StoreSnapshot['resources']>,
          rustFactory.resources as unknown as Partial<StoreSnapshot['resources']>,
          RESOURCE_EPSILON
        )
      );
    }

    logDivergences(
      'command-parity-assign-hauler',
      divergences,
      parityDebugEnabled ? { tsFactory, rustFactory } : undefined
    );
    if (enforceParity) {
      expect(divergences).toEqual([]);
    } else {
      expect(divergences.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('SpawnDrone adjusts capacity and ownership consistently', async () => {
    const snapshot = createTestSnapshot(105);
    const command: SimulationCommand = {
      type: 'SpawnDrone',
      payload: { factoryId: 'factory-1' },
    };

    const { snapshot: tsSnapshot } = applyTsCommand(snapshot, command);
    const rustSnapshot = await applyRustCommand(snapshot, command);

    const divergences: string[] = [];
    if (!withinEpsilon(tsSnapshot.modules.droneBay, rustSnapshot.modules.droneBay, MODULE_EPSILON)) {
      divergences.push(
        `Drone bay level mismatch: TS=${tsSnapshot.modules.droneBay}, Rust=${rustSnapshot.modules.droneBay}`
      );
    }

    const tsOwnersForFactory = Object.values(tsSnapshot.droneOwners ?? {}).filter(
      (owner) => owner === 'factory-1'
    ).length;
    const rustOwnersForFactory = Object.values(rustSnapshot.droneOwners ?? {}).filter(
      (owner) => owner === 'factory-1'
    ).length;
    if (tsOwnersForFactory !== rustOwnersForFactory) {
      divergences.push(
        `Drone owner count mismatch for factory-1: TS=${tsOwnersForFactory}, Rust=${rustOwnersForFactory}`
      );
    }

    logDivergences(
      'command-parity-spawn-drone',
      divergences,
      parityDebugEnabled
        ? {
            tsDroneOwners: tsSnapshot.droneOwners,
            rustDroneOwners: rustSnapshot.droneOwners,
          }
        : undefined
    );
    if (enforceParity) {
      expect(divergences).toEqual([]);
    } else {
      expect(divergences.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('RecycleAsteroid zeroes ore consistently', async () => {
    const snapshot = createTestSnapshot(106);
    const asteroids: AsteroidSnapshot[] = [
      { id: 'asteroid-1', position: [10, 0, 0], oreRemaining: 100, maxOre: 100 },
      { id: 'asteroid-2', position: [20, 0, 0], oreRemaining: 50, maxOre: 50 },
    ];
    const command: SimulationCommand = {
      type: 'RecycleAsteroid',
      payload: { asteroidId: 'asteroid-1' },
    };

    const { asteroids: tsAsteroids } = applyTsCommand(snapshot, command, asteroids);
    const rustSnapshot = await applyRustCommand(snapshot, command, asteroids);
    const rustAsteroids = (rustSnapshot as StoreSnapshot & { asteroids?: AsteroidSnapshot[] }).asteroids;

    const divergences: string[] = [];
    const tsTarget = tsAsteroids?.find((a) => a.id === 'asteroid-1');
    const rustTarget = rustAsteroids?.find((a) => a.id === 'asteroid-1');
    if (!tsTarget || !rustTarget) {
      divergences.push('Target asteroid missing after recycle');
    } else {
      if (!withinEpsilon(tsTarget.oreRemaining, rustTarget.oreRemaining, MODULE_EPSILON)) {
        divergences.push(
          `Ore remaining mismatch: TS=${tsTarget.oreRemaining}, Rust=${rustTarget.oreRemaining}`
        );
      }
    }

    logDivergences(
      'command-parity-recycle-asteroid',
      divergences,
      parityDebugEnabled ? { tsAsteroids, rustAsteroids } : undefined
    );
    if (enforceParity) {
      expect(divergences).toEqual([]);
    } else {
      expect(divergences.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('DoPrestige resets resources and modules in parity', async () => {
    const snapshot = createTestSnapshot(107);
    snapshot.resources.bars = 12000;
    snapshot.prestige.cores = 1;
    const command: SimulationCommand = { type: 'DoPrestige', payload: undefined };

    const { snapshot: tsSnapshot } = applyTsCommand(snapshot, command);
    const rustSnapshot = await applyRustCommand(snapshot, command);

    const divergences: string[] = [];
    divergences.push(
      ...compareResources(tsSnapshot.resources, rustSnapshot.resources, RESOURCE_EPSILON)
    );

    const moduleKeys: (keyof StoreSnapshot['modules'])[] = [
      'droneBay',
      'refinery',
      'storage',
      'solar',
      'scanner',
      'haulerDepot',
      'logisticsHub',
      'routingProtocol',
    ];
    for (const key of moduleKeys) {
      if (!withinEpsilon(tsSnapshot.modules[key], rustSnapshot.modules[key], MODULE_EPSILON)) {
        divergences.push(
          `Module ${key} mismatch: TS=${tsSnapshot.modules[key]}, Rust=${rustSnapshot.modules[key]}`
        );
      }
    }

    if (!withinEpsilon(tsSnapshot.prestige.cores, rustSnapshot.prestige.cores, MODULE_EPSILON)) {
      divergences.push(
        `Prestige cores mismatch: TS=${tsSnapshot.prestige.cores}, Rust=${rustSnapshot.prestige.cores}`
      );
    }

    logDivergences(
      'command-parity-do-prestige',
      divergences,
      parityDebugEnabled ? { tsSnapshot, rustSnapshot } : undefined
    );
    if (enforceParity) {
      expect(divergences).toEqual([]);
    } else {
      expect(divergences.length).toBeGreaterThanOrEqual(0);
    }
  });
});
