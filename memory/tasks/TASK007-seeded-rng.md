# TASK007 - Seeded RNG

**Status:** Pending  
**Added:** 2025-10-16  
**Updated:** 2025-10-16

## Original Request

Add deterministic RNG utility and persist `rngSeed` to support reproducible worlds (Milestone 4).

## Thought Process

Create `src/lib/rng.ts` with Mulberry32 or similar, wire calls through math/ecs where randomness is used, and add tests to assert repeatability.

## Implementation Plan

1. Implement RNG utility and tests.
1. Add `rngSeed` to store snapshot and persistence.
1. Update world generation and other random consumers to accept RNG instance.

## Subtasks

| ID | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 7.1 | Implement RNG util | Not Started |  |  |
| 7.2 | Persist seed in snapshot | Not Started |  |  |
| 7.3 | Wire RNG to world generation | Not Started |  |  |

## Acceptance Criteria

- Same seed yields identical placements and distributions.

## Progress Log

### 2025-10-16

- Task created and linked to `memory/designs/DES006-seeded-rng.md`.
