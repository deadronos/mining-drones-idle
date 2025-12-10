# TASK053 - Drone AI & Travel Parity Implementation

**Status:** Pending  
**Added:** 2025-12-10  
**Updated:** 2025-12-10  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 2 from DES039: Port TS drone targeting, travel, and return logic to Rust to achieve flight path and behavior parity.

## Thought Process

Drone AI is the most visible system and current mismatches cause significant visual divergence. TS uses weighted nearby asteroid selection with biome regions, gravity offsets, and docking queue-aware return logic. Rust currently uses greedy nearest-nearest selection. This phase aligns the core flight behavior.

## Implementation Plan

- Port weighted nearby asteroid selection to Rust:
  - Implement `NEARBY_LIMIT` filtering (TS uses nearby asteroids)
  - Add biome-aware region selection logic
  - Apply gravity/biome position offsets
  - Use same RNG seeding (Mulberry32) for deterministic selection
- Align return-to-factory logic:
  - Port `dockDroneAtFactory` semantics from TS
  - Implement docking queue awareness
  - Match factory capacity checks and queue insertion
- Synchronize travel path generation:
  - Ensure Bezier/lerp control points use identical RNG seeds
  - Match curve generation algorithm between TS `computeTravelPosition` and Rust movement
  - Verify path_seed handling and re-seeding for determinism
- Update Rust drone AI buffers:
  - Populate `target_region_index` for rendering
  - Set factory target buffers for return flights
  - Ensure energy throttle logic matches TS

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID    | Description                                    | Status      | Updated    | Notes |
| ----- | ---------------------------------------------- | ----------- | ---------- | ----- |
| 53.1  | Port weighted nearby asteroid selection        | Not Started |            |       |
| 53.2  | Add biome-aware region selection               | Not Started |            |       |
| 53.3  | Implement docking queue-aware return logic     | Not Started |            |       |
| 53.4  | Synchronize RNG seeding for flight paths       | Not Started |            |       |
| 53.5  | Match travel curve generation (Bezier/lerp)    | Not Started |            |       |
| 53.6  | Update drone AI rendering buffers              | Not Started |            |       |
| 53.7  | Add drone flight parity tests                  | Not Started |            |       |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 2
- Initial implementation plan defined
- Dependencies: TASK052 (measurement baseline)
