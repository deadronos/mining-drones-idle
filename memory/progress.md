# Progress Log

## Summary

- Core MVP implemented with store, ECS loop, rendering, UI, and tests.
- Persistence foundation landed: store settings slice, persistence bootstrap, and Settings UI shipped with tests.
- Spec refreshed (DES002/TASK003) to document current implementation, persistence utilities, and remaining roadmap gaps.
- Added requirement status table flagging the persistence manager store gaps and differentiating implemented vs. planned systems.
- Kicked off Milestone 2 by migrating refinery processing into an ECS system with shared helpers and new parity unit tests.
- Finalized offline catch-up alignment by iterating on snapshot data and adding regression coverage for untouched resources.
- Expanded the implementation roadmap with error handling and testing strategy sections to de-risk upcoming persistence and ECS work.
- Refined offline catch-up to reuse the store's refinery logic directly, emit telemetry for ore/bars processed, and surface load-time summaries via persistence logging.
- Delivered per-drone battery throttling, charging allocation, and regression tests covering mining, travel, and power systems.
- Implemented seeded RNG utility and routed world generation/math helpers through the stored seed with deterministic unit coverage and README updates.
- Documented persistence manager integration/spec updates and introduced the `showTrails` Settings toggle alongside the new drone trail renderer and tests.

- Implemented migration helpers (`src/state/migrations.ts`) to normalize legacy snapshots on load/import; README updated with save format and migration guidance.

- Upgraded factory visuals with animated conveyors, transfer FX, boost pulses, and a settings-driven performance profile backed by ECS activity signals (TASK011).

- Kicked off TASK012 to add per-drone target variation, seeded path offsets, and save/load persistence for active flights; requirements drafted and implementation plan captured in the task log.
- Completed TASK012 with weighted targeting, seeded bezier travel, persisted `droneFlights`, README updates, and unit/integration coverage ensuring mid-flight saves restore correctly.

## Open Items

- Track UI follow-up for surfacing per-drone battery levels and throttle warnings in the HUD.
- Validate seeded RNG integration across save import/export flows and plan any reset tooling.
- Capture performance telemetry for drone trails and finalize factory snapshot/perf scene coverage for TASK011.
