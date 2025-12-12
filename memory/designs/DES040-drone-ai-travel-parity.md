# DES040 — Drone AI & Travel Parity

**Status:** Proposed  
**Related Tasks:** TASK053 — Drone AI & Travel Parity Implementation  
**Confidence:** 0.78 (medium-high; logic is defined in TS but Rust lacks supporting metadata plumbing)

## Requirements (EARS)
- **R1** WHEN a drone is idle and oreful asteroids exist, THE SYSTEM SHALL select a target using the TS weighted-nearby (NEARBY_LIMIT=4) policy and persist path seeds/region metadata for rendering [Acceptance: parity test comparing target indices/path seeds across seeds].
- **R2** WHEN an asteroid has biome regions, THE SYSTEM SHALL pick a non-hazardous region when available, record the region id/index, and apply its gravity/offset to the travel destination [Acceptance: unit test validating region/gravity propagation into travel snapshots].
- **R3** WHEN a drone is full or returning, THE SYSTEM SHALL assign a factory using docking-queue semantics (attemptDockDrone) and update queuedDrones/targetFactory buffers without overfilling capacity [Acceptance: unit test covering docking/queue transitions and buffer indexes].
- **R4** WHEN starting travel (to asteroid or returning), THE SYSTEM SHALL compute Bézier controls using the TS pathSeed mixing function and sink/biome gravity-adjusted speed so positions stay within parity tolerances [Acceptance: movement parity test that compares control points/durations against TS startTravel].
- **R5** WHEN a drone finishes unloading, THE SYSTEM SHALL clear its docking queue entry and reset target metadata to keep queue availability in sync [Acceptance: unit test ensuring queuedDrones shrink and target indexes reset after unload].

## Architecture & Data Flow
- Introduce **AsteroidMetadata** (gravity multiplier + optional region list with offsets/weights/hazard severity) derived from `snapshot.extra.asteroids`. Stored alongside `asteroid_id_to_index` to drive AI selection without touching buffer layout.
- Add **drone_index_to_id** lookup cached from `drone_id_to_index` to let systems manipulate `queued_drones` in factories.
- Extend `sys_drone_ai` to accept modules, sink bonuses, asteroid metadata, factories, and drone ids. Outbound flow: read SoA → select asteroid/region → build travel snapshot (duration uses speed * sink bonuses ÷ gravity) → push `DroneFlight` and set target indices.
- Extend `sys_unload` to remove drones from factory queues using `drone_index_to_id`, freeing slots and resetting target metadata after deposit.
- Travel control generation mirrors TS `computeWaypointWithOffset` (seed mixing, perpendicular offset clamp) so `movement` consumes the same quadratic Bézier path it already supports.

## Interfaces / Contracts
- `sys_drone_ai(...)` new params: `modules`, `sink_bonuses`, `factories`, `drone_ids`, `asteroid_metadata`. Behavior: queue-aware factory assignment, weighted asteroid selection, region-aware destinations, pathSeed capped to `0x7fffffff`.
- Helpers:
  - `select_asteroid_target(...) -> Option<AsteroidTarget>` (weights by distance, region safety/weights, returns gravity/offset/region index).
  - `dock_drone_at_factory(...) -> DockingResult` (updates `queued_drones`, returns docking/queued/exists).
  - `build_travel(...) -> TravelSnapshot` (speed with sink bonuses & gravity, Bézier control from pathSeed).
  - `undock_drone_from_factory(...)` (removes id on unload).
- Data models:
  - `AsteroidRegionMeta { id, weight, gravity_multiplier, offset: [f32;3], hazard_severity: Option<String> }`
  - `AsteroidMetadata { gravity_multiplier: f32, regions: Vec<AsteroidRegionMeta> }`

## Error Handling Matrix
| Case | Detection | Response |
| --- | --- | --- |
| Missing asteroid metadata/fields | No entry or parse failure | Default gravity=1.0, no regions; skip offsets. |
| Invalid travel vectors/NaN distance | Non-finite distance or zero speed | Skip flight creation; leave drone idle and clear targets. |
| Factory queue not found | factory_id missing | Do not enqueue; clear target factory id/index and keep drone returning. |
| Queue overflow (capacity 0) | docking_capacity <= queue len | Return queued state; drone holds position until slot opens. |

## Testing Strategy
- Rust unit tests: drone AI target selection (weighted/seed), docking queue transitions, travel control generation vs fixed seed, unload clears queue and targets.
- TS/Vitest parity: expand step-parity to assert pathSeed/target indices stay aligned for seeded snapshots; add focused movement control comparison if needed.
- Regression: ensure `drone_target_region_index`/`target_factory_index` buffers reflect assignments for renderer consumption.

## Implementation Plan
1) Build metadata plumbing: asteroid metadata + drone index→id cache on GameState init/load; wire into `step`.
2) Refactor `sys_drone_ai` to TS parity: module-based stats, sink/biome-aware travel builder, weighted asteroid/region selection, queue-aware factory assignment, target buffer updates.
3) Update `sys_unload` for queue cleanup + target resets; ensure movement uses generated controls unchanged.
4) Add/extend tests (Rust + parity) for targets, queues, and travel control; run `npm run typecheck && npm run lint && npm run test`.
