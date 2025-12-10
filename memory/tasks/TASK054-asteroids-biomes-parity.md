# TASK054 - Asteroids & Biomes Parity Implementation

**Status:** Pending  
**Added:** 2025-12-10  
**Updated:** 2025-12-10  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 3 from DES039: Align Rust asteroid respawn logic to use biome-driven resource distribution matching TS `createAsteroid()`.

## Thought Process

TS spawns asteroids with biome resource profiles, scanner-level richness multipliers, and sink bonuses. Rust uses simpler uniform random weighting. This causes resource distribution divergence and makes offline parity harder to achieve. Aligning spawn logic ensures consistent resource profiles.

## Implementation Plan

- Port TS `createAsteroid` biome logic to Rust:
  - Implement biome resource profile lookup and weighting
  - Apply scanner level richness multipliers
  - Include sink bonus multipliers for resource generation
  - Match dominant resource selection per biome
- Align asteroid spawn parameters:
  - Use same position ring generation
  - Match spin and gravity values
  - Ensure `asteroid_resource_profile` arrays have consistent length and composition
- Update Rust asteroid respawn:
  - Replace uniform random weighting in `respawn_asteroid()`
  - Use biome-driven distribution from TS
  - Maintain region index tracking for rendering
- Add asteroid respawn parity tests:
  - Verify resource profile composition
  - Check richness multiplier application
  - Test depletion and respawn cycles

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID    | Description                                     | Status      | Updated    | Notes |
| ----- | ----------------------------------------------- | ----------- | ---------- | ----- |
| 54.1  | Port biome resource profile logic               | Not Started |            |       |
| 54.2  | Implement scanner richness multipliers          | Not Started |            |       |
| 54.3  | Apply sink bonus multipliers                    | Not Started |            |       |
| 54.4  | Align spawn position/spin/gravity parameters    | Not Started |            |       |
| 54.5  | Replace uniform random respawn logic            | Not Started |            |       |
| 54.6  | Add asteroid respawn parity tests               | Not Started |            |       |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 3
- Initial implementation plan defined
- Dependencies: TASK052 (measurement baseline)
