# DES015 — Factory Buyable

**Status:** Approved (ready for implementation)  
**Date Created:** 2025-10-18  
**Date Last Updated:** 2025-10-18

## Design Overview

This design document specifies a purchasable, placeable Factory building that drones can autonomously dock into to unload, refuel, and refine mined resources. Factories have explicit properties (docking capacity, refine slots, energy draw, and storage buffer). The design includes autonomous drone assignment (nearest-first, round-robin tie-breaks), energy-based refining with a min-1-running constraint to avoid soft-locks, linear price/upkeep scaling, and a simple camera autofit feature with factory hover cards and pin toggles.

## Architecture & System Design

### Factory Entity

**Properties:**

- `id`: Unique identifier.
- `position`: World coordinates {x, y}.
- `dockingCapacity`: Max concurrent docked drones (default: 3).
- `refineSlots`: Max concurrent refining processes (default: 2).
- `idleEnergyPerSec`: Energy drain when idle (default: 1).
- `energyPerRefine`: Energy cost per refine process (default: 5).
- `storageCapacity`: Max raw ore in buffer (default: 300).
- `currentStorage`: Current ore count in buffer.
- `queuedDrones`: List of drone IDs waiting to dock.
- `activeRefines`: List of RefineProcess objects.
- `pinned`: Boolean, when true factory card is anchored to HUD.

### Refine Process

**Properties:**

- `id`: Unique identifier.
- `oreType`: Type of ore being refined.
- `amount`: Quantity to refine.
- `progress`: 0..1 normalized progress.
- `timeTotal`: Total duration in seconds.
- `energyRequired`: Total energy needed.
- `speedMultiplier`: Speed adjustment (e.g., 0.5x under low energy).

### Drone Assignment Logic

- **Trigger:** Drone is full OR commanded to return.
- **Algorithm:** Find nearest factory with available docking capacity.
- **Tie-breaking:** If multiple factories equidistant, distribute in round-robin order.
- **Fallback:** If no factory available, drone enters idle/return state per existing game rules.

### Refining System

- **Constraints:**
  - Only `refineSlots` processes run concurrently per factory.
  - Each refine consumes `energyPerRefine` energy and time.
  - At least one refine must be allowed to run even under low energy (min 1 running) to avoid soft-lock; speed reduced if needed.
  - Storage buffer limits incoming ore; excess remains with drone.

### Energy Accounting

- **Idle drain:** Each active factory costs `idleEnergyPerSec` per tick.
- **Active drain:** Each refining process costs `energyPerRefine` per refine operation.
- **Total upkeep:** Scales linearly with number of factories: `upkeep = base_idle + (factory_count * idle_per_sec)`.

### Pricing Model

- **Base cost:** 100 metal + 50 crystals (tunable).
- **Linear scaling:** Cost of Nth factory = base + N \* 50 increment.
- **Energy upkeep:** Scales linearly per factory.

### Camera & UI Behavior

- **Autofit Factories:** Button in camera controls smoothly zooms/centers to fit all factories with configurable margin; respects max zoom-out limit.
- **Factory hover card:** On hover, shows brief summary (queued count, active refines, docking capacity).
- **Pin toggle:** Player can pin a factory card to anchor it to the HUD; unpinned cards disappear on mouse-out.
- **Factory panel:** Full details on click (properties, queue, active processes, energy consumption).

### No LOD / No Minimap (this iteration)

- Rendering remains as-is; notes for future LOD optimizations added to spec.
- No minimap; factory cards serve as primary management UI.

## Integration Points

- **State system:** Factories become new world entities, stored in state alongside drones and resources.
- **Energy system:** Factory energy drain and refine costs integrated into global energy pool and accounting.
- **Drone flight system:** Drones route to nearest factory on full/return; autopilot adjusts target.
- **Buyables/Shop:** Add Factory to purchasable building list with cost and info.
- **Camera system:** Add autofit action; integrate with existing zoom/pan controls.
- **UI system:** Add factory panel, hover cards, and camera controls.

## Data Flow

1. Player purchases factory → deduct cost → create Factory entity → add to world state.
2. Drone becomes full → auto-assign to nearest factory.
3. Drone arrives → enter docking queue; on capacity available, dock and unload payload to factory storage.
4. Factory storage updated → if resources and refine slots available, start refine process.
5. Refine process consumes energy/time → on completion, produce refined output.
6. Energy low → continue at least one refine at reduced speed.
7. Player hovers factory → show hover card + pin option.
8. Player clicks Autofit → camera smoothly fits all factories.

## Suggested Files to Modify/Create

- `src/ecs/systems/factories.ts` — Factory lifecycle, docking, refining (new).
- `src/ecs/world.ts` — Register factory system.
- `src/state/` — Factory entity definitions and reducers (new).
- `src/ui/FactoryPanel.tsx` — Factory panel component (new).
- `src/ui/FactoryHoverCard.tsx` — Hover card component (new).
- `src/r3f/` — Factory 3D model or sprite (new or reuse existing).
- `src/config/resourceBalance.ts` — Factory costs and defaults.
- `src/lib/camera.ts` — Autofit logic (new or extend).
- Tests: `src/ecs/factories.test.ts`, integration tests in `tests/e2e/`.

## Known Constraints & Trade-offs

- **Min 1 running refine:** Under low energy, refining continues but at reduced speed to avoid softlock; this means energy can go negative (or low) temporarily.
- **Linear scaling:** Simple pricing and upkeep; may need exponential scaling later if balance feels off.
- **No LOD:** Rendering performance may suffer with many factories; noted for future optimization.
- **Autonomous assignment only:** No manual routing in MVP; can add in future.

## Acceptance Criteria

- Factories are purchasable with cost deduction and placement.
- Drones auto-assign (nearest/round-robin) and dock/unload correctly.
- Refining works with energy consumption and min-1-running constraint.
- Autofit camera fits all factories with configurable margin and max zoom.
- Hover card + pin toggle functional.
- No LOD; future notes in spec.

## Next Steps

1. Create implementation task (TASK016).
2. Implement factory entity and state.
3. Implement docking and unloading.
4. Implement refining with energy constraints.
5. Implement camera autofit and UI.
6. Add unit and integration tests.
7. Playtest and tune numbers.
