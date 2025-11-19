# [TASK041] - Rust Simulation Systems & Logic Port

**Status:** Pending
**Added:** 2025-11-19
**Updated:** 2025-11-19
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

**Overall Status:** Not Started - 0%

### Subtasks

| ID  | Description                   | Status      | Updated | Notes |
| --- | ----------------------------- | ----------- | ------- | ----- |
| 1.1 | Expand GameState struct (SoA) | Not Started |         |       |
| 1.2 | Implement sys_refinery        | Not Started |         |       |
| 1.3 | Implement sys_movement        | Not Started |         |       |
| 1.4 | Implement sys_mining          | Not Started |         |       |
| 1.5 | Implement sys_energy          | Not Started |         |       |
| 1.6 | Update WASM Bridge contracts  | Not Started |         |       |

## Progress Log

### 2025-11-19

- Task created based on DES034.
