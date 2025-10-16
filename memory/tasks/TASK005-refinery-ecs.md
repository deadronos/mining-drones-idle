# TASK005 - Refinery ECS System & Offline Alignment

**Status:** Completed  
**Added:** 2025-10-16  
**Updated:** 2025-10-16

## Original Request

Move refinery logic into ECS system and ensure offline parity (Milestone 2).

## Thought Process

Implement system in `src/ecs/systems/refinery.ts`, expose `store.processRefinery(dt)`, update offline simulation to call it and add parity tests.

## Implementation Plan

1. Implement `createRefinerySystem` and integrate into system registry.
1. Update store to include `processRefinery` proxy.
1. Modify `src/lib/offline.ts` to use `processRefinery` iteratively.
1. Add parity tests and instrumentations.

## Subtasks

| ID | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 5.1 | Create refinery system file | Completed | 2025-02-14 | `src/ecs/systems/refinery.ts` delegates to `store.processRefinery`. |
| 5.2 | Wire store.processRefinery | Completed | 2025-02-14 | `src/state/store.ts` implements `processRefinery` and `computeRefineryProduction`. |
| 5.3 | Offline parity tests | Completed | 2025-02-14 | `src/ecs/systems/refinery.test.ts` validates parity with offline processing. |

## Acceptance Criteria

- Identical ore->bar conversions between live and offline simulation for same inputs.

## Progress Log

### 2025-10-16

- Verified: Refinery system exists in `src/ecs/systems/refinery.ts` and reuses store math. Offline parity test present. Marking TASK005 as Completed.
