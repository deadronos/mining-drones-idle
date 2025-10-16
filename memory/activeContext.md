# Active Context

## Current Focus

Execute Milestone 2 kickoff: migrate refinery processing into an ECS system and ensure offline simulation shares the same helper logic.

## Recent Changes

- Added shared refinery math utilities plus `runRefineryStep` so ECS and offline flows reuse one implementation.
- Wired a dedicated refinery system into the render loop and removed the redundant `store.tick` invocation.
- Expanded Vitest coverage with refinery system parity checks alongside existing offline simulations.

## Next Steps

- Observe autosave/offline behavior with the new ECS delegation and capture any balance regressions.
- Outline follow-up work for energy throttling and per-drone batteries once refinery parity remains stable.
