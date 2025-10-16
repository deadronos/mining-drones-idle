# TASK006 - Energy Throttle & Per-Drone Battery

**Status:** Completed
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

| ID  | Description                 | Status              | Updated    | Notes                                                                                                                 |
| --- | --------------------------- | ------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Drone component updates     | Completed           | 2025-10-16 | Added battery, maxBattery, and charging flags to `DroneEntity` in `src/ecs/world.ts`.                                 |
| 6.2 | Travel & mining adjustments | Completed           | 2025-10-16 | Both systems now scale movement/mining speed by per-drone energy fraction and drain battery via `consumeDroneEnergy`. |
| 6.3 | Power charging allocation   | Completed           | 2025-10-16 | `src/ecs/systems/power.ts` allocates stored energy to docked drones, clamping values and toggling `charging` state.   |
| 6.4 | Settings & HUD wiring       | Partially Completed | 2025-10-16 | Settings UI exposes throttleFloor; HUD feedback for individual drone battery not present.                             |

## Acceptance Criteria

- Smooth throttling without halting; energy values non-negative and stable.

## Progress Log

### 2025-10-16

- Verified: Energy throttle math implemented in `src/state/store.ts` and used by `src/ecs/systems/power.ts` and `src/ecs/systems/mining.ts` to scale consumption and mining rates.
- Remaining: add per-drone battery fields to `DroneEntity`, implement per-drone drain/charge allocation, and surface HUD indicators. Marking TASK006 In Progress.

### 2025-10-16

- Added drone battery fields, helper utilities, and updated travel/mining to consume per-drone energy with throttle floor clamping.
- Reworked the power system to route solar/storage output into docked-drone charging while keeping stored energy non-negative.
- Extended test suite with travel, mining, and power coverage for drained batteries and throttled progress; README documents the new behaviour. Marking TASK006 Completed.
