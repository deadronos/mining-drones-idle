# DES013 - Dynamic Asteroid Biomes Test Stabilization

Status: Completed

## Summary

Ensure the dynamic asteroid biome feature remains deterministic by hardening the fracture region tests described in `/plan/dynamic-asteroid-biomes-plan.md`. The existing implementation occasionally mismatches region identifiers even when all other biome data is stable, so the verification harness must focus on the biome characteristics instead of opaque IDs.

## Linked Plan / Sources

- `/plan/dynamic-asteroid-biomes-plan.md`
- `memory/designs/DES012-dynamic-asteroid-biomes.md`

## Goals & Acceptance Criteria

1. **WHEN** the fracture generator is seeded identically, **THE TESTS SHALL** confirm biome region outputs using identifier-agnostic comparisons. *Acceptance:* `src/ecs/biomes.test.ts` passes consistently without relying on generated `region.id` values.
2. **WHEN** biome regions are sanitized for comparison, **THE TESTS SHALL** retain coverage of weights, gravity multipliers, resource mixes, dominant resources, hazard states, and offsets. *Acceptance:* assertions still validate these fields after sanitization.
3. **WHEN** regressions occur, **THE TESTS SHALL** provide readable diffs of biome properties. *Acceptance:* sanitized comparison structures remain serializable and human-readable.

## Approach

- Add a helper inside `src/ecs/biomes.test.ts` that converts `BiomeRegionState` entries into serializable snapshots with identifier fields removed while preserving biome traits.
- Ensure offsets and hazard data are normalized into plain objects so equality checks provide stable diffs.
- Retain deterministic RNG setup for paired asteroids to guarantee region order and weight distribution stay aligned.

## Risks & Mitigations

- *Risk:* Over-sanitizing objects may hide legitimate regressions. *Mitigation:* only strip `id` and convert nested Three.js vectors into `{ x, y, z }` literals, keeping all biome metrics visible.
- *Risk:* Future schema additions might include new non-deterministic properties. *Mitigation:* structure sanitizer to copy unknown enumerable fields automatically so new data is compared unless explicitly excluded.

## Testing Strategy

- Run `npm run test -- --run` to ensure Vitest suite remains green.
- Maintain existing lint/typecheck gates to verify no TypeScript or style regressions.

## Tasks

- See `memory/tasks/TASK014-dynamic-asteroid-biomes-test-stabilization.md` for actionable steps and progress tracking.
