# TASK052 - Parity Test Expansion & Measurement

**Status:** Completed  
**Added:** 2025-12-10  
**Updated:** 2025-12-10  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 1 from DES039: Expand parity tests to capture drone flight/position/battery, asteroid depletion, command outcomes, and offline simulation parity. Add debug logging and divergence capture.

## Thought Process

This is the foundation phase for achieving full TS↔Rust parity. Before making code changes, we need comprehensive measurement to identify all divergences and establish acceptance thresholds. This allows us to track progress and prevent regressions as we implement fixes.

## Requirements (EARS)

- WHEN running step parity over seeded snapshots, THE SYSTEM SHALL keep per-drone position (≤0.10 axis delta), cargo/capacity, targets, and battery (≤0.01) aligned between TS and Rust, logging divergences when debug mode is enabled. [Acceptance: expanded `step-parity.test.ts` with parity logs under debug flag.]
- WHEN simulating offline across ≥5 seeds and step sizes {1, 10, 60, 300, 3600}, THE SYSTEM SHALL keep TS vs Rust resources within 1% relative tolerance and record step counts. [Acceptance: offline parity suite comparing TS offline vs Rust offline across seeds/step sizes.]
- WHEN applying SimulationCommand variants (BuyModule, PurchaseFactoryUpgrade, SpawnDrone, RecycleAsteroid, AssignHauler, DoPrestige) to identical snapshots, THE SYSTEM SHALL produce matching snapshots (discrete fields exact, numeric within epsilons) and emit a divergence report on mismatch. [Acceptance: command parity tests comparing TS vs Rust snapshots.]
- WHEN parity checks exceed thresholds or shadow-mode drift is detected, THE SYSTEM SHALL write human-readable parity reports to `test-results/parity/` and capture context (rolling averages/screenshot) for investigation. [Acceptance: parity debug logger used by unit/e2e suites with artifact outputs.]

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
| 52.1  | Expand step-parity drone checks          | Completed   | 2025-12-10 | Per-drone position/battery/cargo/targets with parity logging + tolerance gating |
| 52.2  | Expand offline-parity multi-seed tests   | Completed   | 2025-12-10 | Added multi-seed/multi-step matrix; logs divergences under debug flag |
| 52.3  | Create command-parity test suite         | Completed   | 2025-12-10 | TS vs Rust command application helper with parity logging and optional enforcement |
| 52.4  | Add parity debug logging infrastructure  | Completed   | 2025-12-10 | Shared parityLogger writes JSON reports when `PARITY_DEBUG`/`--debug-parity` set |
| 52.5  | Enhance shadow-mode E2E tests            | Completed   | 2025-12-10 | Rolling parity log samples + optional screenshot capture on drift |
| 52.6  | Document acceptance thresholds           | Completed   | 2025-12-10 | EARS requirements recorded and thresholds embedded in tests |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 1
- Initial implementation plan defined
- Added parityLogger (debug flag + JSON reports), gated enforcement flag (`PARITY_ENFORCE`) to keep CI green while logging divergences
- Expanded step parity (per-drone/battery/cargo/targets, asteroid ore per-node) and offline parity (5 seeds x 5 step counts)
- Rebuilt command parity suite to compare TS store vs Rust bridge with logging across commands (BuyModule, Upgrade, AssignHauler, SpawnDrone, RecycleAsteroid, DoPrestige)
- Shadow-mode E2E now collects rolling parity log counts and captures screenshots when drift logs occur
- Began execution; captured EARS requirements and aligned scope for parity logging and expanded coverage
