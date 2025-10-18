# TASK016 — Factory Buyable Implementation

**Status:** Completed  
**Added:** 2025-10-18  
**Updated:** 2025-10-20

## Original Request
Add a purchasable Factory building that drones can dock into to unload, refuel, and refine resources. Factories expose docking capacity, refine slots, energy draw, storage buffers, and must integrate with drone assignment, persistence, UI, and camera autofit. Linear price scaling and minimum-throughput safeguards under low energy were required.

## Outcomes
- Factories are fully modeled (`src/ecs/factories.ts`) and persisted via the store. Drones reserve docking slots, unload into per-factory storage, and refining drains energy while guaranteeing at least one active process when power is scarce.
- ECS systems updated: drone AI assigns return factories, travel snapshots include `targetFactoryId`, unload routes ore into storage, mining resets targets, and fleet/time loops tick `processFactories(dt)`.
- UI integration: FactoryManager panel with buy button, cost display, pin toggle, and camera Autofit control sits beside the Upgrade panel. Styling updated for new layout.
- Camera autofit (`useFactoryAutofit`) animates the scene camera when triggered by UI or state changes.
- Persistence, migrations, and tests updated to serialize factories and drone flight targets, including new Playwright e2e coverage for purchasing and autofit.

## Implementation Breakdown
| ID  | Description                                     | Status   | Notes                                       |
| --- | ----------------------------------------------- | -------- | ------------------------------------------- |
| 1.1 | Create Factory interface/type in store          | ✅ Done  | `BuildableFactory` and snapshots defined    |
| 1.2 | Create RefineProcess interface/type             | ✅ Done  | `RefineProcess` implemented                 |
| 1.3 | Add factory reducers/actions                    | ✅ Done  | purchase, dock/undock, transfer, process    |
| 1.4 | Register Factory with ECS world                 | ✅ Done  | Default factory spawned, world wiring       |
| 2.1 | Implement drone assignment logic                | ✅ Done  | Nearest-first with round-robin tie breaks   |
| 2.2 | Route drones to factory on full/return          | ✅ Done  | Return assignment + flight persistence      |
| 2.3 | Implement docking state and queue management    | ✅ Done  | `attemptDockDrone`, queue enforcement       |
| 2.4 | Implement payload unload to factory storage     | ✅ Done  | Ore moved into factory storage, resources   |
| 3.1 | Implement refine process creation/queue         | ✅ Done  | Start processes until slots filled          |
| 3.2 | Implement energy accounting                     | ✅ Done  | Idle + per-refine drain applied             |
| 3.3 | Implement min-1-running constraint              | ✅ Done  | Speed scaling ensures throughput            |
| 3.4 | Implement refine completion/output              | ✅ Done  | Ore converted to player resources           |
| 4.1 | Create Factory panel component                  | ✅ Done  | `FactoryManager` + `FactoryCard`            |
| 4.2 | Create hover card/pin toggle                    | ✅ Done  | Pin button toggles state                    |
| 4.3 | Add Factory panel to main UI                    | ✅ Done  | Panel mounted beside Upgrade panel          |
| 5.1 | Implement autofit camera action                 | ✅ Done  | `computeAutofitCamera` utility              |
| 5.2 | Add camera control button/toggle                | ✅ Done  | Autofit button wired to store trigger       |
| 5.3 | Implement smooth camera lerp                    | ✅ Done  | `useFactoryAutofit` hook                    |
| 6.1 | Add unit tests for factory logic                | ✅ Done  | 21 cases in `src/ecs/factories.test.ts`     |
| 6.2 | Add integration tests for docking/unload        | ✅ Done  | Updated unload, travel defensive suites     |
| 6.3 | Add e2e playtest for full flow                  | ✅ Done  | `tests/e2e/factory-flow.spec.ts`            |
| 6.4 | Tune numbers (cost, throughput, energy)         | ✅ Done  | Baseline FACTORY_CONFIG validated           |

## Progress Log
### 2025-10-18
- Authored 6-phase plan covering entity/state, docking, refining, UI, camera, and validation.
- Linked design (DES015) and spec references.

### 2025-10-20
- Phases 1–3: Implemented factory model, store integration, energy accounting, and 21 unit tests.
- Phases 4–5: Integrated FactoryManager into HUD, added pin toggle, hooked camera autofit in `Scene`, and exposed UI button.
- Phase 6: Updated travel/unload tests for `targetFactoryId`, added `factory-flow` Playwright scenario, ran lint/typecheck/test, and confirmed baseline balance.

## Validation
- ✅ `npm run typecheck`
- ✅ `npm run lint`
- ✅ `npm run test`

## References
- Spec: `spec/factory-buyable-spec.md`
- Design: `memory/designs/DES015-factory-buyable.md`
- Completion summary: `memory/TASK016-COMPLETION-SUMMARY.md`
