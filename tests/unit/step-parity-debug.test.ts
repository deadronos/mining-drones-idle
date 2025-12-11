import { describe, it, expect, vi } from 'vitest';
import { createParityContext } from './parity-helpers';
import * as fs from 'fs';
import * as path from 'path';
import process from 'node:process';
import { loadWasmBridge } from '@/lib/wasmLoader';
import { FACTORY_CONFIG } from '@/ecs/factories';

vi.mock('@/gen/rust_engine', async (importOriginal) => {
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


// Inline createTestSnapshot (copy from step-parity.test.ts createTestSnapshot helper)
function createTestSnapshot(seed: number) {
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
    logisticsQueues: { pendingTransfers: [] },
  } as any;
}

import { registerBridge } from '@/lib/rustBridgeRegistry';
import { serializeStore } from '@/state/store';
import { logDivergences } from '../shared/parityLogger';

/** Helper - we won't assert, we print detailed differences and fail if diverged */
describe('Step Parity Debug', () => {
  it('reports first divergence step-by-step', async () => {
    const seed = 12345;
    const snapshot = createTestSnapshot(seed);
    const tsContext = createParityContext(snapshot);
    const rustInitSnapshot = { ...snapshot, extra: { asteroids: tsContext.asteroidSnapshots } } as any;
    const res = await loadWasmBridge(rustInitSnapshot);
    expect(res.bridge).toBeDefined();
    const bridge = res.bridge!;
    registerBridge(bridge);

    await bridge.init(rustInitSnapshot);

    const dt = 0.1;
    const maxSteps = 80;
    let divergenceStep: number | null = null;
    let divergenceDetails: Record<string, unknown> | null = null;

    for (let step = 0; step < maxSteps; step++) {
      const tsBefore = serializeStore(tsContext.store.getState());
      const rustBefore = bridge.exportSnapshot();

      tsContext.step(dt);
      bridge.step(dt);

      const tsSnapshot = serializeStore(tsContext.store.getState());
      const rustSnapshot = bridge.exportSnapshot();

      // Compare top-level global resources
      const globalDiffs: string[] = [];
      ['ore', 'ice', 'metals', 'crystals', 'organics', 'bars'].forEach((k) => {
        // @ts-ignore
        const tsVal = tsSnapshot.resources?.[k];
        // @ts-ignore
        const rustVal = rustSnapshot.resources?.[k];
        if (typeof tsVal === 'number' && typeof rustVal === 'number') {
          const diff = Math.abs(tsVal - rustVal);
          if (diff > 0.1) {
            globalDiffs.push(`${k} diff=${diff} ts=${tsVal} rust=${rustVal}`);
          }
        }
      });

      // Drones
      const tsDrones = tsContext.world.droneQuery.entities.map((d, idx) => ({
        id: d.id,
        idx,
        position: [d.position.x, d.position.y, d.position.z],
        cargo: d.cargo,
        speed: d.speed,
        targetId: d.targetId,
      }));

      const rustDronesRaw = Array.from(bridge.getDroneCargo());
      let rustCargo = rustDronesRaw;

      const rustStates = Array.from(bridge.getDroneStates());
      const rustTargets = Array.from(bridge.getDroneTargetAsteroidIndex());
      const rustTargetFactory = Array.from(bridge.getDroneTargetFactoryIndex());

      const droneCargoDiffs = tsDrones.map((d, i) => {
        const tsFlight = tsSnapshot.droneFlights?.find((f) => f.droneId === d.id) ?? null;
        const tsBeforeFlight = tsBefore.droneFlights?.find((f) => f.droneId === d.id) ?? null;
        const rustFlight = (rustSnapshot.droneFlights ?? [])[i] ?? null;
        const rustBeforeFlight = (rustBefore.droneFlights ?? [])[i] ?? null;
        return {
          idx: d.idx,
          tsCargo: d.cargo,
          rustCargo: rustCargo[i] ?? -1,
          tsState: tsContext.world.droneQuery.entities[i].state,
          rustState: (rustStates[i] ?? 0),
          tsTargetId: d.targetId ?? null,
          rustTargetIdx: rustTargets[i] ?? -1,
          rustTargetId: (() => {
            const arr = (rustSnapshot as any).extra?.asteroids as unknown[] | undefined;
            if (!arr || arr.length === 0) return null;
            const idx = Math.floor(rustTargets[i] ?? -1);
            return arr[idx]?.id ?? null;
          })(),
          tsTravel: (() => {
            const f = tsSnapshot.droneFlights?.find((f) => f.droneId === d.idx);
            return f?.travel ?? null;
          })(),
          tsBeforeTravel: tsBeforeFlight?.travel ?? null,
          rustTravel: rustFlight?.travel ?? null,
          rustBeforeTravel: rustBeforeFlight?.travel ?? null,          tsDroneSpeed: d.speed,          diff: Math.abs(d.cargo - (rustCargo[i] ?? 0)),
        };
      }).filter((x) => x.diff > 0.5);

      // Asteroids
      const rustAsteroids = Array.from(bridge.getAsteroidOre());
      const tsAsteroids = tsContext.world.asteroidQuery.entities.map((a) => a.oreRemaining);
      const astDiffs = tsAsteroids.map((v, i) => ({ i, ts: v, rust: (rustAsteroids[i] ?? 0), diff: Math.abs(v - (rustAsteroids[i] ?? 0)) }))
        .filter((x) => x.diff > 1.0);

      if (globalDiffs.length || droneCargoDiffs.length || astDiffs.length) {
        divergenceStep = step;
        divergenceDetails = { globalDiffs, droneCargoDiffs, astDiffs };
        console.warn('Divergence found', divergenceStep, divergenceDetails);
        logDivergences('step-parity-debug', [JSON.stringify(divergenceDetails)], { step, globalDiffs, droneCargoDiffs, astDiffs });
        break;
      }
    }

    expect(divergenceStep).toBeNull();
  }, 10000);
});
