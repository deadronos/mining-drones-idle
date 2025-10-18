# DES011 - Per-Drone Asteroid Targeting & Path Variation

Status: Draft

## Summary

Introduce per-drone targeting variation and path perturbations so individual drones choose different asteroids and follow slightly varied flight paths. This increases visual variety and gameplay unpredictability without changing core game mechanics.

## Goals / Acceptance Criteria

- WHEN the fleet is assigned targets, THE SYSTEM SHALL allow each drone to select from a set of nearby asteroids rather than all drones using a single deterministic selection algorithm.
  - Acceptance: Multiple drones heading to the same asteroid should be reduced when alternatives exist.
- WHEN drones travel, THE SYSTEM SHALL apply small randomized offsets to waypoints (consistent per-flight) so trails and movement differ across drones.
  - Acceptance: Trajectories for drones traveling to the same asteroid should not be identical; random variation should be consistent for the duration of a single trip.
- WHEN saving/loading, THE SYSTEM SHALL preserve any per-flight variation data necessary to resume identical in-progress trips.
  - Acceptance: After reload, drones already in-flight continue with their original randomized offsets and targets.

## Non-Goals

- Changing higher-level AI behavior for fleet strategy (this change is local, per-drone only).
- Reworking pathfinding to use a full physics-based navigation system; this will be a lightweight variation layer over existing travel logic.

## Design Overview

Add two new lightweight pieces of state to represent per-flight variation:

- DroneTargetHint: an optional per-drone target asteroid id (string or number) that may differ between drones.
- PathOffsetSeed: per-flight small RNG seed (number) used to generate deterministic offsets for waypoints and movement vectors.

These can be attached to an in-memory DroneState object (if such exists) or stored in the existing fleet/ai system where drone entities are represented. The change should be minimal and isolated to the `ecs/systems/droneAI.ts` and `ecs/systems/travel.ts` modules.

Data shapes

- DroneFlightState {
  droneId: string;
  targetAsteroidId?: string;
  pathSeed: number; // optional, set when flight begins
  }

APIs / Interfaces (internal)

- assignDroneTarget(droneId, availableAsteroids[])
  - picks an asteroid using existing heuristics but with a weighted random choice to spread drones across options.
  - records selected asteroid in DroneFlightState.targetAsteroidId.
- computeWaypointWithOffset(baseWaypoint, pathSeed, waypointIndex)
  - returns a deterministic offset point based on seeded RNG.

Persistence

- When starting a flight, include any pathSeed and targetAsteroidId in the snapshot exported by the game's persistence layer. The `memory` fields added are small and optional for older saves.
- For older saves that don't include per-flight state, drones will be assigned fresh targeting and seed data on resume.

Migration notes

- Bump save version in `saveVersion` constant (minor patch). Keep backwards compatible: reading older saves should coerce missing drone flight state to defaults.

Testing / Acceptance tests

- Unit tests for `assignDroneTarget` that simulate multiple drones and verify spread across asteroids.
- Unit tests for `computeWaypointWithOffset` ensuring deterministic output for same seed + index.
- Integration test: run a short simulation with N drones and M asteroids and snapshot their paths; ensure not all paths are identical and that reload preserves active flights.

Implementation steps

1. Add DroneFlightState type and minimal storage in fleet/drone system.
2. Implement assignDroneTarget using weighted randomization (use per-drone seeded RNG if available).
3. Add pathSeed generation on flight start (use rng.ts utilities or module-local generateSeed if none available).
4. Update travel system to call computeWaypointWithOffset when producing waypoints.
5. Persist per-flight state in snapshot / save file with migration handling.
6. Add unit tests and integration test.

Edge cases & details

- If asteroid list is empty, fallback to previous behavior (no target).
- Ensure pathSeed is deterministic for the flight; do not reseed mid-flight.
- Keep CPU/memory overhead minimal: only store per-flight seed and target id.

Risks

- Changing persistence schema requires careful migration; fallback to defaults for older saves mitigates risk.

## Notes

- This design intentionally avoids adding complex pathfinding and keeps variation small to preserve gameplay balance.
