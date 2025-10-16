# TASK007 - Seeded RNG

**Status:** Completed
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

| ID  | Description                  | Status    | Updated    | Notes                                                                                                                   |
| --- | ---------------------------- | --------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 7.1 | Implement RNG util           | Completed | 2025-10-16 | Added `src/lib/rng.ts` with Mulberry32 generator, helpers, and deterministic unit tests.                                |
| 7.2 | Persist seed in snapshot     | Completed | 2025-02-14 | `rngSeed` included in `StoreSnapshot` and `serializeStore`/`importState` roundtrip tested in `src/state/store.test.ts`. |
| 7.3 | Wire RNG to world generation | Completed | 2025-10-16 | World creation, asteroid spawning, and math helpers now accept injected RNG instances derived from the store seed.      |

## Acceptance Criteria

- Same seed yields identical placements and distributions.

## Progress Log

### 2025-10-16

- Verified: `rngSeed` is persisted and import/export roundtrips retain the seed (`src/state/store.test.ts`).
- Remaining: add a deterministic RNG utility (`src/lib/rng.ts`) and update `src/lib/math.ts` and world generation to use an injected RNG instance for reproducible generation.

### 2025-10-16

- Implemented the seeded RNG utility, updated math helpers and world generation to consume injected RNG instances, and added reproducibility tests for asteroid layouts. README now documents deterministic seeds. Marking TASK007 Completed.
