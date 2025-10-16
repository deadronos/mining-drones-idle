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

export interface PersistenceManager {
  load(this: void): void;
  start(this: void): void;
  stop(this: void): void;
  saveNow(this: void): void;
  exportState(this: void): string;
  importState(this: void, payload: string): boolean;
}

const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const equality = (a: StoreSettings, b: StoreSettings) =>
  a.autosaveEnabled === b.autosaveEnabled && a.autosaveInterval === b.autosaveInterval;

export const createPersistenceManager = (
  store: StoreApi<StoreState> = storeApi,
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
      snapshot = migrateSnapshot(snapshot);
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
    // parse + migrate before handing to store import
    const parsed = parseSnapshot(payload);
    if (!parsed) return false;
    let migrated = parsed;
    try {
      migrated = migrateSnapshot(parsed);
    } catch (err) {
      console.warn('Migration failed during import', err);
    }
    const success = store.getState().importState(JSON.stringify(migrated));
    if (!success) return false;
    store.getState().setLastSave(Date.now());
    saveNow();
    scheduleAutosave();
    return true;
  };

  return { load, start, stop, saveNow, exportState, importState };
};
