import type { StoreSnapshot } from '../state/types';
import { buildRustSimBridge, type RustSimBridge, type WasmSimExports } from './wasmSimBridge';
import { normalizeSnapshot, validateSnapshotForWasm } from '../state/serialization/store';

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
    const wasmModule = (await import('../gen/rust_engine')) as typeof import('../gen/rust_engine');
    const initOutput = await wasmModule.default();
    const memory = (initOutput as { memory?: WebAssembly.Memory }).memory;
    if (!memory) {
      throw new Error('WASM init missing memory');
    }

    const exports: WasmSimExports = {
      memory,
      WasmGameState: wasmModule.WasmGameState,
    };

    // Pre-validate the original snapshot and provide friendly messages
    // if it looks incomplete. We still normalize and proceed because
    // that's the safe default, but explicit validation gives clearer
    // runtime guidance when callers pass incomplete snapshots.
    const validationIssues = validateSnapshotForWasm(snapshot as Partial<StoreSnapshot>);
    if (validationIssues.length > 0) {
      console.warn('[WASM Loader] Provided snapshot had validation issues:', validationIssues.join('; '));
    }

    // Normalize incoming snapshot to ensure required core fields are present
    // while preserving any top-level extras (like `asteroids` and
    // `droneFlights`) that callers may have attached for WASM.
    const baseSnapshot = normalizeSnapshot(snapshot as Partial<StoreSnapshot>);
    const safeSnapshot = { ...baseSnapshot } as StoreSnapshot & Record<string, unknown>;

    // Preserve known extras used by the Rust engine if the caller provided them
    // (useRustEngine adds asteroids and droneFlights at the top-level).
    type SnapshotExtras = { asteroids?: unknown; droneFlights?: unknown };
    const extras = snapshot as SnapshotExtras;
    if (Array.isArray(extras.asteroids)) {
      (safeSnapshot as SnapshotExtras).asteroids = extras.asteroids;
    }
    if (Array.isArray(extras.droneFlights)) {
      (safeSnapshot as SnapshotExtras).droneFlights = extras.droneFlights;
    }

    const bridge = buildRustSimBridge(exports, safeSnapshot as StoreSnapshot);

    return {
      bridge,
      error: null,
      fallbackReason: null,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[WASM Loader] Failed to load Rust engine:', error);

    // Provide a slightly more actionable fallback reason for common
    // serde deserialization errors coming from Rust (e.g. missing field).
    let reason = error.message;
    const missingFieldRegex = /missing field `([^`]+)`/i;
    const missingFieldMatch = missingFieldRegex.exec(error.message);
    if (missingFieldMatch) {
      const field = missingFieldMatch[1];
      reason = `WASM deserialization failed: missing field '${field}'. Ensure the snapshot includes this property (call normalizeSnapshot before sending) - original: ${error.message}`;
    }

    return {
      bridge: null,
      error,
      fallbackReason: `WASM load failed: ${reason}`,
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
