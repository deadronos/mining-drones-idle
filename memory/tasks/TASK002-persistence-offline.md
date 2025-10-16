# TASK002 — Persistence, Offline Catch-Up, and Settings

## Status

In Progress

## Summary

Implement save/load with autosave and offline simulation, create settings UI for controls, and flesh out refinery system per spec.

## Tasks

1. Extend Zustand store with settings slice, serialization helpers, and import/export actions.
2. Implement persistence manager module handling load, save, offline simulation, and autosave timers; integrate at bootstrap.
3. Build settings panel UI with autosave toggle/interval, offline cap, import/export controls, and error feedback.
4. Move ore→bars conversion into dedicated refinery system and adjust tick usage.
5. Update offline helper utilities and write Vitest specs for offline simulation parity and refinery throughput.
6. Add tests for persistence serialization and settings UI interactions; expand Playwright e2e to cover import/export smoke.
7. Run lint, type check, unit, and e2e tests; update documentation/memory on completion.

## Dependencies

- Requires design DES002.

## Acceptance

- Requirements RQ-006, RQ-007, and RQ-008 satisfied with passing automated tests.

## Current Iteration Plan (2025-02-18)

1. Run extended live sessions to confirm the ECS refinery loop matches offline results and capture telemetry needs for balancing.
2. Outline documentation updates explaining the shared refinery helpers for reviewers.
3. Draft the follow-up design notes for the energy throttling milestone while insights are fresh.

## Progress Log

### 2025-02-16

- Store now includes a `settings` slice, snapshot helpers, and RNG seed preservation for persistence consumers.
- Bootstrapped `createPersistenceManager` in `main.tsx` with autosave scheduling and unload visibility hooks.
- Delivered `SettingsPanel` UI with autosave/offline controls, import/export workflow, and Vitest coverage.
- Ran formatter, ESLint, type checking, and the full unit suite to validate the milestone 1 slice.

### 2025-02-17

- Introduced shared refinery helpers plus `runRefineryStep` so ECS, offline, and tests reuse identical math.
- Wired the new refinery system into the scene update order and removed redundant `store.tick` processing.
- Authored dedicated refinery system unit tests to confirm parity with offline simulation loops.
- Re-executed formatting, linting, type checking, and unit tests to secure the migration.

### 2025-02-18

- Reworked offline catch-up to iterate on snapshot data with `computeRefineryProduction`, removing the legacy tick fallback.
- Added a regression test ensuring untouched resource fields (energy, credits) remain stable after offline processing.
- Ran the formatter, ESLint, type checking, and unit suites to validate the refinery alignment changes.

### 2025-02-19

- Updated the refinery ECS system to invoke the store's `processRefinery` action so live ticks and offline loops share the same execution path.
- Refactored offline simulation to drive `processRefinery` directly, returning a telemetry report for ore consumption and bar output.
- Logged offline recap summaries during persistence load to aid balancing and regression triage, with refreshed Vitest coverage for the new report contract.

## Updated Iteration Plan (2025-02-18)

1. Evaluate whether offline recap UX or telemetry should surface refinery throughput insights for players.
2. Capture manual QA findings from extended offline catch-up sessions and confirm autosave/import remain stable post-refactor.
3. Transition planning towards energy throttling once refinery metrics look healthy.
