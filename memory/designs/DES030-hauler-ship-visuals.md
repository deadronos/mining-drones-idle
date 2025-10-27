# DES030: Hauler Ship Visuals – Replacing Transfer Lines

**Status:** Implemented
**Design Date:** 2025-10-26  
**Relates to:** Visual enhancement epic  
**Component:** `/src/r3f/TransferLines.tsx` → `/src/r3f/HaulerShips.tsx`

## Overview

Currently, transfers between factories and warehouse are visualized as **arrowed cylindrical lines** ("transfer lines"). This design proposes replacing those static lines with **animated hauler ships** that fly along the transfer path, creating a more dynamic and immersive visual experience.

---

## Executive Summary

**Goal:** Replace transfer line visuals with animated hauler ships that:

- Travel from source to destination following the transfer's ETA
- Display resource type via color and visual distinction
- Show directional movement with orientation
- Maintain performance with instancing for many concurrent transfers
- Preserve hover tooltip interaction and transfer information

**Key Design Decisions:**

1. Use instanced meshes to render many haulers efficiently (similar to Drones.tsx)
2. Compute interpolated position based on `gameTime` and transfer `eta`
3. Reuse asset cache and color system from existing TransferLines
4. Define hauler geometry (ship silhouette) as a simple gltf/primitive mesh
5. Keep interaction layer (hover tooltips) via raycast/HTML overlay

**Scope:**

- Replace visual representation in Scene
- Add new HaulerShips component
- Retain PendingTransfer data model (no store changes)
- No changes to logistics logic

---

## Requirements

### Functional Requirements

**RQ-01:** Each `PendingTransfer` with status `'scheduled'` or `'in-transit'` must render as a visible hauler ship in 3D space.

**RQ-02:** Hauler ships must animate along an arcing **Bezier curve** from source to destination, with position interpolated based on:

- Transfer start time (when `status` transitioned to `'in-transit'`)
- Transfer ETA (end time)
- Current `gameTime`
- Path should arc for visual interest and variety

**RQ-03:** Hauler ships must be colored by resource type using the existing `RESOURCE_COLORS` palette from TransferLines.tsx.

**RQ-04:** Hauler ships must orient to **always face the direction of travel** (forward vector points along current trajectory).

**RQ-05:** Hauler ships must support hover interaction to display a tooltip with source→destination, resource, amount, and ETA remaining.

**RQ-06:** Hauler ships must degrade gracefully if count exceeds a reasonable limit (e.g., 256 concurrent transfers).

### Non-Functional Requirements

**NR-01:** Performance: instanced rendering must maintain ≥60 FPS with ≤100 concurrent transfers on typical hardware.

**NR-02:** Visual quality: hauler ship geometry must be recognizable and distinct from the old transfer lines.

**NR-03:** Compatibility: changes must not break existing store, logistics, or test suites.

---

## Architecture & Design

### Component Structure

```typescript
Scene.tsx
  ├─ imports HaulerShips (replaces TransferLines)
  └─ <HaulerShips />

HaulerShips.tsx (new)
  ├─ useFrame hook: update instanced mesh transforms each frame
  ├─ useHover: track which hauler is hovered for tooltip
  ├─ useMemo: compute visual list from store
  └─ render: instanced mesh + HTML tooltip overlay
```

### Data Flow

1. **Store Update** (Zustand tick cycle)
   - `logisticsQueues.pendingTransfers` updated by logistics processing
   - Each transfer has `id`, `fromFactoryId`, `toFactoryId`, `resource`, `amount`, `status`, `eta`

2. **HaulerShips Component**
   - Reads: `gameTime`, `logisticsQueues`, `factories`
   - Computes: visual list with interpolated positions
   - Renders: instanced mesh for all haulers, tooltip for hovered hauler

3. **Interaction**
   - Raycast on mouse over: pick instanceId
   - Lookup transfer by instanceId and display tooltip

### Visual Design

#### Hauler Ship Mesh

**Decision: Procedural Geometry** (selected)

- Simple capsule or cone-based hull
- Small fin or engine glow for direction indicator
- Built inline without external assets
- **Slightly larger than drones** (~0.4–0.6 units) to feel like a cargo vessel

#### Appearance Details

| Property | Value                                   | Notes                                             |
| -------- | --------------------------------------- | ------------------------------------------------- |
| Scale    | **0.4–0.6 units**                       | **Larger than drones** to feel like cargo hauler  |
| Rotation | Face travel direction                   | Quaternion from Bezier curve tangent              |
| Color    | **Resource-specific** (RESOURCE_COLORS) | Distinct from drones; reuse TransferLines palette |
| Opacity  | 0.8 (full)                              | Slight transparency for layering                  |
| Glow     | emissiveIntensity 0.5–0.7               | Increased on hover                                |
| Trail    | **Yes** (particle engine effect)        | Engine/thruster trail from rear                   |

#### Interpolation Strategy

**Bezier Arc Path:**

- Compute transfer duration from `PendingTransfer` metadata (aligned with active transfer setup)
- Use Cubic Bezier with control points to create natural arcing motion
- Control points elevated ~1.5× the midpoint height to create visual variety
- Smooth interpolation: `currentProgress = clamp((gameTime - startTime) / duration, 0, 1)`

```typescript
// Bezier arc trajectory
const P0 = sourcePos; // Start
const P1 = sourcePos + controlOffset1; // Control point 1 (elevated)
const P2 = destPos + controlOffset2; // Control point 2 (elevated)
const P3 = destPos; // End
const haulerPosition = cubicBezier(P0, P1, P2, P3, progress);
```

---

## Data Model & State

### No Store Changes Required

The existing `PendingTransfer` interface is sufficient:

```typescript
export interface PendingTransfer {
  id: string;
  fromFactoryId: string;
  toFactoryId: string;
  resource: TransportableResource;
  amount: number;
  status: 'scheduled' | 'in-transit' | 'completed';
  eta: number; // end time in gameTime units
}
```

**Rationale:** `eta` field already records expected arrival. Transfer duration can be derived from how "active transfers" are set up in the current logistics system.

### Transfer Duration Source

**Decision:** Orient duration calculation from existing active transfer setup.

- Extract transfer start time from logistics queue initialization
- Compute: `duration = transfer.eta - transfer.startTime`
- If start time unavailable, use a fallback constant (e.g., 5 seconds)
- This aligns with existing hauler travel time expectations in the game balance

---

## Implementation Plan

### Phase 1: Component Scaffold & Procedural Geometry

1. Create `/src/r3f/HaulerShips.tsx` with basic structure
2. Define procedural capsule/cone-based hauler mesh (~0.5 units)
3. Implement `useFrame` loop with instanced mesh rendering
4. Set base material with resource-specific colors (RESOURCE_COLORS)

### Phase 2: Bezier Arc & Position Interpolation

1. Extract transfer duration from active transfer metadata
2. Compute Bezier control points for arcing path (elevated midpoint)
3. Interpolate position and tangent vector for orientation
4. Update instanced matrix transforms each frame

### Phase 3: Orientation & Visual Polish

1. Compute quaternion from Bezier tangent (face direction of travel)
2. Add particle/trail effect from hauler rear (engine exhaust)
3. Apply resource-specific color and emissive intensity
4. Verify scale (~0.5 units) appears distinct from drones

### Phase 4: Interaction, Hover & Tooltips

1. Implement raycast picking on mouse move
2. Display styled HTML tooltip (matching TransferLines style)
3. **Highlight source and destination factories on hover**
4. **Show ETA, speed, and transfer info in tooltip**

### Phase 5: Performance & Limits

1. **Cap rendering at 256 haulers (configurable constant)**
2. **Continue calculating transfers above cap (not visible)**
3. Test with high transfer volumes (stress test)
4. Performance profiling and optimization

### Phase 6: Settings Toggle & Testing

1. **Add "Show Hauler Ships" toggle to Settings panel**
2. **Fall back to TransferLines when toggle is disabled**
3. Unit tests for Bezier interpolation and position math
4. E2E tests for interaction and tooltip display
5. Manual validation of animation smoothness and performance

---

## Open Questions for User Feedback

### A. Hauler Geometry

1. Procedural vs. Asset?
   - Should we use a simple capsule/cone (fastest, minimal code) or load a gltf model (better visuals)?
   - Any preference on silhouette (sleek shuttle, bulky freighter, generic pod)?

2. Scale and Distinctness
   - Should haulers be approximately the same size as drones (~0.3–0.5 units) or larger/smaller?
   - Should they have a distinct visual marker (e.g., thruster glow, trail) to differentiate from drones?

### B. Movement & Animation

1. Transfer Duration
   - Is there an existing duration constant for hauler travel time? Or should we compute it from distance + speed?
   - Should all transfers take the same time, or should duration vary by distance/amount?

2. Path Interpolation
   - Straight line (lerp) or smooth curve (Bezier)?
   - Should the path arc slightly above the direct line to feel more "flight-like"?

3. Orientation
   - Always face direction of travel (recommend)?
   - Or should haulers have a fixed orientation with only position animating?

### C. Interaction & Tooltips

1. Hover Targeting
   - Keep the existing HTML-overlay tooltip style?
   - Should hovering a hauler highlight the connected factories (visual breadcrumb)?

2. Tooltip Content
   - Show the same info as TransferLines (source → dest, amount, resource, ETA)?
   - Add estimated remaining travel time or speed?

### D. Performance & Limits

1. Instancing Cap
   - 256 concurrent haulers (current instancing limit)?
   - If exceeded, degrade by hiding oldest/lowest-priority transfers?

2. LOD (Level of Detail)
   - At high transfer volumes, should we simplify geometry (lower-poly mesh) or use fewer vertices?
   - Should haulers fade out if far from camera?

### E. Visual Polish

1. Trails & Particles
   - Add a subtle particle trail or glow trail behind moving haulers?
   - Should trail color match resource type?

2. Resource-Specific Variations
   - Should hauler appearance subtly change per resource (e.g., ore vs. crystals haulers look different)?
   - Or keep them unified with only color differentiation?

### F. Backwards Compatibility & Phasing

1. Toggle
   - Should the old transfer lines be available as a fallback or toggle in Settings?
   - Or commit fully to the new hauler ships visuals?

2. Timeline
   - Is this a blocker for the next release, or a polish task for future iteration?

---

## Success Criteria

- [ ] Hauler ships render and animate correctly for all transfer statuses
- [ ] Tooltip interaction works smoothly (no jank on hover)
- [ ] Performance maintained at ≥60 FPS with 50+ concurrent transfers
- [ ] Visual appearance feels distinct from old transfer lines
- [ ] All existing tests pass (backward compatibility)
- [ ] New tests added for interpolation logic and interaction

---

## Risks & Mitigations

| Risk                                          | Likelihood | Impact | Mitigation                                                          |
| --------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------- |
| Instanced mesh rendering complexity           | Medium     | High   | Use existing Drones.tsx as reference; start with simple geometry    |
| Performance regression at high transfer count | Medium     | High   | Implement culling / LOD early; profile with stress test             |
| Interaction picking fails on complex geometry | Low        | Medium | Test raycast with different mesh densities; add debug visualization |
| Asset loading delays                          | Low        | Medium | Use procedural geometry; avoid external files initially             |

---

## Future Enhancements

1. **Destruction/Repair Mechanics:** Haulers could have HP and be "damaged" by collisions or solar flares, adding gameplay depth.
2. **Cargo Visualization:** Show cargo inside hauler (glow intensity or texture detail by resource).
3. **Fleet Effects:** Multiple haulers on same route could form a convoy or show emergent swarm behavior.
4. **Customization:** Player could paint/upgrade hauler appearances as a cosmetic progression.

---

## Attachments & References

- **Current Implementation:** `/src/r3f/TransferLines.tsx`
- **Drones Reference:** `/src/r3f/Drones.tsx` (instancing pattern)
- **Asset Cache:** `/src/r3f/assetCache.ts`
- **Color Palette:** TransferLines.RESOURCE_COLORS
- **Store Types:** `/src/state/types.ts` → PendingTransfer, LogisticsQueues

---

## Decision Log

### 2025-10-26 – Design Finalized with User Decisions

**Geometry:**

- Selected procedural geometry (capsule/cone-based hull)
- Slightly larger than drones (0.4–0.6 units) to feel like cargo hauler
- Resource-specific coloring from RESOURCE_COLORS palette

**Animation:**

- Bezier arc paths (cubic curves) for visual variety
- Control points elevated for natural flight arc
- Always face direction of travel (quaternion from curve tangent)

**Interaction:**

- Styled tooltips matching TransferLines (with highlight of source/dest factories)
- Show ETA and speed info from active transfer metadata

**Performance & Settings:**

- Cap rendering at 256 haulers (configurable), still process above cap
- Add "Show Hauler Ships" toggle to Settings panel
- Fall back to TransferLines when disabled

**Scope & Timeline:**

- Blocker for next release
- Particle engine trails for visual polish
- Resource-specific variations translate from TransferLines

**Next Step:** Create TASK file with detailed implementation plan and proceed to Phase 1.
