# TASK012 - Per-Drone Asteroid Targeting & Path Variation

**Status:** Completed
**Added:** 2025-10-16
**Updated:** 2025-10-17

## Original Request

Introduce per-drone targeting variation and minor path offsets so drones fly differently to similar destinations. Preserve in-progress flights across saves.

## Thought Process

- The requirements emphasize per-drone variation (target selection, path offsets) and durability across persistence boundaries.
- We need store-level state so that save snapshots can capture in-flight metadata without relying on runtime-only ECS data.
- Travel offsets should be lightweight (single seeded curve control) to avoid heavy pathfinding overhead while staying deterministic.

## Implementation Plan

Subtasks:

1. Extend store snapshot/schema with `DroneFlightState` plus helpers for serializing vector data; bump save version and migrations.
2. Implement `assignDroneTarget` with weighted random selection over nearby asteroids, generating and recording per-flight seeds.
3. Add `computeWaypointWithOffset` utility for deterministic control-point offsets; update travel system to use seeded bezier curves.
4. Synchronize ECS drones with persisted flight records on load and when travel progresses or completes.
5. Write unit tests for targeting/offset helpers and an integration test that saves mid-flight and reloads the snapshot.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                 | Status    | Updated    | Notes                                                                  |
| --- | --------------------------- | --------- | ---------- | ---------------------------------------------------------------------- |
| 1   | Store schema + migrations   | Completed | 2025-10-17 | Added `droneFlights` snapshot data and migration to seed empty arrays. |
| 2   | Target assignment variation | Completed | 2025-10-17 | Implemented weighted per-drone targeting with seeded flight state.     |
| 3   | Seeded path offsets         | Completed | 2025-10-17 | Added bezier control offsets derived from deterministic seeds.         |
| 4   | ECS sync & persistence      | Completed | 2025-10-17 | Synced drones with persisted flights and curved travel paths.          |
| 5   | Tests & validation          | Completed | 2025-10-17 | Added unit + integration coverage and updated README/tests.            |

## Progress Log

### 2025-10-17

- Captured requirements (RQ-016 – RQ-018) and outlined implementation subtasks spanning store persistence, flight assignment, path offsets, ECS syncing, and tests.
- Implemented new `droneFlights` snapshot schema with migrations and serialization helpers; persisted in-progress travel and cleared on completion.
- Added weighted target assignment, seeded offset curves, and ECS synchronization to restore/save flights with deterministic bezier travel.
- Delivered README/persistence documentation updates plus unit, integration, and e2e test fixes; lint/typecheck/test suites all passing.

## Acceptance Tests

- Unit: `assignDroneTarget` spreads N drones over M asteroids when M > 1.
- Unit: `computeWaypointWithOffset` returns identical offsets for the same (seed, index).
- Integration: Start simulation, let drones begin flights, save snapshot, reload, verify target and path offsets persisted.

## Risks / Mitigations

- Migration risk: coerce missing data on import to defaults.
- Performance: offsets computation is O(1) per waypoint and uses small RNG; should be negligible.

## Notes

Follow the design in `memory/designs/DES011-drones-asteroid-variation.md`.
