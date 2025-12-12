# TASK053 - Drone AI & Travel Parity Implementation

**Status:** Completed  
**Added:** 2025-12-10  
**Updated:** 2025-12-12  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md), [DES040 — Drone AI & Travel Parity](../designs/DES040-drone-ai-travel-parity.md)

## Original Request

Phase 2 from DES039: Port TS drone targeting, travel, and return logic to Rust to achieve flight path and behavior parity.

## Thought Process

Drone AI is the most visible system and current mismatches cause significant visual divergence. TS uses weighted nearby asteroid selection with biome regions, gravity offsets, and docking queue-aware return logic. Rust currently uses greedy nearest-nearest selection. This phase aligns the core flight behavior.

## Implementation Plan

- Metadata plumbing:
  - Cache asteroid gravity/region metadata from `snapshot.extra.asteroids` for AI selection.
  - Cache drone index→id for queue updates/unload cleanup.
- Drone AI parity:
  - Apply module-based stats (speed/capacity/mining/battery) with modifiers.
  - Weighted NEARBY_LIMIT target selection with region/hazard weighting and pathSeed clamp.
  - Region-aware destinations (offset + gravity) and buffer updates (`target_region_index`, factory/asteroid indices).
  - Queue-aware factory assignment matching `dockDroneAtFactory` semantics.
- Travel parity:
  - Build travel snapshots with sink/biome gravity speed and TS pathSeed Bézier control generation.
  - Ensure returning flights reuse seeds/control generation for visual parity.
- Queue cleanup & tests:
  - Clear queues/targets on unload; keep `queuedDrones` in sync.
  - Add/extend parity + Rust unit tests for targets, queues, and travel controls.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID    | Description                                    | Status      | Updated    | Notes |
| ----- | ---------------------------------------------- | ----------- | ---------- | ----- |
| 53.1  | Port weighted nearby asteroid selection        | Completed   | 2025-12-10 | Weighted NEARBY_LIMIT selection with distance weights + sink/biome travel speed. |
| 53.2  | Add biome-aware region selection               | Completed   | 2025-12-10 | Region hazards/weights parsed from snapshot extra; gravity/offset applied. |
| 53.3  | Implement docking queue-aware return logic     | Completed   | 2025-12-10 | Queue-aware `dock_drone_at_factory`, persisted queuedDrones + unload cleanup. |
| 53.4  | Synchronize RNG seeding for flight paths       | Completed   | 2025-12-10 | Seeds clamped to 0x7fffffff, TS-matched waypoint mixing. |
| 53.5  | Match travel curve generation (Bezier/lerp)    | Completed   | 2025-12-10 | TS `computeWaypointWithOffset` parity + perpendicular clamp for control points. |
| 53.6  | Update drone AI rendering buffers              | Completed   | 2025-12-10 | Fills target region/factory indexes; owner mapping preserved. |
| 53.7  | Add drone flight parity tests                  | Completed   | 2025-12-12 | Parity seed test now aligned after RNG burn + path seed fixes. |

## Progress Log
### 2025-12-12

- Finalized parity updates and validated flight seed/control alignment across engines.
- Rebuilt WASM bundle and reran `npm run typecheck`, `npm run lint`, and `npm run test` (all passing with known parity divergence logs gated by tolerances).
- Task marked **Completed**.

### 2025-12-10

- Task created from DES039 Phase 2
- Initial implementation plan defined
- Dependencies: TASK052 (measurement baseline)
- Drafted DES040 with EARS requirements, metadata/queue plan, and test strategy; moved task to In Progress.
- Implemented Rust drone AI parity:
  - Added asteroid metadata parsing (gravity/regions/hazards) and drone index→id cache.
  - Weighted nearby selection with biome offsets/gravity; TS-aligned travel seeds/control and sink-speed scaling.
  - Queue-aware factory assignment, queuedDrones persistence, and unload-time queue cleanup.
  - Rebuilt WASM bundle with updated AI/travel logic.
- Tests: npm run typecheck, npm run lint, npm run test (pass). Step-parity seed test now logs missing Rust flights (ts=3, rust=0); long-run parity divergences still reported by existing suites.

### 2025-12-11

- Fixed missing drone flights by reading `extra.asteroids` nested payloads, initializing asteroid buffers, and burning RNG to mirror TS asteroid generation.
- Aligned path seed generation with TS serialization (positive 31-bit seeds) so flights emit with expected metadata; Rust now produces flights for parity snapshots.
- Rebuilt WASM and reran npm run typecheck / npm run lint / npm run test (flight seed parity still failing: seeds differ; other suites pass with existing known divergences).

### 2025-12-12

- Matched TS asteroid spawn RNG consumption (11 draws per spawn) so snapshot load leaves RNG in sync before drone seeding.
- Reworked path seed scaling to mirror `Math.floor(rng.next() * 0x7fffffff)`; step-parity seed/control test now passes.
- Rebuilt WASM and reran npm run typecheck / npm run lint / npm run test (all passing; parity suites still log known multi-step divergences).
