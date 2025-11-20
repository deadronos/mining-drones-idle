# DES035 – Rust Integration & Parity Verification

## Summary

This design covers the integration of the Rust simulation core (`rust-engine`) into the main game loop, enabling a "Shadow Mode" where both TypeScript and Rust engines run in parallel. This allows for real-time parity verification and performance benchmarking before fully switching over to the Rust engine.

## Requirements (EARS)

- RQ-076 – The system shall support a `useRustSim` feature flag that toggles the authoritative simulation source between TypeScript and Rust.
- RQ-077 – The system shall support a "Shadow Mode" where the Rust simulation runs in the background, receiving the same inputs as the TypeScript engine.
- RQ-078 – The system shall periodically compare the state of the TypeScript and Rust simulations in Shadow Mode and log any divergences exceeding a defined tolerance.
- RQ-079 – The system shall visualize the Rust simulation state (e.g., drone positions) when `useRustSim` is enabled, or optionally as debug overlays in Shadow Mode.
- RQ-080 – The system shall gracefully handle WASM initialization failures, falling back to the TypeScript engine.

## Architecture

### Game Loop Integration

The `GameLoop` component (or a new `SimulationManager`) will manage the lifecycle of both engines.

- **Initialization**:
  - Load WASM module.
  - Initialize `RustSimBridge` with the initial `StoreSnapshot`.
- **Update Loop (`useFrame` / `setInterval`)**:
  - **Input**: Collect `dt` (delta time).
  - **TS Engine**: Run existing `useStore.getState().step(dt)`.
  - **Rust Engine**: Call `rustBridge.step(dt)`.
  - **Shadow Mode**: If enabled, run both. If `useRustSim` is true, Rust is authoritative for rendering; otherwise TS is.

### Shadow Mode & Parity Check

To verify parity without killing performance:

1. **Input Synchronization**: Ensure both engines receive the exact same `dt` and user commands (e.g., "Buy Drone").
   - _Challenge_: User commands currently mutate the Zustand store directly. We need to intercept these or replay them to Rust.
   - _Solution_: For now, we might rely on `step(dt)` parity for passive simulation. For commands, we can hook into the store actions or just re-initialize Rust from the TS snapshot if divergence is too high (auto-correction).
   - _Better Solution_: Implement `apply_command` in Rust and route actions to both.

2. **Comparison Strategy**:
   - Compare high-level metrics (Total Ore, Total Energy) every frame.
   - Compare detailed entity state (Drone Positions) every N frames (e.g., 60 frames).
   - Use a tolerance `epsilon` (e.g., `0.001`) for floating-point comparisons.

### Visualization

- **Rendering**: The `Scene` components (`DroneRenderer`, `FactoryRenderer`) currently read from the Zustand store.
- **Bridge**: We need a hook `useSimulationState()` that returns the data to render.
  - If `useRustSim`: Returns data from `rustBridge` (typed arrays).
  - If `legacy`: Returns data from `useStore`.
- **Debug Overlay**: A visual toggle to show "Ghost Drones" (Rust positions) overlaid on "Real Drones" (TS positions) to visually inspect divergence.

## Implementation Plan

1. **WASM Loading**: Ensure `wasm-pack` output is loadable in the Vite dev server.
2. **Simulation Hook**: Create `useGameLoop` or modify `App.tsx` to drive the Rust bridge.
3. **Parity Logger**: Create a utility to diff `StoreSnapshot` vs `RustSnapshot`.
4. **Render Binding**: Update `DroneRenderer` to accept a data source prop or use the abstraction hook.

## Open Questions

- **Command Replay**: How to handle `buyDrone`?
  - _Phase 1_: Just test passive simulation (mining/moving). Re-init Rust on user action.
  - _Phase 2_: Serialize actions and send to Rust.
- **Performance**: Running two sims might be heavy.
  - _Mitigation_: Only run Shadow Mode on desktop/high-perf profile.
