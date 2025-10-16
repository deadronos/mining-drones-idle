# TASK005 - Refinery ECS System & Offline Alignment

**Status:** Pending  
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
| 5.1 | Create refinery system file | Not Started |  |  |
| 5.2 | Wire store.processRefinery | Not Started |  |  |
| 5.3 | Offline parity tests | Not Started |  |  |

## Acceptance Criteria

- Identical ore->bar conversions between live and offline simulation for same inputs.

## Progress Log

### 2025-10-16

- Task created and linked to `memory/designs/DES004-refinery-ecs.md`.
