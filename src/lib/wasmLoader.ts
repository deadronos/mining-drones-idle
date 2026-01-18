import type { StoreSnapshot } from '../state/types';
import { buildRustSimBridge, type RustSimBridge, type WasmSimExports } from './wasmSimBridge';
import type { InitOutput } from '../gen/rust_engine';
import { normalizeSnapshot, validateSnapshotForWasm } from '../state/serialization/store';
import { parityDebugEnabled } from './parityDebug';

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
      const mod = (await import('../gen/rust_engine')) as unknown;

      type RustEngineModule = WasmSimExports & {
        default: (...args: unknown[]) => Promise<InitOutput>;
        set_parity_debug?: (enabled: boolean) => void;
      };

      const isRustEngineModule = (m: unknown): m is RustEngineModule => {
        if (typeof m !== 'object' || m === null) return false;
        const r = m as Record<string, unknown>;
        return (
          typeof r.default === 'function' &&
          typeof r.WasmGameState === 'function' &&
          // `memory` is returned from the init output rather than being a top-level export
          true
        );
      };

      if (!isRustEngineModule(mod)) {
        throw new Error('Imported rust_engine module has an unexpected shape');
      }

      const wasmModule = mod;
      const initOutput = await wasmModule.default();
      const memory = initOutput.memory;
      const hasMemoryBuffer = Boolean(memory && (memory as { buffer?: unknown }).buffer);
      if (!hasMemoryBuffer && !(memory instanceof WebAssembly.Memory)) {
        throw new Error('WASM init missing memory');
      }

      if (parityDebugEnabled && typeof wasmModule.set_parity_debug === 'function') {
        wasmModule.set_parity_debug(true);
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
    // Match several common patterns produced by serde messages: backticks,
    // single quotes, or unquoted identifiers (e.g. `missing field `bars``,
    // `missing field 'bars'`, `missing field bars`).
    let reason = error.message;
    // Match serde 'missing field' patterns with optional separators used by
    // different error messages, e.g. `missing field `bars``,
    // `missing field 'bars'`, `missing field bars`, and `missing field: bars`.
    const missingFieldRegex = /missing field(?:\s*:\s*|\s+)(?:`([^`]+)`|'([^']+)'|([A-Za-z0-9_.-]+))/i;
    const match = missingFieldRegex.exec(error.message);
    if (match) {
      const field = match[1] ?? match[2] ?? match[3] ?? 'unknown';
      reason = `WASM deserialization failed: missing field '${field}'. Ensure the snapshot includes this property (call normalizeSnapshot before sending) - original: ${error.message}`;
    }

    const fallbackReason = `WASM load failed: ${reason}`;
    // Also log the more actionable fallback reason to make debugging easier
    console.error('[WASM Loader] Fallback reason:', fallbackReason);
    return {
      bridge: null,
      error,
      fallbackReason,
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
