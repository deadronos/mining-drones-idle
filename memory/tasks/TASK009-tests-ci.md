# TASK009 - Tests & CI

**Status:** In Progress  
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
| 9.1 | Unit test coverage | Partially Completed | 2025-02-18 | Vitest unit tests exist for store, persistence, refinery, power, and mining systems (`src/**/*.test.ts`). |
| 9.2 | Playwright scenarios | Partially Completed | 2025-02-14 | Playwright e2e exists in `tests/e2e/basic.spec.ts` but targeted scenarios for import/export/offline should be added. |
| 9.3 | CI workflow | Not Started | 2025-10-16 | No `.github/workflows` present in repository; CI workflow should be added. |

## Acceptance Criteria

- `npm test` and e2e suites run in CI with artifacts on failures.

## Progress Log

### 2025-10-16

- Verified: Unit tests (Vitest) present and cover many core systems; Playwright e2e suite exists but more smoke tests for persistence/import/export are suggested.
- Remaining: add GitHub Actions workflow to run lint, unit tests, Playwright e2e, and upload artifacts on failure. Marking TASK009 In Progress.
