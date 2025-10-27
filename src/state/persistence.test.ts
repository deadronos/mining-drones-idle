import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createStoreInstance } from '@/state/store';
import { createPersistenceManager, SAVE_KEY } from '@/state/persistence';
import * as offlineLib from '@/lib/offline';

const FIXED_NOW = new Date('2025-02-14T12:00:00Z');

describe('state/persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('loads save and simulates offline with configured cap hours', { timeout: 30000 }, () => {
    const store = createStoreInstance();
    const snapshot = {
      resources: {
        ore: 5_000,
        ice: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
        bars: 0,
        energy: 160,
        credits: 0,
      },
      modules: { droneBay: 3, refinery: 2, storage: 1, solar: 1, scanner: 0 },
      prestige: { cores: 4 },
      save: { lastSave: FIXED_NOW.getTime() - 13 * 3600 * 1000, version: '0.2.0' },
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 10,
        offlineCapHours: 12,
        notation: 'standard' as const,
        throttleFloor: 0.25,
        showTrails: true,
        showHaulerShips: true,
        performanceProfile: 'medium' as const,
      },
      rngSeed: 123456789,
      droneFlights: [],
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));

    const spy = vi.spyOn(offlineLib, 'simulateOfflineProgress');

    const manager = createPersistenceManager(store);
    manager.load();

    expect(spy).toHaveBeenCalledTimes(1);
    const [api, seconds, options] = spy.mock.calls[0];
    expect(api).toBe(store);
    expect(seconds).toBeCloseTo(12 * 3600, 5);
    expect(options?.capHours).toBe(12);

    const state = store.getState();
    expect(state.resources.bars).toBeGreaterThan(0);
    expect(state.save.lastSave).toBeGreaterThanOrEqual(Date.now());

    const persisted = window.localStorage.getItem(SAVE_KEY);
    expect(persisted).toBeTruthy();
  });
});
