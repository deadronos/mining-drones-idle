import { describe, it, expect } from 'vitest';
import { migrateSnapshot } from './migrations';
import { saveVersion } from './store';
import type { StoreSnapshot } from './store';

describe('migrations', () => {
  it('adds showTrails default and updates version for legacy snapshots', () => {
    const legacy = {
      resources: { ore: 10, bars: 0, energy: 50, credits: 0 },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0 },
      prestige: { cores: 0 },
      save: { lastSave: 1_000_000, version: '0.0.1' },
      settings: { autosaveEnabled: true, autosaveInterval: 10, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.25 },
    } as Partial<StoreSnapshot>;

    const migrated = migrateSnapshot(legacy as StoreSnapshot);
    expect(migrated.save.version).toBe(saveVersion);
    expect(migrated.settings).toBeDefined();
    // showTrails should be present and default to true
    expect((migrated.settings).showTrails).toBe(true);
  });

  it('is idempotent when applied to current snapshots', () => {
    const current = {
      resources: { ore: 0, bars: 0, energy: 100, credits: 0 },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0 },
      prestige: { cores: 0 },
      save: { lastSave: Date.now(), version: saveVersion },
      settings: { autosaveEnabled: true, autosaveInterval: 10, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.25, showTrails: false },
    } as StoreSnapshot;
    const migrated = migrateSnapshot(current);
    expect(migrated.save.version).toBe(saveVersion);
    expect(migrated.settings.showTrails).toBe(false);
  });
});
