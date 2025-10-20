# Active Context

## Current Focus

🟡 **TASK025 – Warehouse Reconciliation**: Standing up the warehouse-first resource model remains in soak; continue validating transfers and polish once the Settings work lands.

✅ **TASK027 – Drone Distribution & Storage Buffer Display**: Completed load-balancing improvements to spread drones evenly across factories and added buffer target visibility in the Inspector.

## Recent Changes

- Completed TASK027: Improved drone factory assignment algorithm
  - Changed sort criteria from distance-first to occupancy-first (least-filled docking slots)
  - Drones now distribute evenly across all available factories instead of clustering at Factory 0
  - Added buffer reserve target display to factory storage panel showing logistics decision thresholds
  - Updated RQ-023 and added RQ-044 to requirements
  - All tests pass (158 tests), TypeScript clean, linting clean

- Fixed hauler logistics not exporting Bars to warehouse on fresh runs:
  - computeBufferTarget is now resource-aware (Ore uses consumption buffer; Bars keep a minimal local buffer; others conservative).
  - Scheduler tick cadence bug fixed: we now preserve fractional time instead of resetting to 0 after each run, ensuring dispatch every 2s.
  - Added focused unit/integration tests for Bars → Warehouse transfers; full test suite passes.

- Captured RQ-041–RQ-043 covering multi-column Settings behavior, panel height clamping, and narrow layout regressions.
- Authored DES022 and TASK026 to define the responsive Settings approach and implementation steps and validated the responsive dialog manually at target sizes.
- Reviewed DES021 and TASK025 plan, noted dual-inventory pain points and buffer/warehouse design decisions.
- Audited store slices, logistics scheduler, unload system, and processing loops to map current duplication paths.
- Prepared implementation plan emphasizing phased delivery (state/model changes first, logistics next, UI/tests afterward).
- Seeded Factory 0 with onboarding hauler + starter stock, added `WAREHOUSE_CONFIG`/capacity helpers, and adjusted factory processing/tests to keep production local.
- Implemented warehouse-aware logistics scheduling with reservations, warehouse capacity clamping, and bidirectional transfer tests.
- Reworked `addResourcesToFactory`/unload path so non-ore stays local unless no dock, eliminating immediate warehouse duplication and adding coverage for both routes.
- Added Settings primer copy explaining warehouse vs. factory ledgers, delivered 0.3.2 migration & regression coverage, and landed warehouse-focused integration tests (export/import, prestige, save/load).

## Next Steps

1. Continue monitoring warehouse reconciliation metrics and log any regressions surfaced during Settings QA.
2. Observe drone distribution in live play to ensure load balancing is working as expected (no single factory dominating queue).
3. Gather player feedback on buffer target display clarity and adjust labels/formatting if needed.
4. Capture tutorial/tooling follow-up (tutorial overlay or HUD tooltip) once UI teams provide direction.
5. Prepare final TASK025 wrap-up notes and identify residual polish items for warehouse UX.
