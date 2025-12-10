# TASK040 - Rust Simulation Core

**Status:** In Progress
**Added:** 2025-11-18
**Updated:** 2025-11-18

## Original Request

Execute `plan/plan-rust-simulation.md` by standing up a Rust/WASM simulation core that mirrors the existing TS ECS, exposes typed-array views, and keeps JSON snapshot compatibility so the UI can eventually switch engines behind a feature flag.

## Thought Process

The Rust engine needs a deterministic surface (seeded RNG, snapshot IO, typed-array layout) before porting systems. Starting with a crate + bridge contracts lets us validate shapes, parity, and error handling without disturbing the TS ECS. Passthrough-friendly schemas avoid blocking on modeling every field up front.

## Implementation Plan

- Capture Rust-focused requirements (RQ-067–RQ-070) and design (DES033) in the memory bank.
- Scaffold `/rust-engine` crate with RNG, snapshot schema, layout planner, and API wrapper.
- Add TypeScript bridge contract (`wasmSimBridge`) to describe WASM exports and buffer view wiring.
- Write Rust unit tests for RNG parity, snapshot round-trips, and layout offsets; add basic time-step coverage.
- Keep the Rust engine opt-in (no runtime wiring yet) while planning wasm-bindgen packaging and store flagging.

### Subtasks

| ID  | Description                                           | Status    | Updated    | Notes                                         |
| --- | ----------------------------------------------------- | --------- | ---------- | --------------------------------------------- |
| 1.1 | Add Rust simulation requirements to memory            | Completed | 2025-11-18 | RQ-067–RQ-070 appended.                       |
| 1.2 | Draft DES033 design covering architecture and testing | Completed | 2025-11-18 | DES033 recorded under /memory/designs.        |
| 2.1 | Scaffold Rust crate with RNG, schema, layout, API     | Completed | 2025-11-19 | Crate + tests passed. Added data buffer.      |
| 2.2 | Create TS wasm bridge contract and helpers            | Completed | 2025-11-19 | Bridge implemented with wasm-bindgen support. |
| 3.1 | Plan wasm-bindgen/feature-flag integration            | Completed | 2025-11-19 | Build script verified. Feature flag added.    |

## Acceptance Criteria

1. Rust crate exists with exported RNG, snapshot import/export, layout planner, and basic step/offline hooks.
2. Unit tests cover RNG parity and snapshot/layout validation per RQ-067–RQ-070.
3. TypeScript bridge exposes WASM export/layout contracts and view helpers without altering current ECS wiring.
4. Memory bank reflects requirements, design, plan, and progress for the Rust migration.

## Progress Log

- 2025-11-18: Created task, added RQ-067–RQ-070, drafted DES033 architecture/testing strategy, and started crate/bridge scaffolding.
- 2025-11-19: Implemented Rust crate scaffolding with data buffer and pointer export. Created `wasmSimBridge.ts` matching `wasm-bindgen` class structure. Verified Rust tests pass.
