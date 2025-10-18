# TASK011 - Factory Visuals

**Status:** In Progress
**Added:** 2025-10-16
**Updated:** 2025-10-17

## Original Request

Implement improved factory visuals: conveyors, transfer FX, boost pulses, and performance profiles as a follow-up to TASK008.

## Thought Process

Factory visuals require art assets (sprites/meshes), cheap GPU techniques (UV-scroll, instancing), and event wiring from existing factory/drone systems. Make visuals optional by profile to keep performance impact small.

## Implementation Plan

1. T1: Create `FactoryModel` placeholder and configurable materials (idle/active/boost/clogged).
2. T2: Implement `ConveyorSystem` with UV-scroll shader and optional instanced sprite items.
3. T3: Implement `TransferFX` pool; wire to factory/drone unload events (`factory:transfer`).
4. T4: Implement boost emissive pulse and fade effect on conveyors.
5. T5: Add `performance.profile` (high/medium/low) setting and surface in `Settings` UI.
6. T6: Add visual snapshot tests and a `tests/perf/factory-stress` scene for measuring frame impact.

## Subtasks

| ID   | Description                                  | Status      | Updated    |
| ---- | -------------------------------------------- | ----------- | ---------- |
| 11.1 | FactoryModel placeholder & materials         | Completed   | 2025-10-17 |
| 11.2 | ConveyorSystem + UV-scroll shader            | Completed   | 2025-10-17 |
| 11.3 | TransferFX pool + event wiring               | Completed   | 2025-10-17 |
| 11.4 | Boost emissive pulse                         | Completed   | 2025-10-17 |
| 11.5 | Settings integration for performance profile | Completed   | 2025-10-17 |
| 11.6 | Visual snapshot tests + perf scene           | In Progress | 2025-10-17 |

## Acceptance Criteria

- Transfer FX visible when drones unload and correctly positioned.
- Conveyors animate while processing and show boost emissive pulse when triggered.
- 'Low' performance profile disables expensive effects and maintains stable framerate.

## Progress Log

### 2025-10-16

- Created task file and linked design doc `DES010`.

### 2025-10-17

- Implemented factory activity tracking, conveyor animation, transfer FX, and boost pulse wired into the ECS; added profile-aware visuals and unit coverage for unload/refinery systems. Snapshot/perf scene follow-up remains open.
