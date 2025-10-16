# TASK006 - Energy Throttle & Per-Drone Battery

**Status:** Pending  
**Added:** 2025-10-16  
**Updated:** 2025-10-16

## Original Request

Introduce per-drone battery mechanics and throttling (Milestone 3).

## Thought Process

Extend drone entity components and modify travel/mining systems to apply `energyFraction`. Add charging logic in power system and expose throttleFloor in Settings.

## Implementation Plan

1. Update `src/ecs/world.ts` DroneEntity with battery fields.
1. Adjust `travel` and `mining` systems to scale by energy fraction.
1. Implement charging allocation in `power` system.
1. Update Settings UI and add HUD feedback.
1. Add tests for battery drain/charge curves and deterministic AI.

## Subtasks

| ID | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 6.1 | Drone component updates | Not Started |  |  |
| 6.2 | Travel & mining adjustments | Not Started |  |  |
| 6.3 | Power charging allocation | Not Started |  |  |
| 6.4 | Settings & HUD wiring | Not Started |  |  |

## Acceptance Criteria

- Smooth throttling without halting; energy values non-negative and stable.

## Progress Log

### 2025-10-16

- Task created and linked to `memory/designs/DES005-energy-throttle.md`.
