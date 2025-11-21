# Active Context

## Current Work

## Active Tasks

### 🔄 **TASK043 – Full Rust → TypeScript Parity Rewrite**

- **Goal**: Replace Rust simulation skeleton with a 1:1 mapping of TS state, systems, and modifiers.
- **Status**: Implementation (Systems Complete).
- **Recent**:
  - Ported all remaining systems: Refinery, Power, Unload.
  - Updated ECS buffer layout with `haulers_assigned`.
  - Wired all systems into `api.rs` `step` function with correct modifiers.
  - Verified compilation of the full Rust codebase.
- **Next Steps**:
  - Verify runtime behavior (WASM build & integration).
  - Debug any logic mismatches.
  - Complete the TS-side integration (if not already done).

### 🔄 **TASK042 – Rust Integration & Parity Verification**

- **Goal**: Integrate `rust-engine` into the main game loop and verify parity.
- **Status**: Implementation Complete. Validation Pending.
- **Recent**:
  - Implemented `checkParity` and Shadow Mode.
  - Created `RustDrones` for direct WASM visualization.
  - Updated `Scene.tsx` to support engine switching.
- **Next Steps**:
  - Run the game and verify "Shadow Mode" logs.
  - Fix any divergences found.
  - Implement `RustFactories` and `RustAsteroids` for full visual parity.

- 🚧 **TASK038 – Factory Metrics & Mini-Charts** remains in progress.
  - Factory Metrics tab now renders four sparklines with summary stats, sampling banner, and pause control.
  - Inline sparkline component ships on factory cards and hides when sampling disabled or empty.
  - Settings panel exposes metrics toggle, interval, and retention inputs; metrics helpers covered by new unit tests.
  - Sparklines now include descriptive titles/ARIA wiring and inline component gains narrated labels with dedicated Vitest coverage.
  - Metrics banner now surfaces the most recent sampling time so players can relate charts to gameplay moments.

---

## Recent Completions

✅ **Completed: TASK041 – Rust Simulation Systems & Logic Port**

- Implemented core ECS systems in Rust: Movement, Mining, Power, Refinery.
- Updated `wasmSimBridge.ts` to expose all SoA buffers.
- Verified parity with unit tests.

✅ **Completed: TASK040 – Rust Simulation Core**

- Scaffolding `/rust-engine` crate completed with RNG parity tests, snapshot import/export, layout planner, and data buffer.
- Implemented TS bridge (`wasmSimBridge`) matching `wasm-bindgen` class structure.

## Next Steps

1. Finalize Rust crate scaffolding, wasm-bindgen surface, and feature-flag plan before integrating with the store.
2. Validate sparkline rendering performance under stress scenarios and document thresholds.
3. Explore contextual data (aggregate deltas, projected throughput) to complement visual trends.
4. Plan Playwright coverage once metrics UI stabilizes and evaluate throttled-profile acceptance.
