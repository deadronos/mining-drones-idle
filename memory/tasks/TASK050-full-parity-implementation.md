# [TASK050] - Full Parity: Rust ↔ TypeScript Parity Implementation
**Status:** Pending  

**Added:** 2025-12-09  
**Updated:** 2025-12-09  
**Design:** DES037 - Full Parity Validation (memory/designs/DES037-full-parity-validation.md)

## Original Request

Bring the Rust WASM simulation to full functional parity with the TypeScript ECS so the Rust engine can act as an authoritative replacement for every gameplay system used in the runtime. Validate parity with deterministic tests and CI coverage.

## Goals & Acceptance Criteria


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
| 1.1 | Extend `step-parity.test.ts` (positions, energy, factories) | Not Started | | Add epsilon thresholds and stable seeds |
| 1.2 | Add offline parity tests for `simulateOffline()` | Not Started | | Compare snapshots across engines |
| 1.3 | Harden shadow-mode E2E tests | Not Started | | Log divergences & assert thresholds |
| 2.1 | Port Fleet/Drone AI to Rust | Not Started | | Includes flight persistence and ownership |
| 2.2 | Port Asteroid lifecycle to Rust | Not Started | | Depletion, recycling, spawn rules |
| 2.3 | Decide / implement Biomes parity (port vs doc exception) | Not Started | | If too complex, document behavior differences |
| 3.1 | Implement `SpawnDrone` command in Rust | Not Started | | Must match TS snapshot outputs |
| 3.2 | Implement `RecycleAsteroid`, `AssignHauler` in Rust | Not Started | | Add tests for each command |
| 3.3 | Command parity tests | Not Started | | Cross-apply commands and compare snapshots |
| 4.1 | Wire offline simulation to Rust bridge | Not Started | | Update persistence and integration tests |
| 4.2 | Snapshot schema versioning & migrations | Not Started | | Keep `load_snapshot` backward compatible |
| 5.1 | CI: add WASM build + test job | Not Started | | Gate long parity suite to own job/nightly |
| 5.2 | Add perf benchmarks & monitoring | Not Started | | Track `step()` timings across engines |

## Tests & Validation


## Dependencies & Notes


## Progress Log

### 2025-12-09

## Next Actions

1. Confirm acceptance thresholds for position/energy/factory parity tests with maintainers.  
2. Land a small, high-value PR: extend parity tests (Phase 1) to provide immediate validation before porting larger subsystems.

 