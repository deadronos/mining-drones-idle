import { describe, it, expect } from 'vitest';
import { migrateSnapshot } from './migrations';
import { saveVersion } from './store';
import type { StoreSnapshot } from './store';

describe('migrations', () => {
  it('adds showTrails default and updates version for legacy snapshots', () => {
    const legacy = {
      resources: {
        ore: 10,
        ice: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
        bars: 0,
        energy: 50,
        credits: 0,
      },
      modules: {
        droneBay: 1,
        refinery: 0,
        storage: 0,
        solar: 0,
        scanner: 0,
        haulerDepot: 0,
        logisticsHub: 0,
        routingProtocol: 0,
      },
      prestige: { cores: 0 },
      save: { lastSave: 1_000_000, version: '0.0.1' },
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 10,
        offlineCapHours: 8,
        notation: 'standard',
        throttleFloor: 0.25,
        showHaulerShips: true,
        showDebugPanel: false,
        useRustSim: false,
      },
    } as Partial<StoreSnapshot>;

    const { snapshot: migrated, report } = migrateSnapshot(legacy as StoreSnapshot);
    expect(report.migrated).toBe(true);
    expect(report.fromVersion).toBe('0.0.1');
    expect(report.toVersion).toBe(saveVersion);
    expect(migrated.save.version).toBe(saveVersion);
    expect(migrated.settings).toBeDefined();
    // showTrails should be present and default to true
    expect(migrated.settings.showTrails).toBe(true);
    expect(migrated.settings.showHaulerShips).toBe(true);
    expect(Array.isArray(migrated.droneFlights)).toBe(true);
    expect(migrated.droneFlights?.length).toBe(0);
    expect(migrated.specTechs).toBeDefined();
    expect(migrated.prestigeInvestments).toBeDefined();
  });

  it('is idempotent when applied to current snapshots', () => {
    const current = {
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
        scanner: 0,
        haulerDepot: 0,
        logisticsHub: 0,
        routingProtocol: 0,
      },
      prestige: { cores: 0 },
      save: { lastSave: Date.now(), version: saveVersion },
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 10,
        offlineCapHours: 8,
        notation: 'standard',
        throttleFloor: 0.25,
        showTrails: false,
        showHaulerShips: true,
        performanceProfile: 'medium',
        showDebugPanel: false,
        useRustSim: false,
      },
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
      droneFlights: [] as StoreSnapshot['droneFlights'],
    } as StoreSnapshot;
    const { snapshot: migrated, report } = migrateSnapshot(current);
    expect(report.migrated).toBe(false);
    expect(migrated.save.version).toBe(saveVersion);
    expect(migrated.settings.showTrails).toBe(false);
    expect(migrated.droneFlights).toEqual([]);
  });

  it('normalizes logistics state for warehouse routing', () => {
    const legacy: StoreSnapshot = {
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
        scanner: 0,
        haulerDepot: 0,
        logisticsHub: 0,
        routingProtocol: 0,
      },
      prestige: { cores: 0 },
      save: { lastSave: Date.now() - 1_000_000, version: '0.3.1' },
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 10,
        offlineCapHours: 8,
        notation: 'standard',
        throttleFloor: 0.25,
        showTrails: true,
        showHaulerShips: true,
        performanceProfile: 'medium',
        inspectorCollapsed: false,
        metrics: {
          enabled: true,
          intervalSeconds: 5,
          retentionSeconds: 300,
        },
        showDebugPanel: false,
        useRustSim: false,
      },
      factories: [
        {
          id: 'factory-0',
          position: [0, 0, 0],
          dockingCapacity: 1,
          refineSlots: 1,
          idleEnergyPerSec: 0.1,
          energyPerRefine: 10,
          storageCapacity: 100,
          resources: { ore: 25, bars: 0, metals: 0, crystals: 0, organics: 0, ice: 0, credits: 0 },
          currentStorage: 25,
          queuedDrones: [],
          activeRefines: [],
          pinned: false,
          energy: 50,
          energyCapacity: 100,
          upgrades: { docking: 0, refine: 0, storage: 0, energy: 0, solar: 0 },
          logisticsState: {
            outboundReservations: {},
            inboundSchedules: [
              { fromFactoryId: 'factory-1', resource: 'ore', amount: 15, eta: 6 },
              { fromFactoryId: 'factory-2', resource: 'bars', amount: 0, eta: 3 },
            ],
          },
        },
      ],
      logisticsQueues: {
        pendingTransfers: [
          {
            id: 'transfer-legacy',
            fromFactoryId: 'factory-0',
            toFactoryId: 'factory-99',
            resource: 'ore',
            amount: 0,
            eta: 5,
            status: 'completed',
            departedAt: 5,
          },
          {
            id: 'transfer-valid',
            fromFactoryId: 'factory-0',
            toFactoryId: 'factory-1',
            resource: 'ore',
            amount: 10,
            eta: 4,
            status: 'in-transit',
            departedAt: 3.9,
          },
        ],
      },
      droneFlights: [],
    };

    const { snapshot: migrated, report } = migrateSnapshot(legacy);

    expect(report.migrated).toBe(true);
    expect(migrated.save.version).toBe(saveVersion);
    expect(Array.isArray(migrated.logisticsQueues?.pendingTransfers)).toBe(true);
    expect(migrated.logisticsQueues?.pendingTransfers).toHaveLength(1);
    const [transfer] = migrated.logisticsQueues?.pendingTransfers ?? [];
    expect(transfer.fromFactoryId).toBe('factory-0');
    expect(transfer.toFactoryId).toBe('factory-1');
    expect(transfer.amount).toBe(10);
    expect(transfer.status).toBe('in-transit');
    expect(transfer.departedAt).toBeLessThanOrEqual(transfer.eta);
    expect(transfer.departedAt).toBeGreaterThanOrEqual(transfer.eta - 0.15);

    expect(migrated.factories?.[0]?.currentStorage).toBe(25);
    expect(migrated.factories?.[0]?.resources?.ore).toBe(25);
    expect(migrated.factories?.[0]?.logisticsState?.outboundReservations).toEqual({});
    expect(migrated.factories?.[0]?.logisticsState?.inboundSchedules).toHaveLength(1);
    expect(migrated.factories?.[0]?.logisticsState?.inboundSchedules?.[0]?.amount).toBe(15);
  });
  it('initializes hauler module and factory upgrade defaults', () => {
    const legacy = {
      resources: {
        ore: 10,
        metals: 5,
        crystals: 2,
        organics: 0,
        ice: 0,
        bars: 3,
        energy: 20,
        credits: 0,
      },
      modules: {
        droneBay: 2,
        refinery: 1,
        storage: 0,
        solar: 0,
        scanner: 0,
        haulerDepot: 0,
        logisticsHub: 0,
        routingProtocol: 0,
      },
      factories: [
        {
          id: 'factory-legacy',
          position: [0, 0, 0] as [number, number, number],
          dockingCapacity: 3,
          refineSlots: 2,
          idleEnergyPerSec: 1,
          energyPerRefine: 2,
          storageCapacity: 300,
          currentStorage: 0,
          queuedDrones: [],
          activeRefines: [],
          pinned: false,
          energy: 40,
          energyCapacity: 80,
          resources: { ore: 10, metals: 5, crystals: 2, organics: 0, ice: 0, bars: 3, credits: 0 },
          upgrades: { docking: 0, refine: 0, storage: 0, energy: 0, solar: 0 },
          upgradeRequests: [],
          haulersAssigned: 0,
          logisticsState: { outboundReservations: {}, inboundSchedules: [] },
        },
      ],
      logisticsQueues: { pendingTransfers: [] },
      droneFlights: [],
      save: { lastSave: Date.now(), version: '0.3.2' },
      prestige: { cores: 0 },
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 10,
        offlineCapHours: 8,
        notation: 'standard',
        throttleFloor: 0.25,
        showTrails: true,
        showHaulerShips: true,
        metrics: {
          enabled: true,
          intervalSeconds: 5,
          retentionSeconds: 300,
        },
        performanceProfile: 'medium',
        inspectorCollapsed: false,
        showDebugPanel: false,
        useRustSim: false,
      },
    } satisfies Partial<StoreSnapshot>;

    const { snapshot: migrated } = migrateSnapshot(legacy as StoreSnapshot);

    expect(migrated.modules.haulerDepot).toBe(0);
    expect(migrated.modules.logisticsHub).toBe(0);
    expect(migrated.modules.routingProtocol).toBe(0);
    const [factory] = migrated.factories ?? [];
    expect(factory?.haulerUpgrades).toEqual({
      capacityBoost: 0,
      speedBoost: 0,
      efficiencyBoost: 0,
    });
  });
});
