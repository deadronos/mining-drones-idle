````markdown
# DES038 – Direct-Buffer HUD Integration

## Summary

Provide a low-latency, zero-copy mechanism for HUD and UI aggregates when the Rust WASM simulation is authoritative. This design describes the hooks, bridge accessors, and UI changes necessary for the HUD to consume authoritative values from WASM memory safely and efficiently.

## Status: Proposed

**Goal:** Keep UI aggregates (warehouse totals, factory ledgers, hauler counts, energy) authoritative and up-to-date with minimal overhead when `useRustSim` is enabled.

## Why this matters

- Avoid stale HUD values when Rust is authoritative.
- Reduce snapshot-export overhead and unnecessary store writes.
- Minimise JS main-thread work while showing accurate information.

## Requirements (EARS)

1. WHEN `useRustSim` is enabled and the bridge is ready, THE HUD shall read authoritative resource totals and factory aggregates from the Rust bridge using typed-array views or aggregate getters, with updates visible to users in under 100ms. [Acceptance: HUD updates in the latency budget, measured in integration tests]

2. WHEN the bridge becomes unavailable or `useRustSim` toggles, THE HUD shall gracefully fall back to Zustand-state values with no visual errors. [Acceptance: No crashes during toggles; UI values switch to fallback]

3. THE solution SHALL avoid blocking the main thread — prefer aggregate getters (pre-computed sums) on the Rust side, or a throttled safe-read strategy if summation is done in JS. [Acceptance: Performance tests show low median latency]

4. THE bridge getters or typed-array reads SHALL be implemented in a way that avoids partial/invalid reads (e.g., single-value getters, double-buffer snapshots, or safe read ordering). [Acceptance: Tests show no inconsistent reads]

## Approaches Compared

Option A — Periodic Snapshot Sync (current)

- Implementation: Call `bridge.exportSnapshot()` at intervals / on commands and write to Zustand
- Pros: Simple, reuses snapshot logic
- Cons: Expensive for frequent updates, generates large JSON objects, may be slow on big worlds

Option B — Direct Buffer Reads (zero-copy) [Recommended]

- Implementation: Add compact Rust bridge getters (e.g., `getGlobalResources()`, `getFactoryResources(index)`), or expose typed array views and read/aggregate in JS.
- Pros: Low-latency, lower allocation, real-time visibility, minimal copying
- Cons: Must ensure safe read semantics (atomic/double-buffer or getters) and safe JS summation.

Option C — Hybrid

- Implementation: Expose aggregated getters for frequent HUD values (fast) and keep `exportSnapshot()` for infrequent full-state syncs (commands, persistence).
- Pros: Balance of simplicity and performance
- Cons: Slightly more work (bridge and hook maintenance)

Recommendation: Option C (Hybrid) as a pragmatic first step, expanding to Option B as needed.

## Implementation Plan

1. Add bridge API for aggregates in `src/lib/wasmSimBridge.ts`:
   - `getGlobalResources(): Float32Array | Float64Array` or `getGlobalResourcesSnapshot(): { ore, metals, crystals, organics, ice, bars, energy }`
   - `getFactoryResources(index)` and `getFactoryEnergy(index)` for per-factory UI.

2. Create hooks in `src/hooks`:
   - `useRustHUD(bridge)` — unified hook providing `resources`, `factories`, `haulers`, `isReady`.
   - Optional: `useRustResources`, `useRustFactories` for targeted consumption.

3. Add safe-read strategies:
   - Prefer compact Rust getters (pre-summed) to avoid heavy JS summation.
   - If raw buffers are used, perform reads under a consistent cadence (e.g., `requestAnimationFrame` or throttled 60/30/10Hz) and consider minimal locking via double-buffering.

4. Update UI consumers to use hooks when `useRustSim && bridge.isReady()`:
   - `src/ui/WarehousePanel.tsx`
   - `src/ui/UpgradePanel.tsx`
   - `src/ui/FactoryManager/*` (resource/hauler displays)
   - Any debug/metrics components that show totals

5. Add tests:
   - Unit tests for `useRustHUD` to simulate bridge values and ensure safe fallback
   - Integration tests to verify toggling `useRustSim` and mid-run updates
   - Performance smoke tests verifying low-latency reads

6. Monitor & iterate: measure memory/CPU differences between snapshot-based and direct-read approaches.

## Safety & Edge Cases

- Race conditions: avoid reading multiple typed arrays in the middle of a step where values may be inconsistent; prefer Rust-side aggregate getters or double-buffer snapshots.
- Precision: sums and aggregates should use similar numeric types as the Rust engine; conversion/float precision checks needed.
- Fallback: if the bridge is not ready, hook returns values from Zustand and marks `isRustActive=false`.

## Acceptance Criteria

- HUD reads authoritative aggregates directly from bridge when available and updates UI within the latency budget.
- No UI crashes or stalls when toggling simulation mode.
- Tests show no inconsistent partial-read artifacts.

## Tests & Validation

- Unit: `useRustHUD` hook tests for aggregate read + fallback.
- Integration: E2E toggling tests which simulate WASM up/down.
- Perf: microbenchmarks for aggregate reads on small/medium/large worlds.

## Next Steps / TASKs

- TASK050: Implement bridge aggregate getters + minimal typed-array helpers
- TASK051: Implement `useRustHUD` + unit tests
- TASK052: Update core UI panels to use `useRustHUD` with fallback
- TASK053: Add perf and E2E tests validating latency and correctness

```diff
+DES038 created: Direct-Buffer HUD Integration
```

````
