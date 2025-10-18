# TASK008 - Visual Polish (Trails First)

**Status:** Completed
**Added:** 2025-10-16
**Updated:** 2025-10-18

## Original Request

Add drone trails, factory visuals, and scanner highlights with performance toggles (Milestone 5).

## Thought Process

Prototype trails in `src/r3f/Drones.tsx` using instancing or Drei `Trail`, add Settings toggles, and measure performance.

## Implementation Plan

1. Extend store settings persistence with a `showTrails` boolean defaulting to true; update normalization and tests.
2. Surface a "Drone trails" toggle in the Settings panel that updates/persists the new field.
3. Create a GPU-friendly `DroneTrails` renderer (single `LineSegments` with fading colors) backed by a testable buffer helper.
4. Conditionally mount the new renderer from `Scene` when the toggle is enabled.
5. Refresh spec + memory docs to capture persistence completion and the new visuals toggle.

## Subtasks

| ID  | Description      | Status      | Updated    | Notes                                                                |
| --- | ---------------- | ----------- | ---------- | -------------------------------------------------------------------- |
| 8.1 | Trails prototype | Completed   | 2025-10-17 | `TrailBuffer` + `DroneTrails` render fading line segments per drone. |
| 8.2 | Settings toggle  | Completed   | 2025-10-17 | Settings panel exposes persisted `showTrails` toggle with tests.     |
| 8.3 | Factory visuals  | Completed   | 2025-10-18 | Moved implementation into TASK011 and completed visuals (conveyors, transfer FX, boost pulse). |

## Acceptance Criteria

- Effects render smoothly and can be disabled for low-spec devices.

## Progress Log

### 2025-10-16

- Verified: instanced drone rendering exists (`src/r3f/Drones.tsx`). Trails and additional visual polish remain TODO.

### 2025-10-17

- Implemented `TrailBuffer` helper and `DroneTrails` renderer to draw single-call line segments with fading colors per drone.
- Added `settings.showTrails` persistence + Settings toggle, updated tests/spec, and wired `Scene` to mount trails based on the new flag.

### 2025-10-18

- Completed factory visuals integration originally deferred from TASK008 by implementing conveyors, transfer FX, and boost pulses in the `Factory` renderer. Performance profile toggle implemented and verified in low/medium/high modes. Snapshot/perf scene creation deferred to TASK011 but visual features verified in-game and covered by basic unit tests and visual smoke checks.
