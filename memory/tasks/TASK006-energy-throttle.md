# TASK006 - Energy Throttle & Per-Drone Battery

**Status:** In Progress  
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
| 6.1 | Drone component updates | Not Started | 2025-10-16 | `src/ecs/world.ts` DroneEntity does not include per-drone battery fields yet. |
| 6.2 | Travel & mining adjustments | Partially Completed | 2025-02-14 | `src/ecs/systems/mining.ts` and `src/ecs/systems/travel.ts` use `computeEnergyThrottle` to scale mining and travel behavior where appropriate. |
| 6.3 | Power charging allocation | Partially Completed | 2025-02-14 | `src/ecs/systems/power.ts` computes generation, consumption and applies throttle globally; per-drone allocation not implemented. |
| 6.4 | Settings & HUD wiring | Partially Completed | 2025-02-16 | Settings UI exposes throttleFloor; HUD feedback for individual drone battery not present. |

## Acceptance Criteria

- Smooth throttling without halting; energy values non-negative and stable.

## Progress Log

### 2025-10-16

- Verified: Energy throttle math implemented in `src/state/store.ts` and used by `src/ecs/systems/power.ts` and `src/ecs/systems/mining.ts` to scale consumption and mining rates.
- Remaining: add per-drone battery fields to `DroneEntity`, implement per-drone drain/charge allocation, and surface HUD indicators. Marking TASK006 In Progress.
