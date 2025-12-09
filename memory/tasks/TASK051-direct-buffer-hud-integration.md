# [TASK051] - Direct-Buffer HUD Integration (Implementation Plan)

**Status:** Pending  
**Added:** 2025-12-09  
**Updated:** 2025-12-09  
**Design:** DES038 - Direct-Buffer HUD Integration (memory/designs/DES038-direct-buffer-hud-integration.md)

## Original Request

Create a robust, low-latency HUD integration that reads authoritative aggregate data directly from the Rust WASM bridge (typed-array views or compact getters) and falls back cleanly to the Zustand store when the bridge is unavailable.

## Requirements (EARS)

1. WHEN `useRustSim` is enabled and the bridge is ready, THE HUD shall display authoritative warehouse totals and per-factory aggregates from the Rust bridge with <100ms observable latency. [Acceptance: integration tests and perf smoke tests pass]

2. WHEN the bridge is unavailable or `useRustSim` toggles, THE HUD shall fall back to Zustand values with no visual or runtime errors. [Acceptance: toggling `useRustSim` preserves UI stability and values converge]

3. THE bridge shall expose compact aggregate getters for frequent HUD values (or allow safe typed-array reads); JS-side aggregation should be minimal and non-blocking. [Acceptance: microbenchmarks show <10ms median read-update]

4. THE hook implementations shall be resilient to partial reads and should expose an `isRustActive` flag to consumers. [Acceptance: tests show no inconsistent partial reads across boundaries]

## Implementation Plan

Phase 1 — Bridge API & Rust helpers

1. Add compact bridge getters in `src/lib/wasmSimBridge.ts` and corresponding Rust bridge exports (if missing):
   - `getGlobalResourcesSnapshot(): Float32Array | JsonObject` (ore, metals, crystals, organics, ice, bars, energy)
   - `getFactoryResources(index)` / `getFactoryEnergy(index)` / `getFactoryHaulers(index)`
   - Optional: `getWarehouseAggregates()` to provide pre-summed totals

2. If summing in Rust is preferred, add small aggregate getters to `rust-engine` to avoid repeated JS accumulation on each frame.

Phase 2 — Hook + adapter layer

1. Implement `src/hooks/useRustHUD.ts`:
   - Expose `resources`, `factories` (indexed), `haulerCounts`, `isReady`, `isRustActive`
   - Use memoization and throttling to limit reads (e.g., 10–30Hz configurable)
   - Provide fallbacks to `useStore` snapshots when bridge is not active

2. Implement small helpers: `readFloatArraySafe()` and `readUintArraySafe()` to avoid partial reads and support double-buffer layouts.

Phase 3 — UI integration

1. Update HUD consumers to use `useRustHUD` when `useRustSim && bridge.isReady()`:
   - `src/ui/WarehousePanel.tsx` — show global aggregates via hook
   - `src/ui/UpgradePanel.tsx` — show bars/energy/cost values from bridge if available
   - `src/ui/FactoryManager/*` — show per-factory resources & hauler counts using `getFactoryResources(index)`

2. Provide graceful partial-fallbacks for components that require more data (request snapshot export or show a loading indicator)

Phase 4 — Tests & Validation

1. Add unit tests for `useRustHUD` validating: fallback behavior, correct parsing, safe reads, and `isRustActive` logic.

2. Add integration tests for `WarehousePanel` and `FactoryManager` that simulate: toggling `useRustSim`, mid-run bridge failover, and direct-read updates.

3. Add perf smoke tests that measure read/update times for small/medium/large worlds and assert <10ms median under normal dev hardware.

Phase 5 — Rollout

1. Deploy change behind `useRustSim` toggle. Default to writing snapshots on command/ persistence flows while using direct hooks for HUD.

2. Monitor performance and, if necessary, adjust throttle rates or move more aggregation into Rust.

## Subtasks (detailed tracker)

| ID | Description | Status | Updated | Notes |
|---:|------------|:------:|--------:|------|
| 1.1 | Add bridge getters for global/factory aggregates | Not Started | | `getGlobalResourcesSnapshot()` + per-factory getters |
| 1.2 | Add optional Rust-side aggregates (if heavy sums needed) | Not Started | | Avoid repeated JS accumulation |
| 2.1 | Implement `useRustHUD` hook with safe reads & throttling | Not Started | | 10–30Hz config option |
| 2.2 | Implement safe typed-array read helpers | Not Started | | Double-buffer / atomic read patterns |
| 3.1 | Update `WarehousePanel` to consume hook | Not Started | | Fall back to store on bridge disabled |
| 3.2 | Update `FactoryManager` per-factory UI to consume hook | Not Started | | Respect factory index mapping |
| 4.1 | Unit tests for `useRustHUD` | Not Started | | Mock bridge ready/unready flows |
| 4.2 | Integration tests for tabs/panels | Not Started | | Simulate toggling feature flag mid-run |
| 4.3 | Perf smoke tests | Not Started | | Measure median read latency |

## Tests & Validation

- Unit: `useRustHUD` tests validating fallback / parsing / safe reads.  
- Integration: mid-run toggles for `WarehousePanel` & `FactoryManager`.  
- Perf: smoke tests asserting <10ms median read times for aggregates.

## Dependencies & Notes

- Requires `rust-engine` / wasm bridge to provide aggregate getters or raw typed-array views.  
- Prefer Rust-side aggregated getters for heavy worlds to reduce JS CPU use.  
- Implementation should be incremental: add bridge getters → hook → UI consumers → tests → perf.

## Progress Log

### 2025-12-09
- Task created for DES038 — Direct-Buffer HUD integration plan created.

## Next Actions

1. Implement bridge getters (`getGlobalResourcesSnapshot`) and add simple unit tests for bridge access.  
2. Implement `useRustHUD` hook and add unit tests for fallback behavior.

 