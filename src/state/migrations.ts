import type { StoreSnapshot } from '@/state/store';
import { saveVersion } from '@/state/store';

export interface MigrationReport {
  migrated: boolean;
  fromVersion: string;
  toVersion: string;
  applied: string[]; // short descriptions of applied migrations
}

type MigrationFn = (snapshot: StoreSnapshot) => { snapshot: StoreSnapshot; description?: string };

// Simple semver compare for 'x.y.z' strings. Returns -1 if a<b, 0 if equal, 1 if a>b
const semverCompare = (a: string, b: string) => {
  const pa = a.split('.').map((s) => Number(s));
  const pb = b.split('.').map((s) => Number(s));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
};

// Registry of migrations to apply in ascending order of targetVersion
const migrations: Array<{ targetVersion: string; migrate: MigrationFn }> = [
  {
    targetVersion: '0.1.0',
    migrate: (snapshot) => {
      const migrated = { ...snapshot } as StoreSnapshot;
      // ensure showTrails exists on settings (introduced in 0.1.0)
      migrated.settings = { ...(migrated.settings ?? {}), showTrails: migrated.settings?.showTrails ?? true };
  migrated.save = { ...(migrated.save ?? ({} as StoreSnapshot['save'])), version: snapshot.save?.version ?? '0.0.0', lastSave: migrated.save?.lastSave ?? Date.now() };
      return { snapshot: migrated, description: 'ensure settings.showTrails default and save meta' };
    },
  },
  {
    targetVersion: '0.0.2',
    migrate: (snapshot) => {
      // historical placeholder migration: normalize numeric fields that used to be strings
      const migrated = { ...snapshot } as StoreSnapshot;
      if (migrated.resources) {
        migrated.resources = {
          ore: Number(migrated.resources.ore) || 0,
          bars: Number(migrated.resources.bars) || 0,
          energy: Number(migrated.resources.energy) || 0,
          credits: Number(migrated.resources.credits) || 0,
        };
      }
      return { snapshot: migrated, description: 'normalize numeric resource fields' };
    },
  },
  {
    targetVersion: '0.0.3',
    migrate: (snapshot) => {
      // placeholder: ensure modules object has all keys
      const migrated = { ...snapshot } as StoreSnapshot;
      migrated.modules = {
        droneBay: migrated.modules?.droneBay ?? 1,
        refinery: migrated.modules?.refinery ?? 0,
        storage: migrated.modules?.storage ?? 0,
        solar: migrated.modules?.solar ?? 0,
        scanner: migrated.modules?.scanner ?? 0,
      };
      return { snapshot: migrated, description: 'ensure module keys exist' };
    },
  },
];

/**
 * Migrate a snapshot to the current saveVersion. Returns the migrated snapshot and a human-readable report.
 */
export const migrateSnapshot = (
  snapshot: StoreSnapshot,
): { snapshot: StoreSnapshot; report: MigrationReport } => {
  const incoming = snapshot?.save?.version ?? '0.0.0';
  const report: MigrationReport = {
    migrated: false,
    fromVersion: incoming,
    toVersion: saveVersion,
    applied: [],
  };

  if (semverCompare(incoming, saveVersion) >= 0) {
    // already up-to-date
    return { snapshot, report };
  }

  // Copy to avoid mutating original
  let working = { ...snapshot } as StoreSnapshot;

  // Apply migrations whose targetVersion is greater than incoming and <= saveVersion
  for (const entry of migrations.sort((a, b) => semverCompare(a.targetVersion, b.targetVersion))) {
    if (semverCompare(incoming, entry.targetVersion) < 0 && semverCompare(entry.targetVersion, saveVersion) <= 0) {
      const result = entry.migrate(working);
      working = result.snapshot;
      if (result.description) report.applied.push(result.description);
      report.migrated = true;
    }
  }

  // Finalize
  working.save = { ...(working.save ?? ({} as StoreSnapshot['save'])), version: saveVersion, lastSave: working.save?.lastSave ?? Date.now() };
  report.toVersion = saveVersion;
  return { snapshot: working, report };
};

export default migrateSnapshot;
