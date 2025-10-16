# TASK004 - Persistence Integration & Settings UI

**Status:** Pending  
**Added:** 2025-10-16  
**Updated:** 2025-10-16

## Original Request

Implement persistence manager, store helpers, offline simulation cap, and Settings UI (Milestone 1 from implementation plan).

## Thought Process

Break into store helpers, persistence manager, offline simulation wiring, Settings UI, and bootstrap integration. Prioritize safe migrations and tests.

## Implementation Plan

1. Update `src/state/store.ts` with `settings` slice and helpers (`applySnapshot`, `serializeStore`, `processRefinery` placeholder).
1. Create `src/state/persistence.ts` implementing `load/start/stop/saveNow/exportState/importState`.
1. Extend `src/lib/offline.ts` to accept cap and notation parameters and call `store.processRefinery`.
1. Create `src/ui/Settings.tsx` with autosave, interval, offline cap, notation, export/import buttons.
1. Wire initialization in `src/main.tsx` to call persistence.load(), simulate offline, then persistence.start().
1. Add tests: `state/persistence.test.ts`, `state/store.test.ts`, `ui/Settings.test.tsx`.

## Subtasks

| ID | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 4.1 | Add settings slice & store helpers | Not Started |  |  |
| 4.2 | Implement persistence manager | Not Started |  |  |
| 4.3 | Offline simulation cap wiring | Not Started |  |  |
| 4.4 | Settings UI | Not Started |  |  |
| 4.5 | Bootstrap wiring and cleanup handlers | Not Started |  |  |
| 4.6 | Tests and Playwright smoke | Not Started |  |  |

## Acceptance Criteria

- Game loads previous session, offline progress capped per settings, and autosave starts by default (10s).
- Export/import works with validation and migration handling.

## Progress Log

### 2025-10-16

- Task created from implementation plan; design documented in `memory/designs/DES003-persistence-integration.md`.
