# DES023 — Drone Distribution & Storage Buffer Display

**Status**: ✅ Completed  
**Date**: 2025-10-25

## Executive Summary

Improved drone distribution across multiple factories and enhanced visibility into resource logistics by:

1. Changing drone return factory selection to prioritize factories with **least-filled docking slots** (instead of nearest-first)
2. Adding **buffer reserve displays** to the factory storage panel showing logistics targets for each resource

This resolves the hoarding problem where one factory would accumulate drones and resources while others starved.

---

## Problem Statement

### Issue 1: Drone Clustering

**Symptom**: One factory receives all mining drones; docking queue reaches 30+ waiting while other factories have empty docks.

**Root Cause**: Factory selection algorithm prioritized **nearest** factory first. If Factory 0 was the drone spawn point, all drones would return there by default, creating a positive feedback loop.

**Impact**:

- Resources concentrate in one factory
- Other factories cannot keep refineries fed
- Uneven load distribution

### Issue 2: Opaque Resource Targets

**Symptom**: Players couldn't tell if a factory was hoarding surplus or legitimately needed resources.

**Root Cause**: No visibility into what the logistics system considered "surplus" vs. "needed".

**Impact**:

- Players don't understand why haulers aren't redistributing
- Can't debug resource starvation issues
- Feedback loop is unclear

---

## Solution Design

### 1. Drone Assignment Algorithm Change

**File**: `src/ecs/systems/droneAI.ts` → `assignReturnFactory()`

**Previous Logic**:

1. Filter factories with available docks
2. Sort by distance (nearest first)
3. Apply random variety (20% chance to pick weighted alternative)

**New Logic**:

1. Filter factories with available docks
2. Sort by docking occupancy (least-filled first), break ties by distance
3. Apply random variety (20% chance to pick weighted alternative)

**Implementation**:

```typescript
candidates.sort((a, b) => {
  const occupiedA = a.queueLength;
  const occupiedB = b.queueLength;
  if (occupiedA !== occupiedB) {
    return occupiedA - occupiedB; // Prefer less-filled docking
  }
  return a.distance - b.distance; // Break ties by distance
});
```

**Result**: Drones naturally distribute across all available factories, preventing clustering.

### 2. Buffer Target Display in UI

**File**: `src/ui/FactoryManager.tsx` → Storage section

**New Display Format**:

```text
Ore:          42,172 / 1,050  (buf: 75)
Bars:         65,110          (buf: 5)
Metals:       35,583          (buf: 20)
Crystals:     29,452          (buf: 20)
Organics:     46,241          (buf: 20)
Ice:          57,487          (buf: 20)
Credits:      0
```

**Buffer targets** show the "ideal" local inventory level:

- **Ore**: Consumption-based (refinery slots × time)
- **Bars**: Minimal (5 units)
- **Others**: Conservative (20 units)

**Player insight**:

- If `current > buffer`: Factory has surplus → haulers will export
- If `current < buffer`: Factory needs more → haulers will import
- If `current ≈ buffer`: Factory is balanced

---

## Data Model Changes

### storageEntries Memoization

Added `bufferTarget` property computed per resource:

```typescript
{
  key: 'ore',
  label: 'Ore',
  amount: 42172,
  display: '42,172 / 1,050',
  bufferTarget: 75  // ← New
}
```

---

## Acceptance Criteria

- ✅ Drones distribute more evenly across factories (no single factory dominant)
- ✅ Buffer targets display in factory storage panel
- ✅ No regressions in existing tests
- ✅ TypeScript compilation clean
- ✅ Linting passes

---

## Testing

- ✅ Unit tests: All 158 tests passed
- ✅ TypeScript: No errors
- ✅ Linting: No errors

---

## Files Modified

| File                         | Change                                         |
| ---------------------------- | ---------------------------------------------- |
| `src/ecs/systems/droneAI.ts` | Modified `assignReturnFactory()` sorting logic |
| `src/ui/FactoryManager.tsx`  | Added buffer target import + display           |

---

## Follow-Up / Polish

- Monitor drone distribution metrics in telemetry
- Consider visualizing buffer/current/surplus levels (e.g., progress bar)
- Tune buffer targets if players report over/under-stocking
