# [TASK042] - Rust Integration & Parity Verification

**Status:** Pending
**Added:** 2025-11-20
**Updated:** 2025-11-20
**Design:** [DES035](../designs/DES035-rust-integration-parity.md)

## Original Request

Hook up the main game loop to use the `RustSimBridge` when `useRustSim` is enabled. Run the Rust simulation in parallel with the TS simulation to verify parity (logging divergences). Visualize the Rust simulation state in the game.

## Thought Process

We need to integrate the `rust-engine` WASM module into the React application. This involves:

1. Loading the WASM module asynchronously.
2. Initializing the `RustSimBridge` with the current store state.
3. Creating a mechanism to step the Rust simulation alongside the TS simulation.
4. Implementing a "Shadow Mode" to compare states and log divergences.
5. Updating the rendering components to consume data from the Rust bridge when enabled.

We will start by ensuring the WASM module can be loaded. Then we'll build the simulation loop hook. Finally, we'll wire up the renderer and parity logger.

## Implementation Plan

- [ ] **WASM Integration**
  - [ ] Configure Vite to handle WASM (if needed, or use `vite-plugin-wasm`).
  - [ ] Create a `useRustEngine` hook to load and initialize the bridge.
- [ ] **Game Loop Integration**
  - [ ] Create `SimulationManager` or update `App.tsx` to manage the loop.
  - [ ] Implement `step(dt)` calling both engines if Shadow Mode is on.
- [ ] **Parity Verification**
  - [ ] Implement `compareSnapshots` utility.
  - [ ] Log warnings to console if divergence > epsilon.
- [ ] **Visualization**
  - [ ] Create `useSimulationState` hook to abstract data source (TS Store vs Rust Bridge).
  - [ ] Update `DroneRenderer` to use `useSimulationState`.
  - [ ] Update `FactoryRenderer` to use `useSimulationState`.

## Progress Tracking

**Overall Status:** In Progress

### Subtasks

| ID  | Description               | Status    | Updated    | Notes                                         |
| --- | ------------------------- | --------- | ---------- | --------------------------------------------- |
| 1.1 | Configure Vite for WASM   | Completed | 2025-11-20 | Installed plugins and updated config          |
| 1.2 | Create useRustEngine hook | Completed | 2025-11-20 | Created hook and bridge initialization        |
| 1.3 | Implement Simulation Loop | Completed | 2025-11-20 | Integrated into Scene.tsx                     |
| 1.4 | Implement Parity Logger   | Completed | 2025-11-20 | Implemented checkParity and Shadow Mode logic |
| 1.5 | Update Renderers          | Completed | 2025-11-20 | Created RustDrones.tsx and updated Scene.tsx  |

## Progress Log

### 2025-11-20

- Task created based on DES035.
- Configured Vite with `vite-plugin-wasm` and `vite-plugin-top-level-await`.
- Created `useRustEngine` hook to load WASM and initialize `RustSimBridge`.
- Integrated Rust simulation step into `Scene.tsx` game loop.
- Implemented `checkParity` utility to compare TS and Rust states.
- Added `shadowMode` setting and logic to run both simulations in parallel.
- Created `RustDrones` component to visualize drones directly from WASM memory.
- Updated `Scene.tsx` to switch between `Drones` and `RustDrones` based on `useRustSim` setting.
- **Verification**: Ran `npm run typecheck`, `npm run lint`, and `npm run test`. All passed.
- **Fixes**:
  - Fixed type mismatch in `wasmSimBridge.ts` (Float32Array vs Uint32Array).
  - Added `shadowMode` to `normalizeSettings` in `store.ts`.
  - Updated tests in `migrations.test.ts` and `Settings.test.tsx` to include `shadowMode`.
  - Added `src/gen` to `eslint.config.js` ignores.
  - Fixed unsafe `any` assignment in `wasmSimBridge.ts`.
  - **Fixed Runtime Error #1**: `pathSeed` generation in `targetAssignment.ts` was producing values > `i32::MAX`, causing WASM deserialization failure. Clamped to `0x7fffffff`.
  - **Fixed Runtime Error #2**: `generateSeed` in `utils.ts` was producing values > `i32::MAX` for `rngSeed`. Updated to mask with `0x7fffffff` to ensure all seeds fit in positive `i32` range.
  - Fixed `wasm-pack` dependency and moved to `devDependencies`.
  - Made `GameState.layout` and `GameState.data` public in Rust for WASM access.
- **Status**: Implementation verified. Runtime errors fixed. Build successful. Ready for runtime testing.
