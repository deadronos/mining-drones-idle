# Plan — Rust Simulation Core

This plan describes how to migrate Space Factory’s entire simulation (ECS entities, pathing, economy/logistics) into a Rust/WASM module while keeping React/R3F responsible for rendering and UI. At runtime, we use typed arrays/binary views for high-frequency data and JSON snapshots for storage, import/export, and debugging. A shared seeded RNG guarantees deterministic behavior across TypeScript and Rust.

---

## Goals

- Move the full ECS simulation (drones, asteroids, factories, power, refinery, logistics/economy) into a Rust core compiled to WASM.
- Keep rendering and UI (React, React Three Fiber, Zustand selectors, HUD) in TypeScript, driven by read-only views of the Rust state.
- Use typed arrays / binary buffers for per-frame or per-tick data flowing from Rust to JS, and JSON snapshots for persistence and tools.
- Introduce a shared seeded RNG implementation so a given seed and command sequence yields identical behavior in TypeScript and Rust.

---

## Step 1 — Define Canonical World Schema and Rust ECS Model

- Extract the full world schema from `src/state` and `src/ecs`:
  - Global economic state: resources, modules, prestige, settings, save metadata, logistics queues, RNG seed.
  - ECS entities: drones, asteroids, factories, any future entities (e.g., hazards, haulers).
  - System responsibilities: fleet, asteroids, drone AI, travel, mining, unload, power, refinery, logistics.
- Define a Rust `GameState` and ECS components mirroring these structures:
  - Components for positions/orientations, movement, cargo, mining/processing, energy, AI state, logistics.
  - Resources for global economic data, time accumulator, RNG, and configuration/spec inputs.
- Decide what belongs in **runtime-only state** vs **snapshot state**:
  - Snapshot: everything needed to resume a run (resources, modules, prestige, logistics, RNG seed, essential ECS entity fields).
  - Runtime-only: cached vectors, transient timers, debug flags, render-only metrics that don’t need persistence.

---

## Step 2 — Design WASM API and Binary Layout (Typed Arrays + JSON Snapshots)

- Define a minimal Rust→WASM API surface:
  - `init_world(snapshot_json: &str)` — Initialize Rust `GameState` from a JSON snapshot compatible with current save/import/export.
  - `load_snapshot(snapshot_json: &str)` — Replace current state with a new snapshot (used for imports or dev tools).
  - `export_snapshot() -> String` — Serialize the current state to JSON for persistence/import/export.
  - `step(dt: f32)` — Advance the entire simulation by `dt` seconds using the fixed-step loop.
  - `apply_command(cmd_json: &str)` — Apply high-level commands (buy module, prestige, settings change, import payload) originating from the UI.
  - `simulate_offline(seconds: f32, step: f32) -> String` — Run offline catch-up in Rust and return JSON telemetry plus the new snapshot.
- Define the binary layout in WASM linear memory for per-frame high-frequency data:
  - Struct-of-arrays layout for drones: positions, velocities, states, cargo, battery, etc.
  - Struct-of-arrays layout for asteroids: positions, ore remaining, richness, radius, hazards.
  - Optional layout for factories: positions/orientations, activity flags, per-factory throughput.
- Expose pointers and counts via the WASM API:
  - `get_drones_ptr() -> *const f32`, `get_drones_len() -> u32`, etc.
  - `get_asteroids_ptr()`, `get_factories_ptr()`, and similar.
- Use JSON **only** for low-frequency and tooling-oriented operations:
  - Save/load, import/export, dev snapshots, offline telemetry.

---

## Step 3 — Implement Rust ECS + Seeded RNG and Compile to WASM

- Implement the Rust ECS systems to match current behavior:
  - Fleet/drone spawning, AI target selection, travel, mining, unloading, asteroid recycling, power, refinery, logistics.
  - Fixed timestep accumulator inside `step(dt)` so behavior matches the existing `createTimeSystem` semantics.
- Port the existing seeded RNG algorithm into Rust:
  - Mirror the current mulberry32-style PRNG: 32-bit `u32` state, identical operations, identical seed normalization.
  - Ensure **all simulation-critical randomness** (world gen, biomes, logistics/economy rolls, AI decisions) uses this RNG.
- Compile to WASM with `wasm-bindgen` (or similar), exposing the API functions and typed-array entry points.
- Add a small Rust-side test suite for internal correctness (systems, RNG, serialization) before wiring JS.

---

## Step 4 — Build TypeScript Bridge for Typed Arrays, Commands, and Snapshots

- Add a TS bridge module (e.g., `src/lib/wasmSimBridge.ts`):
  - Load the WASM module and capture its exports.
  - Provide typed functions: `initWorldFromSnapshot(snapshot)`, `stepSimulation(dt)`, `applyCommand(cmd)`, `exportSnapshot()`, `simulateOffline(seconds, step)`.
  - Create and cache `Float32Array`/`Uint32Array` views over WASM memory for drone/asteroid/factory buffers.
- Adapt R3F/React to read from the bridge instead of the TS ECS/miniplex world:
  - Drone and asteroid meshes read positions/orientations from typed arrays every frame.
  - HUD and panels read aggregated state from small JSON summaries or derived values exposed by the bridge.
- Keep a feature flag (e.g., `useRustSim`) to toggle between the existing TS ECS and the Rust core during migration.

---

## Step 5 — Refactor Store and Persistence to Treat Rust as Source of Truth

- Adjust the Zustand store so simulation-owned fields are mirrors of Rust state:
  - Resources, modules, prestige, RNG seed, factories, logistics, and any simulation counters come from `export_snapshot` or incremental summaries.
  - UI-only state (settings panel view, selections, debug toggles, local UI metrics) remains TS-owned.
- Route all actions that affect simulation through the bridge:
  - `buy`, `doPrestige`, settings that impact simulation, import/export, and offline catch-up become `applyCommand` or `load_snapshot` calls into Rust.
  - After a command, the store pulls updated summaries/snapshots from Rust and updates UI state.
- Keep JSON snapshots compatible with current persistence format where feasible:
  - Extend or version snapshot schema as needed but preserve import/export affordances.

---

## Step 6 — Add Cross-Language Determinism and Parity Tests

- Add tests that compare JS reference logic against Rust/WASM outputs:
  - RNG parity: same seed → same sequence of random values in TS and Rust.
  - Step parity: starting from the same snapshot and seed, running `N` steps produces identical economic and ECS outcomes.
  - Offline parity: given `snapshot + seed + elapsed seconds`, both paths yield matching ore/bars/energy and relevant telemetry.
- Gate rollout behind a feature flag:
  - Run the Rust core in "shadow" mode during development, feeding it the same commands while JS still drives the UI.
  - Log divergences and tighten tests until parity is achieved.
- Once parity and performance are acceptable, flip the default to Rust and gradually retire the TS ECS and simulation code, keeping the JS path only as a debug/reference option if needed.
