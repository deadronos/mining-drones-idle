# TASK009 - Tests & CI

**Status:** Pending  
**Added:** 2025-10-16  
**Updated:** 2025-10-16

## Original Request

Consolidate tests (Vitest + Playwright), add coverage, and wire CI (Milestone 6).

## Thought Process

Prioritize deterministic unit tests for newly added systems and add Playwright smoke tests for persistence and settings. Add GitHub Actions workflow to run lint/test/e2e.

## Implementation Plan

1. Ensure unit tests for persistence, refinery, energy, and RNG are present and robust.
1. Add Playwright scenarios for import/export and offline recap.
1. Add CI workflow files and caching.

## Subtasks

| ID | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 9.1 | Unit test coverage | Not Started |  |  |
| 9.2 | Playwright scenarios | Not Started |  |  |
| 9.3 | CI workflow | Not Started |  |  |

## Acceptance Criteria

- `npm test` and e2e suites run in CI with artifacts on failures.

## Progress Log

### 2025-10-16

- Task created and linked to `memory/designs/DES008-tests-ci.md`.
