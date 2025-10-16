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

      const { snapshot: migrated, report } = migrateSnapshot(legacy as StoreSnapshot);
      expect(report.migrated).toBe(true);
      expect(report.fromVersion).toBe('0.0.1');
      expect(report.toVersion).toBe(saveVersion);
      expect(migrated.save.version).toBe(saveVersion);
      expect(migrated.settings).toBeDefined();
      // showTrails should be present and default to true
      expect(migrated.settings.showTrails).toBe(true);
      expect(Array.isArray(migrated.droneFlights)).toBe(true);
      expect(migrated.droneFlights?.length).toBe(0);
  });

  it('is idempotent when applied to current snapshots', () => {
    const current = {
      resources: { ore: 0, bars: 0, energy: 100, credits: 0 },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0 },
      prestige: { cores: 0 },
      save: { lastSave: Date.now(), version: saveVersion },
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 10,
        offlineCapHours: 8,
        notation: 'standard',
        throttleFloor: 0.25,
        showTrails: false,
        performanceProfile: 'medium',
      },
      droneFlights: [] as StoreSnapshot['droneFlights'],
    } as StoreSnapshot;
      const { snapshot: migrated, report } = migrateSnapshot(current);
      expect(report.migrated).toBe(false);
      expect(migrated.save.version).toBe(saveVersion);
      expect(migrated.settings.showTrails).toBe(false);
      expect(migrated.droneFlights).toEqual([]);
  });
});
