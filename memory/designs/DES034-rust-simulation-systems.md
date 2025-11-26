# DES034 – Rust Simulation Systems & Logic Port

## Summary

This design covers the implementation of the core ECS systems (Movement, Mining, Energy, Refinery) within the Rust engine. Building on the scaffolding from DES033, this phase moves the actual simulation logic from TypeScript to Rust, ensuring mathematical parity and deterministic behavior.

## Requirements (EARS)

- RQ-071 – The system shall update drone positions using 3D cubic Bezier curves identical to the TypeScript implementation.
- RQ-072 – The system shall handle mining interactions, decrementing asteroid ore and incrementing drone cargo based on mining rates.
- RQ-073 – The system shall manage energy consumption (flight/mining drain) and recharging logic at factories.
- RQ-074 – The system shall process refinery queues, converting ore to bars based on factory upgrades and time deltas.
- RQ-075 – The system shall maintain a fixed-step accumulator to ensure deterministic updates regardless of frame rate.

## Architecture

### ECS Pattern

We will use a **Struct-of-Arrays (SoA)** approach for high-frequency data, stored within the `GameState` struct. This aligns with the WASM binary layout requirements for zero-copy views.

- **Entities**: Represented by indices (IDs).
- **Components**: Vectors in `GameState` (e.g., `drone_positions`, `drone_states`).
- **Systems**: Functions that borrow `GameState` (or specific component vectors) and a time delta `dt`.

### Core Systems

1. **Movement System (`sys_movement`)**
   - **Input**: `drone_flights` (source/target/progress), `dt`.
   - **Logic**:
     - Increment `elapsed` time.
     - Calculate Bezier point `B(t)` where `t = elapsed / duration`.
     - Update `position` and `velocity` (derivative of B(t)).
     - Handle arrival (transition to `Mining` or `Docking`).
   - **Parity**: Must match `src/ecs/systems/movement.ts`.

2. **Mining System (`sys_mining`)**
   - **Input**: `drone_states` (Mining), `drone_cargo`, `asteroid_ore`, `dt`.
   - **Logic**:
     - If state is `Mining`, transfer ore from asteroid to drone.
     - Rate determined by modules/upgrades (passed via snapshot/settings).
     - Handle asteroid depletion (mark for recycling/respawn).
   - **Parity**: Must match `src/ecs/systems/mining.ts`.

3. **Energy System (`sys_energy`)**
   - **Input**: `drone_battery`, `drone_states`, `factory_energy`, `dt`.
   - **Logic**:
     - Drain battery during `Flight` and `Mining`.
     - Charge battery when `Docked` (drain factory energy).
     - Trigger `LowBattery` return logic if threshold breached.
   - **Parity**: Must match `src/ecs/systems/energy.ts`.

4. **Refinery System (`sys_refinery`)**
   - **Input**: `factory_resources`, `factory_upgrades`, `dt`.
   - **Logic**:
     - Consume ore, produce bars.
     - Respect `refineSlots` and processing speed.
   - **Parity**: Must match `src/state/processing/gameProcessing.ts`.

## Data Layout (SoA)

The `GameState` struct will be expanded to hold these vectors. The `EntityBufferLayout` (from DES033) will map these vectors to byte offsets for the WASM bridge.

```rust
pub struct GameState {
    // ... existing fields

    // Drones
    pub drone_positions: Vec<f32>, // [x, y, z, x, y, z, ...]
    pub drone_velocities: Vec<f32>,
    pub drone_states: Vec<u32>,    // Enum mapping
    pub drone_cargo: Vec<f32>,
    pub drone_battery: Vec<f32>,
    pub drone_flights: Vec<DroneFlight>, // Complex state, maybe kept as struct or flattened if needed for perf

    // Asteroids
    pub asteroid_positions: Vec<f32>,
    pub asteroid_ore: Vec<f32>,
    pub asteroid_max_ore: Vec<f32>,

    // Factories
    pub factory_resources: Vec<Resources>, // Or flattened
    // ...
}
```

## Implementation Strategy

1. **Iterative Porting**: Port one system at a time, starting with **Refinery** (simplest, self-contained) then **Movement** (visual, high-impact).
2. **Unit Testing**:
   - Create Rust unit tests that mirror the existing TypeScript unit tests for each system.
   - Use the same constants (`GROWTH`, `BASE_REFINERY_RATE`, etc.) defined in a shared `constants.rs`.
3. **Bridge Updates**:
   - As new components are added (e.g., `drone_battery`), update `EntityBufferLayout` and `wasmSimBridge.ts` to expose them.

## Verification Plan

- **Refinery**: Feed a snapshot with 100 ore, run `step(1.0)`, verify ore count and bar count match TS output.
- **Movement**: Initialize a drone at `0,0,0` moving to `100,0,0`. Step `dt` and compare position vector against TS `Math.pow` implementation.
- **RNG**: Verify mining yields and asteroid spawns match the seeded sequence.

## Open Questions

- **Complex Structs**: Should `DroneFlight` (Bezier control points) be flattened into `f32` vectors for WASM access, or kept as a Rust struct since JS only needs the resulting position?
  - _Decision_: Keep `DroneFlight` as a struct in a `Vec` for internal logic. JS only needs the calculated `position` and `velocity` for rendering, which are already flattened.
