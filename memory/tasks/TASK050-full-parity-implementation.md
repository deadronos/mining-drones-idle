# [TASK050] - Full Parity: Rust ↔ TypeScript Parity Implementation

**Status:** In Progress

**Added:** 2025-12-09  
**Updated:** 2025-12-10
**Design:** DES037 - Full Parity Validation (memory/designs/DES037-full-parity-validation.md)

## Original Request

Bring the Rust WASM simulation to full functional parity with the TypeScript ECS so the Rust engine can act as an authoritative replacement for every gameplay system used in the runtime. Validate parity with deterministic tests and CI coverage.

## Goals & Acceptance Criteria

This task implements the acceptance rules from DES037 (Full Parity Validation). The sections below are concrete, testable EARS-style requirements and numeric thresholds used by the parity test-suite.

### Requirements (EARS)

1. WHEN the application runs with `useRustSim` enabled, THE RUST engine SHALL provide equivalent gameplay semantics to the TS ECS for the set of verified features. [Acceptance: step parity tests and command parity tests pass within defined tolerances.]

2. WHEN an authoritative Rust simulation is running, THE TS store SHALL remain consistent with user-visible UI and commands by either direct buffer access or periodic snapshot sync. [Acceptance: HUD and per-factory UI aggregates reflect Rust state within the HUD sync latency threshold.]

3. WHEN `simulateOffline(seconds, step)` is invoked with `useRustSim` enabled, THE offline simulation SHALL use the Rust bridge and produce deterministic snapshot results equivalent (within epsilon thresholds) to the TypeScript method. [Acceptance: offline parity tests pass across engines.]

4. WHEN a simulation command is applied (BuyModule, PurchaseFactoryUpgrade, SpawnDrone, RecycleAsteroid, AssignHauler, DoPrestige, etc.), THE Rust command handlers SHALL produce the same resulting snapshot/accounting as the TS path. [Acceptance: command parity tests pass for every implemented command.]

5. THE parity test suite SHALL run in CI for both TS-only and WASM-enabled environments and fail the build on regressions. [Acceptance: CI job builds WASM artifacts and runs parity tests (or gates them to a separate WASM-parity job/nightly where applicable).]

### Numeric thresholds (initial proposals — confirm with maintainers)

- Position delta (per-axis): <= 0.10 units over 60 frames (position parity checks in `step-parity.test.ts`).
- Resource totals: absolute difference <= 0.01 per-frame (resource parity checks).
- Energy/battery: absolute difference <= 0.01 per-entity.
- Aggregate totals (HUD / factory): absolute difference <= 0.001 per-aggregate check.
- Offline parity relative tolerance: <= 1% (offline catch-up checks).
- HUD sync latency (authoritative Rust → UI): <= 100ms observable latency (configurable; acceptance tests run with 100ms target).

These values are intentionally conservative to allow platform-dependent FP differences; they should be confirmed in an acceptance review and adjusted as needed.

## Why this matters

Rust parity gives a single, high-performance simulation engine and reduces JS main-thread load for large-scale runs. Parity tests provide a deterministic safety net during migration and future refactors.

## Implementation Plan (High-level)

This task will be implemented in phases. Each phase contains sub-tasks with low-level deliverables and tests.

Phase 1 — Parity Tests (high-value, low-risk)

1. Expand `tests/unit/step-parity.test.ts` to include:
   - Drone positions & state comparisons (epsilon-based)
   - Drone energy / battery checks
   - Per-factory resource & energy checks
   - Asteroid ore depletion patterns
   - Add a “frozen-seed” scenario with N-step deterministic checks

2. Add cross-engine offline comparison in `tests/unit/offline-parity.test.ts` that validates `simulateOffline()` on Rust vs TS.

3. Harden E2E shadow-mode tests (`tests/e2e/shadow-mode.spec.ts`) to run longer, log divergence metrics, and assert thresholds.

Phase 2 — Missing Systems & Rust Implementation

1. Port / implement missing systems in `rust-engine/src/systems`:
   - Fleet / Drone AI lifecycle and flight persistence
   - Asteroids lifecycle (depletion + recycling) and spatial behavior
   - Biomes / region assignment (or document clear exceptions if deferred)

2. Remove or resolve all `TODO` placeholders in Rust `droneai.rs` (speed modifiers, mining rates, selection heuristics).

Phase 3 — Command Parity

1. Implement missing SimulationCommand handlers in Rust and wire them through wasm bridge:
   - SpawnDrone, RecycleAsteroid, AssignHauler
   - Ensure BuyModule, DoPrestige, PurchaseFactoryUpgrade behave identically to TS

2. Add unit tests that apply commands to both engines and compare resulting snapshots.

Phase 4 — Persistence & Offline

1. Wire `src/state/persistence.ts` to use `bridge.simulateOffline()` when `useRustSim` is enabled.

2. Update snapshot JSON schema with a `schemaVersion` and add migrations (if needed) so `load_snapshot` is backward compatible.

Phase 5 — CI & Validation

1. Add a CI job to build Rust WASM and make artifacts available to the test runner.

2. Add benchmarks to `tests/perf/` to measure `step()` time for 100/500/1000 entities and track regressions.

## Subtasks (detailed tracker)

| ID | Description | Status | Updated | Notes |
|---:|------------|:------:|--------:|------|
| 1.1 | Extend `step-parity.test.ts` (positions, energy, factories) | Partial | 2025-12-10 | Added factory position/energy parity and deterministic seed coverage; asteroid depletion/flight-level checks still needed |
| 1.4 | Add cross-engine *comparison* tests (TS vs Rust) for `simulateOffline()` | Done | 2025-12-10 | `offline-parity.test.ts` now compares TS `simulateOfflineProgress` vs Rust `simulateOffline()` within 1% tolerance |
| 1.2 | Add offline parity tests for `simulateOffline()` | Done | 2025-12-10 | Rust offline behavior validated across edge cases and cross-engine comparisons |
| 1.3 | Harden shadow-mode E2E tests | Partial | 2025-12-10 | Added 5s run with divergence-log check; longer gated/nightly parity runs still outstanding |
| 2.1 | Port Fleet/Drone AI to Rust | Done | 2025-12-10 | Implemented in `rust-engine/src/systems/drone_ai.rs` with unit tests |
| 2.2 | Port Asteroid lifecycle to Rust | Done | 2025-12-10 | Implemented in `rust-engine/src/systems/asteroids.rs` with respawn logic and unit tests |
| 2.3 | Decide / implement Biomes parity (port vs doc exception) | Partial | 2025-12-10 | Region index exists in buffers (`target_region_index`), but full biome mechanics are not ported to Rust; TS UI still uses `getBiomeDefinition` |
| 2.4 | Port Logistics System to Rust | Done | 2025-12-10 | Implemented in `rust-engine/src/systems/logistics.rs` including scheduling and transfer processing |
| 3.1 | Implement `SpawnDrone` command in Rust | Done | 2025-12-10 | Implemented in `rust-engine/src/api.rs` as `handle_spawn_drone` and wired through `apply_command` |
| 3.2 | Implement `RecycleAsteroid`, `AssignHauler` in Rust | Done | 2025-12-10 | Implemented in `rust-engine/src/api.rs` as `handle_recycle_asteroid` and `handle_assign_hauler`; unit tests in `tests/unit/command-parity.test.ts` verify behavior |
| 3.3 | Command parity tests | Done | 2025-12-09 | `tests/unit/command-parity.test.ts` implements cross-engine command checks for BuyModule, AssignHauler, PurchaseFactoryUpgrade, SpawnDrone, RecycleAsteroid |
| 4.1 | Wire offline simulation to Rust bridge | Done | 2025-12-10 | `useRustEngine.ts` triggers `bridge.simulateOffline()` on load; `persistence.ts` defers offline work to bridge when `useRustSim` is enabled |
| 4.2 | Snapshot schema versioning & migrations | Done | 2025-12-10 | Added `schemaVersion` (TS + Rust), defaulting, validation, and migration defaulting |
| 5.1 | CI: add WASM build + test job | Done | 2025-12-10 | Added dedicated `wasm-parity` CI job running parity suites + artifacts on failure |
| 5.3 | Add CI artifact step: publish WASM build to runner cache for test jobs | Not Started | 2025-12-10 | CI caches `~/.npm`, but does not publish WASM artifacts or persist them for downstream jobs |
| 5.2 | Add perf benchmarks & monitoring | Done | 2025-12-10 | Added `tests/perf/step-bench.spec.ts` (TS+Rust step timing) |


## Tests & Validation

Parity verification is the primary success signal for this task. Tests must be deterministic, self-documenting, and runnable locally and in CI. Tests should skip gracefully when WASM artifacts are not present and must provide clear divergence logs when thresholds are hit.

Unit tests (fast, deterministic):

- `tests/unit/step-parity.test.ts` — extend to compare TS step() vs Rust `step()` where possible; record per-frame divergences, and assert per-entity and aggregate differences remain within thresholds.
- `tests/unit/offline-parity.test.ts` — extend to include cross-engine comparisons: call the TypeScript `simulateOffline()` implementation and compare results to `bridge.simulateOffline()` from the Rust engine (new tests / extensions). Acceptance: results match within the offline relative tolerance (<= 1%).
- `tests/unit/command-parity.test.ts` (new) — test every public SimulationCommand pathway (BuyModule, PurchaseFactoryUpgrade, SpawnDrone, RecycleAsteroid, AssignHauler, DoPrestige, etc.) by applying the same command to both engines and comparing snapshots after execution. Use strict comparisons for discrete events (module counts, ownership) and epsilon for numeric differences.

E2E / Shadow-mode tests (integration):

- `tests/e2e/shadow-mode.spec.ts` — run shadow-mode longer, instrument divergence counters (per-frame aggregates) and assert rolling-average divergence stays under thresholds (e.g., resources, energy, HUD aggregates).

Performance tests / benchmarks (non-blocking CI):

- `tests/perf/step-bench.spec.ts` (new) — micro-benchmarks to record `step()` latencies under entity counts: 100, 500, 1000. Results must be recorded and stored in CI artifacts for regression monitoring.

Local run guidance:

- Build WASM artifacts first: `npm run build:wasm`.
- Run the small unit parity suites locally: `npm test -- tests/unit/step-parity.test.ts tests/unit/offline-parity.test.ts`.
- Use `--run` / `--watch` flags when iterating with Vitest.

CI guidance:

- Add a dedicated CI job (label: `wasm-parity`) that performs the following steps:
   - Build the Rust WASM artifacts (`npm run build:wasm`) using a runner with Rust + wasm-pack installed.
   - Cache the built artifacts and make them available to the test runner to avoid repeated rebuilds.
   - Run the parity unit test suite: `tests/unit/step-parity.test.ts`, `tests/unit/offline-parity.test.ts`, `tests/unit/command-parity.test.ts`.
   - Run longer E2E shadow-mode parity checks on a gated/nightly runner (`tests/e2e/shadow-mode.spec.ts`).
   - Fail the job on parity regressions and publish divergence logs/artifacts for investigation.

## Dependencies & Notes

Key dependencies and implementation notes:

- Rust engine crate: `rust-engine/` — contains the simulation, systems, and WASM build target (wasm-pack compatible).
- WASM bridge: `src/gen` / `src/lib/wasmSimBridge.ts` — the TypeScript bridge receiving WASM exports and exposing typed-array views for drones, asteroids, factories, and other major entity buffers.
- Bridge expectations: typed-array views must be exported for the primary entity buffers, and `exportSnapshot()` / `loadSnapshot()` must provide stable, versioned JSON output. Add `schemaVersion` to snapshots and provide deterministic migration paths if format changes.

Bridge & Snapshot API (expected surface area)

- `init(snapshot: StoreSnapshot)`: initialize Rust engine state from a full store snapshot.
- `step(dt: number)`: advance the authoritative simulation by `dt` seconds.
- `simulateOffline(seconds: number, step: number) => OfflineResult`: offline catch-up and deterministic offline simulation result.
- `applyCommand(cmd: SimulationCommand)`: apply a SimulationCommand and return any diffs or the resulting snapshot.
- `exportSnapshot() => StoreSnapshot`: export the current engine state as a stable JSON-compatible snapshot (includes `schemaVersion`).
- `loadSnapshot(json|object)`: load a versioned snapshot; if `schemaVersion` mismatches, call migration helpers.
- `getEntityBufferViews()` / `getBufferViews()`: return typed-array views for major entity buffers (drones, asteroids, factories, etc.) and clear documentation for buffer layout (offsets, stride).

Acceptance tests for bridge/api:

- Unit tests must verify the bridge exports required functions and that `getBufferViews()` exposes buffers that can be read by the TS layer (validate lengths, offsets and sample values).
- Exported snapshots must include `schemaVersion` and pass JSON schema validation in unit tests prior to CI publish.
- Determinism: floating-point differences are expected — tests should use epsilon-based comparators and per-field tolerances defined above.
- Backwards compatibility: implement snapshot `schemaVersion` and add a migration helper for `load_snapshot` to keep older save formats working when the engine evolves.

Notes on scope and trade-offs:

- Full bitwise equivalence is not required or expected across engines; parity is behavioural and within tolerances.
- If porting a complex subsystem (e.g., fine-grained biome mechanics) is disproportionately costly, document the exception in DES037 and add an explicit integration test demonstrating equivalence of externally visible behaviour.

## Progress Log

### 2025-12-09

- Completed Phase 1 (Parity Tests) and parts of Phase 2/3.
- Implemented `step-parity.test.ts`, `offline-parity.test.ts`, `command-parity.test.ts`.
- Implemented `sync_data_to_snapshot` in `rust-engine` to fix `exportSnapshot`.
- Fixed `sys_refinery` in `rust-engine` (resource index mismatch).
- Implemented `sys_global_refinery` in `rust-engine` to match TS global refinery logic.
- Verified parity for Steps, Offline Simulation, and Commands (BuyModule, PurchaseFactoryUpgrade, AssignHauler, DoPrestige).
- Fixed TS types and lint errors in test suite.

- Added acceptance criteria and numeric thresholds mapped to DES037.
- Started expanding tests & validation details; identified missing cross-engine comparisons and command parity test files.

### 2025-12-10

- Verified Rust command handlers exist and are wired: `handle_spawn_drone`, `handle_recycle_asteroid`, `handle_assign_hauler`, `handle_buy_module`, `handle_prestige`, and `handle_factory_upgrade` are present in `rust-engine/src/api.rs`.
- Verified systems implemented in Rust: `sys_refinery`, `sys_global_refinery`, `sys_movement`, `sys_fleet`, `sys_drone_ai`, `sys_asteroids`, and `sys_logistics` with tests in `rust-engine/src/systems`.
- Confirmed bridge exports and typed array accessors in `src/lib/wasmSimBridge.ts`, and wasm loader in `src/lib/wasmLoader.ts`.
- Command parity tests are implemented: `tests/unit/command-parity.test.ts` covers `AssignHauler`, `BuyModule`, `PurchaseFactoryUpgrade`, `SpawnDrone`, and `RecycleAsteroid`.
- Step parity tests now include factory position/energy checks; still need asteroid depletion and per-drone flight parity. Offline parity has cross-engine comparison but could benefit from deeper TS offline coverage.
- E2E shadow-mode tests include a 5s divergence-log guard but still need longer gated parity runs.
- Snapshot export/import (`exportSnapshot` / `load_snapshot`) now include `schemaVersion` with defaults and validation.
- `persistence.ts` defers offline simulation to the bridge when `useRustSim` is enabled; `useRustEngine.ts` runs `bridge.simulateOffline()` during initialization.
- Added factory position/energy parity checks plus deterministic-seed scenario to `tests/unit/step-parity.test.ts`.
- Added cross-engine offline parity comparison (TS `simulateOfflineProgress` vs Rust `simulateOffline`) with 1% tolerance.
- Added 5s divergence-log guard to `tests/e2e/shadow-mode.spec.ts`.
- Added `schemaVersion` (TS + Rust) with validation/defaulting and migration defaulting.
- Added `tests/perf/step-bench.spec.ts` micro-benchmark for TS/Rust step timing.
- Added dedicated `wasm-parity` CI job running parity/perf suites and uploading artifacts on failure.

## Next Actions

1. Confirm and lock acceptance thresholds with maintainers (position, energy, aggregate tolerance, HUD latency).  
2. Expand `tests/unit/step-parity.test.ts` to cover asteroid depletion and per-drone flight/position parity (not just factory/aggregate parity). Add frozen-seed scenarios across longer horizons.
3. Harden E2E `shadow-mode` runs (longer durations, parity delta logging, nightly gating) and assert divergence thresholds instead of only log absence.
4. Publish WASM artifacts/cache between CI jobs and consider gating release on `wasm-parity`; add artifact uploads for parity/perf outputs when successful.
5. Decide on Biome parity strategy: implement biome mechanics in Rust or document/guard deviations with integration tests.

 