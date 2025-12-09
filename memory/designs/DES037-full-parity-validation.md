```markdown
# DES037 – Full Parity Validation

## Summary

Complete functional parity between the TypeScript ECS and the Rust WASM simulation so the Rust engine can be used as a drop-in, authoritative replacement for all gameplay systems.

This design captures the outstanding work required to reach full parity across systems, commands, persistence, testing, and CI so parity is validated continuously.

## Status: Proposed

**Goal:** Provide a deterministic, production-ready Rust simulation with full feature parity and automated verification against the TypeScript reference implementation.

## Why this matters

- Performance — leverage Rust/WASM for high-scale simulation and to reduce JS main-thread overhead.
- Correctness — ensure behavior matches the JS reference via broad parity tests to catch regressions.
- Maintainability — make the Rust engine a genuine, testable implementation rather than partial coverage.

## Requirements (EARS)

1. WHEN the application runs with `useRustSim` enabled, THE RUST engine SHALL provide equivalent gameplay semantics to the TS ECS for the set of verified features. [Acceptance: parity tests pass within defined tolerances]

2. WHEN an authoritative Rust simulation is running, THE TS store SHALL remain consistent with user-visible UI and commands by either direct buffer access or periodic snapshot sync. [Acceptance: HUD and factory UIs reflect Rust state within acceptable latency]

3. WHEN `simulateOffline(seconds, step)` is invoked and `useRustSim` is enabled, THE offline simulation shall use the Rust bridge and produce deterministic snapshot results equivalent to the TypeScript method. [Acceptance: offline parity tests pass within epsilon]

4. WHEN a simulation command is applied (BuyModule, PurchaseFactoryUpgrade, SpawnDrone, etc.), THE Rust command handlers SHALL produce the same resulting snapshot / accounting as the TS path. [Acceptance: commands parity tests pass]

5. THE parity test suite SHALL run in CI for both TS-only and WASM-enabled environments and fail the build on regressions. [Acceptance: CI runs parity tests on merge]

## Scope & Non-Goals

- Includes: parity coverage for RNG, step sequence, offline simulation, drones, factories, asteroids, energy, resources, and core commands.
- Excludes: exploratory performance optimizations that are not required for functional parity (can be later work).

## Architecture

High-level flow remains the same as DES036, but with the Rust engine completing parity for the following systems:

- Fleet/Drone AI lifecycle
- Asteroid lifecycle, depletion, and recycling
- Biome/region behaviour (where feasible)
- Factory processing, energy/refinery state, haulers assigned

Data & verification paths:

- Bridge exposes typed-array views for every major entity buffer (drones, asteroids, factories)
- `exportSnapshot()` / `loadSnapshot()` provide authoritative serialization for cross-checking and persisting
- Parity tests compare snapshots and selected aggregates (resource totals, active drones, energy stats) across runs

## Implementation Plan

Phase A — Parity Tests (low risk, high visibility)

1. Expand `tests/unit/step-parity.test.ts` to compare:
   - drone positions and states (with epsilon)
   - drone energy/battery levels
   - factory resources & energy
   - asteroid ore depletion patterns

2. Add cross-engine offline test in `tests/unit/offline-parity.test.ts` to compare `simulateOffline()` outputs.

3. Add per-frame parity assertions for shadow mode E2E (`tests/e2e/shadow-mode.spec.ts`) to trigger divergence logging.

Phase B — Missing systems in Rust

4. Port / implement the following in `rust-engine/src/systems` (or ensure equivalent behaviour):
   - `biomes` / region behavior (fractures, region assignment)
   - `asteroids` lifecycle (rotation, depletion, recycle/respawn)
   - `fleet` / drone lifecycle & flight persistence (spawn, recycle, ownership)

5. Address TODOs in Rust `droneai.rs` and related modules — speed modifiers, mining rate modifiers, selection heuristics.

Phase C — Commands and Snapshot parity

6. Implement missing command handlers in Rust (`rust-engine/src/api.rs` / `commands.rs`): `SpawnDrone`, `RecycleAsteroid`, `AssignHauler` and ensure `BuyModule`, `DoPrestige`, `PurchaseFactoryUpgrade` are exact equivalents.

7. Ensure `exportSnapshot()` and `loadSnapshot()` maintain stable JSON schema; add `schemaVersion` to allow migrations.

Phase D — Persistence & Offline wiring

8. Modify `src/state/persistence.ts` to call the Rust bridge `simulateOffline()` when `useRustSim` is enabled.

Phase E — CI & testing

9. Add a CI job that builds the Rust WASM package and makes it available to the test runner.
10. Enable the WASM-dependent parity tests in CI and conditionally in local developer environments.

## Acceptance Criteria

- Parity tests (RNG, step parity, offline parity) pass for current baseline scenarios.
- Command parity tests (BuyModule, Prestige, Upgrades, Spawn) pass.
- No UI drift: HUD totals and factory resources converge within defined epsilon bounds during shadow-mode runs.
- Rust-enabled offline simulation produces the same deterministic results as TS for N-step runs.

## Risks & Tradeoffs

- Full parity requires porting complex systems (biomes) — consider keeping some systems in TS if porting cost is prohibitive.
- Floating point differences will require epsilon-based comparisons; exact bitwise parity is unrealistic for many operations.
- Adding CI WASM increases test runtime — plan to gate full WASM parity checks to a secondary job or nightly build.

## Tests & Validation

- Unit: extended `step-parity.test.ts` and `offline-parity.test.ts` to include drone/factory/energy checks
- E2E: shadow-mode tests that run both engines for extended frames and assert aggregates within tolerances
- Performance: benchmarks for step() across varying entity counts to ensure Rust performance benefits

## Open Questions

1. Which systems are low-enough priority to remain TypeScript-only if porting effort is too high (ex: some biome mechanics)?
2. What is the acceptable latency for HUD sync in authoritative Rust mode? E.g., real-time vs 100ms vs 1s.

## Next steps

1. Approve design and reserve TASK IDs for implementation: TASK050 (HUD sync or hook), TASK051 (Offline wiring), TASK052 (Port missing systems), TASK053 (Parity tests expansion), TASK054 (SpawnDrone/Rust commands), TASK055 (CI WASM pipeline).

```diff
+DES037 created: Full Parity Validation
```

```

``` 
