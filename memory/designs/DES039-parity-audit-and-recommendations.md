# DES039 — Parity Audit & Action Plan: TypeScript ↔ Rust Simulation

## Summary

This design captures an audit of current functional parity between the TypeScript ECS runtime and the Rust WASM simulation (rust-engine). It documents observed mismatches across systems and rendering, proposes acceptance thresholds, and outlines a prioritized action plan to reach functional parity for runtime behavior and rendering sync.

## Original Parity Audit

Parity Status

Drones & travel: Rust AI picks nearest oreful asteroid and nearest factory with no docking/queue or biome logic, so flight seeds/regions aren’t mirrored (drone_ai.rs:69-181, movement.rs:11-154); TS weights nearby targets, uses biome regions/gravity, and respects docking queues when returning (targetAssignment.ts:39-78, factoryAssignment.ts:9-78, travel.ts:15-104). Parity: low for flight selection/queues; medium for movement energy/throttle.
Asteroid lifecycle: Rust respawns depleted nodes with uniform random resource weights and ignores biome data (asteroids.rs:4-78); TS spawns via biome definitions with dominant resource/regions and scanner-richness bias (world.ts:250-297). Parity: low for resource profiles/biomes; medium for position ring.
Power & refinery: Rust uses fixed idle/hauler drains and caps tied to constants (refinery.rs:6-113), and global/factory solar without storage/reservation nuances (power.rs:6-98); TS uses per-factory drains, hauler maintenance cost, solar-array effective capacity, and modifier-aware regen (gameProcessing.ts:12-122, power.ts:7-96). Parity: medium; numeric deltas likely remain in parity tests.
Logistics: Rust scheduler uses fixed capacity/speed and minimal reservations (logistics.rs:22-218), while TS scheduler applies hauler configs, warehouse buffers, upgrade requests, and per-factory reservations (logisticsProcessing.ts:20-102). Parity: low for routing/throughput behavior.
Offline: TS offline sim only runs refinery (+ sink bonus) and ignores movement/logistics (offline.ts:29-90); Rust offline runs the full step loop every step (api.rs:892-917), so state divergence is expected beyond bars/ore. Parity: low unless tests constrain scope.
Rendering sync: Buffer surfaces exist in the bridge (wasmSimBridge.ts:113-351), but drone/factory visuals currently follow TS world state; without reading the WASM buffers for positions/energy/targets, visuals will drift even when parity logic matches.
Next Steps to 100% Behavior & Rendering Sync

Port TS drone targeting/return logic into Rust: weight nearby asteroids with NEARBY_LIMIT and path seeds, honor biome regions/gravity, and mirror docking queue selection when returning; populate target_region_index and factory target buffers to drive rendering.
Align asteroid respawn to createAsteroid: reuse biome-based resource profiles, scanner/sink richness multipliers, spin/gravity, and dominant resource so depletion patterns match.
Match power/refinery math: use per-factory idleEnergyPerSec, energyPerRefine, hauler maintenance cost, and getFactoryEffectiveEnergyCapacity/solar-array bonuses; keep refinery slot/yield modifiers identical to TS.
Bring logistics parity up: mirror resolveFactoryHaulerConfig, reservations, warehouse buffering, upgrade-request routing, and routing overheads; keep the 2s scheduler cadence but share the same capacity/speed math as TS configs.
Normalize offline semantics: either make TS offline call the Rust bridge (preferred) or add a Rust “refinery-only + sink bonus” offline path so both engines produce identical snapshots.
Rendering: wire R3F/HUD to Rust buffer views for drones/factories/asteroids when useRustSim or shadow mode is on, and fall back to exportSnapshot() for HUD aggregates to avoid TS/Rust drift.
Tests to lock parity: add drone-flight parity (positions/targets/battery), asteroid respawn/profile parity, per-factory energy drain/regen parity, logistics transfer parity, and offline snapshot parity gated by the same epsilons as existing step/offline suites.
If you want, I can draft the Rust-side patches (AI, asteroids, power/refinery, logistics), plus targeted parity tests to close these gaps.

## Status: Proposed

## Goals
- Achieve behavioral parity between TS and Rust (within tolerances) for core systems: drones, travel, asteroids, refinery/power, logistics, offline simulation and commands.
- Ensure UI/HUD visuals reflect authoritative Rust state when `useRustSim` is enabled (no noticeable drift).
- Add tests, CI coverage, and a stable snapshot versioning/migration path so parity is continuously validated.

## Findings (Summary)
- Drone logic: TS uses weighted selection, regions/biomes, and docking queue-aware return assignments; Rust uses greedy nearest-nearest selections and does not fully use region/biome selection or queue behavior in its AI. Files: [src/ecs/systems/droneAI.ts](src/ecs/systems/droneAI.ts) → [rust-engine/src/systems/drone_ai.rs](rust-engine/src/systems/drone_ai.rs).
- Travel & movement: TS travel is driven by `travel` snapshots and `computeTravelPosition` with curve control points seeded by RNG; Rust computes travel path similarly but needs consistent seeding/curve generation and clearer parity of energy throttling. Files: [src/ecs/systems/travel.ts](src/ecs/systems/travel.ts) → [rust-engine/src/systems/movement.rs](rust-engine/src/systems/movement.rs).
- Asteroids & biomes: TS spawns asteroids using `createAsteroid()` with biome resource profiles and richness multipliers; Rust respawn uses simpler random weighting in `respawn_asteroid()` resulting in different distribution shapes. Files: [src/ecs/world.ts](src/ecs/world.ts) vs [rust-engine/src/systems/asteroids.rs](rust-engine/src/systems/asteroids.rs).
- Power & Refineries: Rust and TS implement energy/refinery but differ in per-factory energy accounting, local-first charging logic, and energy drain semantics (idle/hauler drains and solar bonuses). Files: [src/ecs/systems/power.ts](src/ecs/systems/power.ts) and [rust-engine/src/systems/power.rs](rust-engine/src/systems/power.rs); [src/ecs/systems/refinery.ts](src/ecs/systems/refinery.ts) and [rust-engine/src/systems/refinery.rs](rust-engine/src/systems/refinery.rs).
- Logistics: The scheduling, warehouse buffering, hauler capacities, and reservations differ in implementation detail (Rust implements a simplified scheduler). Files: [src/state/processing/logisticsProcessing.ts](src/state/processing/logisticsProcessing.ts) vs [rust-engine/src/systems/logistics.rs](rust-engine/src/systems/logistics.rs).
- Offline simulation semantics: TS `simulateOfflineProgress` runs only refinery logic with sink bonuses for offline multipliers; Rust `simulate_offline()` steps the full game loop so offline snapshots can differ. Files: [src/lib/offline.ts](src/lib/offline.ts) vs [rust-engine/src/api.rs](rust-engine/src/api.rs).
- Commands & Snapshot parity: Rust implements `apply_command`, `export_snapshot`, and `load_snapshot`, but there are differences in `SpawnDrone` (owner mapping, capacity updates), factory construction, and where some logic is performed (TS vs Rust). Files: [rust-engine/src/api.rs](rust-engine/src/api.rs) and [src/lib/wasmSimBridge.ts](src/lib/wasmSimBridge.ts).
- Rendering/Bridge: The TS bridge (`wasmSimBridge.ts`) exports typed-array views for SoA buffers, but the renderer is still dominated by TS world state by default — when `useRustSim` is enabled the HUD and visuals still need to read Rust buffers to remove drift. Files: [src/lib/wasmSimBridge.ts](src/lib/wasmSimBridge.ts), [src/lib/wasmLoader.ts](src/lib/wasmLoader.ts), [src/r3f-tools or Scene.tsx references].

## Detailed Mismatches & Risks
- Drone target assignment
  - TS chooses weighted nearby asteroids, picks region if biomes exist, and uses RNG seeds to generate flight curves and path offsets (`assignDroneTarget`), while Rust picks the nearest non-empty asteroid. Result: different target assignments and flight seeds, causing visible position divergence and different resources gathered.
  - Risk: If fleet/factory capacity and docking behavior differ, drone ownership and unloading behavior will diverge.

- Travel deterministic RNG seeds
  - TS uses RNG seeds for path control points and re-seeding for deterministic replay; Rust must use a compatible seed and curve generation to match path shapes. Risk: small RNG seeding differences cause large visible divergence.

- Asteroid respawn & resource profile
  - TS uses `createAsteroid` which ties spawn richness to scanner level and `sinkBonuses` and uses a biome resource profile; Rust `respawn_asteroid()` uses randomness and a base richness multiplier which changes profile distribution.
  - Risk: Resource totals diverge and offline parity becomes harder to enforce.

- Energy accounting
  - TS local-first charging logic (factory local energy -> global fallback) and `getFactoryEffectiveEnergyCapacity()` with module-level bonuses is very specific; Rust has a similar approach but differences in timing/idle drain and hauler maintenance might change energy states.
  - Risk: Drones can charge in different order; refinery progress changes.

- Logistics scheduling & reservations
  - TS uses `scheduleFactoryToFactoryTransfers`, `scheduleFactoryToWarehouseTransfers`, and `scheduleUpgradeRequests` with reservation maps; Rust's scheduler is a simplified match algorithm which may produce different transfer flows.
  - Risk: Throughput differences, per-factory resource totals mismatch.

- Offline delta
  - TS offline progress focuses on refinery-only catch-up; Rust runs the full loop. If the developer goal is to keep offline aligned for a shorter path, the APIs should be reconciled.

- Commands & snapshots
  - `handle_spawn_drone` in Rust increments `modules.drone_bay`, creates an owner entry and rebuilds the layout — this mirrors TS but verification of exact snapshot property names (owner mapping, `drone_owners`, `drone_flights`) and rounding for capacity is necessary. Unit tests must assert these match exactly.

- Visual sync
  - Rendering must read Rust buffers for authoritative positions/energy when `useRustSim` is active to avoid drift — otherwise TS and WASM will race or diverge despite functional equivalence.

## Acceptance Criteria & Numeric Thresholds
- Position delta (per-axis): <= 0.10 units over 60 frames (tracked in `tests/unit/step-parity.test.ts`).
- Resource totals: absolute difference <= 0.01 per frame in per-entity and global resources.
- Energy/battery: absolute difference <= 0.01 per-entity.
- HUD aggregate totals: absolute diff <= 0.001 per check.
- Offline parity relative tolerance: <= 1% for multi-step offline runs.
- HUD sync latency for authoritative Rust→UI: <= 100ms observable latency.
- Parity test failures fail CI job (or a dedicated wasm-parity job for transient runs).

## Action Plan (Phased)

Phase 1 — Test & Measurement (Immediate)
- Expand parity tests:
  - [tests/unit/step-parity.test.ts](tests/unit/step-parity.test.ts) — add per-drone flight/position/battery and asteroid depletion checks.
  - [tests/unit/offline-parity.test.ts](tests/unit/offline-parity.test.ts) — ensure TS offline and Rust offline simulate identical snapshots under target seeds and steps.
  - [tests/unit/command-parity.test.ts](tests/unit/command-parity.test.ts) — ensure command outcomes match (BuyModule, PurchaseFactoryUpgrade, SpawnDrone, RecycleAsteroid, AssignHauler, DoPrestige).
- Add debug logs & divergence capture in shadow-mode E2E ([tests/e2e/shadow-mode.spec.ts](tests/e2e/shadow-mode.spec.ts)).

Phase 2 — Drone AI & Travel Parity
- Port/align TS behavior to Rust for:
  - Weighted nearby asteroid selection (`assignDroneTarget`) and region selection with gravity/biome offsets.
  - Return-to-factory logic that respects queued docking and `dockDroneAtFactory` semantics.
  - Reseed and use same RNG algorithm (Mulberry32) and seed ranges to match TS seeds and control points.
- Verify flight path shape by matching Bezier/lerp control points and path_seed handling.
- Files to update: [rust-engine/src/systems/drone_ai.rs](rust-engine/src/systems/drone_ai.rs), [rust-engine/src/systems/movement.rs](rust-engine/src/systems/movement.rs), [rust-engine/src/api.rs](rust-engine/src/api.rs).

Phase 3 — Asteroids & Biomes
- Make Rust asteroid respawn use biome-driven distribution consistent with `createAsteroid` under TS: scanner level, sink bonuses, region profiles.
- Ensure `asteroid_resource_profile` arrays match length and composition.
- Files to update: [rust-engine/src/systems/asteroids.rs](rust-engine/src/systems/asteroids.rs).

Phase 4 — Power/Refinery Alignment
- Ensure per-factory idle drain, hauler maintenance, refinery slot logic, and `enforceMinOneRefining` semantics match TS energy and refinery formulas (e.g., `computeRefineryProduction`, `applyRefineryProduction` logic in TS).
- Files to update: [rust-engine/src/systems/refinery.rs](rust-engine/src/systems/refinery.rs), [rust-engine/src/systems/power.rs](rust-engine/src/systems/power.rs).

Phase 5 — Logistics Parity
- Port the scheduler’s reservoir/reservation logic, buffer targets, and request scheduling (warehouse vs f2f) as TS does to ensure identical transfer flows.
- Implement `resolveFactoryHaulerConfig` equivalently in rust using the same parameterization.
- Files to mirror: [src/state/processing/logisticsProcessing.ts](src/state/processing/logisticsProcessing.ts) → [rust-engine/src/systems/logistics.rs](rust-engine/src/systems/logistics.rs).

Phase 6 — Commands, Snapshot, Offline
- Align `apply_command()` behavior across both engines for each command (same preconditions, same output snapshot updates); add tests for each command.
- Ensure `simulateOffline()` semantics are consistent — choose either TS limited offline or Rust full-step offline as policy and implement both bridges for safety.
- Add `schemaVersion` validation and migration paths in both engines (already present, but tests must verify round-trip and migration behavior).
- Files: [rust-engine/src/api.rs](rust-engine/src/api.rs), [src/lib/offline.ts](src/lib/offline.ts), [src/lib/wasmSimBridge.ts](src/lib/wasmSimBridge.ts).

Phase 7 — Rendering & Bridge
- Ensure renderer and HUD read authoritative buffer views when `useRustSim` is enabled. Implement an opt-in read-from-bridge path (e.g. `useRustEngine` toggle) and fall back to TS state for UI interaction where necessary.
- Files: [src/lib/wasmSimBridge.ts](src/lib/wasmSimBridge.ts), [src/r3f or Scene.tsx](src/scene/Scene.tsx).

Phase 8 — CI & Validation
- Add a `wasm-parity` CI job that builds WASM (npm run build:wasm), publishes artifacts, and runs parity tests.
- Add artifacts/traces upload (parity diffs) on failures.
- Gate nightly or heavy E2E parity runs for long runs (e.g., 1k steps) on an overnight runner.

## Tests & Validation (Detailed)
- Unit parity tests for micro-steps: drone positions, state transitions, battery, cargo, factory energy and bars, asteroid ore per step. See [tests/unit/step-parity.test.ts](tests/unit/step-parity.test.ts).
- Command parity tests (apply same command on TS and Rust snapshots, compare snapshots) in [tests/unit/command-parity.test.ts](tests/unit/command-parity.test.ts).
- Offline parity: multiple seeds + step sizes in [tests/unit/offline-parity.test.ts](tests/unit/offline-parity.test.ts).
- Shadow-mode E2E: run TS and Rust in parallel for X seconds and report rolling averages; fail on threshold breaches ([tests/e2e/shadow-mode.spec.ts](tests/e2e/shadow-mode.spec.ts)).

## Risk & Tradeoffs
- Full bitwise parity across engines is unrealistic — floating point differences and memory layout differences exist. Use epsilon-based assertions.
- Some TS-only features (complex biome heuristics or UI-only tags) could be left in TS if porting cost is high; document exceptions and add integration tests covering externally visible behavior.
- CI runtime increase can be mitigated by separate WASM-parity job or gating large runs to nightly.

## Acceptance Criteria (repeat)
- Parity tests pass for baseline scenarios across TS and Rust within fiducial thresholds.
- No HUD drift in `useRustSim` mode beyond accepted thresholds.
- WASM build & parity tests run in CI; divergence logs available on failure.

## Next Steps — Immediate Tasks
1. Expand `step-parity` and `command-parity` tests locally and run with `npm test` to capture mismatches.
2. Add parity debug logging to the `rust-engine` and the bridge to quickly compare entity-level differences (drones/asteroids/factories).
3. Prioritize `drone_ai`, `asteroids`, and `refinery` parity patches in the Rust codebase as these produce the largest visual & resource divergences.
4. Add `wasm-parity` job to `.github/workflows` that performs: `npm run build:wasm` → run unit parity tests → (optionally) run gated E2E shadow-mode.
5. Start a focused PR: "DES039 — Drone AI + Travel parity " and link tests/metrics.

## Appendix — Key File References
- TypeScript (TS) implementations & state: [src/ecs/world.ts](src/ecs/world.ts), [src/ecs/systems/droneAI.ts](src/ecs/systems/droneAI.ts), [src/ecs/systems/travel.ts](src/ecs/systems/travel.ts), [src/ecs/systems/mining.ts](src/ecs/systems/mining.ts), [src/ecs/systems/refinery.ts](src/ecs/systems/refinery.ts), [src/state/processing/logisticsProcessing.ts](src/state/processing/logisticsProcessing.ts)
- Rust modules: [rust-engine/src/api.rs](rust-engine/src/api.rs), [rust-engine/src/systems/drone_ai.rs](rust-engine/src/systems/drone_ai.rs), [rust-engine/src/systems/movement.rs](rust-engine/src/systems/movement.rs), [rust-engine/src/systems/asteroids.rs](rust-engine/src/systems/asteroids.rs), [rust-engine/src/systems/refinery.rs](rust-engine/src/systems/refinery.rs), [rust-engine/src/systems/power.rs](rust-engine/src/systems/power.rs), [rust-engine/src/systems/logistics.rs](rust-engine/src/systems/logistics.rs)
- Bridge & snapshot: [src/lib/wasmSimBridge.ts](src/lib/wasmSimBridge.ts), [rust-engine/src/buffers.rs](rust-engine/src/buffers.rs)
- Tests & CI: [tests/unit/step-parity.test.ts](tests/unit/step-parity.test.ts), [tests/unit/offline-parity.test.ts](tests/unit/offline-parity.test.ts), [tests/unit/command-parity.test.ts](tests/unit/command-parity.test.ts), [tests/e2e/shadow-mode.spec.ts](tests/e2e/shadow-mode.spec.ts)

## Closing
This design provides a structured path to close parity differences between TypeScript and Rust simulation layers. The recommended first items are extending parity tests to capture the currently observed differences, and porting `drone` and `asteroid` parity logic to Rust (highest visual divergence), then working across power/refinery, logistics, offline, and rendering.

If you're comfortable with this plan, I can begin patches for Phase 1/Phase 2 steps and create the corresponding TASKs and tests. 
