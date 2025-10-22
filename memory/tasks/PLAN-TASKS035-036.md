# Two-Task Implementation Plan: ownedDrones Removal & Drone Unload Fix

**Date Created:** 2025-10-22  
**Priority:** TASK036 (Critical), TASK035 (Medium)  
**Scope:** 2 focused, independent tasks to improve drone system and reduce technical debt

---

## Overview

Two complementary improvements to the drone system:

1. **TASK035 (Technical Debt):** Remove unused `ownedDrones` historical record
   - Simplifies factory state model
   - Removes cosmetic-only UI component
   - Medium priority but quick win

2. **TASK036 (Bug Fix):** Fix drone unload trigger to use position arrival
   - Directly fixes queue jamming cascade
   - Enables waiting drones to progress
   - Critical priority, more complex implementation

---

## TASK035: Remove Unused ownedDrones Historical Record

### Problem

- Each factory stores `ownedDrones: string[]` - a list of drone IDs that have unloaded here
- This is only used by `RosterSection.tsx` UI component (cosmetic display)
- Adds unnecessary complexity: 10+ test assertions, serialization overhead, state cloning
- Duplicates functionality already provided by global `store.droneOwners` map
- Not used by any game mechanics

### Solution

Remove `ownedDrones` from:

- Factory interface & defaults
- Serialization/deserialization
- Store mutation logic
- UI components
- Tests

### Scope: 6 Phases, ~13 subtasks

- Phase 1: Remove type definitions
- Phase 2: Remove serialization handlers + add migration
- Phase 3: Remove store logic
- Phase 4: Remove UI components
- Phase 5: Remove/update tests
- Phase 6: Validation (typecheck, lint, tests)

### Effort: ~2-3 hours

- Straightforward removals
- No complex logic needed
- Just delete dead code

### Risk: Low

- No game mechanic dependencies
- Migration handles old saves
- Clear what's being removed

### Files Modified:

```
src/ecs/factories.ts (remove from interface & defaults)
src/state/types.ts (remove from types)
src/state/serialization/factory.ts (remove from 4 functions)
src/state/serialization/types.ts (remove from FactorySnapshot)
src/state/slices/factorySlice.ts (remove ownership transfer logic)
src/state/migrations.ts (add v6 migration)
src/ui/FactoryManager/FactoryManager.tsx (remove import)
src/ui/FactoryManager/sections/RosterSection.tsx (DELETE)
src/ui/FactoryManager/sections/RosterSection.test.tsx (DELETE)
src/state/store.factories.test.ts (remove ~10 assertions)
```

---

## TASK036: Fix Drone Unload Trigger - Position Arrival vs. Travel Completion

### Problem

**Root Cause (from DES024 investigation):**

- Drones returning to factory have low battery
- Battery throttles travel progress: `travel.elapsed += dt * fraction` (fraction = 0.01-0.1)
- 10-second trip takes 100+ real-time seconds
- Drone occupies docking slot entire time
- Only transitions to 'unloading' after travel.duration completes
- Waiting drones can't get slots while returning drones block them
- **Queue jamming cascade:** 30+ waiting per factory, but only 58 total drones

**Current Flow:**

```
returning state → travel throttled by battery → waiting for travel.duration → finally unload
```

### Solution

Add **position-based unload trigger** that fires immediately when drone arrives at factory, bypassing travel-duration gate:

**New Flow:**

```
returning state → drone arrives at position → immediately start unload
                  (travel still running but unload starts anyway)
                  (freeing slot much sooner)
```

### Why It Works

- Battery throttling affects `travel.elapsed`, not position computation
- `computeTravelPosition()` updates position every tick regardless of battery
- By time throttling causes travel to stall, drone position is already at factory
- Starting unload immediately = slot freed sooner = waiting drones progress

### Implementation Approach

1. Add distance-based arrival detection: `hasArrivedAtFactory(drone, factory)`
2. In travel system main loop, check position arrival before time-based trigger:

   ```typescript
   if (drone.state === 'returning' && drone.targetFactoryId) {
     const factory = store.getState().getFactory(drone.targetFactoryId);
     if (factory && hasArrivedAtFactory(drone, factory)) {
       // Position-based trigger: start unload immediately
       drone.state = 'unloading';
       drone.travel = null;
       api.clearDroneFlight(drone.id);
       continue;
     }
   }

   // Keep time-based trigger as fallback
   if (travel.elapsed >= travel.duration - 1e-4) {
     // existing logic
   }
   ```

3. Flight recording already happens before both triggers, so no data loss

### Scope: 6 Phases, ~18 subtasks

- Phase 1: Analyze current system & unload behavior
- Phase 2: Design position trigger (distance threshold, helper functions)
- Phase 3: Implement in travel.ts (position check, early transition)
- Phase 4: Unit & integration tests for arrival detection
- Phase 5: Edge case handling (missing factory, corrupted position, etc.)
- Phase 6: Validation & performance testing

### Effort: ~4-6 hours

- Core implementation: 1-2 hours
- Test coverage: 2-3 hours
- Edge case handling & validation: 1-2 hours

### Risk: Medium (but well-mitigated)

- Changes core system that drones depend on
- Mitigation: Fallback to time-based trigger, extensive tests, scenario validation
- Backwards compatible: doesn't break existing saves

### Expected Impact

**Before Fix:**

- 4+ factories with 30+ drones waiting
- Queue jamming cascade
- Drones stuck in 'returning' state for extended periods

**After Fix:**

- Waiting queues should stay ≤ 10-15 per factory
- Drones cycle through states faster
- No queue jamming
- Slot availability improves significantly

### Files Modified:

```
src/ecs/systems/travel.ts (add position trigger logic)
src/ecs/flights.ts (add helper function if needed)
tests/unit/travel.spec.ts (new or updated arrival detection tests)
tests/integration/queue-jamming.spec.ts (new scenario tests)
src/state/store.test.ts (update if time-based trigger affected)
```

---

## Execution Strategy

### Option A: Sequential

1. Complete TASK035 first (quick win, clears debt)
2. Then tackle TASK036 (higher complexity, higher reward)
3. **Duration:** 6-9 hours total
4. **Benefit:** Fast feedback, easier debugging per task

### Option B: Parallel

1. Start TASK035 removals while prototyping TASK036 position trigger
2. Merge TASK035 first when tests pass
3. Complete TASK036 implementation & validation
4. **Duration:** 4-6 hours elapsed time
5. **Benefit:** Faster overall, but more context switching

### Recommendation

**Sequential** - TASK035 is low-risk/quick, removing it first clears mental load for the more complex TASK036 work.

---

## Validation Checklist

### TASK035 Validation

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (all 165+ tests)
- [ ] Old saves load without crashes
- [ ] UI renders without RosterSection
- [ ] Docking queue still works

### TASK036 Validation

- [ ] Position-based trigger fires when drone arrives at factory
- [ ] Time-based trigger still works as fallback
- [ ] All 165+ tests pass
- [ ] New unit tests for arrival detection pass
- [ ] Integration tests show queue jamming fixed
- [ ] No performance regression
- [ ] Edge cases handled (missing factory, corrupted position, etc.)
- [ ] Manual scenario: 4 factories, 58 drones show < 15 waiting per factory

---

## Related Documentation

- **DES024** - Full root cause analysis of queue jamming
- **FINDING-001** - Detailed battery throttling investigation
- **TASK028** - Investigation task (completed)

---

## Notes

- Both tasks are independent (can be done in any order, or merged)
- TASK036 doesn't depend on TASK035
- TASK035 removes UI that displays data unrelated to the fix
- Combined, they improve code quality + fix critical gameplay issue
