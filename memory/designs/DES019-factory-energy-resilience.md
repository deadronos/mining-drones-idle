# DES019 — Factory Energy Resilience

**Status:** Completed  
**Date Created:** 2025-10-23  
**Date Last Updated:** 2025-10-23

## Design Overview

Eliminate the factory out-of-energy deadlock by ensuring drones always exit the unload system cleanly, purging stale factory assignments from DroneAI, and letting docked drones siphon power from their host factory when the global grid is empty. The scope covers requirements RQ-032, RQ-033, and RQ-034 while capturing an optional upgrade hook for localized solar regeneration.

## Architecture & System Design

### Unload State Finalization

- Restructure `createUnloadSystem` so the undock/ownership hand-off executes whether or not a drone delivered cargo.
- Guarantee the unload system clears `targetFactoryId`, `targetId`, travel data, and queue membership before returning control to DroneAI.
- Preserve existing transfer VFX emission while ensuring zero-cargo unloads still dispatch the state reset path.

### Drone Assignment Hygiene

- Extend `createDroneAISystem` with a pre-flight consistency check:
  - For drones whose state is not `returning`/`unloading`, clear `targetFactoryId`.
  - If the drone still appears in the referenced factory queue, invoke `undockDroneFromFactory` to release the slot.
- When synchronization from persisted `droneFlights` encounters an invalid target factory, fall back to the new cleanup path to avoid stale associations.

### Factory-Assisted Charging

- Modify `createPowerSystem` to compute per-factory energy availability for docked drones (`state.factories` lookup by `drone.ownerFactoryId`).
- Consume global energy first; when insufficient, withdraw the remainder from the factory pool while tracking per-factory deltas for a single `setState` call.
- Update drones so the `charging` flag reflects combined sources and batteries clamp to `maxBattery`.
- Apply the same logic for drones mid-unload to cover the idle-and-dock window.

### Optional Upgrade Hook — Local Solar Collectors

- Document a future upgrade path: augment `FactoryUpgrades.energy` to unlock passive regen (e.g., `energyRegenPerLevel`).
- Charging system already accounts for factory energy stores, so local regen would simply increase the supply feeding the same mechanism.

## Data Flow

```
Drone unload tick
  -> transfer resources (if any)
  -> undock + owner assignment
  -> reset drone state to idle
  -> DroneAI sees idle drone, clears stale factory IDs

Power system tick
  -> compute global stored energy
  -> iterate docked drones
      -> attempt global charge
      -> if deficit && factory energy available, draw from factory
      -> record consumption + update drone battery
  -> commit global + per-factory energy updates
```

## Interfaces & Data Model Changes

- No new persistent fields required; reuse `drone.ownerFactoryId` and existing factory energy stores.
- Introduce an internal helper in the power system to batch per-factory energy deductions (Map keyed by factory ID).
- Optional solar upgrade would reuse `FactoryUpgrades.energy`; no schema change required now.

## Error Handling

- Clamp energy draws to available amounts with epsilon guards to avoid negative factory energy.
- If `ownerFactoryId` references a missing factory, clear the link and skip local charging for that tick.
- Wrap undock calls in try/catch guards only if future telemetry indicates possible failures (not required initially because `undock` tolerates missing drones).

## Testing Strategy

1. **Unload zero-cargo regression:** ECS/system test seeds an unloading drone with 0 cargo and asserts it exits the queue, enters `idle`, and clears `targetFactoryId`.
2. **DroneAI cleanup:** Dedicated unit test forces a drone into `idle` while still queued; tick the AI and verify the queue entry is removed and `targetFactoryId` null.
3. **Factory-assisted charging:** Power system test empties global energy, leaves factory energy >0, ticks once, and confirms drone battery rises while factory energy drops by the same delta.
4. **Mixed charging split:** Scenario test ensures partially available global energy is consumed before tapping factory energy, maintaining total charge rate caps.

## Implementation Plan

1. Update memory bank with requirements (RQ-032..RQ-034) and log TASK020 for the implementation loop.
2. Refactor `unload.ts` to separate resource delivery from undock/reset logic and add coverage for zero-cargo cases.
3. Add DroneAI cleanup guard plus corresponding tests to ensure queues stay accurate after energy outages.
4. Enhance `power.ts` with shared draw logic, integrate factory deductions, and extend tests to cover fallback charging.
5. Document optional solar upgrade concept in follow-up ticket once core fixes land.

**Implementation Notes:** TASK020 delivered the design on 2025-10-23; optional solar regeneration remains a backlog candidate.
