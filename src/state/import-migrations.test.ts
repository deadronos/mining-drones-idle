import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createStoreInstance } from '@/state/store';
import { createPersistenceManager, SAVE_KEY, type PersistenceManager } from '@/state/persistence';
import type { MigrationReport } from '@/state/migrations';

describe('persistence migration reporting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-14T12:00:00Z'));
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('importStateWithReport returns a migration report when importing legacy payloads', () => {
    const store = createStoreInstance();
    const manager = createPersistenceManager(store) as PersistenceManager & {
      importStateWithReport?: (payload: string) => { success: boolean; report?: MigrationReport };
    };
    const legacy = {
      resources: {
        ore: 1,
        ice: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
        bars: 0,
        energy: 100,
        credits: 0,
      },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0 },
      prestige: { cores: 0 },
      save: { lastSave: Date.now() - 1000, version: '0.0.1' },
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 10,
        offlineCapHours: 8,
        notation: 'standard',
        throttleFloor: 0.25,
      },
    };
    if (!manager.importStateWithReport)
      throw new Error('importStateWithReport not implemented on manager');
    const { success, report } = manager.importStateWithReport(JSON.stringify(legacy));
    expect(success).toBe(true);
    expect(report).toBeTruthy();
    expect(report!.migrated).toBe(true);
    expect(report!.fromVersion).toBe('0.0.1');
    expect(Object.keys(store.getState().droneFlights)).toHaveLength(0);
  });

  it('loadWithReport returns a report after loading a legacy save from storage', () => {
    const store = createStoreInstance();
    const legacy = {
      resources: {
        ore: 2,
        ice: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
        bars: 0,
        energy: 100,
        credits: 0,
      },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0 },
      prestige: { cores: 0 },
      save: { lastSave: Date.now() - 1000, version: '0.0.1' },
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 10,
        offlineCapHours: 8,
        notation: 'standard',
        throttleFloor: 0.25,
      },
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(legacy));
    const manager = createPersistenceManager(store) as PersistenceManager & {
      loadWithReport?: () => MigrationReport | undefined;
    };
    manager.load();
    if (!manager.loadWithReport) throw new Error('loadWithReport not implemented on manager');
    const report = manager.loadWithReport();
    expect(report).toBeTruthy();
    expect(report!.migrated).toBe(true);
    expect(report!.fromVersion).toBe('0.0.1');
    expect(Object.keys(store.getState().droneFlights)).toHaveLength(0);
  });
});
