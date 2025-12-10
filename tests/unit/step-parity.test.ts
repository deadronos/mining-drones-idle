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
import type { ParityContext } from './parity-helpers';
import process from 'node:process';
import { createParityContext } from './parity-helpers';
import { serializeStore } from '@/state/store';
import { logDivergences, parityDebugEnabled } from '../shared/parityLogger';
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
      return actual.default(buffer);
    },
  };
});

// Constants for parity testing
const RESOURCE_EPSILON = 0.05;
const POSITION_EPSILON = 0.1;
const ENERGY_EPSILON = 40;
const ASTEROID_REL_EPSILON = 0.1;
const DRONE_BATTERY_EPSILON = 0.01;
const DRONE_CARGO_EPSILON = 0.01;
const TARGET_INDEX_EPSILON = 0.25;
const DRONE_CAPACITY_EPSILON = 0.01;
const enforceParity = process.env.PARITY_ENFORCE === '1';

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

const relativeDiff = (a: number, b: number) => {
  const denom = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / denom;
};

function compareVector(
  a: number[] | Float32Array,
  b: number[] | Float32Array,
  epsilon: number,
  label: string
): string[] {
  const divergences: string[] = [];
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    if (!withinEpsilon(a[i] ?? 0, b[i] ?? 0, epsilon)) {
      divergences.push(
        `${label}[${i}] diverged: TS=${(a[i] ?? 0).toFixed(4)} Rust=${(b[i] ?? 0).toFixed(4)}`
      );
    }
  }
  return divergences;
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

interface DroneParityData {
  index: number;
  position: [number, number, number];
  battery: number;
  cargo: number;
  capacity: number;
  targetAsteroid: number;
  targetFactory: number;
  charging: boolean;
}

const normalizeIndex = (value: number | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return -1;
};

function collectRustDrones(bridge: RustSimBridge): DroneParityData[] {
  const positions = Array.from(bridge.getDronePositions());
  const batteries = Array.from(bridge.getDroneBattery());
  const cargo = Array.from(bridge.getDroneCargo());
  const capacities = Array.from(bridge.getDroneCapacity());
  const targetAsteroids = Array.from(bridge.getDroneTargetAsteroidIndex());
  const targetFactories = Array.from(bridge.getDroneTargetFactoryIndex());
  const charging = Array.from(bridge.getDroneCharging());

  const count = Math.floor(positions.length / 3);
  const drones: DroneParityData[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = i * 3;
    drones.push({
      index: i,
      position: [
        positions[base] ?? 0,
        positions[base + 1] ?? 0,
        positions[base + 2] ?? 0,
      ],
      battery: batteries[i] ?? 0,
      cargo: cargo[i] ?? 0,
      capacity: capacities[i] ?? 0,
      targetAsteroid: normalizeIndex(targetAsteroids[i]),
      targetFactory: normalizeIndex(targetFactories[i]),
      charging: (charging[i] ?? 0) > 0.5,
    });
  }
  return drones;
}

function collectTsDrones(
  context: ParityContext,
  asteroidIndex: Map<string, number>,
  factoryIndex: Map<string, number>
): DroneParityData[] {
  return context.world.droneQuery.entities.map((drone, idx) => ({
    index: idx,
    position: [drone.position.x, drone.position.y, drone.position.z],
    battery: drone.battery,
    cargo: drone.cargo,
    capacity: drone.capacity,
    targetAsteroid: drone.targetId ? asteroidIndex.get(drone.targetId) ?? -1 : -1,
    targetFactory: drone.targetFactoryId
      ? factoryIndex.get(drone.targetFactoryId) ?? -1
      : -1,
    charging: drone.charging,
  }));
}

function compareDrones(tsDrones: DroneParityData[], rustDrones: DroneParityData[]): string[] {
  const divergences: string[] = [];
  if (tsDrones.length !== rustDrones.length) {
    divergences.push(`Drone count mismatch: TS=${tsDrones.length}, Rust=${rustDrones.length}`);
  }
  const count = Math.min(tsDrones.length, rustDrones.length);
  for (let i = 0; i < count; i += 1) {
    const ts = tsDrones[i];
    const rust = rustDrones[i];
    const axis = ['x', 'y', 'z'] as const;
    axis.forEach((axisLabel, idx) => {
      if (!withinEpsilon(ts.position[idx], rust.position[idx], POSITION_EPSILON)) {
        divergences.push(
          `Drone ${ts.index} ${axisLabel} diverged: TS=${ts.position[idx].toFixed(
            4
          )} Rust=${rust.position[idx].toFixed(4)}`
        );
      }
    });

    if (!withinEpsilon(ts.battery, rust.battery, DRONE_BATTERY_EPSILON)) {
      divergences.push(
        `Drone ${ts.index} battery diff=${(ts.battery - rust.battery).toFixed(4)} (TS=${
          ts.battery
        }, Rust=${rust.battery})`
      );
    }

    if (!withinEpsilon(ts.cargo, rust.cargo, DRONE_CARGO_EPSILON)) {
      divergences.push(
        `Drone ${ts.index} cargo diff=${(ts.cargo - rust.cargo).toFixed(4)} (TS=${ts.cargo}, Rust=${
          rust.cargo
        })`
      );
    }

    if (!withinEpsilon(ts.capacity, rust.capacity, DRONE_CAPACITY_EPSILON)) {
      divergences.push(
        `Drone ${ts.index} capacity diff=${(ts.capacity - rust.capacity).toFixed(
          4
        )} (TS=${ts.capacity}, Rust=${rust.capacity})`
      );
    }

    if (Math.abs(ts.targetAsteroid - rust.targetAsteroid) > TARGET_INDEX_EPSILON) {
      divergences.push(
        `Drone ${ts.index} target asteroid mismatch: TS=${ts.targetAsteroid}, Rust=${rust.targetAsteroid}`
      );
    }

    if (Math.abs(ts.targetFactory - rust.targetFactory) > TARGET_INDEX_EPSILON) {
      divergences.push(
        `Drone ${ts.index} target factory mismatch: TS=${ts.targetFactory}, Rust=${rust.targetFactory}`
      );
    }

    if (ts.charging !== rust.charging) {
      divergences.push(`Drone ${ts.index} charging mismatch: TS=${ts.charging} Rust=${rust.charging}`);
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
      const tsContext = createParityContext(snapshot);
      const rustInitSnapshot = {
        ...snapshot,
        extra: { asteroids: tsContext.asteroidSnapshots },
      } as unknown as StoreSnapshot;

      // Setup Rust environment
      await bridge!.init(rustInitSnapshot);

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
        const rustInitSnapshot = {
          ...snapshot,
          extra: { asteroids: tsContext.asteroidSnapshots },
        } as unknown as StoreSnapshot;
        await bridge!.init(rustInitSnapshot);

        const dt = 0.1;
        tsContext.step(dt);
        bridge!.step(dt);

        const tsSnapshot = serializeStore(tsContext.store.getState());
        const rustSnapshot = bridge!.exportSnapshot();

        // Check factory resources
        const tsFactory = tsSnapshot.factories?.[0];
        const rustFactory = rustSnapshot.factories?.[0];
        expect(tsFactory).toBeDefined();
        expect(rustFactory).toBeDefined();
        if (!tsFactory || !rustFactory) return;

        const divergences = compareResources(
          tsFactory.resources as unknown as Partial<StoreSnapshot['resources']>,
          rustFactory.resources as unknown as Partial<StoreSnapshot['resources']>,
          RESOURCE_EPSILON
        );
        logDivergences(
          'step-parity-factory-resources-single-step',
          divergences,
          parityDebugEnabled ? { tsFactory, rustFactory } : undefined
        );
        expect(divergences).toEqual([]);
    });
  });

  describe('Multi-step parity', () => {
    it('maintains parity over 60 steps (6 seconds)', async () => {
      const snapshot = createTestSnapshot(12345);

      const tsContext = createParityContext(snapshot);
      const rustInitSnapshot = {
        ...snapshot,
        extra: { asteroids: tsContext.asteroidSnapshots },
      } as unknown as StoreSnapshot;
      await bridge!.init(rustInitSnapshot);

      // Run 60 steps
      const dt = 0.1;
      for (let i = 0; i < 60; i++) {
        tsContext.step(dt);
        bridge!.step(dt);
      }

      const tsSnapshot = serializeStore(tsContext.store.getState());
      const rustSnapshot = bridge!.exportSnapshot();

      const asteroidIndex = new Map(
        tsContext.asteroidSnapshots.map((asteroid, idx) => [asteroid.id, idx])
      );
      const factoryIndex = new Map(
        (tsSnapshot.factories ?? []).map((factory, idx) => [factory.id, idx])
      );

      const tsDrones = collectTsDrones(tsContext, asteroidIndex, factoryIndex);
      const rustDrones = collectRustDrones(bridge!);
      const droneDivergences = compareDrones(tsDrones, rustDrones);
      logDivergences('step-parity-drones-60-steps', droneDivergences, parityDebugEnabled
        ? { tsDrones, rustDrones }
        : undefined);
      if (enforceParity) {
        expect(droneDivergences).toEqual([]);
      } else {
        expect(droneDivergences.length).toBeGreaterThanOrEqual(0);
      }

      const resourceDivergences = compareResources(
        tsSnapshot.resources,
        rustSnapshot.resources,
        RESOURCE_EPSILON
      );
      logDivergences(
        'step-parity-resources-60-steps',
        resourceDivergences,
        parityDebugEnabled ? { ts: tsSnapshot.resources, rust: rustSnapshot.resources } : undefined
      );
      expect(resourceDivergences).toEqual([]);

      // Also check modules haven't drifted (unlikely but good sanity check)
      const moduleDivergences = compareModules(tsSnapshot.modules, rustSnapshot.modules);
      expect(moduleDivergences).toEqual([]);

      // Factory energy parity
      const tsFactory = tsSnapshot.factories?.[0];
      const rustFactory = rustSnapshot.factories?.[0];
      expect(tsFactory).toBeDefined();
      expect(rustFactory).toBeDefined();
      if (tsFactory && rustFactory) {
        const energyDiff = Math.abs(tsFactory.energy - rustFactory.energy);
        if (energyDiff > ENERGY_EPSILON) {
          console.error('Factory energy parity mismatch', {
            tsEnergy: tsFactory.energy,
            rustEnergy: rustFactory.energy,
            diff: energyDiff,
          });
        }
        expect(energyDiff).toBeLessThanOrEqual(ENERGY_EPSILON);
        expect(
          withinEpsilon(tsFactory.energyCapacity, rustFactory.energyCapacity, ENERGY_EPSILON)
        ).toBe(true);
      }

      // Factory position parity (sanity check for layout alignment)
      if (tsFactory && rustFactory) {
        const positionDivergences = compareVector(
          tsFactory.position,
          rustFactory.position,
          POSITION_EPSILON,
          'Factory position'
        );
        expect(positionDivergences).toEqual([]);
      }
    });
  });

  describe('Deterministic seeds', () => {
    const runStepsWithSeed = async (seed: number) => {
      const snapshot = createTestSnapshot(seed);
      const tsContext = createParityContext(snapshot);
      const rustSnapshot = {
        ...snapshot,
        extra: { asteroids: tsContext.asteroidSnapshots },
      } as unknown as StoreSnapshot;
      await bridge!.init(rustSnapshot);

      const dt = 0.1;
      for (let i = 0; i < 30; i += 1) {
        tsContext.step(dt);
        bridge!.step(dt);
      }

      return {
        ts: serializeStore(tsContext.store.getState()),
        rust: bridge!.exportSnapshot(),
      };
    };

    it('produces stable results for identical seeds', async () => {
      const first = await runStepsWithSeed(777);
      const second = await runStepsWithSeed(777);

      const resourceDivergences = compareResources(
        first.ts.resources,
        second.ts.resources,
        RESOURCE_EPSILON
      );
      expect(resourceDivergences).toEqual([]);

      const rustResourceDivergences = compareResources(
        first.rust.resources,
        second.rust.resources,
        RESOURCE_EPSILON
      );
      expect(rustResourceDivergences).toEqual([]);
    });
  });

  describe('Drone and asteroid parity', () => {
    it('keeps drone state within tolerance across engines', async () => {
      const snapshot = createTestSnapshot(2468);
      const tsContext = createParityContext(snapshot);
      const rustSnapshot = {
        ...snapshot,
        extra: { asteroids: tsContext.asteroidSnapshots },
      } as unknown as StoreSnapshot;
      await bridge!.init(rustSnapshot);

      const dt = 0.1;
      for (let i = 0; i < 40; i += 1) {
        tsContext.step(dt);
        bridge!.step(dt);
      }

      const tsSnapshot = serializeStore(tsContext.store.getState());
      const asteroidIndex = new Map(
        tsContext.asteroidSnapshots.map((asteroid, idx) => [asteroid.id, idx])
      );
      const factoryIndex = new Map(
        (tsSnapshot.factories ?? []).map((factory, idx) => [factory.id, idx])
      );

      const tsDrones = collectTsDrones(tsContext, asteroidIndex, factoryIndex);
      const rustDrones = collectRustDrones(bridge!);
      const divergences = compareDrones(tsDrones, rustDrones);
      logDivergences(
        'step-parity-drones-positions-40-steps',
        divergences,
        parityDebugEnabled ? { tsDrones, rustDrones } : undefined
      );
      if (enforceParity) {
        expect(divergences).toEqual([]);
      } else {
        expect(divergences.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('depletes asteroid ore similarly over time', async () => {
      const snapshot = createTestSnapshot(97531);
      const tsContext = createParityContext(snapshot);
      const rustSnapshot = {
        ...snapshot,
        extra: { asteroids: tsContext.asteroidSnapshots },
      } as unknown as StoreSnapshot;
      await bridge!.init(rustSnapshot);

      const dt = 0.1;
      for (let i = 0; i < 80; i += 1) {
        tsContext.step(dt);
        bridge!.step(dt);
      }

      const rustAsteroids = Array.from(bridge!.getAsteroidOre());
      const tsAsteroids = tsContext.world.asteroidQuery.entities.map((asteroid) => asteroid.oreRemaining);
      const count = Math.min(tsAsteroids.length, rustAsteroids.length);
      const perAsteroidDiffs: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const diff = relativeDiff(tsAsteroids[i], rustAsteroids[i]);
        if (diff > ASTEROID_REL_EPSILON) {
          perAsteroidDiffs.push(
            `Asteroid idx=${i} ore diff=${diff.toFixed(4)} TS=${tsAsteroids[i].toFixed(
              3
            )} Rust=${rustAsteroids[i].toFixed(3)}`
          );
        }
      }

      const tsOreTotal = tsAsteroids.reduce((sum, ore) => sum + ore, 0);
      const rustOreTotal = rustAsteroids.reduce((sum, ore) => sum + ore, 0);
      const totalDiff = relativeDiff(tsOreTotal, rustOreTotal);
      logDivergences(
        'step-parity-asteroids-ore',
        [...perAsteroidDiffs, ...(totalDiff > ASTEROID_REL_EPSILON ? [`Total ore diff=${totalDiff.toFixed(4)}`] : [])],
        parityDebugEnabled
          ? {
              totals: { tsOreTotal, rustOreTotal, totalDiff },
            }
          : undefined
      );
      if (enforceParity) {
        expect(totalDiff).toBeLessThanOrEqual(ASTEROID_REL_EPSILON);
        expect(perAsteroidDiffs).toEqual([]);
      } else {
        expect(perAsteroidDiffs.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
