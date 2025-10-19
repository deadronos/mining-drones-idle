# TASK022 - Refactor store.ts into Focused Slices

**Status:** Pending  
**Added:** 2025-10-19  
**Updated:** 2025-10-19

## Original Request

Reduce cognitive complexity and improve testability of `src/state/store.ts` (915 lines) by extracting domain-specific logic into focused slice modules with pure game processing functions.

## Thought Process

The store has organically grown to handle:

1. State shape initialization and type definitions
2. Resource and prestige system operations
3. Settings and UI selection state
4. Factory lifecycle and resource management
5. Drone docking and ownership tracking
6. Hauler logistics configuration and status
7. Game loop processing (refinery, factories, logistics)

These concerns are intertwined within setter functions, making the file hard to navigate, test, and extend. By grouping related operations into slices (following Zustand patterns), we can:

- Reduce file size from 915 to ~250–350 lines (orchestrator + exports)
- Extract pure processing logic into testable functions
- Make each slice ~80–120 lines, focused on one domain
- Enable parallel testing of business logic without full store context
- Simplify debugging by isolating state mutations per domain

## Implementation Plan

### Subtasks

| ID   | Description                                  | Status      | Updated | Notes                                         |
| ---- | -------------------------------------------- | ----------- | ------- | --------------------------------------------- |
| 1.1  | Create slices directory structure            | Not Started | -       | `src/state/slices/`                           |
| 1.2  | Extract resourceSlice (addResources, buy)    | Not Started | -       | Prestige logic, module purchases              |
| 1.3  | Extract settingsSlice (UI state, selections) | Not Started | -       | Factory, asteroid, inspector state            |
| 1.4  | Extract factorySlice (CRUD, pinning, ops)    | Not Started | -       | Factory lifecycle, docks, upgrades            |
| 1.5  | Extract droneSlice (ownership, flights)      | Not Started | -       | Docking, ownership transfers                  |
| 1.6  | Extract logisticsSlice (haulers, config)     | Not Started | -       | Hauler assignment, config updates             |
| 1.7  | Extract gameProcessing.ts (pure functions)   | Not Started | -       | `processRefinery`, `processFactories`, `tick` |
| 1.8  | Extract logisticsProcessing.ts (pure)        | Not Started | -       | `processLogistics` orchestration              |
| 1.9  | Refactor store.ts to compose slices          | Not Started | -       | Import slices, call processing                |
| 1.10 | Add unit tests for each slice                | Not Started | -       | ~60 lines per slice test file                 |
| 1.11 | Add integration tests for store              | Not Started | -       | Factory creation, upgrades, tick flow         |
| 1.12 | Verify no regressions; run full test suite   | Not Started | -       | TypeScript errors, coverage                   |

## Progress Tracking

**Overall Status:** Not Started – 0%

### Subtasks Progress

All subtasks pending completion.

## Progress Log

### 2025-10-19

- Initial task creation from refactor plan REFACTOR-PLAN-three-largest-files.md
- Defined 12 subtasks with clear dependencies
- Estimated effort: 3–4 days
- Next: Await review or proceed with Phase 1 implementation

---

## Architecture Notes

### Slice Structure

Each slice will follow a consistent pattern:

```typescript
// src/state/slices/resourceSlice.ts
import type { StateCreator } from 'zustand';
import type { StoreState } from '../types';

export interface ResourceSliceState {
  resources: Resources;
  modules: Modules;
  prestige: Prestige;
}

export interface ResourceSliceMethods {
  addResources: (
    delta: Partial<Resources>,
    options?: { capacityAware?: boolean },
  ) => void;
  addOre: (amount: number) => void;
  buy: (moduleId: ModuleId) => void;
  prestigeReady: () => boolean;
  preview: () => number;
  doPrestige: () => void;
}

export const createResourceSlice: StateCreator<
  StoreState,
  [],
  [],
  ResourceSliceState & ResourceSliceMethods
> = (set, get) => ({
  resources: initialResources,
  modules: initialModules,
  prestige: initialPrestige,
  addResources: (delta, options) => {
    /* implementation */
  },
  // ... rest of methods
});
```

### Processing Functions

Game loop processing extracted into pure functions:

```typescript
// src/state/processing/gameProcessing.ts
export interface GameProcessingResult {
  resources: Resources;
  factories: BuildableFactory[];
  factoryProcessSequence: number;
}

export function processFactories(
  state: StoreState,
  dt: number,
): Partial<GameProcessingResult> {
  // Pure function: no mutations of input
  // Returns new state slice to merge
}
```

### Store Composition

```typescript
// src/state/store.ts (refactored)
const storeCreator: StateCreator<StoreState> = (set, get) => ({
  ...createResourceSlice(set, get),
  ...createSettingsSlice(set, get),
  ...createFactorySlice(set, get),
  ...createDroneSlice(set, get),
  ...createLogisticsSlice(set, get),

  tick: (dt) => {
    if (dt <= 0) return;
    set((state) => ({ gameTime: state.gameTime + dt }));
    get().processRefinery(dt);
    get().processLogistics(dt);
    get().processFactories(dt);
  },
});
```

## References

- **Refactor Plan**: `memory/designs/REFACTOR-PLAN-three-largest-files.md`
- **Design**: `memory/designs/DES018-per-factory-upgrades-hauler-logistics.md` (logistics context)
- **Store Implementation**: `src/state/store.ts`
- **Related Task**: TASK009 (Tests & CI)

## Acceptance Criteria

- [ ] All 5 slices created and exported from `src/state/slices/index.ts`
- [ ] `gameProcessing.ts` and `logisticsProcessing.ts` contain pure functions with tests
- [ ] Refactored `store.ts` compiles with no TypeScript errors
- [ ] Game behavior unchanged (no functional regressions)
- [ ] All existing tests pass
- [ ] New unit tests cover each slice (at least one happy path + one edge case)
- [ ] Code coverage maintained or improved
- [ ] PR created with summary, links to design, and test results
