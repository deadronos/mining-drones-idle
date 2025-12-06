# DES033 – Rust Simulation Core & WASM Bridge

## Summary
Implement the Rust/WASM simulation core outlined in `plan/plan-rust-simulation.md`. Rust owns ECS state, seeded RNG, and snapshot lifecycle while React/R3F continue rendering from typed-array views and JSON summaries. The bridge exposes deterministic, testable APIs so TS can toggle between the legacy TS ECS and the Rust engine during migration.

## Requirements (EARS)
- RQ-067 – Validate snapshot intake for required sections and clear errors.
- RQ-068 – Export snapshots compatible with the current `StoreSnapshot` schema without losing passthrough fields.
- RQ-069 – Keep RNG parity with TypeScript `createRng` for matching seeds.
- RQ-070 – Provide typed-array layout metadata for drones/asteroids/factories with contiguous offsets.

## Architecture
- **Crate layout (`/rust-engine`):**
  - `rng.rs` implements mulberry32-compatible RNG with float/range/int helpers.
  - `schema.rs` defines serializable `SimulationSnapshot`, `Resources`, `Modules`, `FactorySnapshot`, `DroneFlight`, and passthrough fields for future data.
  - `buffers.rs` computes typed-array layouts (offsets/lengths) for per-entity struct-of-arrays views.
  - `api.rs` hosts `GameState`, snapshot import/export, `step`, `apply_command`, and offline simulation loop placeholders.
  - `lib.rs` re-exports public API and `#[cfg(feature = "wasm")]` bindings ready for wasm-bindgen wrappers.
- **Bridge (`src/lib/wasmSimBridge.ts`):**
  - Type-level contract for WASM exports (init/load/export/step/apply/get layout pointers/memory).
  - Helpers to build typed-array views from shared `WebAssembly.Memory` given layout metadata.
  - Guard rails for missing exports or undersized memories.
- **Feature flag:** Keep Rust path opt-in (`useRustSim` to be introduced later) so current TS ECS remains default.

## Data Flow
1. UI loads WASM module (future `pkg/rust_engine_bg.wasm`) and obtains exports.
2. JS calls `init_world(snapshotJson)` to seed `GameState` + RNG; `get_layout` returns offsets.
3. R3F and selectors create typed-array views via `wasmSimBridge` to read positions/velocities/etc. each frame.
4. Commands (`apply_command`) and ticks (`step(dt)`) mutate Rust state; snapshots exported for persistence/import.
5. Offline simulation uses `simulate_offline(seconds, step)` to fast-forward and return telemetry + snapshot.

## Interfaces
- **Rust API (api.rs):**
  - `GameState::from_snapshot(SimulationSnapshot) -> Result<Self, SimulationError>`
  - `GameState::load_snapshot_str(&mut self, payload: &str)` / `export_snapshot_str(&self)`
  - `GameState::step(dt: f32) -> TickResult` (accumulates time; hook systems later)
  - `GameState::apply_command(SimulationCommand)` (initially supports resource/module mutations; extensible)
  - `GameState::simulate_offline(seconds: f32, step: f32) -> OfflineResult`
  - `plan_layout(drone_count, asteroid_count, factory_count) -> EntityBufferLayout`
- **WASM surface (future wasm-bindgen):** functions mirroring the above plus getters for buffer offsets and lengths.
- **TypeScript bridge:**
  - `RustSimExports` interface (wasm exports + `memory`).
  - `RustSimLayout` mirrors `EntityBufferLayout` for array creation.
  - `buildRustSimBridge` validates exports, builds typed-array views, and exposes high-level methods.

## Data Models
- `SimulationSnapshot` mirrors `StoreSnapshot` (resources, modules, prestige, save, settings, factories, drone flights, logistics queues) and flattens unknown fields via `serde(flatten)`.
- `EntityBufferLayout` groups `DroneBuffers`, `AsteroidBuffers`, `FactoryBuffers` with per-section offsets/lengths for position/velocity/state arrays.
- `SimulationCommand` enum starts with `UpdateResources`, `UpdateModules`, and `SetSettings` to support early parity without touching TS ECS code.

## Binary Layout
- Struct-of-arrays per entity type; float sections for vectors/scalars and a uint section for state ids.
- Layout planner packs sections contiguously using 4-byte alignment (f32/u32) and reports offsets in bytes and element counts.
- JS bridge recreates typed views from the shared `WebAssembly.Memory` buffer using these offsets and lengths.

## Error Handling
- `SimulationError` variants: `MissingField`, `ParseFailure`, `InvalidLayout`, `CommandError`.
- Snapshot import validates required blocks and reports the missing key; JSON parse errors bubble with context.
- Layout planner rejects negative counts; bridge throws when exports or memory are missing/undersized.

## Testing Strategy
- Rust unit tests for:
  - RNG parity vs. TypeScript sample sequences (RQ-069).
  - Snapshot import/export round-trips with passthrough payloads intact (RQ-067/RQ-068).
  - Layout planner offset/length calculations for multiple entity counts (RQ-070).
  - Basic `step`/`simulate_offline` time accumulation.
- JS unit tests will follow when wiring the bridge; initial bridge relies on type-level validation and runtime guards.

## Rollout Plan
1. Land Rust crate + bridge contracts (this change) under opt-in flag.
2. Add wasm-bindgen build + bundling pipeline (wasm-pack/ts bindings).
3. Mirror key systems (rng, snapshots, offline catch-up) and validate parity against TS ECS.
4. Wire feature flag in store/UI; run Rust core in shadow mode; add e2e parity tests before switching default.
