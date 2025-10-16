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

## Current Iteration Plan (2025-02-14)

1. Fix offline simulation clamping so the user-configured offline cap is honored instead of falling back to the default value.
2. Update the persistence manager to forward the configured cap and adjust helper signatures accordingly.
3. Add regression tests covering custom offline caps and persistence load behavior (with mocked storage/time).
4. Re-run formatters, linters, type checking, unit tests, and e2e suite to validate the changes.

## Progress Log

### 2025-02-16

- Store now includes a `settings` slice, snapshot helpers, and RNG seed preservation for persistence consumers.
- Bootstrapped `createPersistenceManager` in `main.tsx` with autosave scheduling and unload visibility hooks.
- Delivered `SettingsPanel` UI with autosave/offline controls, import/export workflow, and Vitest coverage.
- Ran formatter, ESLint, type checking, and the full unit suite to validate the milestone 1 slice.

## Updated Iteration Plan (2025-02-16)

1. Break out refinery processing into its ECS system and expose `processRefinery` for offline parity.
2. Expand offline simulation tests to cover the new system delegation.
3. Design the follow-up UI/UX for offline recap before entering Milestone 2 implementation.
