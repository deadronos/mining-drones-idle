# DES032 – Render/Simulation Hotpath Pooling

## Summary
Optimize several hot paths by replacing per-frame allocations with pooled/instanced representations. Focus areas:
- Logistics transfer lines (rendered cylinders/cones)
- Hauler ship path visuals
- Drone AI flight map construction

## Requirements (EARS)
1. WHEN logistics transfers are rendered, THE SYSTEM SHALL draw shafts and arrowheads via pooled instanced meshes instead of per-transfer meshes to reduce draw and allocation overhead. *Acceptance: inspect TransferLines instancing usage and ensure instance counts reflect queued transfers.*
2. WHEN hauler visuals are recomputed, THE SYSTEM SHALL reuse Vector3/Color storage across frames to avoid per-transfer allocations. *Acceptance: `computeVisuals` consumes a reusable pool without cloning vectors and still returns correct labels/speeds.*
3. WHEN the drone AI tick runs, THE SYSTEM SHALL reuse the drone-flight lookup structure instead of recreating it every update. *Acceptance: travel sync continues to function while the same Map instance is cleared/reused per tick.*

## Design
- **TransferLines instancing:**
  - Maintain a preallocated pool of `TransferVisual` objects (Vector3/Quaternion/Color) capped to a safe maximum (e.g., 256 transfers).
  - Reuse a factory Map to resolve endpoints and write transforms into two InstancedMeshes (shaft + head). Update matrices/colors only when inputs change; hover state tweaks color in-place.
  - Preserve hover tooltips by mapping transfer ids to instance indices.
- **Hauler visual pooling:**
  - Convert `computeVisuals` to fill a reusable pool rather than allocating vectors/colors per transfer. Keep factory map reusable; expose count + slice helper for consumers/tests.
  - Reuse Color pool for base colors to avoid per-effect allocations.
- **Drone AI map reuse:**
  - Hoist flight Map outside system step; clear and repopulate each tick to eliminate per-frame Map creation.

## Implementation Plan
- Add TASK039 tracking file and update `memory/tasks/_index.md` + `activeContext.md`.
- Implement pooled instanced TransferLines with hover-aware coloring and tooltip support.
- Refactor hauler `computeVisuals` to use object pools; adjust consumers/tests.
- Reuse flight Map in `createDroneAISystem` tick loop.
- Run lint, typecheck, and tests.
