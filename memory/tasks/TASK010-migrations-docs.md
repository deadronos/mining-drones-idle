# TASK010 - Migration Helpers & Documentation

**Status:** Pending  
**Added:** 2025-10-16  
**Updated:** 2025-10-16

## Original Request

Add migration helpers, document save format, and update README and Memory Bank (Milestone 7).

## Thought Process

Create migration pipeline in persistence, add readable migration logs for UI, and expand README with troubleshooting and instructions.

## Implementation Plan

1. Implement migration helpers and test cases for legacy payloads.
1. Update README with save/import/export guide and offline behavior.
1. Update memory/progress.md and activeContext.md.

## Subtasks

| ID   | Description         | Status      | Updated    | Notes                                                                                                            |
| ---- | ------------------- | ----------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 10.1 | Migration pipeline  | Not Started | 2025-10-16 | `src/state/store.ts` includes `save.version` and `saveVersion` constants; migration helpers not implemented yet. |
| 10.2 | README updates      | Not Started | 2025-10-16 | README.md contains project overview but save/import/export docs could be expanded.                               |
| 10.3 | Memory Bank updates | Not Started | 2025-10-16 | Update `memory/` docs after migration helpers are implemented.                                                   |

## Acceptance Criteria

- Legacy saves migrate gracefully and README documents the process.

## Progress Log

### 2025-10-16

- Verified: Save snapshots carry a `version` value and parsing handles unknown fields; full migration pipeline and UI-facing migration logs remain to be implemented.
