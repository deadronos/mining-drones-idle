# TASK016 — Factory Buyable Implementation

**Status:** Pending  
**Added:** 2025-10-18  
**Updated:** 2025-10-18  

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

**Overall Status:** Not Started - 0%

### Subtasks

| ID  | Description                                      | Status             | Updated    | Notes                                     |
| --- | ------------------------------------------------ | ------------------ | ---------- | ----------------------------------------- |
| 1.1 | Create Factory interface/type in src/state/      | Not Started        | 2025-10-18 | Block: understand state structure         |
| 1.2 | Create RefineProcess interface/type             | Not Started        | 2025-10-18 |                                           |
| 1.3 | Add factory entity reducer and actions          | Not Started        | 2025-10-18 |                                           |
| 1.4 | Register Factory with ECS world                 | Not Started        | 2025-10-18 |                                           |
| 2.1 | Implement drone assignment logic                | Not Started        | 2025-10-18 |                                           |
| 2.2 | Route drones to factory on full/return          | Not Started        | 2025-10-18 |                                           |
| 2.3 | Implement docking state and queue management    | Not Started        | 2025-10-18 |                                           |
| 2.4 | Implement payload unload to factory storage     | Not Started        | 2025-10-18 |                                           |
| 3.1 | Implement refine process creation and queue     | Not Started        | 2025-10-18 |                                           |
| 3.2 | Implement energy accounting (idle + per-refine) | Not Started        | 2025-10-18 |                                           |
| 3.3 | Implement min-1-running constraint              | Not Started        | 2025-10-18 |                                           |
| 3.4 | Implement refine completion and product output  | Not Started        | 2025-10-18 |                                           |
| 4.1 | Create Factory panel component                  | Not Started        | 2025-10-18 |                                           |
| 4.2 | Create hover card component with pin toggle     | Not Started        | 2025-10-18 |                                           |
| 4.3 | Add Factory to buyables/shop UI                 | Not Started        | 2025-10-18 |                                           |
| 5.1 | Implement autofit camera action                 | Not Started        | 2025-10-18 |                                           |
| 5.2 | Add camera control button and toggle            | Not Started        | 2025-10-18 |                                           |
| 5.3 | Implement smooth zoom/pan with constraints      | Not Started        | 2025-10-18 |                                           |
| 6.1 | Add unit tests for factory logic                | Not Started        | 2025-10-18 |                                           |
| 6.2 | Add integration tests for docking               | Not Started        | 2025-10-18 |                                           |
| 6.3 | Add e2e playtest for full flow                  | Not Started        | 2025-10-18 |                                           |
| 6.4 | Tune numbers (costs, throughput, energy)        | Not Started        | 2025-10-18 |                                           |

## Progress Log

### 2025-10-18

- Task created with 6-phase implementation plan (24 subtasks).
- Design document (DES015) linked.
- Subtasks cover entity/state, docking, refining, UI, camera, and tests.
- Ready to begin Phase 1 (Factory Entity & State).

