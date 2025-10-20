# Resource Distribution Analysis

## Overview

This document explains how drones decide which factory to return to when mining, and how the hauler logistics system is supposed to distribute resources across factories and the warehouse.

---

## Part 1: Drone Return Factory Selection

### Entry Point: When does a drone decide to return?

**File**: `src/ecs/systems/mining.ts` (lines ~48)

When a drone is mining, it accumulates cargo. It transitions to "returning" state when:

1. **Cargo is full**: `drone.cargo >= drone.capacity - 0.01` (essentially at capacity)
2. **Asteroid depleted**: `asteroid.oreRemaining <= 0.01` (no more ore to mine)
3. **Energy insufficient**: `fraction <= 0` (drone battery too low to continue)

When any of these conditions occur:

```typescript
drone.state = 'returning';
drone.targetId = null;
drone.targetRegionId = null;
drone.travel = null;
drone.targetFactoryId = null; // ← Reset, will be reassigned
```

### Factory Assignment Logic

**File**: `src/ecs/systems/droneAI.ts` (lines 252-340)

Function: `assignReturnFactory(drone)`

#### Step 1: Check existing assignment

If the drone already has a `targetFactoryId` and that factory still has a slot available for this drone, keep heading there. Otherwise, clear the old assignment.

```typescript
if (drone.targetFactoryId) {
  const existing = state.factories.find(
    (item) => item.id === drone.targetFactoryId,
  );
  if (existing) {
    const queueIndex = existing.queuedDrones.indexOf(drone.id);
    if (queueIndex !== -1 && queueIndex < existing.dockingCapacity) {
      return { targetId: existing.id, position: existing.position.clone() };
    }
  }
}
```

#### Step 2: Calculate distances to all factories

```typescript
const withDistances = state.factories.map((factory) => {
  const distance = drone.position.distanceTo(factory.position);
  const occupied = Math.min(
    factory.queuedDrones.length,
    factory.dockingCapacity,
  );
  const available = Math.max(0, factory.dockingCapacity - occupied);
  return {
    factory,
    distance,
    available,
    queueLength: factory.queuedDrones.length,
  };
});
```

#### Step 3: Filter factories with available docking slots

Only consider factories that have open docking slots:

```typescript
const candidates = withDistances.filter((entry) => entry.available > 0);
```

#### Step 4: Smart selection with randomness

**If there ARE candidates with open slots:**

```typescript
candidates.sort((a, b) => a.distance - b.distance);
selected = candidates[0]; // Default: nearest
if (candidates.length > 1 && rng.next() < FACTORY_VARIETY_CHANCE) {
  // With some probability, pick a weighted-random alternative
  const others = candidates.slice(1);
  const weights = others.map(
    (entry) => 1 / Math.max(entry.distance, FACTORY_WEIGHT_EPSILON),
  );
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let roll = rng.next() * totalWeight;
  for (let i = 0; i < others.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      selected = others[i];
      break;
    }
  }
}
```

What this means:

- **Primarily**: Pick the nearest factory
- **With probability `FACTORY_VARIETY_CHANCE`** (~20%?): Pick an alternative factory, weighted inversely by distance
- This creates variety and prevents all drones from flocking to one factory

**If NO candidates with open slots:**

```typescript
selected = withDistances.reduce<(typeof withDistances)[number] | null>(
  (best, entry) => {
    if (!best) return entry;
    if (entry.queueLength < best.queueLength) return entry;
    if (
      entry.queueLength === best.queueLength &&
      entry.distance < best.distance
    ) {
      return entry;
    }
    return best;
  },
  null,
);
```

- Find factory with shortest queue
- Break ties by distance (nearest wins)
- Even if all slots are full, drones will queue

#### Step 5: Attempt to dock

```typescript
const result = state.dockDroneAtFactory(selected.factory.id, drone.id);
```

- If successful ("docking" or "queued"), record `drone.targetFactoryId = selected.factory.id`
- Drone travels to that factory

### Key Constants

Look for:

- `FACTORY_VARIETY_CHANCE` — probability of picking a non-nearest factory
- `FACTORY_WEIGHT_EPSILON` — minimum distance for weighting calculations

These control how "spread out" drone returns are vs. always going to the nearest factory.

---

## Part 2: Resource Distribution System

### Current State

**Two-Layer Inventory System:**

1. **Global warehouse** (`state.resources.*`) — Central pool of all resources
2. **Per-factory storage** (`factory.resources.*`) — Local buffers at each factory

**Problem**: Drones unload ore into their assigned factory's storage. If one factory gets all the drones, it hoards ore while others starve.

### Hauler Logistics System

**File**: `src/state/processing/logisticsProcessing.ts`

The hauler system is a **reservation-based scheduler** that runs each tick to:

1. Identify factories with surplus resources
2. Identify factories with resource needs
3. Schedule "transfer" drones to move resources between factories/warehouse

#### How It's Supposed to Work

##### Phase 1: Calculate Current State

```typescript
const warehouseStock = state.resources[resource]; // Global warehouse stock
const factoryStock = factory.resources[resource]; // Local factory stock
const target = computeBufferTarget(factory, resource); // Target amount
const minReserve = computeMinReserve(factory, resource); // Never drop below
```

##### Phase 2: Identify Surplus vs. Need

```typescript
matchSurplusToNeed(state.factories, resource, state.gameTime);
```

This function (in `src/ecs/logistics.ts`) finds:

- **Surplus factories**: `current > target + minReserve`
- **Needy factories**: `current < target`
- Returns proposed transfers between them

##### Phase 3: Make Reservations

```typescript
reserveOutbound(sourceFactory, resource, transfer.amount);
```

- Mark the amount as "reserved" so it's not double-counted
- Prevents race conditions where two haulers try to grab the same ore

##### Phase 4: Schedule Hauler Transfer

```typescript
updatedQueues.pendingTransfers.push({
  id: transferId,
  fromFactoryId,
  toFactoryId,
  resource,
  amount,
  eta: state.gameTime + travelTime, // Scheduled completion time
});
```

- Each transfer gets an ETA (estimated time of arrival)
- Factories are added to a queue of pending transfers

##### Phase 5: Execute On Arrival

```typescript
executeArrival(transfer, state);
```

- When ETA is reached, resources are moved
- Reservations are released

#### Key Functions (in `src/ecs/logistics.ts`)

| Function                | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `matchSurplusToNeed()`  | Find best surplus/needy pairs for a resource |
| `computeBufferTarget()` | Calculate ideal local stock for a factory    |
| `computeMinReserve()`   | Calculate minimum never-drop-below amount    |
| `reserveOutbound()`     | Mark factory amount as reserved              |
| `executeArrival()`      | Move resources when transfer arrives         |

---

## Part 3: Why One Factory Might Hoard

### Likely Causes

1. **No haulers assigned** or **first factory has 1 hauler but others have 0**
   - Hauler system only activates when `networkHasHaulers === true`
   - If only Factory 1 has 1 hauler, it can only redistribute from that factory

2. **Drones keep choosing the nearest factory**
   - If most drones spawn at/near one factory, they'll keep returning to it
   - Even with `FACTORY_VARIETY_CHANCE`, the default is still "nearest first"

3. **Hauler capacity too small**
   - Default hauler capacity: 50 units per trip
   - If a factory is gaining 100+ ore/sec, and hauler can only move 50/trip every 2+ seconds, it can't keep up

4. **Buffer targets miscalculated**
   - If surplus threshold is set too high, factories won't export
   - Formula: `current > target + minReserve`

5. **Warehouse space full**
   - If warehouse capacity is reached, export transfers stop
   - Resources stay local at factories that have docking space

### Indicators to Look For

From your screenshots:

- **Factory 1**: 42.172 bars, 21.635 metals, etc. (high)
- **Factory 2**: Lower amounts (starving?)
- **Docking queue**: "34 waiting" suggests drones are queued, likely at one factory
- **Haulers active**: Shows in UI that transfers are happening, but still one factory ahead

---

## Part 4: How Resource Distribution Is Supposed to Work

### Flow Diagram

```text
Miners (drones mining)
  ↓
  → Drone full → Return to nearest factory (with variety)
  ↓
Factory receives ore
  ├─ Stores in factory.resources.ore
  └─ Refined to bars (consumes energy)
  ↓
Hauler scheduler tick (every 2 seconds)
  ├─ Check each factory: `current > target?`
  ├─ If yes: Reserve surplus, schedule export to warehouse
  └─ Check each factory: `current < target?`
      └─ If yes & warehouse has stock: Schedule import from warehouse
  ↓
Hauler transfer (moves resources)
  ├─ Source factory: outbound reservation
  ├─ Dest factory/warehouse: inbound
  └─ On arrival: Move resources, release reservations
  ↓
Global warehouse state.resources.*
  ↓
Display (HUD shows warehouse + factory summary)
```

### Key Insight: Factories ≠ Warehouse

- **Factories** hold local ore for processing and local use
- **Warehouse** is the central redistribution hub
- **Haulers** act as the transport layer between them
- **Drones** only deliver to their assigned factory, not the warehouse

### Current Implementation Status

✅ **Implemented:**

- Drone return assignment (nearest + variety)
- Docking queue system
- Per-factory storage
- Hauler assignment UI (add/remove buttons)

⚠️ **Partially Implemented:**

- Hauler scheduler (code exists but may have bugs)
- Reservation system (basic logic in place)
- Buffer target calculations

❓ **May Have Issues:**

- Buffer target math (is it too high/low?)
- Hauler cost progression (are they affordable?)
- Warehouse export/import thresholds
- Global resource totals (double-counting?)

---

## Next Steps to Debug

1. **Check drone spawning logic** (`src/ecs/systems/fleet.ts`)
   - Do all new drones spawn near Factory 1?
   - What's the initial drone distribution?

2. **Verify buffer targets** (`src/ecs/logistics.ts`)
   - Print `computeBufferTarget()` for each factory/resource
   - Is the surplus threshold reasonable?

3. **Check hauler assignments**
   - Are haulers actually assigned to factories 2+?
   - Only Factory 1 should start with 1 free hauler

4. **Monitor logistics scheduler**
   - Are transfers being proposed correctly?
   - Are reservations blocking transfers?
   - Are transfers executing on time?

5. **Examine warehouse capacity**
   - Is it full, causing backlog?
   - Are exports to warehouse actually happening?

---

## Files to Review for Debugging

| File                                          | Purpose                                     |
| --------------------------------------------- | ------------------------------------------- |
| `src/ecs/systems/droneAI.ts`                  | Drone return factory selection              |
| `src/ecs/systems/mining.ts`                   | When drone goes into "returning" state      |
| `src/state/processing/logisticsProcessing.ts` | Hauler scheduler main loop                  |
| `src/ecs/logistics.ts`                        | Matching, reservations, buffer calculations |
| `src/state/factory.ts`                        | Factory creation & initialization           |
| `src/state/processing/factoriesProcessing.ts` | Per-tick factory operations                 |
| `src/ui/FactoryManager.tsx`                   | UI showing factory state                    |
