/**
 * Global registry for the Rust WASM simulation bridge.
 * Allows store actions to access the bridge without React context.
 *
 * Usage:
 * - React component calls `registerBridge(bridge)` when bridge is ready
 * - Store actions call `getBridge()` to get the current bridge
 * - React component calls `unregisterBridge()` on cleanup
 */

import type { RustSimBridge } from './wasmSimBridge';

let activeBridge: RustSimBridge | null = null;

/**
 * Register the active Rust simulation bridge.
 * Called by the React component managing bridge lifecycle.
 */
export function registerBridge(bridge: RustSimBridge | null): void {
  activeBridge = bridge;
}

/**
 * Unregister the bridge (typically on component unmount).
 */
export function unregisterBridge(): void {
  activeBridge = null;
}

/**
 * Get the currently registered bridge.
 * Returns null if no bridge is registered or WASM is unavailable.
 */
export function getBridge(): RustSimBridge | null {
  return activeBridge;
}

/**
 * Check if a bridge is registered and ready.
 */
export function isBridgeReady(): boolean {
  return activeBridge?.isReady() ?? false;
}
