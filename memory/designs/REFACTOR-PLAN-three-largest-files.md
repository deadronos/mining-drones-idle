# Refactor Plan: Three Largest Files

**Analysis Date**: October 19, 2025  
**Files**: `store.ts` (915 lines), `FactoryManager.tsx` (482 lines), `serialization.ts` (603 lines)

---

## Executive Summary

The three largest files grew organically to support the evolving game system. Each has clear opportunities for modularization:

1. **`store.ts`**: Zustand store mixing game logic, resource management, factory lifecycle, and logistics orchestration
2. **`FactoryManager.tsx`**: React component coupling factory UI, hauler controls, storage display, and upgrades
3. **`serialization.ts`**: Normalization and cloning utilities spanning resources, factories, drones, and logistics

**Recommendation**: Extract by domain into focused modules, reducing each file by ~30–50%, improving testability and maintainability.

---

## File Analysis

### 1. **`src/state/store.ts`** (915 lines)

#### Current Structure

- **Zustand store initialization** (40 lines)
- **State shape** (20 lines): resources, modules, prestige, factories, drones, logistics queues, selections, sequences
- **Resource & prestige methods** (60 lines): `addResources`, `buy`, `doPrestige`, `preview`
- **Settings & selection methods** (80 lines): UI state (`selectedFactory`, `selectedAsteroid`, camera, inspector)
- **Save/load methods** (40 lines): `applySnapshot`, `exportState`, `importState`
- **Factory lifecycle** (120 lines): `addFactory`, `removeFactory`, `purchaseFactory`, `getFactory`, pinning
- **Drone docking/ownership** (80 lines): `dockDroneAtFactory`, `undockDroneFromFactory`, `recordDroneFlight`, drone ownership transfer
- **Factory resources & energy** (140 lines): `transferOreToFactory`, `addResourcesToFactory`, `allocateFactoryEnergy`
- **Factory upgrades** (70 lines): `upgradeFactory`
- **Hauler logistics** (100 lines): `assignHaulers`, `updateHaulerConfig`, `getLogisticsStatus`
- **Game processing** (140 lines): `tick`, `processRefinery`, `processLogistics`, `processFactories`
- **Camera & factory cycling** (40 lines): `cycleSelectedFactory`, `triggerFactoryAutofit`, `resetCamera`
- **Game reset** (30 lines): `resetGame`

#### Issues

- **Mixed concerns**: state shape, UI selection logic, game processing, and logistics orchestration in one file
- **Large setter functions**: `set((state) => {...})` blocks are repetitive and hard to test in isolation
- **Logistics complexity**: `processLogistics` (45 lines) couples scheduling, reservation, FX emission, and execution
- **Factory processing**: `processFactories` (70 lines) handles energy distribution, drains, refining, and bar production
- **Hard to mock**: Testing individual operations requires recreating the full store context

#### Refactor Opportunities

**Extract Domains:**

1. `store/slices/resourceSlice.ts` – `addResources`, `buy`, prestige
2. `store/slices/settingsSlice.ts` – UI state, selections, camera
3. `store/slices/factorySlice.ts` – factory CRUD, pinning, resource/energy operations
4. `store/slices/droneSlice.ts` – docking, ownership, flights
5. `store/slices/logisticsSlice.ts` – hauler assignment, config, status query
6. `store/processing/gameProcessing.ts` – `processRefinery`, `processFactories`, `tick`
7. `store/processing/logisticsProcessing.ts` – `processLogistics` as pure function

**Benefits:**

- Each slice is ~80–120 lines, focused on one domain
- Processing logic extracted into pure functions, testable without store
- Store acts as orchestrator, calling pure functions and merging results
- Reduces cognitive load; easier to debug and add features

**Estimated Reduction**: 915 → 250–350 lines (core store + orchestrator)

---

### 2. **`src/ui/FactoryManager.tsx`** (482 lines)

#### Current Structure

- **Constants & helpers** (40 lines): page sizes, resource order, storage labels, formatters
- **FactoryManager main component** (180 lines):
  - Factory list state management
  - Purchase/camera controls
  - Selection logic
  - Render selected factory card or empty state
- **SelectedFactoryCard component** (260 lines):
  - Docking queue display & pagination (50 lines)
  - Energy bar & solar regen (30 lines)
  - Storage listing (60 lines)
  - Upgrade buttons & costs (50 lines)
  - Owned drones roster & pagination (50 lines)
  - Hauler logistics controls (30 lines)

#### Issues

- **Single component handles too many concerns**: selection, display, pagination, upgrade UI
- **Pagination logic duplicated**: docking queue and owned drones both paginate independently
- **Storage listing complex**: maps over 7 resource types with conditional formatting
- **Upgrade rendering loop**: iterates all upgrades, checks affordability, formats costs inline
  - Hauler controls nested deeply: hard to extract and test
  - CSS classes tightly coupled: styling relies on nested `.factory-grid` structure

#### Refactor Opportunities

**Extract Sub-Components:**

1. `FactoryManager/FactorySelector.tsx` – left panel with cycling, purchase, camera buttons
2. `FactoryManager/FactoryHeader.tsx` – factory title, index, pin button
3. `FactoryManager/DockingSection.tsx` – queued drones + pagination
4. `FactoryManager/EnergySection.tsx` – energy bar + solar regen
5. `FactoryManager/StorageSection.tsx` – resource list
6. `FactoryManager/UpgradeSection.tsx` – upgrade grid with affordability checks
7. `FactoryManager/RosterSection.tsx` – owned drones + pagination
8. `FactoryManager/HaulerSection.tsx` – hauler controls

**Extract Utilities:**

1. `FactoryManager/hooks/usePagination.ts` – reusable pagination state
2. `FactoryManager/utils/upgradeFormatting.ts` – cost formatting, affordability checks
3. `FactoryManager/utils/storageDisplay.ts` – resource ordering, labels, display formatting

**Benefits:**

- Each sub-component ~40–60 lines, single responsibility
- Easier to test; can snapshot individual sections
- Pagination logic extracted to hook; reusable for other paginated lists
- Upgrade rendering isolated; easier to add conditional upgrade visibility
- Styling scoped to component; easier to refactor CSS

**Estimated Reduction**: 482 → 180–220 lines (main component + utils); sub-components ~300 lines total

---

### 3. **`src/state/serialization.ts`** (603 lines)

#### Current Structure

- **Vector normalization** (20 lines): `normalizeVectorTuple`, `cloneVectorTuple`
- **Travel snapshot** (25 lines): `normalizeTravelSnapshot`, `cloneTravelSnapshot`
- **Drone flight** (30 lines): `normalizeDroneFlight`, `normalizeDroneFlights`
- **Refine process** (20 lines): `cloneRefineProcess`, `snapshotToRefineProcess`
- **Factory resources** (15 lines): `normalizeFactoryResources`
- **Factory upgrades** (15 lines): `normalizeFactoryUpgrades`
- **Drone owners** (15 lines): `normalizeDroneOwners`
- **Refine snapshot** (35 lines): `normalizeRefineSnapshot`, `refineProcessToSnapshot`
- **Factory snapshot** (120 lines): `normalizeFactorySnapshot`, `cloneFactory`, `snapshotToFactory`, `factoryToSnapshot`
- **Drone flight state** (20 lines): `cloneDroneFlight`
- **Resource merging** (50 lines): `mergeResourceDelta` (complex capacity/prestige logic)
- **High-level normalizers** (80 lines): `normalizeResources`, `normalizeModules`, `normalizePrestige`, `normalizeSettings`
- **Store serialization** (30 lines): `normalizeSnapshot`, `serializeStore`
- **JSON I/O** (15 lines): `stringifySnapshot`, `parseSnapshot`

#### Issues

- **Mixed levels of abstraction**: utility functions (vector cloning) alongside complex domain logic (factory snapshot)
- **Inconsistent naming**: `normalize*` for validation/coercion, `clone*` for copying, `to*` for conversion; unclear pattern
- **Factory snapshot massive** (120 lines): handles complex nested objects, multiple resource types, logistics state
- **Tight coupling to types**: Every change to `BuildableFactory` requires updates here
- **No semantic grouping**: related functions scattered across file
- **Prestige logic in mergeResourceDelta**: capacity awareness mixes game logic with serialization

#### Refactor Opportunities

**Group by Domain:**

1. `serialization/vectors.ts` – vector tuple operations
2. `serialization/drones.ts` – drone flight normalization & cloning
3. `serialization/factory.ts` – factory snapshot, resource, upgrade handling (~200 lines)
4. `serialization/resources.ts` – resource merging, normalization
5. `serialization/store.ts` – top-level store serialization (~50 lines)
6. `serialization/types.ts` – type guards and coercion helpers

**Extract Complex Logic:**

- Move `mergeResourceDelta` (with prestige logic) → `lib/resourceMerging.ts` (pure game logic, not serialization)
- Introduce `FactorySnapshotBuilder` class or helper to break up the 120-line factory normalization

**Benefits:**

- Each file ~50–100 lines, single concern
- Easier to locate and maintain normalization rules
- Game logic (prestige modifiers) separated from serialization
- Can test each domain independently
- Clearer API: `FactorySnapshot.fromFactory(f)`, `Drone.clone(d)`

**Estimated Reduction**: 603 → 250–300 lines across modules; clearer boundaries

---

## Implementation Roadmap

### Phase 1: Extract `store.ts` domains (3–4 days)

1. Create `src/state/slices/` directory structure
2. Extract `resourceSlice`, `settingsSlice`, `factorySlice`, `droneSlice`, `logisticsSlice`
3. Refactor `processRefinery`, `processFactories` → `src/state/processing/gameProcessing.ts`
4. Update store to compose slices and call processing functions
5. Add tests for each slice and processing function
6. **PR**: "Refactor: Decompose store into focused slices"

### Phase 2: Extract `FactoryManager.tsx` sub-components (2–3 days)

1. Create `src/ui/FactoryManager/` directory
2. Extract `DockingSection`, `EnergySection`, `StorageSection`, `UpgradeSection`, `RosterSection`, `HaulerSection`
3. Extract `usePagination` hook
4. Extract utility functions for formatting, affordability checks
5. Consolidate CSS into component-scoped files
6. Update main `FactoryManager.tsx` to compose sub-components
7. Add snapshot tests for each sub-component
8. **PR**: "Refactor: Decompose FactoryManager into sub-components"

### Phase 3: Reorganize `serialization.ts` (2 days)

1. Create `src/state/serialization/` directory
2. Separate into domain files: `vectors.ts`, `drones.ts`, `factory.ts`, `resources.ts`, `store.ts`
3. Move prestige logic → `src/lib/resourceMerging.ts`
4. Add type guards to `serialization/types.ts`
5. Update imports across codebase
6. **PR**: "Refactor: Reorganize serialization into domain-focused modules"

### Phase 4: Validation & Polish (1 day)

1. Run full test suite; update any broken tests
2. Verify no imports broken; check tree-shaking works
3. Profile build size; confirm no regression
4. Update memory/progress with completion
5. **PR**: "Chore: Verify refactor builds and tests pass"

---

## Risk Mitigation

| Risk                               | Mitigation                                                       |
| ---------------------------------- | ---------------------------------------------------------------- |
| Breaking changes in store API      | Verify consumer components before merging; use integration tests |
| Circular imports between slices    | Use dependency injection; define clear boundaries                |
| Serialization regressions          | Expand unit tests; run save/load round-trip tests                |
| CSS breakage after component split | Test responsive layouts; verify all themes still work            |
| Build time increase                | Monitor bundle size; avoid re-exports of slices                  |

---

## Success Criteria

- [ ] All 3 files reduced by at least 30% (store: 915→600, FactoryManager: 482→300, serialization: 603→350)
- [ ] Each extracted module has clear responsibility and is <150 lines
- [ ] Test coverage maintained or improved
- [ ] No functionality changed; game behavior identical after refactor
- [ ] Build succeeds; no TypeScript errors
- [ ] CI passes (tests, linting, type-checking)
- [ ] Memory/progress updated with links to PRs

---

## References

- Store implementation: `src/state/store.ts`
- Factory UI: `src/ui/FactoryManager.tsx`
- Serialization: `src/state/serialization.ts`
- Related task: TASK009 (Tests & CI) for test expansion
- Related design: DES018 (Hauler Logistics) for complex store interactions
