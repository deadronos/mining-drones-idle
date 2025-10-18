import type { StoreApi } from 'zustand';
import {
  type StoreState,
  type StoreSnapshot,
  type StoreSettings,
  serializeStore,
  stringifySnapshot,
  parseSnapshot,
  storeApi,
  saveVersion,
} from '@/state/store';
import { migrateSnapshot } from '@/state/migrations';
import { computeOfflineSeconds, simulateOfflineProgress } from '@/lib/offline';

export const SAVE_KEY = 'space-factory-save';

import type { MigrationReport } from '@/state/migrations';

export interface PersistenceManager {
  load(this: void): void;
  // returns a migration report when one was applied
  loadWithReport?(this: void): MigrationReport | undefined;
  start(this: void): void;
  stop(this: void): void;
  saveNow(this: void): void;
  exportState(this: void): string;
  importState(this: void, payload: string): boolean;
  // import with migration report
  importStateWithReport?(
    this: void,
    payload: string,
  ): { success: boolean; report?: MigrationReport };
}

const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const equality = (a: StoreSettings, b: StoreSettings) =>
  a.autosaveEnabled === b.autosaveEnabled && a.autosaveInterval === b.autosaveInterval;

export const createPersistenceManager = (
  store: StoreApi<StoreState> = storeApi,
  options?: { onMigrationReport?: (report?: MigrationReport) => void },
): PersistenceManager => {
  let autosaveHandle: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const clearAutosave = () => {
    if (autosaveHandle) {
      clearInterval(autosaveHandle);
      autosaveHandle = null;
    }
  };

  const persistSnapshot = (snapshot: StoreSnapshot) => {
    if (!hasStorage()) return;
    try {
      window.localStorage.setItem(SAVE_KEY, stringifySnapshot(snapshot));
    } catch (error) {
      console.warn('Failed to persist save', error);
    }
  };

  const saveNow = () => {
    if (!hasStorage()) return;
    const now = Date.now();
    store.getState().setLastSave(now);
    const snapshot = serializeStore(store.getState());
    snapshot.save.lastSave = now;
    snapshot.save.version ??= saveVersion;
    persistSnapshot(snapshot);
  };

  const scheduleAutosave = (settings: StoreSettings = store.getState().settings) => {
    clearAutosave();
    if (!settings.autosaveEnabled || !hasStorage()) return;
    const delay = Math.max(1, Math.floor(settings.autosaveInterval)) * 1000;
    autosaveHandle = setInterval(() => {
      saveNow();
    }, delay);
  };

  let lastLoadReport: MigrationReport | undefined;

  const load = () => {
    if (!hasStorage()) return;
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      store.getState().setLastSave(Date.now());
      return;
    }
    let snapshot = parseSnapshot(raw);
    if (!snapshot) {
      store.getState().setLastSave(Date.now());
      return;
    }
    // Run migrations to ensure snapshot shape is current
    try {
      const result = migrateSnapshot(snapshot);
      snapshot = result.snapshot;
      lastLoadReport = result.report;
      options?.onMigrationReport?.(result.report);
    } catch (err) {
      console.warn('Migration failed, falling back to parsed snapshot', err);
    }
    store.getState().applySnapshot(snapshot);
    const now = Date.now();
    const settings = store.getState().settings;
    const offlineSeconds = computeOfflineSeconds(
      snapshot.save.lastSave,
      now,
      settings.offlineCapHours,
    );
    if (offlineSeconds > 0) {
      const report = simulateOfflineProgress(store, offlineSeconds, {
        capHours: settings.offlineCapHours,
      });
      if (report.barsProduced > 0 || report.oreConsumed > 0) {
        console.info(
          `Simulated ${report.simulatedSeconds.toFixed(1)}s of offline progress`,
          report,
        );
      }
    }
    store.getState().setLastSave(now);
    saveNow();
  };

  const start = () => {
    scheduleAutosave();
    unsubscribe ??= store.subscribe((state, previous) => {
      if (!previous || !equality(state.settings, previous.settings)) {
        scheduleAutosave(state.settings);
      }
    });
  };

  const stop = () => {
    clearAutosave();
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  const exportState = () => store.getState().exportState();

  const importState = (payload: string) => {
    const result = importStateWithReport(payload);
    return result.success;
  };

  const importStateWithReport = (payload: string) => {
    // parse + migrate before handing to store import
    const parsed = parseSnapshot(payload);
    if (!parsed) return { success: false as const };
    let migrated = parsed;
    let report;
    try {
      const r = migrateSnapshot(parsed);
      migrated = r.snapshot;
      report = r.report;
      options?.onMigrationReport?.(report);
    } catch (err) {
      console.warn('Migration failed during import', err);
    }
    const success = store.getState().importState(JSON.stringify(migrated));
    if (!success) return { success: false as const, report };
    store.getState().setLastSave(Date.now());
    saveNow();
    scheduleAutosave();
    return { success: true as const, report };
  };

  return {
    load,
    start,
    stop,
    saveNow,
    exportState,
    importState,
    importStateWithReport,
    loadWithReport: () => lastLoadReport,
  };
};
