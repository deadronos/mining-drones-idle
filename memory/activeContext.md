# Active Context

## Current Focus

Implement dynamic asteroid biomes (TASK013): deterministic biome assignment, fracture events, drone reassignment heuristics, and HUD inspector surfacing biome modifiers.

Tie resource types into the live loop (TASK015): implemented modifiers now feed refinery, fleet, power, mining, and HUD; confirm balance and surface follow-up work for consumable effects.

## Recent Changes

- Finalized spec/persistence backlog items for TASK002, documenting the live manager wiring and Settings defaults.
- Added `settings.showTrails` persistence, Settings toggle, and new tests covering normalization/export/import paths.
- Implemented `TrailBuffer` + `DroneTrails` to render fading path lines behind drones with a single draw call.
- Implemented migration helpers in `src/state/migrations.ts` and updated the README with save format / migration strategy guidance. Legacy snapshots are normalized during load/import to avoid breaking player progress.

## Next Steps

- Build biome data module, extend entities, and integrate fracture system before polishing visuals.
- Validate deterministic behavior with seeded tests before expanding content.
- Align with visual polish backlog once biome HUD and particles are ready for art review.
