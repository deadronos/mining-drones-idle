# DES016 — Factory Fleet Upgrades & Ownership

**Status:** Draft
**Date Created:** 2025-10-21
**Date Last Updated:** 2025-10-21

## Design Overview

Extend the factory ecosystem so returning drones pick destinations with weighted variety, factories own their own energy/resource ledgers, and the HUD exposes a selector-driven management panel with per-factory upgrades and drone ownership feedback. The work supports requirements RQ-026, RQ-027, and RQ-028 by integrating routing, storage, and UI loops.

## Architecture & System Design

### Factory Resource Core

- Augment `BuildableFactory` with `energy`, `energyCapacity`, and `resources` buckets (ore, bars, ice, metals, crystals, organics, credits).
- Track refinery outputs and energy drain per factory; global store keeps derived aggregates for HUD convenience.
- Refine ticks consume the hosting factory's energy pool; factories pause/refuse new processes if their available energy is exhausted.
- Introduce transfer helpers:
  - `transferOreToFactory(factory, amount)` already exists; extend to return overflow.
  - `transferEnergyToFactory(factory, amount)` to accept routed energy shipments.
  - `extractFactoryOutputs(factory)` to move refined bars/metals/etc. into global totals when requested (e.g., manual collect or scheduled sweep).

### Drone Routing & Landing Queue

- Replace `findNearestAvailableFactory` usage with `selectReturnFactory` that:
  1. Scores factories by inverse-distance weight when capacity exists.
  2. Applies a configurable randomness factor so distant factories remain possible choices.
  3. Respects docking capacity; drones queue when all bays are occupied by recording desired factory even if immediate dock fails.
- If every factory is saturated, drones enter a `holdingPattern` queue at their previous assignment until a dock frees.
- Upon landing, drone `ownerFactoryId` updates to the destination, enabling per-factory drone rosters.

### Factory Upgrade Management Panel

- Convert `FactoryManager` into a selector-based inspector:
  - Maintains `selectedFactoryIndex` (persisted via store UI slice) and provides `◀ ▶` controls mirroring the asteroid inspector.
  - Displays selected factory stats (energy, storage, queues, drone roster).
  - Offers per-factory upgrades (e.g., docking bay, storage) spending that factory's resource pools.
  - Shows owned drones (derived from new `drone.ownerFactoryId`).
- Introduce `useFactoryOwnership` hook to compute rosters and update when drones land/launch.

## Data Flow

```text
Drone returns -> selectReturnFactory -> reserve dock -> fly -> unload -> factory.resources.ore += cargo
Factory tick -> consume factory.energy -> start/advance refine -> produce bars -> factory.resources.bars += output
Player UI -> selects factory -> triggers upgrade -> deduct factory.resources.metals/crystals -> increase factory stat
Aggregate pass -> sum factory.resources.* to global display (read-only)
```

## Interfaces & APIs

- `BuildableFactory`: add `energy`, `energyCapacity`, `resources`, `drones: string[]` (owned drone IDs).
- Store actions:
  - `routeDroneToFactory(droneId, weightingSeed?)` returns assignment used by AI.
  - `updateFactoryEnergy(factoryId, delta)` / `updateFactoryResources(factoryId, delta)` mutate per-factory ledgers.
  - `selectFactory(index)` updates UI selection.
- Drone entity: add `ownerFactoryId` field persisted via store flight snapshots.
- UI: `FactoryManager` consumes store selectors to render active factory, arrow navigation, upgrade callbacks.

## Error Handling & Edge Cases

- When no factories have capacity, drones remain in returning state without travel, re-attempting assignment each frame.
- If a factory is deleted while drones queue, reroute those drones immediately to avoid orphaned ownership.
- Energy underflow clamps at zero; refine processes hold progress and resume when energy replenishes.
- Upgrades fail gracefully with disabled buttons when per-factory resources insufficient.

## Testing Strategy

1. **Drone AI weighting:** deterministic RNG seed loops to confirm >70% of assignments choose nearest while others receive traffic over 100 iterations.
2. **Factory energy isolation:** store tests instantiate two factories, drain one to zero, ensure the other continues refining unaffected.
3. **UI selector & upgrades:** React Testing Library verifies arrow controls cycle factories, upgrade buttons deduct per-factory resources, and drone roster reflects landings.
4. **Persistence:** snapshot roundtrip preserves `ownerFactoryId`, per-factory resources, and energy values.

## Implementation Plan

1. Update requirements (`RQ-026`..`RQ-028`) and create task log entry (TASK017).
2. Extend store models/snapshots with per-factory energy/resources, migration defaults, and aggregate helpers.
3. Adapt ECS systems (unload/refine/power/travel) to operate on per-factory stores and update drone ownership.
4. Rebuild FactoryManager UI with selector arrows, upgrade actions, and drone roster list.
5. Add targeted unit/react tests plus update Playwright flow if necessary.
6. Document progress in memory and prepare PR summary.
