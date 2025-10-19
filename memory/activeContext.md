# Active Context

## Current Focus

🟡 **TASK025 – Warehouse Reconciliation**: Standing up the warehouse-first resource model. Key objectives for this pass:

- Formalize the warehouse as the canonical global bank (rename semantics, capacity helpers, constants).
- Seed Factory 0 with an onboarding hauler and starter stock so players see logistics immediately.
- Redirect production/unload flows so factories hold ore/bars locally and haulers regulate movement to the warehouse.
- Extend logistics scheduling + arrivals to support warehouse exports/imports without duplicating inventory.

Confidence is medium; plan is to deliver incremental slices (state model → logistics → UI/tests) with validation after each step.

## Recent Changes

- Reviewed DES021 and TASK025 plan, noted dual-inventory pain points and buffer/warehouse design decisions.
- Audited store slices, logistics scheduler, unload system, and processing loops to map current duplication paths.
- Prepared implementation plan emphasizing phased delivery (state/model changes first, logistics next, UI/tests afterward).
- Seeded Factory 0 with onboarding hauler + starter stock, added `WAREHOUSE_CONFIG`/capacity helpers, and adjusted factory processing/tests to keep production local.
- Implemented warehouse-aware logistics scheduling with reservations, warehouse capacity clamping, and bidirectional transfer tests.
- Reworked `addResourcesToFactory`/unload path so non-ore stays local unless no dock, eliminating immediate warehouse duplication and adding coverage for both routes.
- Added Settings primer copy explaining warehouse vs. factory ledgers, delivered 0.3.2 migration & regression coverage, and landed warehouse-focused integration tests (export/import, prestige, save/load).

## Next Steps

1. Capture tutorial/tooling follow-up (tutorial overlay or HUD tooltip) once UI teams provide direction.
2. Monitor migration telemetry after new save version ships; stage any fixes for edge-case imports.
3. Prepare final TASK025 wrap-up notes and identify residual polish items for warehouse UX.
