# TASK054 - Asteroids & Biomes Parity Implementation

**Status:** Completed  
**Added:** 2025-12-10  
**Updated:** 2025-12-12  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 3 from DES039: Align Rust asteroid respawn logic to use biome-driven resource distribution matching TS `createAsteroid()`.

## Thought Process

TS spawns asteroids with biome resource profiles, scanner-level richness multipliers, and sink bonuses. Rust uses simpler uniform random weighting. This causes resource distribution divergence and makes offline parity harder to achieve. Aligning spawn logic ensures consistent resource profiles.

## Requirements (EARS)

- WHEN an asteroid respawns, THE SYSTEM SHALL generate biome-driven resource profiles (ore/ice/metals/crystals/organics) matching TS `createAsteroid` normalization [Acceptance: parity test compares Rust respawn profile to TS reference within epsilon].
- WHEN computing respawn richness, THE SYSTEM SHALL apply scanner level (+5%/level) and sink richness multipliers with the same random range (0.8–1.2) as TS [Acceptance: respawn maxOre and oreRemaining match TS calculation for a seeded run].
- WHEN respawning asteroids, THE SYSTEM SHALL consume the same RNG sequence as TS `createAsteroid` (11 draws) and reuse ring positioning logic to preserve deterministic parity [Acceptance: RNG state after N respawns matches TS reference seed trace].
- WHEN a respawn occurs, THE SYSTEM SHALL update gravity metadata to the selected biome so drone travel duration/gravity parity is maintained [Acceptance: drone travel durations use biome gravity multiplier parity fixture].

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

**Overall Status:** Completed - 100%

### Subtasks

| ID    | Description                                     | Status      | Updated    | Notes |
| ----- | ----------------------------------------------- | ----------- | ---------- | ----- |
| 54.1  | Port biome resource profile logic               | Completed   | 2025-12-12 | Biome definitions + normalization mirrored from TS `createAsteroidBiomeState`. |
| 54.2  | Implement scanner richness multipliers          | Completed   | 2025-12-12 | Scanner + sink richness multipliers applied to respawn richness. |
| 54.3  | Apply sink bonus multipliers                    | Completed   | 2025-12-12 | Sink richness multiplier folded into respawn bias. |
| 54.4  | Align spawn position/spin/gravity parameters    | Completed   | 2025-12-12 | Ring spawn, rotation/spin draws, and gravity metadata updated for parity. |
| 54.5  | Replace uniform random respawn logic            | Completed   | 2025-12-12 | Biome-driven respawn with deterministic RNG (11 draws) and metadata sync. |
| 54.6  | Add asteroid respawn parity tests               | Completed   | 2025-12-12 | Added TS↔Rust respawn parity test covering profiles/richness. |

## Progress Log

### 2025-12-12

- Kicked off task; captured EARS requirements for respawn parity (biome profiles, richness multipliers, RNG draw count, gravity metadata).
- Began porting TS biome profile lookup for Rust asteroid respawn logic.
- Implemented biome-driven respawn in Rust (`rust-engine/src/systems/asteroids.rs`), updating gravity metadata and mirroring TS RNG draw count (11) including rotation/spin/hazard draws.
- Added respawn parity test (`tests/unit/asteroid-respawn-parity.test.ts`) comparing Rust respawn output to TS `createAsteroid`.
- Rebuilt WASM (`npm run build:wasm`) and validated with `npm run typecheck`, `npm run lint`, `npm run test` (existing parity divergences logged but suite passes).

### 2025-12-10

- Task created from DES039 Phase 3
- Initial implementation plan defined
- Dependencies: TASK052 (measurement baseline)
