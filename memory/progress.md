# Progress Log

## Summary

- 2025-10-23: **Completed TASK035 & TASK036** – Removed unused `ownedDrones` historical record (150+ lines of dead code) and implemented position-based drone unload trigger to fix queue jamming. All 189 tests pass, TypeScript clean, linting clean. Both tasks ready for deployment.
- 2025-10-23: Kicked off TASK034 Phases 2 & 3 (specialization techs and prestige investments) to extend resource sinks beyond Tier 1; updated active context accordingly and preparing implementation work.
- Completed TASK027 (Drone Distribution & Storage Buffer Display): improved drone assignment to prefer least-filled docking slots (preventing clustering), added buffer target visibility in factory storage panel, updated RQ-023 and added RQ-044 to requirements, verified all 158 tests pass.
- Implementing TASK032: added warehouse landmark entity, new R3F space-station mesh with animated docking ring, and redesigned Warehouse HUD panel with themed resource cards plus automated unit/UI coverage.
- Completed TASK026 (Settings responsive layout): drafted DES022, added RQ-041–RQ-043 requirements, refactored the panel into a grid-based layout, verified the full Vitest suite, and manually confirmed responsive behavior.
- Core MVP implemented with store, ECS loop, rendering, UI, and tests.
- Persistence foundation landed: store settings slice, persistence bootstrap, and Settings UI shipped with tests.
- Spec refreshed (DES002/TASK003) to document current implementation, persistence utilities, and remaining roadmap gaps.
- Added requirement status table flagging the persistence manager store gaps and differentiating implemented vs. planned systems.
- Kicked off Milestone 2 by migrating refinery processing into an ECS system with shared helpers and new parity unit tests.
- Completed TASK020 (Factory Energy Resilience) with DES019 delivering unload resets, DroneAI reassignment cleanup, and factory-assisted charging coverage after energy outage reports.
- Completed TASK021 (Factory Solar Regeneration) introducing solar collector upgrades, passive factory regen, UI visibility, and new migration/test coverage.
- Finalized offline catch-up alignment by iterating on snapshot data and adding regression coverage for untouched resources.
- Expanded the implementation roadmap with error handling and testing strategy sections to de-risk upcoming persistence and ECS work.
- Refined offline catch-up to reuse the store's refinery logic directly, emit telemetry for ore/bars processed, and surface load-time summaries via persistence logging.
- Delivered per-drone battery throttling, charging allocation, and regression tests covering mining, travel, and power systems.
- Implemented seeded RNG utility and routed world generation/math helpers through the stored seed with deterministic unit coverage and README updates.
- Documented persistence manager integration/spec updates and introduced the `showTrails` Settings toggle alongside the new drone trail renderer and tests.

- Implemented migration helpers (`src/state/migrations.ts`) to normalize legacy snapshots on load/import; README updated with save format and migration guidance.

- Upgraded factory visuals with animated conveyors, transfer FX, boost pulses, and a settings-driven performance profile backed by ECS activity signals (TASK011).
- TASK008/TASK011: Visuals completed and integrated. Trails, conveyors, transfer FX, and boost pulses are implemented and gated by performance profiles. Visual snapshot tests and a perf scene were added for baseline measurements.

- Finalized Phase 6 hauler logistics visuals with arrowed transfer meshes, resource-aware coloring, and hover tooltips tied to live ETAs.
- Shifted hauler purchasing to bar-based costs with store-level affordability checks and UI gating, laying groundwork for Phase 8 balance work.
- Added hauler maintenance drain (0.5 energy/sec per hauler) to factory processing to balance sustained logistics usage.
- Paginated docking and owned-drone lists in the factory inspector to stabilize layout and improve usability.
- Updated factory storage display to surface local inventories across all resources.
- Ensured drones removed from the fleet also clear factory queues to prevent inflated docking/waiting counts.
- Added a Settings reset workflow with confirmation modal and store-level reset to let players wipe progress safely.
- Brought prestige resets back in line with design by rebuilding factories/logistics/drone state and timers on each prestige while preserving earned cores.
- Kicked off TASK012 to add per-drone target variation, seeded path offsets, and save/load persistence for active flights; requirements drafted and implementation plan captured in the task log.
- Completed TASK012 with weighted targeting, seeded bezier travel, persisted `droneFlights`, README updates, and unit/integration coverage ensuring mid-flight saves restore correctly.

- Initiated TASK017 to move factories toward per-factory ledgers and selector-driven management; requirements/design/task plan captured.

## Open Items

- Execute TASK021 to deliver the factory solar regeneration upgrade and surface regen telemetry in the inspector.
- Track UI follow-up for surfacing per-drone battery levels and throttle warnings in the HUD.
- Validate seeded RNG integration across save import/export flows and plan any reset tooling.
- Capture performance telemetry for drone trails and finalize factory snapshot/perf scene coverage for TASK011.
- Capture performance telemetry for drone trails (follow-up) and triage e2e/flaky UI tests that wait for panels to mount in CI.
