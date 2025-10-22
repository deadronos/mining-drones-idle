# TASK035: Remove Unused ownedDrones Historical Record

**Status:** Pending  
**Added:** 2025-10-22  
**Updated:** 2025-10-22  
**Related:** TASK036, DES024  
**Priority:** Medium (Technical Debt)

## Original Request

Remove the `ownedDrones` field from factories. This is a historical record of drones that have finished unloading at a factory, but it:
- Is not used by any game mechanics or logic
- Is purely cosmetic (UI display only)
- Duplicates functionality already provided by global `droneOwners` map
- Adds unnecessary complexity to serialization and cloning

## Thought Process

The drone system has two ownership tracking mechanisms:
1. **`factory.ownedDrones`** - Historical list of drone IDs that have unloaded here (cosmetic)
2. **`store.droneOwners`** - Global map: droneId → factoryId (actual game logic)

Investigation showed:
- Game logic uses only `queuedDrones` (docking queue) and `droneOwners` (global map)
- `ownedDrones` is only read by `RosterSection.tsx` (UI panel showing historical list)
- No upgrades, achievements, or mechanics depend on `ownedDrones` count
- Removing it won't fix drone queue jamming (different root cause: battery throttling)
- Simplifies factory state model significantly

## Implementation Plan

### Phase 1: Remove Type Definitions & Core State

- [ ] **1.1** Update `src/ecs/factories.ts`
  - Remove `ownedDrones: string[]` from `BuildableFactory` interface (line ~68)
  - Remove `ownedDrones: []` from `createFactory()` default (line ~140)

- [ ] **1.2** Update `src/state/types.ts`
  - Remove `ownedDrones: string[]` from types

### Phase 2: Remove Serialization & Cloning

- [ ] **2.1** Update `src/state/serialization/factory.ts`
  - Remove `ownedDrones` from `normalizeFactory()` function (lines ~214-215)
  - Remove `ownedDrones` from `cloneFactory()` function (line ~241)
  - Remove `ownedDrones` from `snapshotToFactory()` function
  - Remove `ownedDrones` from `factoryToSnapshot()` function

- [ ] **2.2** Update `src/state/serialization/types.ts`
  - Remove `ownedDrones` from `FactorySnapshot` type

- [ ] **2.3** Add Migration Handler
  - Open `src/state/migrations.ts`
  - Add migration v6 (or next version) that strips `ownedDrones` from snapshots
  - Ensures old saves load without corruption

### Phase 3: Remove Store Logic

- [ ] **3.1** Update `src/state/slices/factorySlice.ts`
  - Remove `ownedDrones` handling from `undockDroneFromFactory()` (lines ~174-188)
  - This entire block can be deleted:
    ```typescript
    factories = state.factories.map((factory) => {
      if (factory.ownedDrones.includes(droneId)) {
        return {
          ...factory,
          ownedDrones: factory.ownedDrones.filter((id) => id !== droneId),
        };
      }
      return factory;
    });

    factories = factories.map((factory, idx) => {
      if (idx === index) {
        const newOwned = Array.from(new Set([...factory.ownedDrones, droneId]));
        return {
          ...updated,
          ownedDrones: newOwned,
        };
      }
      return factory;
    });
    ```

### Phase 4: Remove UI Components

- [ ] **4.1** Delete `src/ui/FactoryManager/sections/RosterSection.tsx`
  - This component only displays `ownedDrones` and has no other purpose

- [ ] **4.2** Delete `src/ui/FactoryManager/sections/RosterSection.test.tsx`
  - All tests are for the removed component

- [ ] **4.3** Update `src/ui/FactoryManager/FactoryManager.tsx`
  - Remove import of `RosterSection`
  - Remove `<RosterSection factory={factory} />` from render

### Phase 5: Remove Tests

- [ ] **5.1** Update `src/state/store.factories.test.ts`
  - Remove/update assertions about `ownedDrones` transfer (lines ~261-343)
  - Affected test: "transfers drone ownership between factories"
  - Removes ~10+ assertions that validate `ownedDrones` state

- [ ] **5.2** Run full test suite
  - Verify all 165+ tests pass
  - Check for any other references to `ownedDrones` in tests

### Phase 6: Validation

- [ ] **6.1** Verify TypeScript compilation
  - Run `npm run typecheck`
  - Ensure no "ownedDrones" references remain

- [ ] **6.2** Lint code
  - Run `npm run lint`
  - Should be clean after removals

- [ ] **6.3** Run full test suite
  - Run `npm run test`
  - Verify all tests pass (should pass all remaining tests)

- [ ] **6.4** Manual smoke test
  - Load a game or create fresh factory
  - Verify UI renders without "Owned Drones" panel
  - Verify docking queue still works (uses `queuedDrones`, not `ownedDrones`)

## Progress Tracking

### Subtasks

| ID  | Description                      | Status | Updated | Notes |
| --- | -------------------------------- | ------ | ------- | ----- |
| 1.1 | Remove from BuildableFactory     | Not Started | - | - |
| 1.2 | Remove from types               | Not Started | - | - |
| 2.1 | Remove from serialization/factory.ts | Not Started | - | - |
| 2.2 | Remove from serialization/types.ts | Not Started | - | - |
| 2.3 | Add migration handler           | Not Started | - | - |
| 3.1 | Remove from factorySlice        | Not Started | - | - |
| 4.1 | Delete RosterSection.tsx        | Not Started | - | - |
| 4.2 | Delete RosterSection.test.tsx   | Not Started | - | - |
| 4.3 | Update FactoryManager imports   | Not Started | - | - |
| 5.1 | Update factory tests            | Not Started | - | - |
| 5.2 | Run test suite                  | Not Started | - | - |
| 6.1 | TypeScript check                | Not Started | - | - |
| 6.2 | Lint check                      | Not Started | - | - |
| 6.3 | Full test run                   | Not Started | - | - |
| 6.4 | Manual smoke test               | Not Started | - | - |

## Progress Log

_(Updates logged as work progresses)_

## Acceptance Criteria

- [ ] All `ownedDrones` references removed from codebase
- [ ] TypeScript compilation succeeds with no errors
- [ ] All 165+ tests pass
- [ ] Linting passes with no warnings
- [ ] Old saves load without crashes (migration handles gracefully)
- [ ] Factory UI renders without "Owned Drones" panel
- [ ] Docking queue functionality unaffected
