# TASK052 - Parity Test Expansion & Measurement

**Status:** Pending  
**Added:** 2025-12-10  
**Updated:** 2025-12-10  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 1 from DES039: Expand parity tests to capture drone flight/position/battery, asteroid depletion, command outcomes, and offline simulation parity. Add debug logging and divergence capture.

## Thought Process

This is the foundation phase for achieving full TS↔Rust parity. Before making code changes, we need comprehensive measurement to identify all divergences and establish acceptance thresholds. This allows us to track progress and prevent regressions as we implement fixes.

## Implementation Plan

- Expand `tests/unit/step-parity.test.ts` with per-drone checks:
  - Drone position (x, y, z) within 0.10 units per axis
  - Drone battery within 0.01 units
  - Drone cargo amounts
  - Drone target assignments and flight seeds
  - Asteroid ore depletion tracking
- Expand `tests/unit/offline-parity.test.ts`:
  - Test multiple seeds (at least 5)
  - Test multiple step sizes (1, 10, 60, 300, 3600 steps)
  - Verify resource totals within 1% relative tolerance
- Create `tests/unit/command-parity.test.ts`:
  - Test each command type (BuyModule, PurchaseFactoryUpgrade, SpawnDrone, RecycleAsteroid, AssignHauler, DoPrestige)
  - Compare TS and Rust snapshots after applying same command
  - Assert exact matches for discrete values, epsilon matches for floats
- Add debug logging infrastructure:
  - Add `--debug-parity` flag to test runner
  - Log per-entity differences when thresholds exceeded
  - Output divergence reports to `test-results/parity/`
- Enhance `tests/e2e/shadow-mode.spec.ts`:
  - Add rolling average tracking for resource deltas
  - Report threshold breaches with entity details
  - Capture screenshots when visual drift detected

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID    | Description                              | Status      | Updated    | Notes |
| ----- | ---------------------------------------- | ----------- | ---------- | ----- |
| 52.1  | Expand step-parity drone checks          | Not Started |            |       |
| 52.2  | Expand offline-parity multi-seed tests   | Not Started |            |       |
| 52.3  | Create command-parity test suite         | Not Started |            |       |
| 52.4  | Add parity debug logging infrastructure  | Not Started |            |       |
| 52.5  | Enhance shadow-mode E2E tests            | Not Started |            |       |
| 52.6  | Document acceptance thresholds           | Not Started |            |       |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 1
- Initial implementation plan defined
