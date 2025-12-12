import { useEffect, useState, useCallback } from 'react';
import type { RustSimBridge } from '../lib/wasmSimBridge';
import { loadWasmBridge } from '../lib/wasmLoader';
import { registerBridge, unregisterBridge } from '../lib/rustBridgeRegistry';
import { useStore } from '../state/store';
import type { StoreSnapshot } from '../state/types';
import { computeOfflineSeconds } from '../lib/offline';
import { buildRustSnapshotFromTs } from '@/lib/rustSnapshot';

export interface UseRustEngineResult {
  bridge: RustSimBridge | null;
  isLoaded: boolean;
  error: Error | null;
  fallbackReason: string | null;
  reinitialize: () => Promise<void>;
}

/**
 * React hook to manage Rust WASM simulation engine lifecycle.
 * Provides graceful fallback to TypeScript ECS when WASM unavailable.
 */
export function useRustEngine(shouldInitialize: boolean): UseRustEngineResult {
  const [bridge, setBridge] = useState<RustSimBridge | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const rngSeed = useStore((state) => state.rngSeed);

  const initializeWasm = useCallback(async () => {
    const snapshot = buildRustSnapshotFromTs();
    const result = await loadWasmBridge(snapshot);

    setBridge(result.bridge);
    setError(result.error);
    setFallbackReason(result.fallbackReason);
    setIsLoaded(result.bridge !== null);

    // Register the bridge globally for store actions
    registerBridge(result.bridge);

    if (result.bridge) {
      console.log('[WASM] Rust engine loaded successfully');

      // Check for offline catchup
      const state = useStore.getState();
      const now = Date.now();
      const offlineSeconds = computeOfflineSeconds(state.save.lastSave, now, state.settings.offlineCapHours);
      if (offlineSeconds > 0) {
        console.log(`Running Rust offline sim for ${offlineSeconds}s`);
        // Use a default step of 0.1s for offline sim
        const simResult = result.bridge.simulateOffline(offlineSeconds, 0.1);

        // Update store from result
        const newSnapshot = JSON.parse(simResult.snapshotJson) as StoreSnapshot;
        useStore.getState().applySnapshot(newSnapshot);
        useStore.getState().setLastSave(now);
      }
    }
  }, []);

  const reinitialize = useCallback(async () => {
    if (bridge) {
      unregisterBridge();
      bridge.dispose();
      setBridge(null);
    }
    setIsLoaded(false);
    setError(null);
    setFallbackReason(null);
    await initializeWasm();
  }, [bridge, initializeWasm]);

  useEffect(() => {
    if (!shouldInitialize) return;

    let mounted = true;

    const init = async () => {
      if (!mounted) return;
      await initializeWasm();
    };

    void init();

    return () => {
      mounted = false;
    };
  }, [shouldInitialize, rngSeed, initializeWasm]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bridge) {
        unregisterBridge();
        bridge.dispose();
      }
    };
  }, [bridge]);

  return { bridge, isLoaded, error, fallbackReason, reinitialize };
}
