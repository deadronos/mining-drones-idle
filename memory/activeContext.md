# Active Context

## Current Focus

Implement per-drone asteroid targeting variation and seeded flight offsets (TASK012), including persistence of in-progress flights across saves.

## Recent Changes

- Finalized spec/persistence backlog items for TASK002, documenting the live manager wiring and Settings defaults.
- Added `settings.showTrails` persistence, Settings toggle, and new tests covering normalization/export/import paths.
- Implemented `TrailBuffer` + `DroneTrails` to render fading path lines behind drones with a single draw call.
- Implemented migration helpers in `src/state/migrations.ts` and updated the README with save format / migration strategy guidance. Legacy snapshots are normalized during load/import to avoid breaking player progress.

## Next Steps

- Monitor runtime performance/visual impact of the new per-drone flights and adjust offset ranges if needed.
- Coordinate follow-up polish for Task011 and remaining visual backlog items now that flight persistence landed.
- Document migration rollout guidance for QA and confirm legacy saves resume in-flight drones without regression reports.
