# Factory Buyable — Specification

Date: 2025-10-18
Author: repo contributor

This file specifies the Factory Buyable feature and camera behavior requested by the product owner. It uses EARS-style requirements with acceptance criteria, reasonable assumptions, data model suggestions, UI behaviors, test cases, and notes for future work.

## Overview

Add a purchasable, placeable Factory building that drones can dock into to unload, refuel, and refine mined resources. Factories expose the following properties: docking capacity, refine slots, energy draw, and storage buffer. Drones are assigned autonomously (nearest-first, round-robin tie-breaks). Refining consumes energy, but at least one refine process must be allowed to run to avoid soft-locks. Camera behavior includes an "Autofit Factories" action and a hover card with a pin toggle. No LOD or minimap will be implemented in this iteration.

## Actors

- Player — purchases and manages factories; may pin factory cards.
- Drone — mines, carries payloads, docks at factories.
- Factory — new entity with properties and behaviors described below.

## Assumptions (reasonable defaults)

- Game tick: 1 second.
- Base factory cost: 100 metal + 50 crystals (tunable).
- Docking capacity: 3 drones (base).
- Refine slots: 2 concurrent slots (base).
- Refine time: 10 seconds per batch (base).
- Idle energy draw: 1 energy/sec; energy per refine: 5 energy.
- Storage buffer: 300 units raw ore.
- Price scaling: linear: price_n = base + n * 50 (n = factories owned).
- Energy upkeep scales linearly with number of factories.
- Drones choose nearest factory; ties resolved by round-robin distribution.
- At least one refine slot remains active under low energy, with reduced speed to avoid soft-lock.

## Requirements (EARS)

R1 — WHEN the player purchases a Factory, THE SYSTEM SHALL create a Factory entity with the configured properties and deduct the cost from the player's resources.

### Acceptance criteria

- Player resources decrease by the factory cost at purchase time.
- The new Factory entity appears at the selected location with default properties visible in its panel.

R2 — WHEN a Drone is full OR when commanded to return, THE SYSTEM SHALL assign the Drone to a Factory automatically using nearest-first selection; use round-robin if distances are equal.

### Acceptance criteria

- Full drones navigate to the nearest factory with available capacity or queue to approach.
- For equal-distance factories, drones distribute in round-robin order.

R3 — WHEN a Drone arrives and docking capacity exists, THE SYSTEM SHALL allow docking, transfer payload to factory storage (up to capacity), and perform optional refuel before relaunch per factory policy.

### Acceptance criteria

- Docking respects dockingCapacity; extra drones queue visibly.
- Payload transfers into factory storage up to remaining capacity.
- Refuel (if provided) occurs while docked; drone state updates after unload/refuel.

R4 — WHEN a Factory has resources and an available refine slot, THE SYSTEM SHALL start a refine process consuming energy and time, occupying one refine slot and reducing stored raw resources.

### Acceptance criteria

- Only up to refineSlots processes run concurrently per factory.
- Each refine consumes configured energy and storage and produces refined output on completion.

R5 — WHEN energy is insufficient, THE SYSTEM SHALL ensure at least one refine process remains allowed (min 1 running) at reduced speed to avoid soft-lock.

### Acceptance criteria

- Under low energy, one refine continues at reduced speed (for example, 50% speed) rather than stopping entirely.
- The factory panel displays an energy warning and expected modified refine time.

R6 — WHEN a Factory is active, THE SYSTEM SHALL deduct idle energy upkeep and per-refine energy costs from the player's energy pool.

### Acceptance criteria

- Energy resource decreases by expected amounts during idle and refining.
- Factory panel shows idle and active energy consumption.

R7 — WHEN multiple Factories exist, THE SYSTEM SHALL allow drones to auto-assign to factories autonomously; the player can pin a factory card to keep it visible.

### Acceptance criteria

- Autonomous assignment (nearest/round-robin) is functional.
- Hovering a factory shows a factory card with a pin toggle; when pinned, the card remains visible in the HUD.

R8 — WHEN the player activates Autofit, THE SYSTEM SHALL smoothly center and zoom the camera so that all factories are in view within a configurable margin, up to a maximum zoom-out limit.

### Acceptance criteria

- Autofit centers and zooms to include all factories, with smoothing and a configurable margin.
- Zoom-out is clamped to a maximum to preserve readability.

R9 — THE SYSTEM SHALL NOT implement LOD rendering, minimap, or advanced camera features in this iteration; these are explicitly deferred to future work.

### Acceptance criteria

- No LOD or minimap implemented; developer notes recorded for future optimization.

R10 — WHEN buying additional factories, THE SYSTEM SHALL apply a linear price increase and increase total energy upkeep accordingly.

### Acceptance criteria

- Nth factory cost equals base + N * increment.
- Total energy upkeep reflects the number of factories.

## Suggested data model

Factory (example TypeScript shape):

```ts
interface Factory {
  id: string;
  position: { x: number; y: number };
  dockingCapacity: number;
  refineSlots: number;
  idleEnergyPerSec: number;
  energyPerRefine: number;
  storageCapacity: number;
  currentStorage: number;
  queuedDrones: string[]; // drone ids
  activeRefines: RefineProcess[];
  pinned: boolean;
}
```

RefineProcess:

```ts
interface RefineProcess {
  id: string;
  oreType: string;
  amount: number;
  progress: number; // 0..1
  timeTotal: number;
  energyRequired: number;
  speedMultiplier: number; // reduced when energy low
}
```

## UI behaviors

- Buy Factory: button opens placement mode with ghost preview and confirmation.
- Factory panel: shows properties, queued drones, active refines, energy usage, and upgrades.
- Hover card: shows quick summary and a pin icon; pinned cards anchor to HUD.
- Autofit Factories: camera control button to fit all factories with smoothing.

## Edge cases and error handling

- No factories exist: full drones follow existing idle/return logic.
- Factory sold/destroyed while drones en-route: drones re-evaluate and reassign.
- Storage overflow: drone delivers up to remaining capacity; excess kept by drone.

## High-level test cases

- TC1: Purchase factory (resources decrease; factory appears; panel shows defaults).
- TC2: Drone auto-assignment (full drone navigates to nearest factory and docks).
- TC3: Concurrency (only refineSlots processes run concurrently; others queue).
- TC4: Low energy behavior (one refine continues at reduced speed; UI shows warning).
- TC5: Autofit camera (fits all factories within max zoom-out and margin).

## Metrics to collect during tuning

- Avg throughput per factory.
- CPU/frame with 10 factories + 50 drones.
- Visual clarity at max zoom-out.

## Future work

- Add LOD / simplified rendering for distant objects.
- Add minimap and per-factory minimized views.
- Add factory specialization and upgrades.
- Add UI group management for factory clusters.

## Acceptance summary

- Factories are buyable, placeable, and have docking/refine/storage/energy properties.
- Drones auto-assign (nearest/round-robin) and dock/unload correctly.
- Factories refine with energy consumption and ensure at least one refine continues under low energy.
- Autofit camera fits factories within a capped zoom-out.
