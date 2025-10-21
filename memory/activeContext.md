# Active Context

## Current Focus

✅ **Serialization Refactor Complete (TASK024)**: Successfully redo the serialization refactoring from stub state to full implementation. Store-level normalization functions now properly in `serialization/store.ts`. All 174 tests pass, TypeScript clean, lint clean. Circular dependencies resolved.

✅ **FactoryManager Refactor Complete (TASK023)**: Deleted old monolithic `FactoryManager.tsx` file that was blocking refactored version. Solar Array bonus now displays correctly in UI.

🟡 **TASK034 – Secondary Resource Sinks**: Implementing Tier 1 bulk factory upgrade alternative costs so factories can consume secondary resources directly while relieving bar pressure.
🟡 **TASK032 – Warehouse Space-Station & Panel**: Implementing the new warehouse landmark in the world scene and redesigning the left HUD into a dedicated Warehouse panel with themed resource cards and bonuses display.
🟡 **TASK033 – Hauler Tech Upgrades**: Building hybrid global/per-factory hauler upgrades per DES028, starting with module registry, bonus resolution utilities, and migration scaffolding.
🟡 **TASK025 – Warehouse Reconciliation**: Standing up the warehouse-first resource model remains in soak; continue validating transfers and polish once the Settings work lands.

✅ **TASK029 – Local-First Energy Priority**: Completed full implementation of energy system reversal. Factories now use local energy first (for drone charging and processing), with global warehouse as backup. All 165 tests pass, code is clean (lint & typecheck).

## Recent Changes

- **TASK024 & TASK023 Completed – Three Major Refactors Now Properly Complete** ✅
  - **TASK024 (Serialization)**: Redo from incomplete stub state
    - Moved all store-level functions from monolithic file → `serialization/store.ts` (~150 lines)
    - Functions: normalizeResources, normalizeModules, normalizePrestige, normalizeSave, normalizeNotation, normalizePerformanceProfile, normalizeSettings, normalizeSnapshot, serializeStore, stringifySnapshot, parseSnapshot
    - Converted monolithic `serialization.ts` (587 lines) → 12-line backwards compatibility bridge
    - Updated `serialization/index.ts` to export all store functions properly
    - Result: Clean modular architecture, no circular dependencies, all 174 tests passing
  - **TASK023 (FactoryManager)**: Fixed UI display issue
    - Deleted old monolithic `src/ui/FactoryManager.tsx` that was blocking refactored version
    - Module resolution was choosing .tsx file over folder, preventing refactored code from loading
    - Solar Array bonus now displays correctly in UI and scales properly (L1 +0.15/s, L2 +0.30/s)
  - **TASK022 (Store Slices)**: Verified actually completed correctly ✅
  - Status: All three major refactor tasks now properly and fully completed

- **TASK029 Completed – Local-First Energy Priority Implemented** ✅
  - Inverted drone charging logic in `src/ecs/systems/power.ts` (lines 38-80)
    - Now: try factory-local first (including solar gain), then fallback to global
    - Before: tried global first, then factory-local
  - Removed upfront global energy pull from `src/state/processing/gameProcessing.ts`
    - Factories consume local only; sit at zero when depleted
    - No emergency global pull on demand
  - Updated power system tests (6 tests) to verify local-first charging behavior
  - Created new gameProcessing tests (6 tests) to verify factory local-only consumption
  - All 165 tests pass, lint clean, typecheck clean
  - Design decisions locked (DES025): factories sit at zero locally, solar ignored at capacity
  - Behavioral impact: factories now have energy autonomy, per-factory solar upgrades are more valuable, global warehouse is backup/buffer
  - Located missing `'returning'` → `'unloading'` transition in `src/ecs/systems/travel.ts:79`
  - Transition exists and is correct; the real issue is travel completion gating
  - Root cause: battery fraction throttling on travel progress (`travel.elapsed += dt * fraction`)
  - When battery critical (0-5%), throttleFloor clamps fraction to 0.1-0.3 minimum
  - This causes return trips to take 10-100x longer than intended
  - With low battery: 10-second trip takes 100+ seconds real-time
  - Drones block docking slots indefinitely while waiting for travel to complete
  - Waiting drones cannot progress → **queue jamming cascade**
  - Created FINDING-001 with math, test evidence, and 4 solution approaches
  - Recommended fix: trigger unload on position arrival, not travel completion
  - Updated DES024 with root cause analysis and marked completed

- Completed TASK027: Improved drone factory assignment algorithm
  - Changed sort criteria from distance-first to occupancy-first (least-filled docking slots)
  - Drones now distribute evenly across all available factories instead of clustering at Factory 0
  - Added buffer reserve target display to factory storage panel showing logistics decision thresholds
  - Updated RQ-023 and added RQ-044 to requirements
  - All tests pass (158 tests), TypeScript clean, linting clean

- Added Logistics Modules and per-factory override help affordances clarifying how global bonuses stack (TASK033)

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

1. Execute TASK032 implementation (world warehouse entity, Warehouse panel styling, supporting tests) following DES027.
2. **TASK028 Follow-up**: Design decision on solution approach (current recommendation: position-based unload trigger)
3. Proceed with implementation task once solution chosen
4. Continue monitoring warehouse reconciliation metrics and log any regressions surfaced during Settings QA.
5. Observe drone distribution in live play to ensure load balancing is working as expected (no single factory dominating queue).
6. Gather player feedback on buffer target display clarity and adjust labels/formatting if needed.
7. Capture tutorial/tooling follow-up (tutorial overlay or HUD tooltip) once UI teams provide direction.
8. Prepare final TASK025 wrap-up notes and identify residual polish items for warehouse UX.
