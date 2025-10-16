# Active Context

## Current Focus

Stabilize Milestone 2 by aligning offline catch-up with the shared refinery helpers before pivoting to energy throttling design work.

## Recent Changes

- Added shared refinery math utilities plus `runRefineryStep` so ECS and offline flows reuse one implementation.
- Wired a dedicated refinery system into the render loop and removed the redundant `store.tick` invocation.
- Refactored offline simulation to iterate against snapshot data using the shared refinery math while preserving untouched resource fields.

## Next Steps

- Observe autosave/offline behavior with the new ECS delegation and capture any balance regressions.
- Outline follow-up work for energy throttling and per-drone batteries once refinery parity remains stable.
- Capture any manual QA findings from extended offline catch-up runs and feed them into the upcoming energy milestone planning.
