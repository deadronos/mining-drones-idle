# Active Context

## Current Focus

Implement Factory Buyable feature (TASK016): autonomous drone docking, refining with energy constraints, and camera autofit controls.

**Current Phase:** Phase 5 (Camera Autofit) - IN PROGRESS

**Recent milestones:**

- Phases 1-3 COMPLETE: Factory entity, docking/assignment logic, refining system with min-1-running constraint, 21 unit tests passing.
- Phase 4 PARTIAL: FactoryManager.tsx component created with purchase UI and factory cards, awaiting main UI integration.
- Phase 5 IN PROGRESS: Camera utilities created (computeAutofitCamera, lerpCameraState, useFactoryAutofit hook); needs Scene integration and button wiring.

## Recent Changes

- Created `src/ecs/factories.ts` (243 lines): Factory entity type, configuration, utility functions for docking, energy accounting, refining, assignment logic.
- Integrated factory state into `src/state/store.ts`: factories array, addFactory, removeFactory, processFactories method with energy drain and min-1-running enforcement.
- Added comprehensive unit tests (`src/ecs/factories.test.ts`): 21 tests covering all core factory mechanics, all passing.
- Created `src/ui/FactoryManager.tsx` (75 lines): UI component for factory purchases and status display.
- Added camera autofit utilities: `src/lib/camera.ts` (bounding box, autofit calc, lerp) and `src/hooks/useFactoryAutofit.ts` (React hook for smooth animation).

## Next Steps

**Immediate (Phase 4-5 Integration):**

1. Integrate FactoryManager into UpgradePanel or dedicated Factory UI panel.
2. Wire cost deduction (reduce metals/crystals on purchase).
3. Wire processFactories(dt) call into main game loop (find where processRefinery is called).

**Phase 5 Completion:**

1. Integrate useFactoryAutofit hook into main Scene component.
2. Add camera autofit button to UI toggle.

**Short-term (Phase 6):**

1. E2E playtest: buy factory → dock drone → watch refining → use autofit camera.
2. Tune factory costs, energy consumption, refine throughput based on metrics.
3. Add hover card with pin toggle functionality.

**Blocked on:**

- Main game loop integration point (where/how to call processFactories).
- Scene camera context (3D canvas setup to hook useFactoryAutofit).

## Design References

- Spec: `spec/factory-buyable-spec.md` (EARS requirements, acceptance criteria, test cases).
- Design: `memory/designs/DES015-factory-buyable.md` (architecture, integration points, data flow).
- Task: `memory/tasks/TASK016-factory-buyable.md` (6-phase plan with detailed progress log).

