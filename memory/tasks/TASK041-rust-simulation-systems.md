# [TASK041] - Rust Simulation Systems & Logic Port

**Status:** Completed
**Added:** 2025-11-19
**Updated:** 2025-11-20
**Design:** [DES034](../designs/DES034-rust-simulation-systems.md)

## Original Request

Implement the core ECS systems (Movement, Mining, Energy, Refinery) within the Rust engine. This builds on the scaffolding from TASK040/DES033 and moves the actual simulation logic from TypeScript to Rust, ensuring mathematical parity and deterministic behavior.

## Thought Process

The goal is to achieve high-performance, deterministic simulation by moving core logic to Rust/WASM. We will use a Struct-of-Arrays (SoA) pattern for the `GameState` to optimize for WASM memory access (zero-copy views).

We need to port the following systems:

1. **Refinery**: Simplest logic, good starting point.
2. **Movement**: Critical for visuals, involves Bezier math.
3. **Mining**: Interaction between drones and asteroids.
4. **Energy**: Resource management across entities.

We must ensure that the Rust implementation produces the exact same results as the TypeScript implementation (parity) to avoid simulation divergence during the migration.

## Implementation Plan

- [ ] **Expand GameState Data Structure**
  - [ ] Add vectors for Drones (positions, velocities, states, cargo, battery).
  - [ ] Add vectors for Asteroids (positions, ore, max_ore).
  - [ ] Add vectors for Factories (resources).
- [ ] **Implement Refinery System (`sys_refinery`)**
  - [ ] Port logic from `src/state/processing/gameProcessing.ts`.
  - [ ] Add unit tests verifying input/output parity.
- [ ] **Implement Movement System (`sys_movement`)**
  - [ ] Port Bezier curve logic from `src/ecs/systems/movement.ts`.
  - [ ] Implement `DroneFlight` struct/logic.
  - [ ] Add unit tests for position calculation.
- [ ] **Implement Mining System (`sys_mining`)**
  - [ ] Port logic from `src/ecs/systems/mining.ts`.
  - [ ] Handle ore transfer and asteroid depletion.
  - [ ] Add unit tests.
- [ ] **Implement Energy System (`sys_energy`)**
  - [ ] Port logic from `src/ecs/systems/energy.ts`.
  - [ ] Handle battery drain and charging.
  - [ ] Add unit tests.
- [ ] **Update WASM Bridge**
  - [ ] Update `EntityBufferLayout` to expose new components.
  - [ ] Ensure `wasmSimBridge.ts` can read the new data.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                   | Status    | Updated    | Notes                                                                   |
| --- | ----------------------------- | --------- | ---------- | ----------------------------------------------------------------------- |
| 1.1 | Expand GameState struct (SoA) | Completed | 2025-11-19 | Added factory components, updated layout, fixed alignment (`Vec<u32>`). |
| 1.2 | Implement sys_refinery        | Completed | 2025-11-19 | Ported logic, added unit tests, verified pass.                          |
| 1.3 | Implement sys_movement        | Completed | 2025-11-19 | Implemented with Bezier curves, energy drain, arrival logic.            |
| 1.4 | Implement sys_mining          | Completed | 2025-11-19 | Implemented mining logic, added `target_index` to SoA.                  |
| 1.5 | Implement sys_energy          | Completed | 2025-11-19 | Implemented as `sys_power` (generation, charging).                      |
| 1.6 | Update WASM Bridge contracts  | Completed | 2025-11-20 | Updated `wasmSimBridge.ts` with new buffers and getters.                |

## Progress Log

### 2025-11-20

- Updated `wasmSimBridge.ts` to expose new SoA buffers (cargo, battery, target_index, factory resources/energy/upgrades/refinery).
- Fixed type errors in `migrations.test.ts` and `Settings.test.tsx` related to `useRustSim` setting.
- Verified TypeScript compilation with `npm run typecheck`.
- Marked task as completed.

### 2025-11-19

- Task created based on DES034.
- Expanded `buffers.rs` with factory components (resources, energy, upgrades, refinery state).
- Created `constants.rs` with game constants.
- Implemented `sys_refinery` in Rust with unit tests.
- Updated `api.rs` to use `Vec<u32>` for data storage to ensure 4-byte alignment for f32 slices.
- Verified `sys_refinery` and alignment fix with `cargo test`.
- Implemented `sys_movement` with energy consumption and state transitions.
- Implemented `sys_power` for global energy generation and drone charging.
- Implemented `sys_mining` for resource gathering.
- Updated `buffers.rs` to include `target_index` for drones to support mining target tracking.
- Integrated all systems into `api.rs` `step` function.
- Verified all systems with `cargo test`.
