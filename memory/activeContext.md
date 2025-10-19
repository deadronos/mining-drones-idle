# Active Context

## Current Focus

🟡 **TASK026 – Settings Panel Responsive Layout**: Implement DES022 to stop the Settings modal from overflowing the viewport. Priorities are widening the panel, introducing the CSS grid wrapper for sections, and clamping height with internal scrolling only when the dialog would otherwise spill out of view.

🟡 **TASK025 – Warehouse Reconciliation**: Standing up the warehouse-first resource model remains in soak; continue validating transfers and polish once the Settings work lands.

## Recent Changes

- Captured RQ-041–RQ-043 covering multi-column Settings behavior, panel height clamping, and narrow layout regressions.
- Authored DES022 and TASK026 to define the responsive Settings approach and implementation steps.
- Reviewed DES021 and TASK025 plan, noted dual-inventory pain points and buffer/warehouse design decisions.
- Audited store slices, logistics scheduler, unload system, and processing loops to map current duplication paths.
- Prepared implementation plan emphasizing phased delivery (state/model changes first, logistics next, UI/tests afterward).
- Seeded Factory 0 with onboarding hauler + starter stock, added `WAREHOUSE_CONFIG`/capacity helpers, and adjusted factory processing/tests to keep production local.
- Implemented warehouse-aware logistics scheduling with reservations, warehouse capacity clamping, and bidirectional transfer tests.
- Reworked `addResourcesToFactory`/unload path so non-ore stays local unless no dock, eliminating immediate warehouse duplication and adding coverage for both routes.
- Added Settings primer copy explaining warehouse vs. factory ledgers, delivered 0.3.2 migration & regression coverage, and landed warehouse-focused integration tests (export/import, prestige, save/load).

## Next Steps

1. Update Settings markup to wrap sections in the grid container and mark primer copy to span full width.
2. Revise `.settings-panel` sizing/padding plus new grid CSS so columns scale between 1–3 safely.
3. Manually validate the dialog at 900/1280/1440/1920px widths and ~720px tall to confirm scroll behavior.
4. Continue monitoring warehouse reconciliation metrics and log any regressions surfaced during Settings QA.
