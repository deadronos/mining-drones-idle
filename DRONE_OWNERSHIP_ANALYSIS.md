# Drone Ownership Bug Analysis

## Observation

- **Global Drones (ECS)**: 10 drones exist in the world
- **Owned Drones (UI)**: Shows 24 drones across 3 pages (8 per page)

## Root Cause: FOUND

### The Core Issue

**`dockDroneAtFactory()` does NOT initialize `ownedDrones`**, only `queuedDrones`.

When a drone is docked multiple times without being properly undocked:

```typescript
dockDroneAtFactory: (factoryId, droneId) => {
  // ... only modifies queuedDrones
  // Never touches ownedDrones!
};
```

But `undockDroneFromFactory` with `transferOwnership: true` adds to `ownedDrones`:

```typescript
undockDroneFromFactory: (factoryId, droneId, options) => {
  if (options?.transferOwnership) {
    // Adds droneId to ownedDrones on target factory
    ownedDrones: Array.from(
      new Set([...updated.ownedDrones.filter((id) => id !== droneId), droneId]),
    ),
  }
}
```

### The Real Scenario

**What happens during normal drone routing:**

1. Drone-1 calls `dockDroneAtFactory(Factory-A, Drone-1)`
   - Factory-A.queuedDrones = [Drone-1]
   - Factory-A.ownedDrones = [] (unchanged)

2. Drone-1 finishes unloading, calls `undockDroneFromFactory(Factory-A, Drone-1, {transferOwnership: true})`
   - Factory-A.queuedDrones = [] (removed)
   - Factory-A.ownedDrones = [Drone-1] ← **ADDED**
   - droneOwners: {Drone-1: "Factory-A"}

3. Drone-1 calls `dockDroneAtFactory(Factory-B, Drone-1)`
   - Factory-B.queuedDrones = [Drone-1]
   - Factory-B.ownedDrones = [] (unchanged)

4. Drone-1 finishes unloading, calls `undockDroneFromFactory(Factory-B, Drone-1, {transferOwnership: true})`
   - Should remove from Factory-A.ownedDrones and add to Factory-B.ownedDrones
   - The cleanup logic checks: `previousOwnerId = state.droneOwners["Drone-1"]` = "Factory-A"

**But here's the catch:** If drones are cycling through multiple dock/undock cycles at the SAME factory, or if the undocking is queued/batched, the state may not properly reflect previous ownership.

### Hypothesis: Race Condition or State Batching Issue

The problem might occur when:

- Multiple drones undock in the same frame
- The `previousOwnerId` tracking doesn't catch all scenarios
- Serialization/deserialization loses proper ownedDrones cleanup

## Related Code Paths

### Where Ownership Transfer Happens

- **Unload System** (`src/ecs/systems/unload.ts:74`): When drone finishes unloading at a factory
- **Called function** (`src/state/store.ts:428`): `undockDroneFromFactory` with `transferOwnership: true`
- **Docking** (`src/ecs/systems/droneAI.ts:246`): Calls `dockDroneAtFactory` but never handles ownership

### Data Structures Involved

1. **ECS World** (`gameWorld.droneQuery`)
   - Single source of truth for actual drones
   - Count = `modules.droneBay` (e.g., 10)

2. **Factory.ownedDrones** (UI display, per factory)
   - Array of drone IDs that "belong" to this factory
   - Should be mutually exclusive across factories

3. **droneOwners** (Zustand state)
   - Map from drone ID → factory ID that owns it
   - Intended as single source of truth but not fully enforced

## The Fix

The code SHOULD enforce a single-owner model where:

- Each drone can have at most one `ownerFactoryId`
- When a drone is owned by a factory, it's removed from all other factories' `ownedDrones` lists
- The `droneOwners` map is the single source of truth

**Current code attempts this but has subtle issues in the mutation/filter logic.**

## Recommended Investigation Steps

1. **Check drone lifecycle**: Does a single drone visit multiple factories in sequence?
2. **Add logging**: Log each `undockDroneFromFactory` call with drone ID and all factories' `ownedDrones` before/after
3. **Verify Set deduplication**: The `new Set()` should deduplicate, but check if it's actually working
4. **Check if ownedDrones is ever properly cleared**: Maybe the cleanup logic isn't running

## Files to Examine

- `src/ecs/systems/unload.ts` - Where ownership transfer is initiated
- `src/state/store.ts` lines 400-415 (dockDroneAtFactory) - Missing ownedDrones initialization
- `src/state/store.ts` lines 428-451 (undockDroneFromFactory) - Where ownership transfer logic lives
- `src/state/serialization.ts` - Ensure ownership state persists correctly
- `src/ui/FactoryManager.tsx` lines 193-201 - Where `ownedDrones` is displayed

## Key Findings

### What's Missing

1. **`dockDroneAtFactory` does NOT populate `ownedDrones`**: It only adds to `queuedDrones`. The `ownedDrones` array remains empty until a drone unloads with `transferOwnership: true`.

2. **No cleanup when docking**: If a drone that was previously owned by another factory docks at a new one, the old ownership is only cleaned up on undock, not on dock.

3. **Potential accumulation**: If a drone docks multiple times at the same factory without proper cleanup between cycles, it could accumulate in `ownedDrones`.

### The Correct Behavior Should Be

- `queuedDrones`: Tracks drones that are currently at the factory (active dock + waiting queue)
- `ownedDrones`: Tracks drones that have been docked and unloaded here (persistent ownership)
- When a drone unloads: transfer ownership, remove from all other factories

**Current implementation** attempts this but the separation between "docked" (queuedDrones) and "owned" (ownedDrones) is ambiguous.
