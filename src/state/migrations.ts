/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unnecessary-type-assertion */
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
    targetVersion: '0.2.0',
    migrate: (snapshot) => {
      const migrated = { ...snapshot } as StoreSnapshot;
      if (!Array.isArray(migrated.droneFlights)) {
        migrated.droneFlights = [];
      }
      return { snapshot: migrated, description: 'initialize drone flight state array' };
    },
  },
  {
    targetVersion: '0.1.0',
    migrate: (snapshot) => {
      const migrated = { ...snapshot } as StoreSnapshot;
      // ensure showTrails exists on settings (introduced in 0.1.0)
      migrated.settings = {
        ...(migrated.settings ?? {}),
        showTrails: migrated.settings?.showTrails ?? true,
      };
      const existingSave = migrated.save ?? { lastSave: Date.now(), version: '0.0.0' };
      migrated.save = {
        ...existingSave,
        version: snapshot.save?.version ?? existingSave.version,
        lastSave: existingSave.lastSave ?? Date.now(),
      };
      return {
        snapshot: migrated,
        description: 'ensure settings.showTrails default and save meta',
      };
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
          ice: Number(migrated.resources?.ice) || 0,
          metals: Number(migrated.resources?.metals) || 0,
          crystals: Number(migrated.resources?.crystals) || 0,
          organics: Number(migrated.resources?.organics) || 0,
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
  {
    targetVersion: '0.3.0',
    migrate: (snapshot) => {
      // Add hauler logistics fields
      const migrated = { ...snapshot } as StoreSnapshot;
      if (Array.isArray(migrated.factories)) {
        migrated.factories = migrated.factories.map((factory: any) => ({
          ...factory,
          haulersAssigned: factory.haulersAssigned ?? 0,
          haulerConfig: factory.haulerConfig ?? {
            capacity: 50,
            speed: 1.0,
            pickupOverhead: 1.0,
            dropoffOverhead: 1.0,
            resourceFilters: [],
            mode: 'auto',
            priority: 5,
          },
          logisticsState: factory.logisticsState ?? {
            outboundReservations: {},
            inboundSchedules: [],
          },
        }));
      }

      migrated.logisticsQueues ??= { pendingTransfers: [] };
      return { snapshot: migrated, description: 'add hauler logistics fields' };
    },
  },
  {
    targetVersion: '0.3.1',
    migrate: (snapshot) => {
      const migrated = { ...snapshot } as StoreSnapshot;
      if (Array.isArray(migrated.factories)) {
        migrated.factories = migrated.factories.map((factory: any) => {
          const upgrades = factory.upgrades ?? {};
          return {
            ...factory,
            upgrades: {
              docking: upgrades.docking ?? 0,
              refine: upgrades.refine ?? 0,
              storage: upgrades.storage ?? 0,
              energy: upgrades.energy ?? 0,
              solar: upgrades.solar ?? 0,
            },
          };
        });
      }
      return { snapshot: migrated, description: 'ensure factory solar upgrade defaults' };
    },
  },
  {
    targetVersion: '0.3.2',
    migrate: (snapshot) => {
      const migrated = { ...snapshot } as StoreSnapshot;

      if (Array.isArray(migrated.factories)) {
        migrated.factories = migrated.factories.map((factory: any) => {
          const resources = factory.resources ?? {};
          const normalizedOre = Number(resources.ore) || 0;
          const inboundSchedules = Array.isArray(factory.logisticsState?.inboundSchedules)
            ? factory.logisticsState.inboundSchedules
                .map((schedule: any) => ({
                  fromFactoryId: schedule?.fromFactoryId ?? null,
                  resource: schedule?.resource,
                  amount: Number(schedule?.amount) || 0,
                  eta: Number(schedule?.eta) || 0,
                }))
                .filter(
                  (schedule: any) =>
                    typeof schedule.resource === 'string' &&
                    schedule.amount > 0 &&
                    Number.isFinite(schedule.eta),
                )
            : [];
          return {
            ...factory,
            resources: {
              ore: Number(resources.ore) || 0,
              bars: Number(resources.bars) || 0,
              metals: Number(resources.metals) || 0,
              crystals: Number(resources.crystals) || 0,
              organics: Number(resources.organics) || 0,
              ice: Number(resources.ice) || 0,
              credits: Number(resources.credits) || 0,
            },
            currentStorage: typeof factory.currentStorage === 'number' ? factory.currentStorage : normalizedOre,
            logisticsState: {
              outboundReservations:
                factory.logisticsState?.outboundReservations && typeof factory.logisticsState.outboundReservations === 'object'
                  ? factory.logisticsState.outboundReservations
                  : {},
              inboundSchedules,
            },
          };
        });
      }

      const pendingTransfers = migrated.logisticsQueues?.pendingTransfers;
      migrated.logisticsQueues = {
        pendingTransfers: Array.isArray(pendingTransfers)
          ? pendingTransfers
              .map((transfer: any) => ({
                id: transfer?.id ?? `migration-${Date.now()}`,
                fromFactoryId: transfer?.fromFactoryId,
                toFactoryId: transfer?.toFactoryId,
                resource: transfer?.resource,
                amount: Number(transfer?.amount) || 0,
                eta: Number(transfer?.eta) || 0,
                status: (transfer?.status === 'in-transit' ? 'in-transit' : 'scheduled') as 'in-transit' | 'scheduled',
              }))
              .filter(
                (transfer: any) =>
                  typeof transfer.fromFactoryId === 'string' &&
                  typeof transfer.toFactoryId === 'string' &&
                  typeof transfer.resource === 'string' &&
                  transfer.amount > 0 &&
                  Number.isFinite(transfer.eta),
              )
          : [],
      };

      return { snapshot: migrated, description: 'normalize logistics data for warehouse routing' };
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
    if (
      semverCompare(incoming, entry.targetVersion) < 0 &&
      semverCompare(entry.targetVersion, saveVersion) <= 0
    ) {
      const result = entry.migrate(working);
      working = result.snapshot;
      if (result.description) report.applied.push(result.description);
      report.migrated = true;
    }
  }

  // Finalize
  working.save = {
    ...(working.save ?? ({} as StoreSnapshot['save'])),
    version: saveVersion,
    lastSave: working.save?.lastSave ?? Date.now(),
  };
  report.toVersion = saveVersion;
  return { snapshot: working, report };
};

/**
 * Simple wrapper for applyMigrations that returns just the migrated snapshot (for backward compatibility).
 */
export const applyMigrations = (snapshot: Partial<StoreSnapshot>): Partial<StoreSnapshot> => {
  const result = migrateSnapshot(snapshot as StoreSnapshot);
  return result.snapshot;
};

export default migrateSnapshot;
