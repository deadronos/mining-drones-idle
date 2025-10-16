# Active Context

## Current Focus

Implement factory visual upgrades (TASK011) including conveyors, transfer FX, and performance profiles while keeping persistence/settings docs aligned with the shipped implementation.

## Recent Changes

- Finalized spec/persistence backlog items for TASK002, documenting the live manager wiring and Settings defaults.
- Added `settings.showTrails` persistence, Settings toggle, and new tests covering normalization/export/import paths.
- Implemented `TrailBuffer` + `DroneTrails` to render fading path lines behind drones with a single draw call.

- Implemented migration helpers in `src/state/migrations.ts` and updated the README with save format / migration strategy guidance. Legacy snapshots are normalized during load/import to avoid breaking player progress.

## Next Steps

- Validate runtime performance of the new trails on low-spec profiles and provide screenshots for design review.
- Ship factory/scanner visual polish follow-ups and related Settings toggles, starting with TASK011, and close out remaining snapshot/perf coverage.
- Plan HUD indicators for energy throttling/battery state once visual polish baseline ships.
