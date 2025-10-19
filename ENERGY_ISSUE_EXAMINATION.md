# Energy System Examination: Factory Out-of-Energy Bug# Energy System Examination: Factory Out-of-Energy Bug

## Problem Summary## Problem Summary

User reports that when a factory runs out of energy, drones never resume docking and charging operations even after energy is restored. This appears to be a state management issue where drones get stuck in a state that prevents them from returning to the factory.User reports that when a factory runs out of energy, drones never resume docking and charging operations even after energy is restored. This appears to be a state management issue where drones get stuck in a state that prevents them from returning to the factory.

## Current Energy Architecture## Current Energy Architecture

### Global Energy System### Global Energy System (`src/ecs/systems/power.ts`)

**File**: `src/ecs/systems/power.ts`- **Energy Generation**: Based on solar modules (SOLAR_BASE_GEN \* (modules.solar + 1))

- **Energy Capacity**: Modular (BASE_ENERGY_CAP + modules.solar \* ENERGY_PER_SOLAR)

- **Energy Generation**: Based on solar modules (SOLAR_BASE_GEN \* (modules.solar + 1))- **Energy Allocation**: Priority-based:

- **Energy Capacity**: Modular (BASE_ENERGY_CAP + modules.solar \* ENERGY_PER_SOLAR) 1. Drones in 'idle' or 'unloading' states charge from global pool

- **Energy Allocation**: Priority-based 2. Charge rate: DRONE_ENERGY_COST \* 2 per drone
  - Drones in 'idle' or 'unloading' states charge from global pool 3. Each drone charges up to maxBattery

  - Charge rate: DRONE_ENERGY_COST \* 2 per drone- **No Local Energy Regen**: Factories do NOT have local energy regeneration (no solar collectors)

  - Each drone charges up to maxBattery- **Global Pool Only**: All energy is centralized; factories depend on allocated energy from global resources

- **No Local Energy Regen**: Factories do NOT have local energy regeneration (no solar collectors)

- **Global Pool Only**: All energy is centralized; factories depend on allocated energy from global resources### Factory Energy System (`src/ecs/factories.ts`)

### Factory Energy System- **Energy Capacity**: per-factory cap (config: 80 initially)

- **Energy Storage**: factory.energy (persistent local storage)

**File**: `src/ecs/factories.ts`- **Idle Drain**: factory.idleEnergyPerSec (1 per second base)

- **Refine Costs**: factory.energyPerRefine (5 per active refine)

- **Energy Capacity**: per-factory cap (config: 80 initially)- **Hauler Drain**: 0.5 energy/sec per assigned hauler (TASK019)

- **Energy Storage**: factory.energy (persistent local storage)- **No Local Generation**: Factories are energy sinks, not sources

- **Idle Drain**: factory.idleEnergyPerSec (1 per second base)

- **Refine Costs**: factory.energyPerRefine (5 per active refine)### Energy Allocation Flow (`src/state/store.ts:processFactories`)

- **Hauler Drain**: 0.5 energy/sec per assigned hauler (TASK019)

- **No Local Generation**: Factories are energy sinks, not sources```

1. Global energy pool → factory capacity tops up

### Energy Allocation Flow2. Factory consumes:

- Idle drain (factory.idleEnergyPerSec \* dt)

**File**: `src/state/store.ts:processFactories` - Hauler maintenance drain

- Refine costs (energyPerRefine _ speedMultiplier _ dt)

The flow is:3. Remaining global energy continues to other systems

````

1. Global energy pool → factory capacity tops up

2. Factory consumes:## Drone Charging & Docking Flow

   - Idle drain (factory.idleEnergyPerSec * dt)

   - Hauler maintenance drain### Power System Charging (`src/ecs/systems/power.ts`)

   - Refine costs (energyPerRefine * speedMultiplier * dt)

3. Remaining global energy continues to other systems- **Only charges docked drones** (state === 'idle' || state === 'unloading')

- **Requires global energy**: stored = state.resources.energy

## Drone Charging & Docking Flow- **If stored <= 0**: drone.charging = false (no charge happens)

- **Charge rate**: DRONE_ENERGY_COST \* 2 per dt

### Power System Charging

### Drone AI Return Logic (`src/ecs/systems/droneAI.ts:assignReturnFactory`)

**File**: `src/ecs/systems/power.ts`

1. Checks if drone has targetFactoryId with a docking slot

- **Only charges docked drones** (state === 'idle' || state === 'unloading')2. If no slot available: returns null (drone cannot initiate return)

- **Requires global energy**: stored = state.resources.energy3. Calls state.dockDroneAtFactory() → adds drone to factory.queuedDrones

- **If stored <= 0**: drone.charging = false (no charge happens)4. Returns factory position and targetId

- **Charge rate**: DRONE_ENERGY_COST * 2 per dt5. Drone state transitions: 'returning' → travel to factory



### Drone AI Return Logic### Docking State Transition (`src/ecs/systems/travel.ts`)



**File**: `src/ecs/systems/droneAI.ts:assignReturnFactory`- When travel.elapsed >= travel.duration:

  - toAsteroid → 'mining'

1. Checks if drone has targetFactoryId with a docking slot  - returning → 'unloading'

2. If no slot available: returns null (drone cannot initiate return)- Drone moves to factory position

3. Calls state.dockDroneAtFactory() → adds drone to factory.queuedDrones

4. Returns factory position and targetId### Unloading & Reinitialization (`src/ecs/systems/unload.ts`)

5. Drone state transitions: 'returning' → travel to factory

- Transfers cargo to factory

### Docking State Transition- Resets drone state: cargo=0, cargoProfile={}, travel=null, targetId=null

- **CRITICAL**: Sets drone.state = 'idle' (this allows charging to resume)

**File**: `src/ecs/systems/travel.ts`- Undocks drone via state.undockDroneFromFactory()



- When travel.elapsed >= travel.duration:## The Bug: Why Drones Get Stuck

  - toAsteroid → 'mining'

  - returning → 'unloading'### Scenario: Factory Out of Energy

- Drone moves to factory position

1. Factory runs out of energy (working.energy = 0)

### Unloading & Reinitialization2. Drones arriving at factory attempt to transition: returning → unloading

3. Unload system processes: transfers cargo, sets drone.state = 'idle'

**File**: `src/ecs/systems/unload.ts`4. Charging attempt in power system requires:

   - Drone in 'idle' state ✓ (just reset)

- Transfers cargo to factory   - Global energy available: stored > 0 ✗ **FAILS if global is depleted too**

- Resets drone state: cargo=0, cargoProfile={}, travel=null, targetId=null

- **CRITICAL**: Sets drone.state = 'idle' (this allows charging to resume)### But Also: Potential Soft-Lock on Charging

- Undocks drone via state.undockDroneFromFactory()

If drones are stuck in 'returning' or 'unloading' state:

## The Bug: Why Drones Get Stuck

1. Travel system clears travel when complete

### Scenario: Factory Out of Energy2. **If unload system never runs** (conditions not met?), drone stays 'returning'

3. DroneAI won't re-assign if drone already has targetFactoryId

1. Factory runs out of energy (working.energy = 0)4. Power system won't charge (state != 'idle' and != 'unloading')

2. Drones arriving at factory attempt to transition: returning → unloading

3. Unload system processes: transfers cargo, sets drone.state = 'idle'### Hypothesis: State Not Being Reset Properly

4. Charging attempt in power system requires:

   - Drone in 'idle' state ✓ (just reset)**Most likely issue:**

   - Global energy available: stored > 0 ✗ **FAILS if global is depleted too**

- When factory energy drops to 0, it's unclear if `enforceMinOneRefining()` or refine logic causes drones to be held in a state

### But Also: Potential Soft-Lock on Charging- OR: Drones transition to 'unloading' but cargo is already 0 (due to low energy preventing successful arrival at docking)

- Unload system requires `drone.cargo > 0` to trigger full unload cycle

If drones are stuck in 'returning' or 'unloading' state:- If cargo is 0, drone.state stays 'unloading' forever (state machine stuck)



1. Travel system clears travel when complete## Critical Code Points

2. **If unload system never runs** (conditions not met?), drone stays 'returning'

3. DroneAI won't re-assign if drone already has targetFactoryId### Check 1: Unload System Cargo Condition

4. Power system won't charge (state != 'idle' and != 'unloading')

File: `src/ecs/systems/unload.ts:20-25`

### Hypothesis: State Not Being Reset Properly

```typescript

**Most likely issue:**if (drone.state !== 'unloading') continue;

const amount = drone.cargo;

- When factory energy drops to 0, it's unclear if `enforceMinOneRefining()` or refine logic causes drones to be held in a stateif (amount > 0) {

- OR: Drones transition to 'unloading' but cargo is already 0 (due to low energy preventing successful arrival at docking)  // <-- CRITICAL: if cargo <= 0, nothing happens

- Unload system requires `drone.cargo > 0` to trigger full unload cycle  // transfer logic

- If cargo is 0, drone.state stays 'unloading' forever (state machine stuck)  drone.state = 'idle'; // <-- never reached if cargo = 0

}

## Critical Code Points// drone stays 'unloading' forever!

````

### Check 1: Unload System Cargo Condition

### Check 2: DroneAI Cannot Reassign Stuck Drones

**File**: `src/ecs/systems/unload.ts:20-25`

File: `src/ecs/systems/droneAI.ts:192-210`

```typescript

if (drone.state !== 'unloading') continue;- If drone.targetFactoryId is set and drone.state != 'idle'/'unloading'

const amount = drone.cargo;- DroneAI won't call `assignReturnFactory()` again

if (amount > 0) {  // <-- CRITICAL: if cargo <= 0, nothing happens- Drone never gets a fresh chance to return to factory

  // transfer logic

  drone.state = 'idle';  // <-- never reached if cargo = 0### Check 3: Travel System Doesn't Force State Reset

}

// drone stays 'unloading' forever!File: `src/ecs/systems/travel.ts:52-63`

```

- When travel completes, transition is hard-coded:

### Check 2: DroneAI Cannot Reassign Stuck Drones - 'toAsteroid' → 'mining'

- 'returning' → 'unloading'

**File**: `src/ecs/systems/droneAI.ts:192-210`- There's no fallback if unload system fails to finalize

- If drone.targetFactoryId is set and drone.state != 'idle'/'unloading'## Missing: Local Factory Energy Regeneration

- DroneAI won't call `assignReturnFactory()` again

- Drone never gets a fresh chance to return to factory**Currently**: No. Factories are purely energy sinks.

### Check 3: Travel System Doesn't Force State Reset- Idle drain: 1 energy/sec

- Refine cost: 5 per active batch

**File**: `src/ecs/systems/travel.ts:52-63`- Hauler cost: 0.5 per assigned hauler per sec

- **No source**: must pull from global energy pool

- When travel completes, transition is hard-coded:
  - 'toAsteroid' → 'mining'**Suggestion for Future**: Solar collectors could be an upgrade that gives local energy regen, e.g.:

  - 'returning' → 'unloading'

- There's no fallback if unload system fails to finalize- Base: 0 regen

- Each upgrade level: +0.5 energy/sec regen (local only)

## Missing: Local Factory Energy Regeneration- Helps factories stay powered independently during energy droughts

**Currently**: No. Factories are purely energy sinks.## Reproduction Steps

- Idle drain: 1 energy/sec1. Build factory (primary has 80 energy cap, 40 initial)

- Refine cost: 5 per active batch2. Let drones mine and bring cargo back

- Hauler cost: 0.5 per assigned hauler per sec3. Increase refine/hauler activity to drain factory energy to 0

- **No source**: must pull from global energy pool4. Continue draining global energy too (or reach point where refine halts)

5. **Expected**: As energy recovers, drones should resume charging and operations

**Suggestion for Future**: Solar collectors could be an upgrade that gives local energy regen, e.g.:6. **Actual**: Drones stuck, never re-engage with factory

7. Likely state: drone.state = 'unloading' (or 'returning'), cargo = 0

- Base: 0 regen

- Each upgrade level: +0.5 energy/sec regen (local only)## Summary of Issues

- Helps factories stay powered independently during energy droughts

| Issue | Location | Severity | Impact |

## Reproduction Steps| --------------------------------------- | ----------------------- | -------- | ------------------------------------------------------------------------- |

| **Unload gate on cargo=0** | unload.ts:21-75 | High | Drones with 0 cargo never transition to 'idle' from 'unloading' |

1. Build factory (primary has 80 energy cap, 40 initial)| **DroneAI can't reassign stuck drones** | droneAI.ts:192-210 | High | Once targetFactoryId set, drone won't re-evaluate until manually undocked |

2. Let drones mine and bring cargo back| **No factory local regen** | factories.ts / power.ts | Low | Factories are pure sinks; design decision but limits resilience |

3. Increase refine/hauler activity to drain factory energy to 0| **Energy-zero charging bug** | power.ts:24-42 | Medium | If global energy = 0, drones can't charge even if factory.energy > 0 |

4. Continue draining global energy too (or reach point where refine halts)| **No reinit after recovery** | (overall) | Medium | No explicit re-trigger when energy is restored after outage |

5. **Expected**: As energy recovers, drones should resume charging and operations

6. **Actual**: Drones stuck, never re-engage with factory## Next Steps (When Ready to Code)

7. Likely state: drone.state = 'unloading' (or 'returning'), cargo = 0

8. **Fix unload gate**: Always transition drone to 'idle' at end of unload system, regardless of cargo

## Summary of Issues2. **Allow DroneAI reassignment**: Clear targetFactoryId if drone state doesn't match expected

3. **Add charging from factory energy**: Allow docked drones to charge from local factory energy pool too

| Issue | Location | Severity | Impact |4. **Optional factory regen**: Consider upgrade module for local solar (future enhancement)

|-------|----------|----------|--------|
| **Unload gate on cargo=0** | unload.ts:21-75 | High | Drones with 0 cargo never transition to 'idle' from 'unloading' |
| **DroneAI can't reassign stuck drones** | droneAI.ts:192-210 | High | Once targetFactoryId set, drone won't re-evaluate until manually undocked |
| **No factory local regen** | factories.ts / power.ts | Low | Factories are pure sinks; design decision but limits resilience |
| **Energy-zero charging bug** | power.ts:24-42 | Medium | If global energy = 0, drones can't charge even if factory.energy > 0 |
| **No reinit after recovery** | (overall) | Medium | No explicit re-trigger when energy is restored after outage |

## Next Steps (When Ready to Code)

1. **Fix unload gate**: Always transition drone to 'idle' at end of unload system, regardless of cargo
2. **Allow DroneAI reassignment**: Clear targetFactoryId if drone state doesn't match expected
3. **Add charging from factory energy**: Allow docked drones to charge from local factory energy pool too
4. **Optional factory regen**: Consider upgrade module for local solar (future enhancement)
