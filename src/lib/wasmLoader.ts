import type { StoreSnapshot } from '../state/types';
import { buildRustSimBridge, type RustSimBridge, type WasmSimExports } from './wasmSimBridge';

export interface WasmLoadResult {
  bridge: RustSimBridge | null;
  error: Error | null;
  fallbackReason: string | null;
}

/**
 * Attempt to load the WASM module with graceful fallback.
 * Returns null bridge if WASM is unavailable, with error details.
 */
export async function loadWasmBridge(
  snapshot: StoreSnapshot
): Promise<WasmLoadResult> {
  // Feature detect WebAssembly support
  if (typeof WebAssembly === 'undefined') {
    return {
      bridge: null,
      error: null,
      fallbackReason: 'WebAssembly not supported in this browser',
    };
  }

  try {
    // Dynamic import to allow tree-shaking when WASM is not used
    const wasmModule = await import('../gen/rust_engine');
    const initOutput = await wasmModule.default();

    const exports: WasmSimExports = {
      memory: initOutput.memory,
      WasmGameState: wasmModule.WasmGameState,
    };

    const bridge = buildRustSimBridge(exports, snapshot);

    return {
      bridge,
      error: null,
      fallbackReason: null,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[WASM Loader] Failed to load Rust engine:', error);

    return {
      bridge: null,
      error,
      fallbackReason: `WASM load failed: ${error.message}`,
    };
  }
}

/**
 * Initialize WASM bridge with automatic fallback behavior.
 * Logs warnings but does not throw - allows graceful degradation.
 */
export async function initRustBridge(
  snapshot: StoreSnapshot,
  onFallback?: (reason: string) => void
): Promise<RustSimBridge | null> {
  const result = await loadWasmBridge(snapshot);

  if (result.fallbackReason) {
    console.warn(`[WASM] Falling back to TypeScript ECS: ${result.fallbackReason}`);
    onFallback?.(result.fallbackReason);
  }

  return result.bridge;
}
