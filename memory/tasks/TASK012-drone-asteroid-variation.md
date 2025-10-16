# TASK012 - Per-Drone Asteroid Targeting & Path Variation

**Status:** Pending
**Added:** 2025-10-16
**Updated:** 2025-10-16

## Original Request

Introduce per-drone targeting variation and minor path offsets so drones fly differently to similar destinations. Preserve in-progress flights across saves.

## Implementation Plan

Subtasks:
1. Add `DroneFlightState` type and storage inside `ecs` or `state` where drone entities are represented.
2. Implement `assignDroneTarget(droneId, asteroids)` in `ecs/systems/droneAI.ts` that chooses among nearby asteroids using weighted randomization and records `targetAsteroidId` and `pathSeed`.
3. Implement `computeWaypointWithOffset(baseWaypoint, seed, index)` in `ecs/systems/travel.ts` or `lib/rng.ts` utilities for deterministic per-flight offsets.
4. Ensure travel system uses offsets when calculating trajectories.
5. Persist per-flight state in the existing save snapshot: include `droneFlights?: DroneFlightState[]` in saved snapshot.
6. Add unit tests: assignDroneTarget, computeWaypointWithOffset; add integration test for in-flight persistence.
7. Update migration notes and bump save version if necessary.
8. Manual test: run with several drones/asteroids and observe variety; save & reload mid-flight and confirm identical continuation.

## Acceptance Tests

- Unit: `assignDroneTarget` spreads N drones over M asteroids when M > 1.
- Unit: `computeWaypointWithOffset` returns identical offsets for the same (seed, index).
- Integration: Start simulation, let drones begin flights, save snapshot, reload, verify target and path offsets persisted.

## Risks / Mitigations
- Migration risk: coerce missing data on import to defaults.
- Performance: offsets computation is O(1) per waypoint and uses small RNG; should be negligible.

## Notes

Follow the design in `memory/designs/DES011-drones-asteroid-variation.md`.
