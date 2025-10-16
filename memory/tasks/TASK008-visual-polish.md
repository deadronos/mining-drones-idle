# TASK008 - Visual Polish (Trails First)

**Status:** Pending  
**Added:** 2025-10-16  
**Updated:** 2025-10-16

## Original Request

Add drone trails, factory visuals, and scanner highlights with performance toggles (Milestone 5).

## Thought Process

Prototype trails in `src/r3f/Drones.tsx` using instancing or Drei `Trail`, add Settings toggles, and measure performance.

## Implementation Plan

1. Implement trails prototype and performance test.
1. Add Settings toggle and defaults.
1. Iterate on factory visuals and scanner highlights.

## Subtasks

| ID | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 8.1 | Trails prototype | Not Started | 2025-10-16 | `src/r3f/Drones.tsx` uses instancing but no trail implementation present. |
| 8.2 | Settings toggle | Not Started | 2025-10-16 | Settings UI contains general toggles but no trail-specific toggle implemented. |
| 8.3 | Factory visuals | Not Started | 2025-10-16 | Factory visual improvements remain to be implemented. |

## Acceptance Criteria

- Effects render smoothly and can be disabled for low-spec devices.

## Progress Log

### 2025-10-16

- Verified: instanced drone rendering exists (`src/r3f/Drones.tsx`). Trails and additional visual polish remain TODO.
