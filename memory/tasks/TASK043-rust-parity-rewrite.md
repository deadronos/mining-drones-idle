# [TASK043] - Full Rust → TypeScript Parity Rewrite

**Status:** In Progress
**Added:** 2025-11-20
**Updated:** 2025-11-20

## Original Request

Plan: Full Rust → TypeScript Parity Rewrite
TL;DR — Replace Rust simulation skeleton with a 1:1 mapping of TS state, systems, and modifiers so Rust can run authoritative, config-driven frames identical to the TypeScript sim. Start by aligning data schemas (SoA + snapshots), port per-system logic in small increments, then validate with shadow-mode parity tests.

## Thought Process

The current Rust implementation (`TASK040`, `TASK041`) provided a skeleton and some initial system ports, but to achieve full parity and authoritative simulation, we need a more rigorous 1:1 mapping. The TypeScript simulation has specific logic for mining, energy, and drone behavior that must be exactly replicated. The data model in Rust (SoA) needs to be expanded to hold all runtime state (cargo, battery, etc.) which might currently be transient or implicitly managed in TS.

## Implementation Plan

### Phase 1: Schema & State Expansion

- [ ] **Update Schema**: Expand `schema.rs` to include full `Drone` state (cargo, battery, homeFactoryId, etc.) matching TS runtime needs.
- [ ] **Update SoA Layout**: Expand `buffers.rs` to include new fields (cargo, battery, target_index, etc.).
- [ ] **Update API**: Ensure `SimulationSnapshot` can carry this full state for save/load/debug.

### Phase 2: Constants & Configuration

- [ ] **Port Constants**: Create `config.rs` or update `constants.rs` in Rust to match `src/config/constants.ts`.
- [ ] **Config Bridge**: Allow passing config from TS to Rust via WASM to ensure they share the same values.

### Phase 3: System Porting (1:1)

- [ ] **Movement**: Port `src/ecs/systems/travel.ts` to `movement.rs`. Ensure Bezier/linear math matches exactly.
- [ ] **Mining**: Port `src/ecs/systems/mining.ts` to `mining.rs`. Handle ore depletion, capacity, modifiers.
- [ ] **Energy**: Port `src/ecs/systems/power.ts` and `energy.ts` to `energy.rs`. Handle solar, base regen, drain priorities.
- [ ] **AI & Unload**: Port `src/ecs/systems/droneAI.ts` and `unload.ts` to `drone_ai.rs` and `unload.rs`. Implement docking queues and target selection.

### Phase 4: Runtime Parity & Validation

- [ ] **Shadow Mode**: Enhance the existing shadow mode to compare full state (positions, cargo, battery) every frame.
- [ ] **Parity Tests**: Create `tests/parity_*.rs` or TS integration tests that feed identical inputs to both engines and assert outputs.
- [ ] **I/O Fidelity**: Ensure snapshots round-trip correctly between TS and Rust.

## Progress Tracking

**Overall Status:** In Progress - 0%

### Subtasks

| ID  | Description              | Status      | Updated | Notes |
| --- | ------------------------ | ----------- | ------- | ----- |
| 1.1 | Expand Rust Schema & SoA | Not Started |         |       |
| 1.2 | Port Constants & Config  | Not Started |         |       |
| 2.1 | Port Movement System     | Not Started |         |       |
| 2.2 | Port Mining System       | Not Started |         |       |
| 2.3 | Port Energy System       | Not Started |         |       |
| 2.4 | Port AI & Unload Systems | Not Started |         |       |
| 3.1 | Enhance Shadow Mode      | Not Started |         |       |
| 3.2 | Parity Tests             | Not Started |         |       |

## Progress Log

### 2025-11-20

- Created task file.
- Analyzed existing Rust and TS code to understand the gap.
- Defined implementation plan.
