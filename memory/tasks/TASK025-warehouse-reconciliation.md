# TASK025: Warehouse Reconciliation Implementation

**Status**: In Progress  
**Added**: 2025-10-19  
**Updated**: 2025-10-24  
**Related Design**: `memory/designs/DES021-warehouse-reconciliation.md`

## Original Request

Implement a warehouse-based resource accounting system to fix the dual-inventory problem (global `state.resources` vs. local `factory.resources`). The warehouse becomes the canonical global resource hub; factories retain a local buffer and export surplus; haulers distribute resources between factories and the warehouse. Start the first factory with 1 free hauler to onboard players to the logistics system early.

## Requirements (EARS)

- WHEN a new run initializes, THE SYSTEM SHALL assign Factory 0 a single hauler and starter resource buffer so logistics activity is visible within the first tick. [Acceptance: store initialization test confirms `haulersAssigned === 1` and local stock seeded.]
- WHEN a factory's inventory for a warehoused resource exceeds its buffer target plus reserve, THE SYSTEM SHALL schedule an export transfer to the warehouse that increases global inventory only after the transfer completes. [Acceptance: logistics scheduler test verifies surplus factory triggers warehouse export and global totals update once arrival executes.]
- WHEN a factory's inventory falls below its buffer target and the warehouse holds that resource, THE SYSTEM SHALL schedule an import transfer that never reduces warehouse stock below zero nor the factory below its minimum reserve. [Acceptance: scheduler/import test confirms warehouse dispatch obeys reserve constraints.]
- WHEN refinery production or drone unloads complete at a factory, THE SYSTEM SHALL retain output locally until logistics exports it, preventing simultaneous increments to both factory and warehouse pools. [Acceptance: process factories/unload tests assert global resources remain unchanged until hauler export.]
- WHEN a prestige reset occurs, THE SYSTEM SHALL clear warehouse and factory inventories while computing earned cores from the warehouse totals available at trigger time. [Acceptance: prestige store test validates resets and earned cores.]

## Thought Process

The current system has two independent resource pools that receive updates from the same events, causing apparent duplication and reconciliation headaches. By designating one as the authoritative warehouse and keeping local factories as production/consumption nodes with buffers, we can:

1. Eliminate double-counting (no "bars in both places" scenario).
2. Give factories autonomy (local buffer lets them produce without constant warehouse fetches).
3. Teach logistics early (1 free hauler on Factory 1 makes transfers visible from turn 1).
4. Simplify accounting (total resources = warehouse + sum(factories) + in-transit).

The five design questions were resolved toward clarity and player onboarding:

- **Q1 (Visibility)**: Hidden warehouse with visible FX (hauler deliveries) keeps UI simple but actionable.
- **Q2 (Flow)**: Factories buffer locally; excess exports automatically; starving factories can request imports. This balances autonomy with consolidation.
- **Q3 (Starting haulers)**: 1 free hauler teaches the system without overwhelming.
- **Q4 (Upgrades)**: Map global module upgrades to warehouse capacity; simpler than independent trees.
- **Q5 (Prestige)**: Full reset preserves prestige feel; future prestige-upgradeable bank out-of-scope.

## Implementation Plan

### Phase 1: Factory Initialization & Startup Resources

**Subtasks**:

- 1.1. Update `createDefaultFactories()` in `src/state/factory.ts` to set `haulersAssigned: 1` on the first factory only.
- 1.2. Add startup resources to the first factory (e.g., `ore: 50, bars: 10`) so players can immediately start refining.
- 1.3. Update factory snapshot serialization to preserve startup state.
- 1.4. Add unit test: first factory has 1 hauler, remaining have 0.

**Acceptance**: First factory boots with 1 hauler; any newly-added factories have 0 haulers.

---

### Phase 2: Warehouse Concept Formalization

**Subtasks**:

- 2.1. Alias `state.resources` as the "warehouse" in comments and terminology throughout codebase.
- 2.2. Update `mergeResourceDelta` and related capacity checks to use a `WAREHOUSE_STORAGE_MULTIPLIER` constant (default 1.0 initially, can be tuned).
- 2.3. Add `WAREHOUSE_CONFIG` constant in `src/state/constants.ts`:
  - `WAREHOUSE_STORAGE_MULTIPLIER` (e.g., 1.0)
  - `MIN_LOCAL_BUFFER_SECONDS` (30s worth of consumption for default threshold)
- 2.4. Create utility function `computeWarehouseCapacity(modules, modifiers)` to derive warehouse storage from global modules.
- 2.5. Add unit test: warehouse capacity scales with storage module level.

**Acceptance**: Capacity calculation is consistent; warehouse is a well-defined concept in code.

---

### Phase 3: Resource Flow Updates (Factory → Warehouse Export)

**Subtasks**:

- 3.1. Update `matchSurplusToNeed` in `src/ecs/logistics.ts` to:
  - Treat warehouse as an implicit "factory" for matching (no location, infinite hauler capacity).
  - Factories with surplus (above buffer threshold) generate export transfers to warehouse.
  - Factories with need below buffer generate import transfers from warehouse.
- 3.2. Update `computeBufferTarget` to return refined buffer target (e.g., 30s of local consumption) based on factory refine slots and active production.
- 3.3. Update `computeMinReserve` to set minimum safety threshold; never export below it.
- 3.4. Modify `reserveOutbound` and `executeArrival` to handle warehouse transfers.
- 3.5. Add unit tests:
  - Factory with 200 ore and buffer target 50 exports 150 to warehouse.
  - Factory with 20 ore and buffer target 50 imports from warehouse.
  - Minimum reserve is respected (never export below safety threshold).

**Acceptance**: Haulers schedule transfers between factories and warehouse based on buffer logic.

---

### Phase 4: Drone Unload Routing Updates

**Subtasks**:

- 4.1. Review `src/ecs/systems/unload.ts` and confirm ore is deposited to factory (stays local).
- 4.2. Non-ore resources (metals, crystals, organics, ice, credits) unloaded to factory should also feed warehouse if factory storage is full or on export schedule.
- 4.3. If no docking factory, all resources go to warehouse.
- 4.4. Add unit test: unload to factory stays local for ore; non-ore respects export rules.

**Acceptance**: Ore stays local; non-ore respects factory export rules.

---

### Phase 5: Global Refinery & Factory Production Updates

**Subtasks**:

- 5.1. Audit `computeRefineryProduction` and `processRefinery` in `src/state/utils.ts` and `src/state/processing/gameProcessing.ts`:
  - Global refinery consumes `state.resources.ore` and produces `state.resources.bars`.
  - No change needed; global refinery remains a warehouse-level production subsystem.
- 5.2. Audit `processFactories` in `src/state/processing/gameProcessing.ts`:
  - Factory-level refineries produce bars locally and add to `factory.resources.bars`.
  - Do NOT also increment `state.resources.bars` (this was the duplication source).
  - Haulers will export local factory bars to warehouse when above buffer.
- 5.3. Remove `totalBarsProduced` aggregation from `processFactories` so factory bars don't double-count into global.
- 5.4. Add unit test:
  - Factory refines 10 ore → 1 bar locally.
  - Global warehouse bars unchanged until factory exports (via hauler).
  - No bars appear in two places.

**Acceptance**: Factory production is local only; no duplication into global state.

---

### Phase 6: Prestige Reset Behavior

**Subtasks**:

- 6.1. Update `doPrestige` in `src/state/slices/resourceSlice.ts` to:
  - Reset `state.resources` (warehouse) to `initialResources`.
  - Reset all factory inventories.
  - Confirm prestige cores are preserved and incremented.
- 6.2. Update prestige screen to show final warehouse inventory before reset (for clarity).
- 6.3. Add unit test: prestige run resets warehouse and factories; cores accumulate.

**Acceptance**: Prestige behaves as today (full reset); cores earned correctly.

---

### Phase 7: UI Terminology & Labels

**Subtasks**:

- 7.1. Update HUD labels:
  - Change "Resources" header to "Warehouse Inventory" or "Global Bank".
  - Clarify in tooltips that these are shared across all factories.
- 7.2. Update factory inspector storage display to clarify "Local Storage" vs. "Warehouse".
- 7.3. Update logistics panel to clarify warehouse is a redistribution hub.
- 7.4. Add note in settings or tutorial: "Resources in the warehouse are available for global purchases and hauler distribution."

**Acceptance**: UI clearly distinguishes warehouse from factory inventories.

---

### Phase 8: Migration & Backwards Compatibility

**Subtasks**:

- 8.1. Add migration in `src/state/migrations.ts`:
  - Old saves treat `state.resources` as warehouse (no change needed).
  - Old factory inventories remain local (no change needed).
  - Logic is backward-compatible; no data transformation required.
- 8.2. Update save version if needed (currently 0.3.1).
- 8.3. Add unit test: old save imports correctly; warehouse and factory inventories are distinct.

**Acceptance**: Old saves load without data loss or resets.

---

### Phase 9: Integration Tests & Balance Validation

**Subtasks**:

- 9.1. Scenario: new game, 1st factory with 1 hauler, mine ore, refine to bars, export to warehouse.
  - Verify bars appear locally in factory first.
  - Verify hauler schedules export when above buffer.
  - Verify warehouse receives bars.
- 9.2. Scenario: 2+ factories, one starving (0 ore), one with surplus.
  - Verify hauler imports ore from warehouse to starving factory.
  - Verify starving factory resumes refining.
- 9.3. Scenario: prestige run.
  - Verify warehouse resets; factories reset; cores earned.
  - Verify first factory of new run has 1 hauler again.
- 9.4. Load/save cycle:
  - Create game state with warehouse + factories.
  - Save & export.
  - Import & verify state is consistent.

**Acceptance**: All scenarios work as designed; no regressions in existing tests.

---

## Progress Tracking

**Overall Status:** In Progress - 75%

| ID  | Description                                              | Status      | Updated     | Notes |
| --- | -------------------------------------------------------- | ----------- | ------- | ----- |
| 1.1 | Update `createDefaultFactories()` for 1st factory hauler | Completed   | 2025-10-24 | Seeded onboarding hauler |
| 1.2 | Add startup resources to 1st factory                     | Completed   | 2025-10-24 | Starter ore/bars applied |
| 1.3 | Serialization updates for startup state                  | Not Started |         |       |
| 1.4 | Unit test: 1st factory has 1 hauler                      | Completed   | 2025-10-24 | Coverage in `store.factories.test.ts` |
| 2.1 | Alias warehouse terminology                              | Not Started |         |       |
| 2.2 | Update capacity logic & WAREHOUSE_MULTIPLIER             | Completed   | 2025-10-24 | `mergeResourceDelta` clamps via warehouse capacity |
| 2.3 | Add WAREHOUSE_CONFIG constant                            | Completed   | 2025-10-24 | Config captured in `state/constants.ts` |
| 2.4 | Utility: computeWarehouseCapacity()                      | Completed   | 2025-10-24 | Helper added in `state/utils.ts` |
| 2.5 | Unit test: capacity scales with modules                  | Completed   | 2025-10-24 | `utils.warehouse.test.ts` |
| 3.1 | Update matchSurplusToNeed for warehouse transfers        | Completed   | 2025-10-24 | Warehouse routing handled in `processLogistics` scheduler |
| 3.2 | Update computeBufferTarget logic                         | Completed   | 2025-10-24 | Buffer targets aligned with warehouse constants (LOGISTICS_CONFIG) |
| 3.3 | Update computeMinReserve logic                           | Completed   | 2025-10-24 | Reserve calculations use shared warehouse thresholds |
| 3.4 | Update reserveOutbound & executeArrival                  | Completed   | 2025-10-24 | Warehouse arrivals handled via custom scheduler pathway |
| 3.5 | Unit tests: buffer & export logic                        | Completed   | 2025-10-24 | Added `logisticsProcessing.test.ts` coverage |
| 4.1 | Audit unload.ts ore routing                              | Completed   | 2025-10-24 | Ore remains local; warehouse exports handle surplus |
| 4.2 | Update non-ore unload routing                            | Completed   | 2025-10-24 | Factory ledger only; warehouse fed in scheduler/fallback |
| 4.3 | No-factory fallback to warehouse                         | Completed   | 2025-10-24 | Confirmed direct warehouse deposit when no dock |
| 4.4 | Unit test: unload routing                                | Completed   | 2025-10-24 | Added unload tests covering local vs warehouse |
| 5.1 | Audit global refinery (no change)                        | Completed   | 2025-10-24 | Global refinery flow left intact for warehouse operations |
| 5.2 | Audit processFactories production                        | Completed   | 2025-10-24 | Local-only bar production verified |
| 5.3 | Remove totalBarsProduced duplication                     | Completed   | 2025-10-24 | `processFactories` no longer increments warehouse bars |
| 5.4 | Unit test: factory production is local only              | Completed   | 2025-10-24 | Updated store test asserts warehouse bars unchanged |
| 6.1 | Update doPrestige behavior                               | Completed   | 2025-10-24 | Verified prestige resets to new default factory with starter hauler/resources |
| 6.2 | Update prestige screen display                           | Completed   | 2025-10-24 | Upgrade panel now labels warehouse bars for prestige readiness |
| 6.3 | Unit test: prestige reset                                | Completed   | 2025-10-24 | Adjusted store test to expect starter hauler after reset |
| 7.1 | Update HUD labels                                        | Completed   | 2025-10-24 | Upgrade panel buttons reference warehouse bars explicitly |
| 7.2 | Update factory inspector display                         | Completed   | 2025-10-24 | Factory view shows Warehouse Inventory vs Factory Storage |
| 7.3 | Update logistics panel                                   | Completed   | 2025-10-24 | Panel now highlights warehouse node and stock in summary |
| 7.4 | Add tutorial/settings note                               | Completed   | 2025-10-24 | Warehouse primer added to Settings copy |
| 8.1 | Add migration (backwards compat)                         | Completed   | 2025-10-24 | Migration `0.3.2` normalizes logistics data |
| 8.2 | Update save version if needed                            | Completed   | 2025-10-24 | `SAVE_VERSION` bumped to `0.3.2` |
| 8.3 | Unit test: old save import                               | Completed   | 2025-10-24 | Added coverage in `migrations.test.ts` |
| 9.1 | Integration: ore → refine → export to warehouse          | Completed   | 2025-10-24 | Warehouse/export scenario in `store.warehouse.integration.test.ts` |
| 9.2 | Integration: starving factory import from warehouse      | Completed   | 2025-10-24 | Warehouse import scenario verified via integration test |
| 9.3 | Integration: prestige run reset                          | Completed   | 2025-10-24 | Integration test checks prestige reset invariants |
| 9.4 | Integration: save/load cycle                             | Completed   | 2025-10-24 | Export/import round-trip covered in integration test |

## Estimated Effort

- **Phase 1** (Initialization): 1–2 hours (straightforward factory config).
- **Phase 2** (Warehouse formalization): 1–2 hours (constants & utilities).
- **Phase 3** (Resource flow export): 2–3 hours (logistics scheduler updates).
- **Phase 4** (Unload routing): 1 hour (audit + minor tweaks).
- **Phase 5** (Production deduplication): 2–3 hours (processFactories refactor + regression tests).
- **Phase 6** (Prestige): 1 hour (prestige already resets; just confirm).
- **Phase 7** (UI labels): 1–2 hours (terminology updates across components).
- **Phase 8** (Migration): 1 hour (logic is mostly backward-compat).
- **Phase 9** (Integration tests): 2–3 hours (comprehensive scenario validation).

**Total**: ~12–18 hours (2–3 days of focused development).

## Success Criteria

- ✅ First factory initializes with 1 hauler and startup resources (ore, bars).
- ✅ Factory production stays local; no duplication into global warehouse.
- ✅ Factories buffer locally and export excess via haulers to warehouse.
- ✅ Starving factories can import from warehouse to resume production.
- ✅ UI clearly labels warehouse vs. factory storage.
- ✅ Prestige resets warehouse & factories; cores earned correctly.
- ✅ Old saves load correctly (backwards-compat).
- ✅ All existing tests pass; new tests cover warehouse logic.
- ✅ No visual regressions; all transfer visuals work as before.

## Blockers / Dependencies

None identified. Work can proceed immediately.

## Follow-up (Out-of-Scope)

- Prestige-upgradeable "Prestige Bank" module (future, buyable with cores).
- Warehouse UI panel (future, if visible warehouse becomes desired).

## Progress Log

### 2025-10-24

- Switched TASK025 status to In Progress and captured warehouse EARS requirements to anchor acceptance.
- Reviewed DES021 and current state/logistics code to map duplication points and confirm plan feasibility.
- Drafted phased execution plan prioritizing state/model adjustments ahead of logistics and UI changes.
- Implemented starter hauler/resources for Factory 0 plus WAREHOUSE_CONFIG + warehouse capacity helper to formalize the model.
- Updated factory processing to keep bars local, wired mergeResourceDelta to warehouse capacity, and added unit coverage for both the onboarding stock and capacity scaling.
- Extended logistics scheduler to reserve factory→warehouse exports and warehouse→factory imports, clamp arrivals against capacity, and covered both flows with targeted tests.
- Stopped factory resource helper from mirroring into the warehouse, adjusted unload flow for non-ore handling, and added regression tests for factory-local vs warehouse fallback paths.
- Ran `npm test` to confirm warehouse scheduling, unload routing, and UI updates pass existing suites.
- Added Warehouse primer copy in Settings, introduced v0.3.2 migration/test harness, and built end-to-end warehouse integration tests (export/import, prestige reset, save/load).
