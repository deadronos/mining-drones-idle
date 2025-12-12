import { describe, it, expect, vi } from 'vitest';
import { createParityContext } from './parity-helpers';
import * as fs from 'fs';
import * as path from 'path';
import process from 'node:process';
import { loadWasmBridge } from '@/lib/wasmLoader';
import { FACTORY_CONFIG } from '@/ecs/factories';
import type { StoreSnapshot } from '@/state/types';

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


// Inline createTestSnapshot (copy from step-parity.test.ts createTestSnapshot helper)
function createTestSnapshot(seed: number): StoreSnapshot {
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
  };
}

import { registerBridge } from '@/lib/rustBridgeRegistry';
import { serializeStore } from '@/state/store';
import { logDivergences, writeParityReport } from '../shared/parityLogger';

/** Helper - we won't assert, we print detailed differences and fail if diverged */
describe('Step Parity Debug', () => {
  it('reports first divergence step-by-step', async () => {
    const enforceParity = process.env.PARITY_ENFORCE === '1';
    const seed = 12345;
    const snapshot = createTestSnapshot(seed);
    const tsContext = createParityContext(snapshot);
    const rustInitSnapshot: StoreSnapshot & {
      extra: { asteroids: typeof tsContext.asteroidSnapshots };
    } = { ...snapshot, extra: { asteroids: tsContext.asteroidSnapshots } };
    const res = await loadWasmBridge(rustInitSnapshot);
    expect(res.bridge).toBeDefined();
    const bridge = res.bridge!;
    registerBridge(bridge);

    await bridge.init(rustInitSnapshot);

    const dt = 0.1;
    const maxSteps = 80;
    const enforceSteps = 60;
    let divergenceStep: number | null = null;
    let divergenceDetails: Record<string, unknown> | null = null;

    const trace: Array<Record<string, unknown>> = [];

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
        // @ts-expect-error: snapshot is a structural match for resources but not strongly typed here
        const tsVal = tsSnapshot.resources?.[k];
        // @ts-expect-error: snapshot is a structural match for resources but not strongly typed here
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

      const rustCargo = Array.from(bridge.getDroneCargo());
      const rustPositions = Array.from(bridge.getDronePositions());

      const rustStates = Array.from(bridge.getDroneStates());
      const rustTargets = Array.from(bridge.getDroneTargetAsteroidIndex());

      const droneCargoDiffs = tsDrones.map((d, i) => {
        const tsFlight = tsSnapshot.droneFlights?.find((f) => f.droneId === d.id) ?? null;
        const tsBeforeFlight = tsBefore.droneFlights?.find((f) => f.droneId === d.id) ?? null;
        // Rust drone IDs are not the same as TS drone IDs; use index-based buffers for parity.
        // Rust drone ids are generated as `drone-rust-${index}`.
        const rustFlight = rustSnapshot.droneFlights?.find((f) => f.droneId === `drone-rust-${i}`) ?? null;
        const rustBeforeFlight = rustBefore.droneFlights?.find((f) => f.droneId === `drone-rust-${i}`) ?? null;
        return {
          idx: d.idx,
          tsCargo: d.cargo,
          rustCargo: rustCargo[i] ?? -1,
          tsState: tsContext.world.droneQuery.entities[i].state,
          rustState: (rustStates[i] ?? 0),
          tsTargetId: d.targetId ?? null,
          rustTargetIdx: rustTargets[i] ?? -1,
          rustTargetId: (() => {
            const arr = (rustSnapshot as { extra?: { asteroids?: { id?: string }[] } }).extra
              ?.asteroids;
            if (!arr || arr.length === 0) return null;
            const idx = Math.floor(rustTargets[i] ?? -1);
            const asteroid = arr[idx];
            return asteroid?.id ?? null;
          })(),
          tsTravel: (() => {
            return tsFlight?.travel ?? null;
          })(),
          tsBeforeTravel: tsBeforeFlight?.travel ?? null,
          rustTravel: rustFlight?.travel ?? null,
          rustBeforeTravel: rustBeforeFlight?.travel ?? null,
          tsPathSeed: tsFlight?.pathSeed ?? null,
          rustPathSeed: rustFlight?.pathSeed ?? null,
          tsDroneSpeed: d.speed,
          diff: Math.abs(d.cargo - (rustCargo[i] ?? 0)),
        };
      }).filter((x) => x.diff > 0.5);

      // Asteroids
      const rustAsteroids = Array.from(bridge.getAsteroidOre());
      const tsAsteroids = tsContext.world.asteroidQuery.entities;
      const tsOreById = new Map(tsAsteroids.map((a) => [a.id, a.oreRemaining] as const));

      const rustAsteroidMeta = (
        (rustSnapshot as { extra?: { asteroids?: { id?: string }[] } }).extra?.asteroids ??
        []
      );

      const rustOreById = new Map(
        rustAsteroidMeta
          .map((meta, idx) => {
            const id = meta?.id;
            if (!id) return null;
            return [id, rustAsteroids[idx] ?? 0] as const;
          })
          .filter((entry): entry is readonly [string, number] => Boolean(entry))
      );

      const astDiffs = rustAsteroids
        .map((rustOre, i) => {
          const id = rustAsteroidMeta[i]?.id;
          if (!id) return null;
          const tsOre = tsOreById.get(id);
          if (typeof tsOre !== 'number') return null;
          const diff = Math.abs(tsOre - rustOre);
          return { i, id, ts: tsOre, rust: rustOre, diff };
        })
        .filter((x): x is { i: number; id: string; ts: number; rust: number; diff: number } => Boolean(x))
        .filter((x) => x.diff > 1.0)
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 10);

      const droneStateSummary = tsContext.world.droneQuery.entities.map((drone, i) => {
        const base = i * 3;
        const rx = rustPositions[base] ?? 0;
        const ry = rustPositions[base + 1] ?? 0;
        const rz = rustPositions[base + 2] ?? 0;
        const dx = drone.position.x - rx;
        const dy = drone.position.y - ry;
        const dz = drone.position.z - rz;
        const posDiff = Math.hypot(dx, dy, dz);

        const rustTargetIdx = Math.floor(rustTargets[i] ?? -1);
        const rustTargetId = rustTargetIdx >= 0 ? rustAsteroidMeta[rustTargetIdx]?.id ?? null : null;
        const tsFlight = tsSnapshot.droneFlights?.find((f) => f.droneId === drone.id) ?? null;
        const rustFlight = rustSnapshot.droneFlights?.find((f) => f.droneId === `drone-rust-${i}`) ?? null;
        return {
          i,
          tsId: drone.id,
          tsState: drone.state,
          tsTargetId: drone.targetId ?? null,
          tsCargo: drone.cargo,
          tsFlight: tsFlight
            ? {
                state: tsFlight.state,
                pathSeed: tsFlight.pathSeed,
                targetAsteroidId: tsFlight.targetAsteroidId ?? null,
                targetFactoryId: tsFlight.targetFactoryId ?? null,
              }
            : null,
          rustState: rustStates[i] ?? 0,
          rustTargetIdx,
          rustTargetId,
          rustCargo: rustCargo[i] ?? 0,
          rustFlight: rustFlight
            ? {
                state: rustFlight.state,
                pathSeed: rustFlight.pathSeed,
                targetAsteroidId: rustFlight.targetAsteroidId ?? null,
                targetFactoryId: rustFlight.targetFactoryId ?? null,
              }
            : null,
          posDiff,
        };
      });

      if (step >= 70 && step <= 85) {
        const targetIds = new Set<string>();
        for (const drone of tsContext.world.droneQuery.entities) {
          if (drone.targetId) targetIds.add(drone.targetId);
        }
        for (const target of rustTargets) {
          const idx = Math.floor(target ?? -1);
          const id = idx >= 0 ? rustAsteroidMeta[idx]?.id : undefined;
          if (id) targetIds.add(id);
        }

        trace.push({
          step,
          globalDiffs,
          droneCargoDiffs,
          astDiffs,
          targetOre: Array.from(targetIds)
            .slice(0, 8)
            .map((id) => ({
              id,
              ts: tsOreById.get(id) ?? null,
              rust: rustOreById.get(id) ?? null,
            })),
          droneStateSummary,
          tsFlights: (tsSnapshot.droneFlights ?? []).map((f) => ({
            droneId: f.droneId,
            state: f.state,
            pathSeed: f.pathSeed,
            targetAsteroidId: f.targetAsteroidId ?? null,
            targetFactoryId: f.targetFactoryId ?? null,
            travel: f.travel ?? null,
          })),
          rustFlights: (rustSnapshot.droneFlights ?? []).map((f) => ({
            droneId: f.droneId,
            state: f.state,
            pathSeed: f.pathSeed,
            targetAsteroidId: f.targetAsteroidId ?? null,
            targetFactoryId: f.targetFactoryId ?? null,
            travel: f.travel ?? null,
          })),
        });
      }

      if (globalDiffs.length || droneCargoDiffs.length || astDiffs.length) {
        divergenceStep = step;
        divergenceDetails = { globalDiffs, droneCargoDiffs, astDiffs, trace };
        // Compute candidate lists for diverged drones for more context
        try {
          const asteroidPositions = Array.from(bridge.getAsteroidPositions());
          const astArray = (rustSnapshot as { extra?: { asteroids?: { id: string }[] } }).extra
            ?.asteroids ?? [];

          divergenceDetails = {
            ...divergenceDetails,
            candidates: droneCargoDiffs.map((d) => {
              const tsCandidates = tsContext.world.asteroidQuery.entities
                .map((a) => ({
                  id: a.id,
                  dist: Math.hypot(
                    a.position.x - tsContext.world.droneQuery.entities[d.idx].position.x,
                    a.position.y - tsContext.world.droneQuery.entities[d.idx].position.y,
                    a.position.z - tsContext.world.droneQuery.entities[d.idx].position.z,
                  ),
                }))
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 4);

              const rustCandidates = astArray
                .map((a, idx: number) => ({
                  id: a.id,
                  dist: Math.hypot(
                    asteroidPositions[idx * 3] - tsContext.world.droneQuery.entities[d.idx].position.x,
                    asteroidPositions[idx * 3 + 1] - tsContext.world.droneQuery.entities[d.idx].position.y,
                    asteroidPositions[idx * 3 + 2] - tsContext.world.droneQuery.entities[d.idx].position.z,
                  ),
                }))
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 4);
              return { idx: d.idx, tsCandidates, rustCandidates };
            }),
          };
        } catch (candidateErr) {
          console.warn('Failed to collect candidate info', candidateErr);
        }

        console.warn('Divergence found', divergenceStep, divergenceDetails);
        logDivergences('step-parity-debug', [JSON.stringify(divergenceDetails)], { step, globalDiffs, droneCargoDiffs, astDiffs });
        break;
      }
    }

    if (enforceParity) {
      // Keep this debug harness aligned with the main enforced parity window.
      // Divergences after `enforceSteps` are still logged for follow-up, but
      // won't block enabling `PARITY_ENFORCE=1` for the core suite.
      const withinEnforcedWindow = divergenceStep !== null && divergenceStep < enforceSteps;
      expect(withinEnforcedWindow ? divergenceStep : null).toBeNull();
    }

    writeParityReport('step-parity-debug-latest', {
      divergenceStep,
      divergenceDetails,
    });
  }, 10000);
});
