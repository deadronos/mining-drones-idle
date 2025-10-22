# TASK036: Fix Drone Unload Trigger - Position Arrival vs. Travel Completion

**Status:** Pending  
**Added:** 2025-10-22  
**Updated:** 2025-10-22  
**Related:** DES024, TASK028, FINDING-001  
**Priority:** Critical (Blocks Queue Jamming)

## Original Request

Fix the drone unload system to trigger on **position arrival** rather than **travel time completion**. Currently:

- Drones returning to factory get throttled by low battery
- Battery throttling slows travel progress to 10-100x slower
- This causes drones to occupy docking slots indefinitely
- Waiting drones never get slots → **queue jamming cascade**

Solution: When drone arrives at factory position (distance < threshold), immediately transition to unloading, bypassing travel-completion gate.

## Thought Process

### Root Cause Analysis (from DES024)

The current flow:

```
drone.state = 'returning'
  → travel starts with battery fraction throttling
  → travel.elapsed += dt * fraction (fraction = 0.01-0.1 when battery low)
  → travel takes 10-100x longer than intended
  → drone occupies docking slot for extended period
  → travel.elapsed finally reaches travel.duration
  → drone transitions to 'unloading'
  → unload completes, slot frees
  → waiting drones can progress

With throttling: 10-second trip becomes 100+ seconds real-time
```

Current transition point (src/ecs/systems/travel.ts:60-67):

```typescript
if (travel.elapsed >= travel.duration - 1e-4) {
  drone.position.copy(travel.to);
  drone.travel = null;
  api.clearDroneFlight(drone.id);
  if (drone.state === 'toAsteroid') {
    drone.state = 'mining';
  } else if (drone.state === 'returning') {
    drone.state = 'unloading'; // ← Only happens at travel.duration
  }
}
```

### Why Position-Based Trigger Works

- Battery throttling affects travel progress (`travel.elapsed`), not position computation
- Position is updated every tick: `computeTravelPosition(travel, drone.position)`
- By the time throttling causes problems, drone position is already correct
- Transition to unload immediately once position is close enough = unload starts sooner
- Unloading doesn't depend on travel data, so it's safe to clear travel early

### Safe Design Constraints

1. **Avoid double-triggering**: Only transition once per return trip
2. **Maintain state consistency**: Ensure flight data is recorded before clearing
3. **Distance threshold**: Use same tolerance used for other positional checks
4. **Backwards compatibility**: Doesn't break toAsteroid mining transitions

## Implementation Plan

### Phase 1: Analyze Current System

- [ ] **1.1** Review travel system
  - Read `src/ecs/systems/travel.ts` fully
  - Understand `computeTravelPosition()` in `src/ecs/flights.ts`
  - Identify all position-based checks in codebase

- [ ] **1.2** Review distance checks in droneAI
  - Check how other systems detect "arrival" at destinations
  - Find appropriate distance threshold constant
  - Verify no existing position-based early-exit logic

- [ ] **1.3** Document current unload system
  - Read `src/ecs/systems/unload.ts` or equivalent
  - Understand what happens during 'unloading' state
  - Confirm unloading is safe to start with incomplete travel

### Phase 2: Design Position Trigger

- [ ] **2.1** Define distance threshold constant
  - Create constant `UNLOAD_ARRIVAL_DISTANCE` (suggest: 0.5 or 1.0 units)
  - Document in comment why this value chosen
  - Add to config/constants

- [ ] **2.2** Add arrival detection helper
  - Create function: `hasArrivedAtFactory(drone, factory) => boolean`
  - Checks: `drone.position.distanceTo(factory.position) < UNLOAD_ARRIVAL_DISTANCE`
  - Place in `src/ecs/systems/travel.ts` or `src/ecs/flights.ts`

- [ ] **2.3** Design state transition logic
  - Document when to trigger: every tick while in 'returning' state
  - Ensure one-shot (no repeated transitions)
  - Determine if we clear travel early or let it finish
  - Consider: should we still record flight state?

### Phase 3: Implement Position Trigger

- [ ] **3.1** Modify `src/ecs/systems/travel.ts`
  - Add `UNLOAD_ARRIVAL_DISTANCE` constant at top
  - Add `hasArrivedAtFactory()` helper function
  - In travel loop, add check before time-based trigger:

    ```typescript
    // NEW: Check if drone has arrived at factory (position-based)
    if (drone.state === 'returning' && drone.targetFactoryId) {
      const factory = store.getState().getFactory(drone.targetFactoryId);
      if (factory && hasArrivedAtFactory(drone, factory)) {
        // Drone has reached factory position, start unloading
        drone.position.copy(factory.position); // Snap to factory
        drone.travel = null;
        api.clearDroneFlight(drone.id);
        drone.state = 'unloading';
        drone.flightSeed = null;
        continue; // Skip rest of travel loop
      }
    }

    // Keep time-based trigger as fallback (safety net)
    if (travel.elapsed >= travel.duration - 1e-4) {
      // ... existing logic
    }
    ```

- [ ] **3.2** Update flight recording
  - Ensure flight state is recorded before position trigger clears it
  - Verify: is flight recorded in recordDroneFlight before travel.elapsed check?
  - Current code records at line 45-53, so it runs before position check ✓

- [ ] **3.3** Add early arrival marker
  - Consider: log when position-based trigger fires (for debugging)
  - Optional: add metric to world events to track early arrivals
  - Helps validate: position trigger is firing, reducing queue wait times

### Phase 4: Test Position Trigger

- [ ] **4.1** Create unit tests
  - Test arrival detection at various distances
  - Test transition happens at exact threshold
  - Test no double-transition on consecutive ticks
  - Test fallback to time-based trigger if distance check fails

- [ ] **4.2** Create integration tests
  - Spawn drone, send it returning with low battery
  - Verify: drone arrives at factory position before travel.duration
  - Verify: drone immediately transitions to 'unloading'
  - Verify: unload completes and frees docking slot
  - Verify: waiting drones can progress to docking slots

- [ ] **4.3** Create scenario tests
  - Setup: 4 factories with 3 docking capacity each, 58 drones
  - Simulate: low battery scenario
  - Before fix: queues back up with 30+ waiting per factory
  - After fix: queues should remain <= 10 waiting (or lower)
  - Measure: average wait time for waiting drone to get slot

### Phase 5: Handle Edge Cases

- [ ] **5.1** Handle missing factory
  - If targetFactoryId is set but factory deleted
  - Position trigger should fail gracefully (continue, let time-based trigger handle)
  - Verify: drone doesn't soft-lock

- [ ] **5.2** Handle corrupted position
  - If drone.position has NaN/Infinity
  - Distance check should handle safely (return false)
  - Verify: no exceptions thrown

- [ ] **5.3** Handle travel = null during returning
  - Drone in 'returning' but travel cleared (shouldn't happen, but defensive)
  - Position trigger still works (doesn't depend on travel)
  - Verify: drone unloads successfully

- [ ] **5.4** Handle very close factory
  - If drone spawns/loads already at factory position
  - Distance < threshold immediately
  - Position trigger fires, drone transitions to unload
  - Verify: expected behavior (start unloading immediately)

### Phase 6: Validate & Optimize

- [ ] **6.1** Performance check
  - Distance check runs every frame, every drone
  - Use squared-distance comparison to avoid sqrt
  - Verify: no performance regression
  - Measure: frame time before/after

- [ ] **6.2** Run full test suite
  - `npm run test`
  - Verify all 165+ tests still pass
  - Check for any tests that assume time-based trigger

- [ ] **6.3** TypeScript check
  - `npm run typecheck`
  - No type errors from new code

- [ ] **6.4** Lint check
  - `npm run lint`
  - Code follows project style

- [ ] **6.5** Manual scenario test
  - Load game with multiple factories
  - Create drones, mine asteroids
  - Observe: drones returning should unload faster
  - Verify: waiting queues don't balloon
  - Check: no drone soft-locks or stuck states

## Progress Tracking

### Subtasks

| ID  | Description                      | Status      | Updated | Notes |
| --- | -------------------------------- | ----------- | ------- | ----- |
| 1.1 | Review travel system             | Not Started | -       | -     |
| 1.2 | Review distance checks           | Not Started | -       | -     |
| 1.3 | Document unload system           | Not Started | -       | -     |
| 2.1 | Define distance threshold        | Not Started | -       | -     |
| 2.2 | Create arrival detection helper  | Not Started | -       | -     |
| 2.3 | Design state transition logic    | Not Started | -       | -     |
| 3.1 | Modify travel.ts with trigger    | Not Started | -       | -     |
| 3.2 | Verify flight recording          | Not Started | -       | -     |
| 3.3 | Add debugging/metrics (optional) | Not Started | -       | -     |
| 4.1 | Unit tests for arrival detection | Not Started | -       | -     |
| 4.2 | Integration tests                | Not Started | -       | -     |
| 4.3 | Scenario tests (queue jamming)   | Not Started | -       | -     |
| 5.1 | Handle missing factory edge case | Not Started | -       | -     |
| 5.2 | Handle corrupted position        | Not Started | -       | -     |
| 5.3 | Handle null travel state         | Not Started | -       | -     |
| 5.4 | Handle drone already at factory  | Not Started | -       | -     |
| 6.1 | Performance validation           | Not Started | -       | -     |
| 6.2 | Full test suite run              | Not Started | -       | -     |
| 6.3 | TypeScript check                 | Not Started | -       | -     |
| 6.4 | Lint check                       | Not Started | -       | -     |
| 6.5 | Manual scenario test             | Not Started | -       | -     |

## Progress Log

_(Updates logged as work progresses)_

## Acceptance Criteria

- [ ] Drones arriving at factory position immediately transition to unloading
- [ ] Position-based trigger operates independently from travel-time completion
- [ ] Fallback to time-based trigger if position check unavailable
- [ ] All new unit/integration tests pass
- [ ] Full test suite passes (165+ tests)
- [ ] Manual scenario: 4 factories, 58 drones show dramatically reduced waiting queues
- [ ] No performance regression from distance checks
- [ ] No edge cases cause drone soft-locks
- [ ] Code clean on typecheck and lint

## Success Metrics (Validation)

**Before Fix:**

- 4+ factories show 30+ drones waiting
- Total drones: 58
- Waiting queues accumulate indefinitely

**After Fix:**

- Waiting queues should stay <= 10-15 per factory
- Drones cycle through mining → returning → unloading → idle faster
- No queue jamming cascade
- Docking slots free up as unloading completes quicker

**Related Issues Fixed:**

- Battery throttling no longer blocks queue progression
- Stuck-returning drones unload immediately
- Waiting drones get fair access to docking slots
