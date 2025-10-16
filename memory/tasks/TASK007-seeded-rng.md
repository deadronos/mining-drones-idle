# TASK007 - Seeded RNG

**Status:** In Progress  
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
| 7.1 | Implement RNG util | Not Started | 2025-10-16 | No `src/lib/rng.ts` found; random helpers still use Math.random in `src/lib/math.ts`. |
| 7.2 | Persist seed in snapshot | Completed | 2025-02-14 | `rngSeed` included in `StoreSnapshot` and `serializeStore`/`importState` roundtrip tested in `src/state/store.test.ts`. |
| 7.3 | Wire RNG to world generation | Partially Completed | 2025-02-14 | `createAsteroid` and world generation still call `randomRange`/Math.random; needs wiring to accept RNG instance for determinism. |

## Acceptance Criteria

- Same seed yields identical placements and distributions.

## Progress Log

### 2025-10-16

- Verified: `rngSeed` is persisted and import/export roundtrips retain the seed (`src/state/store.test.ts`).
- Remaining: add a deterministic RNG utility (`src/lib/rng.ts`) and update `src/lib/math.ts` and world generation to use an injected RNG instance for reproducible generation.
