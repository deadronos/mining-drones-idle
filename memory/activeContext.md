# Active Context

## Current Focus
Factory buyable (TASK016) feature is complete and ready for review. Attention can shift to backlog grooming (e.g., Task011 visuals or Task013 biomes) and balance/playtest follow-ups.

## Recent Changes
- Integrated factory processing into the ECS loop and store; drones now reserve docking slots, unload into per-factory storage, and trigger refining with min-one-running safeguards.
- Hooked FactoryManager UI into the HUD alongside the Upgrade panel, added pin toggles, and exposed an Autofit Camera control wired to the new `useFactoryAutofit` hook.
- Updated persistence, migrations, and drone flight serialization with `targetFactoryId`, resolving type/lint issues and ensuring tests exercise the new paths.
- Added Playwright coverage (`tests/e2e/factory-flow.spec.ts`) plus refreshed unit/integration suites for unloading, travel guards, and store snapshots.

## Next Steps
1. Monitor balance: adjust `FACTORY_CONFIG` cost/throughput/energy once telemetry or playtest data is available.
2. Expand UX polish—factory placement previews, persistent pinning, and richer HUD cues—under Task011/visual polish tracks.
3. Continue Task013 (dynamic asteroid biomes) once factory work lands; ensure interactions with factory assignment remain stable.
4. Consider additional e2e scenarios covering multi-factory saturation and low-energy throttling after broader QA.

## References
- Task details: `memory/tasks/TASK016-factory-buyable.md`
- Completion summary: `memory/TASK016-COMPLETION-SUMMARY.md`
- Design: `memory/designs/DES015-factory-buyable.md`
