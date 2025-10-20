# TASK020 — Factory Energy Resilience

**Status:** Completed  
**Added:** 2025-10-23  
**Updated:** 2025-10-23

## Original Request

Look at `ENERGY_ISSUE_EXAMINATION.md` and execute the documented next steps:

1. Fix unload gate so drones always transition to `idle` at the end of the unload system, regardless of cargo.
2. Allow DroneAI reassignment by clearing `targetFactoryId` when the drone state no longer matches expectations.
3. Add charging from factory energy so docked drones can draw from the local pool when the global grid is empty.
4. Consider an optional factory solar regeneration upgrade as a future enhancement.

## Thought Process

- The unload system currently guards undock logic inside a `cargo > 0` branch, allowing zero-cargo drones to keep their docking slot and `targetFactoryId`. Moving the undock/reset sequence outside the branch will address the stuck state.
- DroneAI does not sanitize stale factory assignments, so drones that lost power mid-queue never re-enter the assignment flow. A per-tick guard clearing idle/mining drones will release the queue slot and let `assignReturnFactory` run again.
- The power system only consumes global energy. By diverting a small helper to draw from the docked drone's `ownerFactoryId` energy store, drones can recover after localized outages without waiting for the global grid.
- A future solar upgrade can sit on top of the same per-factory energy store, so this loop focuses on the underlying resilience changes and leaves regen for later planning.

## Implementation Plan

1. Document requirements (RQ-032..RQ-034) and create design DES019 plus this task record.
2. Refactor `src/ecs/systems/unload.ts` to always undock/reset drones and cover zero-cargo cases.
3. Harden `src/ecs/systems/droneAI.ts` with a cleanup guard and unit tests for factory assignment hygiene.
4. Extend `src/ecs/systems/power.ts` to charge from factory energy when global energy is exhausted, updating persistence/tests if needed.
5. Run regression tests (unit + integration) and update memory bank with outcomes and follow-up items, including the optional solar upgrade note.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                                        | Status    | Updated    | Notes                                                         |
| --- | -------------------------------------------------- | --------- | ---------- | ------------------------------------------------------------- |
| 1.1 | Capture requirements and design in memory bank     | Completed | 2025-10-23 | DES019 + RQ-032..RQ-034 recorded.                             |
| 2.1 | Refactor unload system for zero-cargo path         | Completed | 2025-10-23 | Always undocks, clears targets, frees queue slots.            |
| 3.1 | Add DroneAI assignment cleanup and tests           | Completed | 2025-10-23 | Idle drones clear stale factory targets; unit coverage added. |
| 4.1 | Enable factory-assisted charging and test coverage | Completed | 2025-10-23 | Power system draws from factory pools with regression tests.  |
| 5.1 | Execute validation and document outcomes           | Completed | 2025-10-23 | `npm run test` suite green; optional solar regen deferred.    |

## Progress Log

### 2025-10-23

- Reviewed energy issue examination notes and confirmed root causes in unload, drone AI, and power systems.
- Drafted DES019 design outlining unload reset, assignment cleanup, and factory-assisted charging flows.
- Logged requirements RQ-032..RQ-034 tying to this resilience work and captured Task 020 implementation plan.
- Implemented unload system changes to release drones with zero cargo, added DroneAI cleanup for stale docking targets, and extended the power system to blend factory energy charging with new unit coverage.
- Ran `npm run test` (vitest) to confirm regressions pass; captured DES019 follow-up note for a future solar regeneration upgrade.
