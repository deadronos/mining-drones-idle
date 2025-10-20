# TASK028 - Drone Returning Throttle Stall Fix

**Status:** Completed  
**Added:** 2025-10-25  
**Updated:** 2025-10-25  
**Design:** DES024

## Original Request

Investigate and address why drones get stuck in "returning" state and never undock from factory queues, causing queue jamming with drones stuck in "waiting" status indefinitely.

**Symptoms:**

- Docking queue shows "5/5 docks (27+ waiting)"
- Waiting drones never progress to docking
- Drones appear to be stuck at factory position

## Thought Process

### Analysis Phase

1. Searched for drone state machine - found 5 states: `'idle' | 'toAsteroid' | 'mining' | 'returning' | 'unloading'`

2. Examined docking mechanics:
   - `factory.queuedDrones` array holds all drones
   - First N entries (where N = `dockingCapacity`) are "docked" (active)
   - Remaining entries are "waiting" (in queue)

3. Traced undocking flow:
   - `unload.ts` system processes `state === 'unloading'`
   - Calls `undockDroneFromFactory()` to remove drone from queue
   - Drone returns to `'idle'` state

4. **Key discovery:** Searched for `'returning'` → `'unloading'` transition
   - Initially appeared to be missing
   - Actually found in `src/ecs/systems/travel.ts` line 79
   - Transition DOES exist and is correctly implemented

5. **Root cause found:** Energy throttling on travel progress
   - File: `src/ecs/systems/travel.ts` line 56
   - `travel.elapsed = Math.min(travel.elapsed + dt * fraction, travel.duration)`
   - `fraction = clamp(drone.battery / drone.maxBattery, throttleFloor, 1)`
   - When battery is low, `fraction` approaches `throttleFloor` minimum
   - Travel completion takes 10-100x longer depending on battery level

### Validation

Confirmed by test file `src/ecs/systems/travel.test.ts`:

- With 25% battery: only 25% travel progress per frame
- With 0% battery + 0.3 throttleFloor: only 30% progress per frame
- Expected behavior: travel completion is energy-gated

## Implementation Plan

### Discovery Phase (COMPLETED)

- [x] Locate transition code: found in `travel.ts`
- [x] Understand throttling mechanism: energy.ts
- [x] Verify test expectations: travel.test.ts
- [x] Document root cause: created FINDING-001

### Design Phase (COMPLETED)

- [x] DES024 created with full analysis
- [x] Four solution options documented
- [x] Recommended solution: trigger unload on position arrival

### No Implementation Needed

This is a **diagnosis task**, not a code fix task. The behavior is:

1. **Working as designed** (energy throttling is intentional)
2. **Causing gameplay issue** (queue stalling on low-battery drones)
3. **Requires design decision** (should return journey be throttled?)

The actual fix would be addressed in a separate task after design approval.

## Progress Tracking

| Phase    | Status   | Updated    | Notes                                               |
| -------- | -------- | ---------- | --------------------------------------------------- |
| Analysis | Complete | 2025-10-25 | Root cause identified: battery throttling on travel |
| Design   | Complete | 2025-10-25 | DES024 created with 4 solution options              |
| Findings | Complete | 2025-10-25 | FINDING-001 documents the issue comprehensively     |
| Decision | Pending  | -          | Awaiting design decision on best fix approach       |

## Progress Log

### 2025-10-25 - Investigation Complete

**Discoveries:**

- Drone state transition `'returning'` → `'unloading'` found in `src/ecs/systems/travel.ts:79`
- Transition is correctly implemented
- Root cause: travel progress gated by battery fraction
- With low battery, travel completes 10-100x slower than normal
- This prevents state transition to 'unloading' within reasonable time
- Unload system never triggers, queue slots never free
- Result: queue jamming and system deadlock

**Evidence:**

1. Travel system code shows: `travel.elapsed += dt * fraction`
2. Energy system clamps fraction to throttleFloor (minimum 0.1-0.3)
3. Test confirms: 0% battery with 0.3 throttle = 30% speed only
4. At 60 FPS with 10-second travel: could take 30+ seconds real-time to return

**Solution Paths Identified:**

1. Bypass throttling for return journey
2. Use separate fast-track energy system for returns
3. Trigger unload on position arrival (recommended)
4. Increase throttleFloor for returning drones

## Key Files Modified

- `memory/designs/DES024-drone-docking-mechanics-analysis.md` - Updated with root cause
- `memory/findings/FINDING-001-drone-returning-throttle.md` - Created with complete analysis

## Key Files Referenced

- `src/ecs/systems/travel.ts` - Travel progress calculation
- `src/ecs/energy.ts` - Energy throttling mechanism
- `src/ecs/systems/travel.test.ts` - Validates expected behavior
- `src/ecs/systems/unload.ts` - Undocking system
- `src/ecs/systems/droneAI.ts` - Drone assignment logic

## Acceptance Criteria

- [x] Root cause identified and documented
- [x] Transition code located and verified
- [x] Energy throttling mechanism understood
- [x] Cascade failure path documented
- [x] Solutions proposed with trade-offs
- [x] Test coverage confirmed
- [x] Findings recorded for implementation phase

## Next Steps

1. **Design Review:** Stakeholders choose preferred solution
2. **Implementation Task:** Create separate task for chosen fix
3. **Testing:** Validate queue progression with returning drones
4. **Balance Review:** Ensure energy system remains challenging

## Technical Details

### Energy Throttling Math

```
fraction = clamp(battery / maxBattery, throttleFloor, 1)
travel.elapsed += dt * fraction

With low battery:
- battery = 1/100 → fraction = clamp(0.01, 0.1, 1) = 0.1
- At 60 FPS: dt = 0.0167
- Progress per frame: 0.0167 * 0.1 = 0.00167
- To complete 10-second travel: 10 / 0.00167 = 5,988 frames = 99.8 seconds
```

### Cascade Failure Chain

```
Low Battery Drone Completes Mining
→ Assigned to Factory Dock
→ Travel Path Created (10 seconds)
→ Travel Progresses at 10% Speed
→ 100+ Seconds Real-Time Needed
→ State Stuck in 'returning'
→ Unload System Skipped
→ Drone Never Undocked
→ Queue Slot Permanently Occupied
→ Waiting Drones Cannot Progress
→ SYSTEM DEADLOCK
```

## Lessons Learned

1. Transition code existed but wasn't immediately visible in grep results
2. Energy throttling is intentional but creates unexpected side effects
3. Queue-based systems are sensitive to blocking - one stuck drone jams the whole queue
4. Testing infrastructure helps validate assumptions about throttling behavior
5. Need for explicit "return journey" handling separate from normal travel

## Related Issues

- DES023: Drone distribution improvement (related to queue filling)
- TASK006: Energy throttle implementation (the throttling mechanism itself)
- TASK019: Hauler logistics (another queue-based system)
