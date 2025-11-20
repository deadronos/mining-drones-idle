import { useEffect, useState } from 'react';
import init, { WasmGameState } from '../gen/rust_engine';
import { buildRustSimBridge, type RustSimBridge } from '../lib/wasmSimBridge';
import { useStore } from '../state/store';
import { serializeStore } from '../state/serialization/store';

export function useRustEngine() {
  const [bridge, setBridge] = useState<RustSimBridge | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
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

          const newBridge = buildRustSimBridge(exports, currentSnapshot);
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
  }, []);

  return { bridge, isLoaded, error };
}
