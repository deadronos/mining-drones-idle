import type { StoreSnapshot } from '@/state/store';
import { saveVersion } from '@/state/store';

/**
 * Migration utilities for save snapshots.
 * Keep migrations additive and idempotent so repeated runs are safe.
 */
export const migrateSnapshot = (snapshot: StoreSnapshot): StoreSnapshot => {
  if (!snapshot?.save) return snapshot;
  const incoming = snapshot.save.version ?? '0.0.0';
  // If already current, nothing to do
  if (incoming === saveVersion) return snapshot;

  // Generic migration: ensure new fields exist and normalize a couple of edge cases
  const migrated = { ...snapshot } as StoreSnapshot;

  // Ensure settings and the new `showTrails` flag exist (defaults to true)
  migrated.settings = { ...(migrated.settings ?? {}), showTrails: migrated.settings?.showTrails ?? true };

  // Ensure save.meta fields
  migrated.save = {
    ...migrated.save,
    version: saveVersion,
    lastSave: migrated.save.lastSave ?? Date.now(),
  };

  // Future targeted migrations can be chained here based on incoming version.

  return migrated;
};

export default migrateSnapshot;
