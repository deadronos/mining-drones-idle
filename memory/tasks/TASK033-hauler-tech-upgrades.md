# TASK033 - Hauler Tech Upgrades Implementation

**Status**: In Progress
**Added**: 2025-10-21
**Updated**: 2025-10-27
**Design**: [DES028 - Hauler Tech Upgrades (Hybrid Global + Per-Factory)](../designs/DES028-hauler-tech-upgrades.md)

---

## Original Request

Implement a hybrid hauler technology upgrade system to address transfer congestion (206+ queued transfers). Players can purchase global warehouse modules that boost all haulers network-wide, with optional per-factory specialization for advanced tuning.

---

## Thought Process

The design addresses a real bottleneck: with large networks and a shared warehouse capacity pool, transfers queue up rapidly. A hybrid approach allows:

1. **Global modules** provide a progression path (players feel network-wide improvements)
2. **Per-factory overrides** give late-game players agency without forcing micromanagement
3. **Capacity prioritized over speed** because the bottleneck is throughput, not latency

Implementation follows the pattern established by factory upgrades (DES018), extending the existing purchase/upgrade flow in the store.

---

## Implementation Plan

### Phase 1: Module Registry & Config

- [ ] Add `haulerDepot`, `logisticsHub`, `routingProtocol` fields to `Modules` type
- [ ] Create `getHaulerModuleBonuses(modules)` utility in `src/lib/` or `src/ecs/logistics.ts`
- [ ] Update `resolveHaulerConfig()` in `logisticsProcessing.ts` to apply global bonuses
- [ ] Add unit tests for multiplier stacking and config resolution
- [ ] Define module cost curves (base costs + per-level scaling)

### Phase 2: Factory-Level Upgrade Types

- [ ] Extend `BuildableFactory` with `haulerUpgrades?` field
- [ ] Update `FactorySnapshot` and `StoreSnapshot` to include new fields
- [ ] Add helper function `getFactoryHaulerUpgrades()` to merge global + per-factory config
- [ ] Add serialization/deserialization for new snapshot fields

### Phase 3: Purchase Logic

- [ ] Implement `purchaseHaulerModule(moduleId, nextLevel)` store method
- [ ] Implement `purchaseFactoryHaulerUpgrade(factoryId, upgradeId, nextLevel)` store method
- [ ] Add cost calculation matching module definitions (60 metals/level for Depot, etc.)
- [ ] Add validation: affordability checks, max level caps (e.g., Lv20 for Depot)
- [ ] Deduct costs from warehouse (metals, crystals, bars as appropriate)
- [ ] Add unit tests for purchase flow (success, insufficient funds, max level)

### Phase 4: Persistence & Migration

- [ ] Bump `SAVE_VERSION` to `'0.3.3'`
- [ ] Add migration logic in `normalizeSnapshot()` to initialize new fields
- [ ] Add migration tests confirming old saves load without loss
- [ ] Verify snapshot validation passes with new fields

### Phase 5: UI Components

- [ ] Create `HaulerModulesPanel` component for warehouse panel (Logistics tab)
  - Show current level + next-level cost for each module
  - Display network bonuses (+% capacity, +% speed)
  - Purchase buttons with affordability checks
- [ ] Extend `HaulerSection` in factory inspector with per-factory overrides (collapsible)
  - Show cost/effect preview before purchase
  - Badge indicator if above/below global baseline
- [ ] Update `LogisticsPanel` to show "Network Bonuses" summary row
- [ ] Add CSS styling for new panels

### Phase 6: Tuning & Testing

- [ ] Run full test suite (`npm run test`)
- [ ] Verify no performance regression (bonus calculations per-tick)
- [ ] Manual playtesting: verify upgrades reduce transfer congestion
- [ ] Adjust cost curves if necessary based on feel
- [ ] Add tooltips explaining global vs. per-factory mechanics

---

## Success Criteria

- ✅ Global hauler modules apply to all factories' configs
- ✅ Per-factory overrides cost 2–3x more than global baseline
- ✅ Multiplier stacking works correctly (global + per-factory)
- ✅ Purchase logic validates affordability and max levels
- ✅ Old saves (v0.3.2) load without loss and initialize new fields to defaults
- ✅ UI clearly distinguishes global vs. per-factory options
- ✅ Transfer congestion visibly decreases after upgrades
- ✅ All tests pass (unit + e2e + persistence)
- ✅ No performance regression in logistics tick

---

## Dependencies

**Blocked By**: None (can start immediately)

**Blocks**: Future logistics analytics (TASK???), warehouse entity enhancements (DES027)

**Related**:

- TASK019: Hauler Logistics Implementation (establishes baseline config system)
- TASK025: Warehouse Reconciliation (establishes warehouse as resource pool)
- DES018: Per-Factory Upgrades (upgrade pattern precedent)
- DES021: Warehouse Reconciliation (warehouse capacity constraint)

---

## Progress Tracking

**Overall Status**: In Progress — 70%

### Subtasks

| ID  | Description                                 | Status | Updated | Notes |
| --- | ------------------------------------------- | ------ | ------- | ----- |
| 1.1 | Add module registry types & constants       | ✅     | 2025-10-26 | Added hauler module definitions |
| 1.2 | Implement bonus calculation utility         | ✅     | 2025-10-26 | getHaulerModuleBonuses created |
| 1.3 | Update config resolution chain              | ✅     | 2025-10-26 | Logistics processing uses resolved configs |
| 1.4 | Unit tests: multiplier stacking             | ✅     | 2025-10-26 | Added haulerUpgrades helper tests |
| 2.1 | Extend BuildableFactory with upgrade fields | ✅     | 2025-10-26 | Added haulerUpgrades optional field |
| 2.2 | Update snapshot types & serialization       | ✅     | 2025-10-26 | Snapshot + clone include haulerUpgrades |
| 2.3 | Helper function: merge global + per-factory | ✅     | 2025-10-26 | resolveFactoryHaulerConfig exported |
| 3.1 | Implement purchaseHaulerModule() method     | ✅     | 2025-10-26 | store slice added purchase logic |
| 3.2 | Implement purchaseFactoryUpgrade() method   | ✅     | 2025-10-26 | per-factory override purchase implemented |
| 3.3 | Cost calculation & max level validation     | ✅     | 2025-10-26 | Constants + guards enforce caps |
| 3.4 | Unit tests: purchase logic                  | ✅     | 2025-10-26 | store purchase tests cover success/failure |
| 4.1 | Migration logic: normalize old snapshots    | ✅     | 2025-10-26 | Migration initializes modules/upgrades |
| 4.2 | Bump SAVE_VERSION to 0.3.3                  | ✅     | 2025-10-26 | Version constant updated |
| 4.3 | Migration tests                             | ✅     | 2025-10-26 | Added coverage for new defaults |
| 5.1 | HaulerModulesPanel component                | ✅     | 2025-10-26 | Warehouse panel renders module list |
| 5.2 | Per-factory override UI in HaulerSection    | ✅     | 2025-10-26 | Inspector shows upgrade controls |
| 5.3 | LogisticsPanel bonus summary                | ✅     | 2025-10-26 | Network bonus line added |
| 5.4 | CSS styling                                 | ✅     | 2025-10-26 | Styling added for modules & upgrades |
| 6.1 | Full test run & regression check            | ⏳     | —       | Pending command run |
| 6.2 | Manual playtesting & cost tuning            | ⏳     | —       |       |
| 6.3 | Tooltips & documentation                    | ✅     | 2025-10-27 | Added Logistics Modules and per-factory override guidance copy |

---

## Progress Log

### 2025-10-21 - Task Created

- Task file created from DES028 design
- Phases broken into actionable subtasks
- Ready for Phase 1 implementation

### 2025-10-26 - Phase 1 Kickoff

- Reviewed DES028 requirements and confirmed scope for Task033
- Drafted new EARS requirements RQ-048 through RQ-051 covering modules, overrides, purchases, and migrations
- Marked Task033 as in progress and began updating module type definitions

### 2025-10-26 - Core implementation & UI wiring

- Implemented hauler module constants, helper utilities, and store purchase methods
- Updated serialization, migrations, and logistics processing to apply module + per-factory bonuses
- Added Warehouse HaulerModulesPanel, LogisticsPanel bonus summary, and Factory inspector upgrade controls
- Added Vitest coverage for helper math, store purchases, and migration defaults

### 2025-10-27 - Guidance tooltips

- Added contextual copy and help affordances to Logistics Modules and per-factory overrides explaining how bonuses stack
- Captured requirement RQ-052 covering tooltip expectations and added Warehouse panel test assertion

---

## Key Code Locations

| File                                               | Purpose                                                      |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `src/state/types.ts`                               | Add Modules extensions + HaulerUpgrades type                 |
| `src/state/constants.ts`                           | Module cost definitions                                      |
| `src/ecs/logistics.ts`                             | `getHaulerModuleBonuses()` + `resolveHaulerConfig()` updates |
| `src/state/slices/modulesSlice.ts`                 | Add `purchaseHaulerModule()` method                          |
| `src/state/slices/logisticsSlice.ts`               | Add `purchaseFactoryHaulerUpgrade()` method                  |
| `src/state/serialization.ts`                       | Update snapshot serialization                                |
| `src/ui/WarehousePanel.tsx`                        | Add Logistics tab with HaulerModulesPanel                    |
| `src/ui/FactoryManager/sections/HaulerSection.tsx` | Add per-factory override options                             |
| `src/ui/LogisticsPanel.tsx`                        | Add network bonus summary                                    |

---

## Notes

- Phase 1–2 are blocking (data model must be solid before purchase logic)
- Phase 3 can proceed once Phase 2 is stable
- Phase 5 can start once Phase 3 is testable
- Phase 6 happens in parallel with UI work for polish
- Design supports future extensions (Routing Protocol, specialization bonuses, prestige interaction)
