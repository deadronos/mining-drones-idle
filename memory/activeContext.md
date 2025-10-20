# Active Context

## Current Focus

🟡 **TASK025 – Warehouse Reconciliation**: Standing up the warehouse-first resource model remains in soak; continue validating transfers and polish once the Settings work lands.

## Recent Changes

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
2. Capture tutorial/tooling follow-up (tutorial overlay or HUD tooltip) once UI teams provide direction.
3. Prepare final TASK025 wrap-up notes and identify residual polish items for warehouse UX.
