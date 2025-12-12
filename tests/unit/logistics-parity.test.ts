import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import process from 'node:process';
import { LOGISTICS_CONFIG } from '@/ecs/logistics';
import { FACTORY_CONFIG } from '@/ecs/factories';
import { loadWasmBridge } from '@/lib/wasmLoader';
import { registerBridge } from '@/lib/rustBridgeRegistry';
import { createStoreInstance, serializeStore } from '@/state/store';
import type { FactoryLogisticsState, StoreSnapshot } from '@/state/types';
import type { RustSimBridge } from '@/lib/wasmSimBridge';

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

const createSnapshot = (seed: number): StoreSnapshot => ({
  resources: {
    ore: 0,
    ice: 0,
    metals: 0,
    crystals: 0,
    organics: 0,
    bars: 30,
    energy: 0,
    credits: 0,
  },
  modules: {
    droneBay: 0,
    refinery: 0,
    storage: 1,
    solar: 0,
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
      id: 'factory-a',
      position: [0, 0, 0],
      dockingCapacity: 1,
      refineSlots: 0,
      idleEnergyPerSec: 0,
      energyPerRefine: 0,
      storageCapacity: FACTORY_CONFIG.storageCapacity,
      currentStorage: 0,
      queuedDrones: [],
      activeRefines: [],
      pinned: false,
      energy: 0,
      energyCapacity: 0,
      resources: {
        ore: 0,
        bars: 120,
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
      upgradeRequests: [],
      haulersAssigned: 2,
      haulerConfig: {
        capacity: 50,
        speed: 1,
        pickupOverhead: 1,
        dropoffOverhead: 1,
        resourceFilters: [],
        mode: 'auto',
        priority: 5,
      },
      haulerUpgrades: undefined,
      logisticsState: { outboundReservations: {}, inboundSchedules: [] },
    },
    {
      id: 'factory-b',
      position: [5, 0, 0],
      dockingCapacity: 1,
      refineSlots: 0,
      idleEnergyPerSec: 0,
      energyPerRefine: 0,
      storageCapacity: FACTORY_CONFIG.storageCapacity,
      currentStorage: 0,
      queuedDrones: [],
      activeRefines: [],
      pinned: false,
      energy: 0,
      energyCapacity: 0,
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
      upgradeRequests: [
        {
          upgrade: 'storage',
          resourceNeeded: {
            ore: 0,
            bars: 10,
            metals: 0,
            crystals: 0,
            organics: 0,
            ice: 0,
            credits: 0,
          },
          fulfilledAmount: {
            ore: 0,
            bars: 0,
            metals: 0,
            crystals: 0,
            organics: 0,
            ice: 0,
            credits: 0,
          },
          status: 'pending',
          createdAt: 0,
          expiresAt: Date.now() + 60_000,
        },
      ],
      haulersAssigned: 1,
      haulerConfig: {
        capacity: 50,
        speed: 1,
        pickupOverhead: 1,
        dropoffOverhead: 1,
        resourceFilters: [],
        mode: 'auto',
        priority: 5,
      },
      haulerUpgrades: undefined,
      logisticsState: { outboundReservations: {}, inboundSchedules: [] },
    },
  ],
  selectedFactoryId: 'factory-a',
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

const normalizeTransfers = (
  transfers: NonNullable<StoreSnapshot['logisticsQueues']>['pendingTransfers'] = [],
): Array<{ from: string; to: string; res: string; amount: number }> => {
  const simplified = transfers.map((transfer) => ({
    from: transfer.fromFactoryId,
    to: transfer.toFactoryId,
    res: transfer.resource,
    amount: Number(transfer.amount.toFixed(4)),
  }));
  return simplified.sort((a, b) =>
    `${a.from}-${a.to}-${a.res}`.localeCompare(`${b.from}-${b.to}-${b.res}`),
  );
};

type InboundScheduleSnapshot = FactoryLogisticsState['inboundSchedules'];
type OutboundReservations = FactoryLogisticsState['outboundReservations'];

const normalizeInbound = (
  schedules: InboundScheduleSnapshot = [],
): Array<{ from: string; res: string; amount: number }> => {
  const simplified = schedules.map((schedule) => ({
    from: schedule.fromFactoryId,
    res: schedule.resource,
    amount: Number(schedule.amount.toFixed(4)),
  }));
  return simplified.sort((a, b) => `${a.from}-${a.res}`.localeCompare(`${b.from}-${b.res}`));
};

const normalizeReservations = (reservations: OutboundReservations = {}): Record<string, number> => {
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(reservations)) {
    normalized[key] = Number(value.toFixed(4));
  }
  return normalized;
};

describe('Logistics parity', () => {
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

  it('produces matching transfer schedules and reservations for bars', async () => {
    if (!bridge) {
      expect(bridge).toBeDefined();
      return;
    }

    const snapshot = createSnapshot(42);

    const tsStore = createStoreInstance();
    tsStore.getState().applySnapshot(snapshot);
    tsStore.setState((state) => ({
      ...state,
      gameTime: LOGISTICS_CONFIG.scheduling_interval,
    }));
    tsStore.getState().processLogistics(LOGISTICS_CONFIG.scheduling_interval);
    const tsState = serializeStore(tsStore.getState());

    const rustSnapshot = {
      ...snapshot,
      extra: { asteroids: [] },
    } as StoreSnapshot;
    await bridge.init(rustSnapshot);
    bridge.step(LOGISTICS_CONFIG.scheduling_interval);
    const rustState = bridge.exportSnapshot();

    const tsTransfers = normalizeTransfers(tsState.logisticsQueues?.pendingTransfers ?? []);
    const rustTransfers = normalizeTransfers(rustState.logisticsQueues?.pendingTransfers ?? []);
    expect(tsTransfers).toEqual(rustTransfers);

    const tsFactoryA = tsState.factories?.find((f) => f.id === 'factory-a');
    const rustFactoryA = rustState.factories?.find((f) => f.id === 'factory-a');
    const tsFactoryB = tsState.factories?.find((f) => f.id === 'factory-b');
    const rustFactoryB = rustState.factories?.find((f) => f.id === 'factory-b');

    expect(tsFactoryA).toBeDefined();
    expect(rustFactoryA).toBeDefined();
    expect(tsFactoryB).toBeDefined();
    expect(rustFactoryB).toBeDefined();
    if (!tsFactoryA || !rustFactoryA || !tsFactoryB || !rustFactoryB) return;

    expect(
      normalizeReservations(tsFactoryA.logisticsState?.outboundReservations),
    ).toEqual(normalizeReservations(rustFactoryA.logisticsState?.outboundReservations));

    expect(normalizeInbound(tsFactoryB.logisticsState?.inboundSchedules)).toEqual(
      normalizeInbound(rustFactoryB.logisticsState?.inboundSchedules),
    );

    const tsRequest = tsFactoryB.upgradeRequests?.[0];
    const rustRequest = rustFactoryB.upgradeRequests?.[0];
    expect(tsRequest?.status).toBe(rustRequest?.status);
    expect(tsRequest?.fulfilledAmount.bars ?? 0).toBeCloseTo(
      rustRequest?.fulfilledAmount.bars ?? 0,
      4,
    );
  });
});
