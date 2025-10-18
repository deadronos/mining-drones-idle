# TASK014 - Dynamic Asteroid Biomes Test Stabilization

**Status:** Completed
**Added:** 2025-10-18
**Updated:** 2025-10-18

## Linked Design / Plan

- Design: `memory/designs/DES013-dynamic-asteroid-biomes-test-stabilization.md`
- Plan: `/plan/dynamic-asteroid-biomes-plan.md`

## Original Request

Harden the deterministic fracture tests for dynamic asteroid biomes so they ignore volatile identifiers while still verifying biome characteristics.

## Thought Process

- The fracture generator intentionally includes unique region IDs that may drift when asteroid metadata changes; tests should not depend on those identifiers.
- Sanitizing regions before comparison lets us preserve coverage of biome behavior (weights, hazard severity, offsets) without brittle expectations.
- Converting Three.js vectors to plain objects improves diff readability when assertions fail.

## Implementation Plan

1. Add a sanitizer helper to `src/ecs/biomes.test.ts` that removes `id` fields and flattens vector and hazard data for comparison.
2. Update the deterministic fracture test to use the sanitizer when asserting equality.
3. Run lint, typecheck, and vitest to confirm the suite passes without flaky output.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                              | Status    | Updated    | Notes                                    |
| --- | -------------------------------------------------------- | --------- | ---------- | ---------------------------------------- |
| 1.1 | Create biome region sanitizer helper                     | Completed | 2025-10-18 | Added offset/hazard flattening           |
| 1.2 | Update deterministic fracture test to use sanitized data | Completed | 2025-10-18 | Snapshot comparison ignores IDs          |
| 1.3 | Run lint, typecheck, and tests to verify stability       | Completed | 2025-10-18 | npm run lint · typecheck · test -- --run |

## Progress Log

### 2025-10-18

- Implemented `sanitizeRegion` helper in `src/ecs/biomes.test.ts` to strip identifiers while preserving biome metrics.
- Updated deterministic fracture assertion to compare sanitized snapshots and removed redundant type assertions in migrations to satisfy lint.
- Ran `npm run lint`, `npm run typecheck`, and `npm run test -- --run` to confirm suite stability.
