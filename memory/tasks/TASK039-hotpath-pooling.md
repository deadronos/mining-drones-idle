# TASK039 - Hotpath Instancing & Pooling

**Status:** Completed
**Added:** 2025-11-02
**Updated:** 2025-11-02

## Original Request
Identify 3–5 hot paths in `/src` and use instancing/pooling/reuse to enhance performance.

## Thought Process
- Target render-heavy logistics visuals and simulation loops that allocate each frame.
- Prioritize pooling to cut GC churn while preserving UX (hover tooltips, highlights).
- Reuse maps/vectors/colors rather than cloning per transfer/hauler.

## Implementation Plan
- Pool transfer visuals and render shafts/heads via instanced meshes; keep hover mapping for tooltip/labels.
- Convert hauler visual computation to fill reusable pools (vectors/colors) while keeping labels/speeds accurate; adjust tests.
- Hoist and reuse the flight Map inside the drone AI system tick.
- Validate with `npm run typecheck`, `npm run lint`, and `npm run test`.

## Progress Tracking
**Overall Status:** Completed - 100%

### Subtasks
| ID  | Description                                      | Status       | Updated    | Notes |
| --- | ------------------------------------------------ | ------------ | ---------- | ----- |
| 1.1 | Pool and instance logistics transfer visuals     | Completed    | 2025-11-02 | Instanced shafts/heads with hover colors |
| 1.2 | Pool hauler visuals and adjust tests             | Completed    | 2025-11-02 | Reused pools + updated test harness |
| 1.3 | Reuse flight map in drone AI tick                | Completed    | 2025-11-02 | Map hoisted and cleared per tick |

## Progress Log
### 2025-11-02
- Captured requirements in DES032 and outlined pooling targets.
### 2025-11-03
- Instanced logistics shafts/heads off a pooled TransferVisual buffer with hover-aware colors/tooltips.
- Reworked hauler visual computation to reuse pooled vectors/colors/maps and updated tests for the new return shape.
- Hoisted the drone flight Map to reuse across AI ticks, eliminating per-frame allocations.
