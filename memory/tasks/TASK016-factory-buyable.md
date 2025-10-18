# TASK016 — Factory Buyable Implementation

**Status:** In Progress  
**Added:** 2025-10-18  
**Updated:** 2025-10-20  

## Original Request

Add a purchasable Factory building that drones can dock into to unload, refuel, and refine resources. Factories have docking capacity, refine slots, energy draw, and storage. Drones auto-assign (nearest/round-robin). Refining consumes energy with min 1 running to avoid soft-lock. Linear price and energy upkeep scaling. Camera autofit feature with factory hover cards and pin toggles. No LOD/minimap for now.

## Thought Process

Reviewed spec (factory-buyable-spec.md) and designed DES015. The feature is foundational to mid-game progression and involves:

1. New entity type (Factory) with properties and lifecycle.
2. Integration with drone flight/assignment system.
3. Energy accounting and refining concurrency.
4. UI for factory management and camera controls.
5. Balancing mechanics to avoid soft-locks and progression pace.

The design is spec-driven with EARS requirements. Implementation will follow an iterative approach: core entity + docking, then refining, then UI/camera, then tests and tuning.

## Implementation Plan

### Phase 1: Factory Entity & State (2-4 hours)

- [ ] 1.1 — Create Factory interface/type in `src/state/`.
- [ ] 1.2 — Create RefineProcess interface/type.
- [ ] 1.3 — Add factory entity reducer and actions.
- [ ] 1.4 — Register Factory with ECS world.

**Expected outcome:** Factory can be created, stored, and queried via state.

### Phase 2: Docking & Unloading (3-5 hours)

- [ ] 2.1 — Implement drone assignment logic (nearest-first, round-robin).
- [ ] 2.2 — Route drones to factory on full/return.
- [ ] 2.3 — Implement docking state and queue management.
- [ ] 2.4 — Implement payload unload to factory storage.

**Expected outcome:** Drones autonomously find and dock at factories, unload payloads.

### Phase 3: Refining System (3-5 hours)

- [ ] 3.1 — Implement refine process creation and queue.
- [ ] 3.2 — Implement energy accounting (idle + per-refine).
- [ ] 3.3 — Implement min-1-running constraint (reduced speed under low energy).
- [ ] 3.4 — Implement refine completion and product output.

**Expected outcome:** Factories refine ore with energy constraints; min 1 runs under low energy.

### Phase 4: UI & Factory Panel (2-3 hours)

- [ ] 4.1 — Create Factory panel component showing properties, queues, active refines, energy.
- [ ] 4.2 — Create hover card component with pin toggle.
- [ ] 4.3 — Add Factory to buyables/shop UI with cost and placement mode.

**Expected outcome:** UI for factory management and purchase.

### Phase 5: Camera Autofit (1-2 hours)

- [ ] 5.1 — Implement autofit camera action to fit all factories.
- [ ] 5.2 — Add camera control button and toggle.
- [ ] 5.3 — Implement smooth zoom/pan with configurable margin and max zoom-out.

**Expected outcome:** Autofit button centers and zooms to show all factories.

### Phase 6: Tests & Tuning (3-4 hours)

- [ ] 6.1 — Add unit tests for factory entity, assignment, refining logic.
- [ ] 6.2 — Add integration tests for docking and unloading.
- [ ] 6.3 — Add e2e playtest for full flow (buy, dock, refine, autofit).
- [ ] 6.4 — Tune numbers (costs, throughput, energy, timing).

**Expected outcome:** Tests passing; numbers tuned for fun and balance.

## Progress Tracking

**Overall Status:** Phase 5 In Progress - 75%

### Subtasks

| ID  | Description                                      | Status             | Updated    | Notes                                     |
| --- | ------------------------------------------------ | ------------------ | ---------- | ----------------------------------------- |
| 1.1 | Create Factory interface/type in src/state/      | Complete           | 2025-10-20 | BuildableFactory in src/ecs/factories.ts  |
| 1.2 | Create RefineProcess interface/type             | Complete           | 2025-10-20 | RefineProcess defined in factories.ts      |
| 1.3 | Add factory entity reducer and actions          | Complete           | 2025-10-20 | addFactory, removeFactory, getFactory     |
| 1.4 | Register Factory with ECS world                 | Complete           | 2025-10-20 | factories array in store.ts                |
| 2.1 | Implement drone assignment logic                | Complete           | 2025-10-20 | findNearestAvailableFactory with round-robin |
| 2.2 | Route drones to factory on full/return          | Deferred           | 2025-10-20 | Requires flight system integration (Phase 6) |
| 2.3 | Implement docking state and queue management    | Complete           | 2025-10-20 | attemptDockDrone, dockingCapacity        |
| 2.4 | Implement payload unload to factory storage     | Complete           | 2025-10-20 | transferOreToFactory in store              |
| 3.1 | Implement refine process creation and queue     | Complete           | 2025-10-20 | startRefineProcess, activeRefines array   |
| 3.2 | Implement energy accounting (idle + per-refine) | Complete           | 2025-10-20 | computeFactoryEnergyDemand, energy drain  |
| 3.3 | Implement min-1-running constraint              | Complete           | 2025-10-20 | enforceMinOneRefining with speed mult     |
| 3.4 | Implement refine completion and product output  | Complete           | 2025-10-20 | tickRefineProcess, ore → resources        |
| 4.1 | Create Factory panel component                  | Complete           | 2025-10-20 | FactoryManager.tsx with FactoryCard       |
| 4.2 | Create hover card component with pin toggle     | Complete           | 2025-10-20 | FactoryCard shows stats; pin badge ready  |
| 4.3 | Add Factory to buyables/shop UI                 | In Progress        | 2025-10-20 | FactoryManager created; needs UI integrate |
| 5.1 | Implement autofit camera action                 | Complete           | 2025-10-20 | computeAutofitCamera in src/lib/camera.ts |
| 5.2 | Add camera control button and toggle            | Not Started        | 2025-10-20 | Blocked: waiting for Phase 4 UI complete  |
| 5.3 | Implement smooth zoom/pan with constraints      | Complete           | 2025-10-20 | lerpCameraState + useFactoryAutofit hook  |
| 6.1 | Add unit tests for factory logic                | Complete           | 2025-10-20 | 21 tests, all passing                     |
| 6.2 | Add integration tests for docking               | Partial            | 2025-10-20 | Basic tests; needs flight integration     |
| 6.3 | Add e2e playtest for full flow                  | Not Started        | 2025-10-20 | Deferred to Phase 6 after UI integration  |
| 6.4 | Tune numbers (costs, throughput, energy)        | Not Started        | 2025-10-20 | Deferred to Phase 6 after playtesting     |

## Progress Log

### 2025-10-18

- Task created with 6-phase implementation plan (24 subtasks).
- Design document (DES015) linked.
- Subtasks cover entity/state, docking, refining, UI, camera, and tests.
- Ready to begin Phase 1 (Factory Entity & State).

### 2025-10-20

- **Phase 1-3 COMPLETE**: All core factory logic implemented in src/ecs/factories.ts (243 lines).
  - Factory entity: id, position, docking/refine capacity, energy params, storage, queues, refines, pinned state.
  - Factory utilities: createFactory, computeFactoryCost, attemptDockDrone, transferOreToFactory, startRefineProcess, tickRefineProcess, enforceMinOneRefining, findNearestAvailableFactory, computeFactoryEnergyDemand.
  - Store integration: factories array, addFactory, removeFactory, getFactory, dockDroneAtFactory, undockDroneFromFactory, transferOreToFactory, processFactories(dt).
  - **21 unit tests**: all passing (docking, storage, refining, energy, assignment).

- **Phase 4 PARTIAL**: FactoryManager.tsx component created (75 lines).
  - FactoryManager: buy button, factory list, cost display.
  - FactoryCard: displays docking queue, active refines, storage, progress.
  - CSS styling: src/ui/FactoryManager.css.
  - Status: Component type-checks; awaits integration into main UI layout.

- **Phase 5 IN PROGRESS**: Camera autofit utilities created.
  - src/lib/camera.ts: computeBoundingBox, computeAutofitCamera, lerpCameraState.
  - src/hooks/useFactoryAutofit.ts: React hook for smooth camera animation.
  - Status: Utility code complete; needs integration into scene camera and UI button.

- **Next Steps**:
  - Integrate FactoryManager into UpgradePanel or dedicated UI panel.
  - Wire cost deduction (reduce resources on purchase).
  - Call processFactories(dt) in game loop.
  - Add camera autofit button to UI.
  - Test full flow (buy → dock → refine → autofit).
  - Tune numbers for balance.

