import { useEffect, useState } from 'react';
import init, { WasmGameState } from '../gen/rust_engine';
import { buildRustSimBridge, type RustSimBridge } from '../lib/wasmSimBridge';
import { useStore } from '../state/store';
import { serializeStore } from '../state/serialization/store';
import { gameWorld } from '@/ecs/world';
import type { StoreSnapshot, DroneFlightState } from '../state/types';

export function useRustEngine(shouldInitialize: boolean) {
  const [bridge, setBridge] = useState<RustSimBridge | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const rngSeed = useStore((state) => state.rngSeed);

  useEffect(() => {
    if (!shouldInitialize) return;

    let mounted = true;

    const loadWasm = async () => {
      try {
        const wasmModule = await init();

        if (mounted) {
          const exports = {
            memory: wasmModule.memory,
            WasmGameState: WasmGameState,
          };

          // Initialize with current store state
          const currentSnapshot = serializeStore(useStore.getState());

          // Inject asteroid data from ECS
          const asteroids = gameWorld.asteroidQuery.entities.map((entity) => ({
            id: entity.id,
            position: [entity.position.x, entity.position.y, entity.position.z],
            oreRemaining: entity.oreRemaining,
            maxOre: entity.oreRemaining, // Assuming current is max for now, or we need to store max
          }));

          // Inject drone data from ECS to ensure parity with running simulation
          const droneFlights = gameWorld.droneQuery.entities.map((entity) => ({
            droneId: entity.id,
            state: entity.state as any,
            targetAsteroidId: entity.targetId ?? undefined,
            targetRegionId: entity.targetRegionId ?? undefined,
            targetFactoryId: entity.targetFactoryId ?? undefined,
            pathSeed: entity.flightSeed ?? 0,
            travel: entity.travel
              ? {
                  from: [entity.travel.from.x, entity.travel.from.y, entity.travel.from.z],
                  to: [entity.travel.to.x, entity.travel.to.y, entity.travel.to.z],
                  elapsed: entity.travel.elapsed,
                  duration: entity.travel.duration,
                  control: entity.travel.control
                    ? [entity.travel.control.x, entity.travel.control.y, entity.travel.control.z]
                    : undefined,
                }
              : {
                  from: [entity.position.x, entity.position.y, entity.position.z],
                  to: [entity.position.x, entity.position.y, entity.position.z],
                  elapsed: 0,
                  duration: 0,
                },
          }));

          // We need to cast to extend the type because extra is not strictly typed in TS interface yet
          const snapshotWithExtra = currentSnapshot as StoreSnapshot & { extra: Record<string, unknown> };
          snapshotWithExtra.extra = {
            asteroids,
          };
          // Override droneFlights with current ECS state
          snapshotWithExtra.droneFlights = droneFlights as DroneFlightState[];

          const newBridge = buildRustSimBridge(exports, snapshotWithExtra);
          setBridge(newBridge);
          setIsLoaded(true);
          console.log('Rust engine loaded and initialized');
        }
      } catch (err) {
        console.error('Failed to load WASM module:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error loading WASM'));
        }
      }
    };

    void loadWasm();

    return () => {
      mounted = false;
    };
  }, [shouldInitialize, rngSeed]);

  return { bridge, isLoaded, error };
}
