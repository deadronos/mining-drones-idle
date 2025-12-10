import { useEffect, useState, useCallback } from 'react';
import type { RustSimBridge } from '../lib/wasmSimBridge';
import { loadWasmBridge } from '../lib/wasmLoader';
import { registerBridge, unregisterBridge } from '../lib/rustBridgeRegistry';
import { useStore } from '../state/store';
import { serializeStore, normalizeSnapshot } from '../state/serialization/store';
import { gameWorld } from '@/ecs/world';
import type { StoreSnapshot, DroneFlightState } from '../state/types';
import { computeOfflineSeconds } from '../lib/offline';

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

  const buildSnapshot = useCallback((): StoreSnapshot & Record<string, unknown> => {
    // Ensure we pass a fully-normalized snapshot to the Rust engine so
    // required numeric fields (like `bars`) are always present.
    const currentSnapshot = normalizeSnapshot(serializeStore(useStore.getState()));

    // Inject asteroid data from ECS
    const asteroids = gameWorld.asteroidQuery.entities.map((entity) => ({
      id: entity.id,
      position: [entity.position.x, entity.position.y, entity.position.z],
      oreRemaining: entity.oreRemaining,
      maxOre: entity.oreRemaining,
      resourceProfile: entity.resourceProfile ?? { ore: 1, ice: 0, metals: 0, crystals: 0, organics: 0 },
    }));

    // Inject drone data from ECS
    const droneFlights = gameWorld.droneQuery.entities.map((entity) => ({
      droneId: entity.id,
      state: entity.state as DroneFlightState['state'],
      targetAsteroidId: entity.targetId ?? null,
      targetRegionId: entity.targetRegionId ?? null,
      targetFactoryId: entity.targetFactoryId ?? null,
      ownerFactoryId: entity.ownerFactoryId ?? null,
      pathSeed: entity.flightSeed ?? 0,
      cargo: entity.cargo ?? 0,
      battery: entity.battery ?? 100,
      maxBattery: entity.maxBattery ?? 100,
      capacity: entity.capacity ?? 10,
      miningRate: entity.miningRate ?? 1,
      charging: entity.charging ?? false,
      cargoProfile: entity.cargoProfile ?? { ore: 0, ice: 0, metals: 0, crystals: 0, organics: 0 },
      travel: entity.travel
        ? {
            from: [entity.travel.from.x, entity.travel.from.y, entity.travel.from.z] as [number, number, number],
            to: [entity.travel.to.x, entity.travel.to.y, entity.travel.to.z] as [number, number, number],
            elapsed: entity.travel.elapsed,
            duration: entity.travel.duration,
            control: entity.travel.control
              ? [entity.travel.control.x, entity.travel.control.y, entity.travel.control.z] as [number, number, number]
              : undefined,
          }
        : {
            from: [entity.position.x, entity.position.y, entity.position.z] as [number, number, number],
            to: [entity.position.x, entity.position.y, entity.position.z] as [number, number, number],
            elapsed: 0,
            duration: 0,
          },
    }));

    const snapshotWithExtra = currentSnapshot as StoreSnapshot & Record<string, unknown>;
    // Place asteroid data at the top-level so Rust's `flatten`ed `extra` map
    // will pick up the `asteroids` key directly.
    snapshotWithExtra.asteroids = asteroids;
    snapshotWithExtra.droneFlights = droneFlights as DroneFlightState[];

    return snapshotWithExtra;
  }, []);

  const initializeWasm = useCallback(async () => {
    const snapshot = buildSnapshot();
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
  }, [buildSnapshot]);

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
