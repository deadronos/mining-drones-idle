# TASK027 — Drone Distribution & Storage Buffer Display

**Status**: ✅ Completed (Re-implemented)
**Added**: 2025-10-25  
**Updated**: 2025-10-25

## Original Request

Improve drone distribution across multiple factories by changing the factory assignment algorithm from "nearest first" to "least-filled docking first". Additionally, display buffer reserve targets in the factory storage panel so players can understand the logistics system's decision-making.

## Thought Process

The current issue is that drones cluster at one factory (usually Factory 0) creating bottlenecks and resource hoarding. The root cause is that the `assignReturnFactory()` algorithm prioritizes proximity over load balancing.

Two simple changes can dramatically improve the situation:

1. **Reorder sort criteria**: Instead of `sort by distance`, use `sort by docking occupancy first, then distance`. This naturally spreads drones across all available factories.
2. **Show buffer targets**: Players don't understand why one factory has high resources and others don't. Displaying buffer targets (`(buf: 75)` next to resources) makes the logistics system's decision logic visible.

Both changes are low-risk and non-invasive. No new state required, just algorithmic changes and UI display improvements.

## Implementation Plan

### Phase 1: Drone Assignment Algorithm (COMPLETED)

**Subtasks**:

| ID  | Description                                                 | Status      | Updated    | Notes                                                      |
| --- | ----------------------------------------------------------- | ----------- | ---------- | ---------------------------------------------------------- |
| 1.1 | Locate `assignReturnFactory()` in droneAI.ts                | ✅ Complete | 2025-10-25 | Function at lines 252-340                                  |
| 1.2 | Change sort criteria from distance-first to occupancy-first | ✅ Complete | 2025-10-25 | Modified sort logic, added occupancy check before distance |
| 1.3 | Verify no regressions (existing tests)                      | ✅ Complete | 2025-10-25 | All 158 tests pass                                         |

**Outcome**: Drones now distribute evenly across factories with available docking slots.

### Phase 2: Buffer Display in UI (COMPLETED)

**Subtasks**:

| ID  | Description                                            | Status      | Updated    | Notes                                            |
| --- | ------------------------------------------------------ | ----------- | ---------- | ------------------------------------------------ |
| 2.1 | Import `computeBufferTarget` from logistics            | ✅ Complete | 2025-10-25 | Added to FactoryManager.tsx imports              |
| 2.2 | Modify `storageEntries` memo to compute buffer targets | ✅ Complete | 2025-10-25 | Added bufferTarget field for each resource       |
| 2.3 | Update JSX to display buffer targets                   | ✅ Complete | 2025-10-25 | Shows `(buf: X)` suffix in storage list          |
| 2.4 | Fix TypeScript strict mode issues                      | ✅ Complete | 2025-10-25 | Used proper type guards instead of `as any`      |
| 2.5 | Run linting and tests                                  | ✅ Complete | 2025-10-25 | TypeScript clean, linting passes, all tests pass |

**Outcome**: Factory storage panel now shows buffer targets alongside resource amounts.

### Phase 3: Validation (COMPLETED)

- ✅ TypeScript: No errors
- ✅ Linting: No errors
- ✅ Tests: All 158 tests pass
- ✅ No pre-existing issues introduced

---

## Progress Log

### 2025-10-25 (Initial Implementation)

- Analyzed resource distribution problem: drones cluster at Factory 0 due to distance-first priority
- Reviewed `assignReturnFactory()` algorithm and `computeBufferTarget()` calculations
- Identified two simple fixes: reorder sort criteria, add buffer display
- Implemented Phase 1: Changed sort order to prioritize occupancy over distance
- Implemented Phase 2: Added buffer target import and display to factory storage panel
- Fixed TypeScript strict mode warnings (removed `as any`, added proper type guards)
- Ran full test suite: All 158 tests pass
- TypeScript and linting: Clean
- Task ready for completion

### 2025-10-25 (Re-implementation After Refactor)

**Issue Found**: Buffer display feature was lost when TASK023 deleted old monolithic FactoryManager.tsx

- Changes had been applied to old file, never migrated to refactored structure
- storageDisplay.ts had no buffer computation
- StorageSection.tsx had no buffer display

**Re-implementation Steps**:

1. Updated `src/ui/FactoryManager/utils/storageDisplay.ts`:
   - Added import of `computeBufferTarget` and `TransportableResource` from logistics
   - Modified `buildStorageEntries()` to compute buffer target for each resource
   - Added `bufferTarget` field to returned entry object

2. Updated `src/ui/FactoryManager/sections/StorageSection.tsx`:
   - Modified JSX to display `(buf: X)` suffix for each resource
   - Updated aria-label to include buffer information
   - Used `Math.floor()` to display clean integer values

3. Validation:
   - ✅ TypeScript: 0 errors (tsc -b --noEmit passes)
   - ✅ Linting: 0 errors (ESLint passes)
   - ✅ Tests: 174/174 passing (Vitest suite clean)
   - ✅ No regressions introduced

**Files Modified**:

- `src/ui/FactoryManager/utils/storageDisplay.ts` (lines 2, 38-45)
- `src/ui/FactoryManager/sections/StorageSection.tsx` (lines 16-26)

---

## Success Criteria

- ✅ Drones distribute more evenly (no single factory dominant with 30+ queue)
- ✅ Buffer targets visible in storage panel
- ✅ No test regressions
- ✅ Code compiles cleanly
- ✅ Linting passes

---

## Files Changed

| File                         | Lines               | Change                                                                            |
| ---------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `src/ecs/systems/droneAI.ts` | 285-308             | Modified candidate sorting logic                                                  |
| `src/ui/FactoryManager.tsx`  | 8, 231-252, 350-361 | Imported computeBufferTarget; updated storageEntries; added buffer display in JSX |

---

## Related Documentation

- **Design**: DES023 — Drone Distribution & Storage Buffer Display
- **Requirements**: RQ-026 (Factory Return Distribution) — now enforced by occupancy-first sorting
- **Analysis**: See `/docs/RESOURCE_DISTRIBUTION_ANALYSIS.md` for system overview

---

## Impact Analysis

### Player Experience

- **Before**: One factory reaches 30+ docked drones waiting; other factories idle
- **After**: Drones spread evenly; all factories receive ores consistently; haulers work balanced logistics

### Performance

- **No change** — sorting logic is unchanged complexity (still O(n log n) or better for small factory counts)
- **Buffer display** — computed once per factory per frame (cached in useMemo)

### Maintenance

- **Low risk**: Changes are localized and don't touch core state or persistence
- **Future proof**: Buffer calculation is already in `computeBufferTarget()`, UI just displays it

---

## Notes

- The `FACTORY_VARIETY_CHANCE` (~20%) still applies to encourage randomness, but now randomness is applied _after_ occupancy sorting, so base selection is intelligent
- Buffer targets are resource-aware (ore uses consumption model; bars minimal; others conservative)
- Future work could add progress bars or visual indicators showing current vs. buffer vs. surplus
