# DES024: Drone Docking/Undocking Mechanics Analysis

## Overview

This document explains how drone docking and undocking works in the mining-drones-idle game, and identifies potential causes for drones getting stuck in a "queued" state and not undocking again.

---

## 1. Drone State Machine

### States

Drones have 5 states defined in `src/ecs/world.ts`:

```typescript
export type DroneState =
  | 'idle'
  | 'toAsteroid'
  | 'mining'
  | 'returning'
  | 'unloading';
```

### State Transitions

```
idle
  ↓ (when assigned asteroid target)
toAsteroid
  ↓ (travels to asteroid, reaches destination)
mining
  ↓ (mines ore, cargo full or ore depleted)
returning
  ↓ (travels to factory, arrives)
unloading
  ↓ (transfers cargo to factory, completes)
idle (cycle repeats)
```

---

## 2. Docking Architecture

### Factory Docking System (`src/ecs/factories.ts`)

Each factory has two related properties:

1. **`queuedDrones: string[]`** - Array of drone IDs queued at the factory
   - First `dockingCapacity` entries = actively docked drones
   - Remaining entries = waiting drones

2. **`dockingCapacity: number`** - Upgradeable limit (default 3)
   - Shows as "5/5 docks" in UI when upgraded

### Docking vs. Waiting

The UI in `src/ui/FactoryManager/sections/DockingSection.tsx` distinguishes:

```typescript
const dockingEntries = useMemo(
  () =>
    currentItems.map((id, idx) => ({
      droneId: id,
      // Docked if index < capacity, otherwise waiting
      status: idx < factory.dockingCapacity ? 'docked' : 'waiting',
    })),
  [currentItems, factory.dockingCapacity],
);
```

**Visual indicators:**

- First N drones show with blue icon = **docked** (actively unloading)
- Remaining drones show with hourglass icon = **waiting** (queued)

---

## 3. The Docking Process

### Step 1: Drone Decides to Return

**Location:** `src/ecs/systems/droneAI.ts`, function `assignReturnFactory()`

When drone finishes mining and enters `'returning'` state:

1. Checks if drone already has `targetFactoryId` assigned
2. If yes and it's in the docking queue with a slot available, returns immediately
3. Otherwise, searches for the best factory:
   - Filters factories with available docking slots: `available = dockingCapacity - queuedDrones.length > 0`
   - Sorts by **least-filled docking** (primary) and **distance** (secondary)
   - With 25% chance, adds randomness to avoid starvation

### Step 2: Add Drone to Queue

**Location:** `src/state/slices/factorySlice.ts`, method `dockDroneAtFactory()`

```typescript
dockDroneAtFactory: (factoryId, droneId) => {
  // Find factory and attempt to dock
  const result = attemptDockDrone(updated, droneId);

  // Returns:
  // 'docking' = successfully added, within docking capacity
  // 'queued' = successfully added, but in waiting queue
  // 'exists' = already in queue, check position
};
```

The underlying function `attemptDockDrone()` (factories.ts):

```typescript
export const attemptDockDrone = (
  factory: BuildableFactory,
  droneId: string,
): DockingResult => {
  const existingIndex = factory.queuedDrones.indexOf(droneId);
  if (existingIndex !== -1) {
    return existingIndex < factory.dockingCapacity ? 'docking' : 'queued';
  }
  factory.queuedDrones.push(droneId);
  // Check if newly added drone is within capacity
  return position < factory.dockingCapacity ? 'docking' : 'queued';
};
```

### Step 3: Drone Travels to Factory

**Location:** `src/ecs/systems/droneAI.ts`, function `startTravel()`

Drone state becomes `'returning'` and travel is initiated:

- Sets `drone.state = 'returning'`
- Creates `TravelData` with bezier curve path (for visual polish)
- Records flight in store: `store.getState().recordDroneFlight()`
- Sets `drone.targetFactoryId` so unload system knows where to unload

### Step 4: Drone Arrives and Unloads

**Location:** `src/ecs/systems/unload.ts`, system `createUnloadSystem()`

When drone reaches factory:

1. Flight system puts drone at factory position
2. Unload system detects `drone.state === 'unloading'`
3. Transfers cargo to factory:
   ```typescript
   state.transferOreToFactory(dockingFactory.id, oreForFactory);
   state.addResourcesToFactory(dockingFactoryId, factoryDelta);
   ```
4. **Critical: Calls `undockDroneFromFactory()`** with `transferOwnership: true`
   ```typescript
   state.undockDroneFromFactory(dockingFactoryId, drone.id, {
     transferOwnership: true,
   });
   ```

### Step 5: Drone Undocked and Returns to Idle

**Location:** `src/state/slices/factorySlice.ts`, method `undockDroneFromFactory()`

```typescript
undockDroneFromFactory: (factoryId, droneId, options) => {
  // Remove drone from factory.queuedDrones
  removeDroneFromFactory(updated, droneId);

  // If transferOwnership: mark factory as owner
  if (options?.transferOwnership) {
    nextDroneOwners = { ...state.droneOwners, [droneId]: factoryId };
    // Add droneId to factory.ownedDrones
  }

  set({ factories, droneOwners: nextDroneOwners });
};
```

The underlying function `removeDroneFromFactory()` (factories.ts):

```typescript
export const removeDroneFromFactory = (
  factory: BuildableFactory,
  droneId: string,
): void => {
  factory.queuedDrones = factory.queuedDrones.filter((id) => id !== droneId);
};
```

Drone resets to `'idle'` and cycle repeats.

---

## 4. What Could Cause Drones NOT to Undock

### **Issue A: Drone Never Enters "Unloading" State**

**Problem:** If a drone is stuck in `'returning'` state but never transitions to `'unloading'`, it will remain in the queue forever.

**Root Causes:**

1. **Travel Never Completes**
   - If `drone.travel.elapsed >= drone.travel.duration`, the flight system should mark arrival
   - But if the physics/movement system doesn't progress `elapsed`, drone stays in travel indefinitely
   - Drone position updates, but state never changes

2. **Unload System Not Invoked**
   - Unload system only triggers when `drone.state === 'unloading'`
   - But what sets the state to `'unloading'`?
   - **Check needed:** There's no visible code that transitions `'returning'` → `'unloading'`
   - This might be in a movement/physics system or tick handler not shown in the grep results

3. **Missing Tick Call**
   - If unload system isn't called on that drone, undocking never happens
   - Drone sits at factory position in `'returning'` state with full cargo indefinitely

**Evidence in Code:**

```typescript
// In unload.ts:
if (drone.state !== 'unloading') continue; // SKIPPED if state is 'returning'

// In droneAI.ts:
if (drone.state === 'unloading' && drone.cargo <= 0.01) {
  // Only cleanup after unloading completes
  drone.state = 'idle';
}
```

---

### **Issue B: State Machine Gets Stuck Due to Stuck Factory Detection**

**Problem:** There's a check in `droneAI.ts` (lines 381-382) that tries to prevent drones from being stuck:

```typescript
if (
  drone.targetFactoryId &&
  drone.state !== 'returning' &&
  drone.state !== 'unloading'
) {
  const stuckFactoryId = drone.targetFactoryId;
  state.undockDroneFromFactory(stuckFactoryId, drone.id); // Undock
  drone.targetFactoryId = null;
}
```

**Issue:** This only undocks if drone is in `'idle'`, `'toAsteroid'`, or `'mining'` state AND has `targetFactoryId` set.

**When This Fails:**

- If drone transition from `'returning'` → `'unloading'` happens after the stuck check runs
- Or if the state transition logic is broken and drone never reaches `'unloading'`
- Then the drone is never undocked by this safety check

---

### **Issue C: Persistence/Deserialization Corruption**

**Problem:** When loading a saved game with in-flight drones:

```typescript
// In droneAI.ts - synchronizeDroneFlight()
if (storedFlight) {
  // Validates travel snapshot
  const invalid = !travel || !Number.isFinite(...);
  if (invalid) {
    // Clear flight and reset drone to idle
    drone.state = 'idle';
    drone.targetId = null;
    drone.travel = null;
    drone.flightSeed = null;
    return; // BUT targetFactoryId might still be set!
  }
}
```

**The Bug:**

- If travel snapshot is corrupted, drone is put in `'idle'` state
- But `drone.targetFactoryId` remains set from before the save
- Drone is still in the factory's `queuedDrones` array
- On next tick, the stuck check sees `targetFactoryId` with state `'idle'` and undocks
- **But what if the safe persistence logic doesn't clear targetFactoryId properly?**

---

### **Issue D: Travel Starts with Invalid Vectors**

**Problem:** In `startTravel()`:

```typescript
const invalidVec = (v: Vector3) =>
  !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z);
if (invalidVec(from) || invalidVec(to)) {
  console.warn('[startTravel] invalid from/to vectors; forcing return-to-base');
  // Fallback: send drone back to factory
  drone.travel = null;
  drone.flightSeed = null;
  drone.state = 'returning'; // ← Still returning, not idle!
  drone.targetId = null;
  return; // Travel setup failed, drone never leaves
}
```

**The Issue:**

- Drone is set to `'returning'` state
- But `drone.travel = null` (no travel data)
- On next `assignReturnFactory()` call, it tries to start travel again with the same broken vectors
- Or if `targetFactoryId` is already set, it returns `null` (no assignment needed)
- Drone enters infinite loop in `'returning'` state with `travel = null`

---

### **Issue E: Factory Deleted While Drone Queued**

**Problem:** If a factory is deleted/removed while drone is in its queue:

```typescript
// In removeFactory():
const factories = state.factories.filter((f) => f.id !== factoryId);
// Drone remains in droneFlights, but factory doesn't exist!

// Next tick in assignReturnFactory():
const existing = state.factories.find(
  (item) => item.id === drone.targetFactoryId,
);
if (!existing) {
  state.undockDroneFromFactory(drone.targetFactoryId, drone.id);
  // ↑ This calls undock on a NON-EXISTENT factory!
}
```

**The Issue:**

- `undockDroneFromFactory()` uses `factories.findIndex()` to locate factory
- If factory doesn't exist, `index === -1`, function returns early
- Drone's `targetFactoryId` is never cleared
- On next tick, same check fails again
- **Drone is orphaned and can never dock anywhere**

---

### **Issue F: Docking Capacity Set to Zero**

**Problem:** If `dockingCapacity` is set to 0 (via bug or save corruption):

```typescript
// In assignReturnFactory():
const candidates = withDistances.filter((entry) => entry.available > 0);
// If dockingCapacity = 0 and queuedDrones.length > 0, available = 0
// Drone not added to candidates
```

**The Issue:**

- No factories have available slots
- Falls back to finding least-filled factory
- If all factories have `available <= 0`, drone queues anyway (fallback logic)
- But if some drones are already stuck waiting, new drones join waiting queue
- **As docks never free up (unload system never runs), waiting drones never get slots**

---

## 5. The Screenshot Issue

In the provided screenshot, I see:

- **5/5 docks (27 waiting)**
- Drones shown: `drone-f7`, `drone-d9`, `drone-f2`, `drone-f4`, `drone-f6`, `drone-121` (sand icon = waiting)

**Analysis:**

1. All 5 docking slots are full
2. 27 drones in waiting queue
3. `drone-121` is waiting (hourglass icon)
4. For waiting drones to become docked, one of the 5 must undock
5. **If the 5 docked drones are stuck in "returning" or other non-"unloading" states, they never undock**
6. **Waiting drones never get a docking slot**
7. **Cycle stalls indefinitely**

---

## 6. Key Findings & Potential Fixes

### **Root Cause Hypothesis:**

The most likely issue is **Issue A: Drone Never Enters "Unloading" State**

**Why:**

1. There's no visible code that transitions `'returning'` → `'unloading'`
2. The unload system only processes drones already in `'unloading'` state
3. If this transition is missing or conditional, drones stay in `'returning'` forever
4. Queue slots never free up

### **Secondary Suspects:**

1. **Issue B (Stuck Check)** - Conditional logic preventing undocking of improperly-stated drones
2. **Issue D (Invalid Vectors)** - Travel corruption causing state to be stuck in `'returning'`
3. **Issue E (Deleted Factory)** - Orphaned drones after factory removal
4. **Issue F (Zero Capacity)** - Upgrade or save bug setting capacity to 0

---

## 7. Investigation Checklist

- [ ] **Find the code that transitions `'returning'` → `'unloading'`**
  - Check movement/physics systems not captured in grep results
  - Check if it's distance-based, collision-based, or time-based
  - Verify this transition always happens

- [ ] **Verify unload system is called every tick**
  - Check `src/ecs/systems/` for all system definitions
  - Ensure unload system is registered and runs

- [ ] **Check travel completion logic**
  - How does `drone.travel.elapsed` get updated?
  - Does it account for dt passed to tick function?
  - Can it get stuck if dt is 0 or NaN?

- [ ] **Verify stuck-drone safety check**
  - Test if undocking actually removes drone from queue
  - Check if targetFactoryId is properly cleared

- [ ] **Test persistence round-trip**
  - Save game with drones in flight
  - Load and verify flight states are correctly restored
  - Check for NaN/Infinity in travel snapshots

---

## 8. UI Implications

The UI correctly shows the queue state:

- Shows count of docked vs. waiting
- Pagination works correctly (shows 6 per page)
- Drone icons indicate status

**But UI has no way to:**

- Manually undock a stuck drone
- See if a drone is in an invalid state
- Force a state transition

**Recommendation:** Add a debug UI option to:

1. Show drone state and targetFactoryId
2. Manually undock specific drones
3. See travel data (from/to positions, elapsed/duration)
4. Force state transitions for debugging
