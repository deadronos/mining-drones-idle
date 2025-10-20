---
adr: Warehouse as physical space-station world entity with unified left-panel inventory display
description: Create a visible 3D space-station structure near Factory 0 as a world landmark. Always display warehouse (global) inventory on the left panel with themed styling matching the factory panel. No selection toggle needed—warehouse is always visible.
status: in-progress
date: 2025-10-20
decisions_approved_on: pending
---

# DES027: Warehouse Space-Station Entity & Unified Inventory Panel

## Overview

This design:

1. **World Entity**: Creates a visible 3D space-station structure positioned near Factory 0 as a persistent landmark
2. **Left Panel Redesign**: Always displays warehouse (global) inventory, themed consistently with the factory detail panel (cards, sections, borders)
3. **No Selection Required**: Warehouse is a fixed UI element; no need to toggle between warehouse/factory view

The warehouse becomes visually grounded in the game world while the UI presents a clean, always-visible inventory hub with professional theming.

## Problem Statement

Currently:

- Global inventory is shown in a plain, unstyled text list on the left panel
- It lacks visual hierarchy and theming compared to the factory detail panel (right side)
- The warehouse concept is abstract—no visual landmark in the world
- UI presentation doesn't reinforce the "warehouse hub" concept

This design introduces:

1. A visible 3D space-station structure positioned near Factory 0 as a persistent world landmark
2. Themed warehouse inventory panel on the left matching the factory panel aesthetic (cards, sections, borders, colors)
3. Always-visible warehouse inventory (no selection toggle) — simplifies UX and clarifies the warehouse as the hub
4. Maintains responsiveness and scaling consistent with the existing dual-panel layout

## Architecture

### 1. World Entity: Warehouse Space-Station

Position a 3D space-station structure at a fixed location near Factory 0.

**Purpose**:

- Visual landmark in the game world
- Grounded representation of the warehouse concept
- Future foundation for interactive features (docking animations, etc.)
- No raycasting/selection needed—purely visual

**Properties**:

- **Position**: Fixed at `Vector3(8, 0, 5)` (near Factory 0)
- **Non-interactive**: No click detection or selection logic
- **Static**: Rendered as a persistent world object

---

### 2. Left Panel: Always-Visible Warehouse Inventory

The left panel always displays warehouse (global) inventory with themed styling matching the factory panel.

**Current State** (from screenshot):

- Plain text list (Ore, Metals, Crystals, etc.)
- Resource Bonuses section
- Settings button

**Proposed Changes**:

- Add "Warehouse" title section (similar to "Storage" / "Upgrades" labels on right panel)
- Organize resources into themed cards/boxes matching factory panel styling
- Use consistent borders, colors (cyan/teal accents), padding, and typography
- Keep responsive scaling (adapts to narrow/wide viewports)
- Resource Bonuses section stays below inventory
- Settings button stays at bottom

### UI Theme Alignment

#### Left Panel (Warehouse) → Right Panel (Factory Detail)

| Element             | Left (Warehouse)               | Right (Factory)                 | Match                                   |
| ------------------- | ------------------------------ | ------------------------------- | --------------------------------------- |
| **Title**           | "Warehouse"                    | "[Factory Name]" or "Upgrades"  | ✅ Same typography, size                |
| **Section Headers** | "Resources"                    | "Storage", "Upgrades"           | ✅ Same styling (uppercase, cyan color) |
| **Boxes/Cards**     | Resource list in bordered card | Storage list in bordered card   | ✅ Same border color, rounded corners   |
| **Text Styling**    | Resource names + values        | Resource names + values/buffers | ✅ Same font, spacing                   |
| **Border Color**    | Cyan/teal (#00D9FF or similar) | Cyan/teal                       | ✅ Consistent                           |
| **Background**      | Dark with subtle border        | Dark with subtle border         | ✅ Consistent                           |
| **Padding/Spacing** | Uniform gutters                | Uniform gutters                 | ✅ Consistent                           |
| **Scroll Areas**    | Independent scroll for left    | Independent scroll for right    | ✅ No interference                      |

**Implementation Note**: Extract or reuse the existing card/section component from the factory panel and apply it to warehouse inventory. This ensures consistency without duplication.

---

### Visual Representation: Multi-Part Space Station

The warehouse will be composed of **simple geometric primitives** combined into a cohesive space-station structure:

#### 1. Central Hub (Cylindrical Core)

- **Geometry**: `CylinderGeometry(radius: 2, height: 3, radialSegments: 8)`
- **Position**: `(0, 0, 0)` relative to warehouse center
- **Purpose**: Command/control center; main visual anchor
- **Color**: Teal/cyan (#00D9FF) with slight emission glow
- **Effect**: Subtle emission to draw attention as landmark

#### 2. Storage Modules (3 Radiating Arms)

- **Geometry**: `BoxGeometry(width: 1, height: 2, depth: 4)` × 3 arms
- **Layout**: Rotate around Y-axis at 0°, 120°, 240°
- **Position**: Radiating outward from hub (distance: ~4 units)
- **Purpose**: Visual representation of storage capacity
- **Color**: Dark gray/charcoal (#1a1a2e) with subtle metallic sheen
- **Detail**: Slight beveled edges to suggest cargo containers

#### 3. Docking Collar (Toroidal Ring)

- **Geometry**: `TorusGeometry(radius: 3, tubeRadius: 0.4, radialSegments: 16, tubularSegments: 8)`
- **Position**: Around the hub at mid-height (Y ≈ 0.5)
- **Purpose**: Hauler docking ports; visual flow indicator
- **Animation**: Continuous slow rotation (0.5 rad/sec) for life/activity feel
- **Color**: Bright cyan (#00D9FF) matching UI accent
- **Effect**: Emission glow, animated rotation suggests "receiving" goods

#### 4. Solar Panels (2 Wing-like Structures)

- **Geometry**: `PlaneGeometry(width: 3, height: 2)` × 2
- **Position**: Top and bottom of hub, angled 45°
- **Purpose**: Visual variety; suggests power/energy autonomy
- **Color**: Dark blue (#1a3a5f) with metallic finish
- **Detail**: Optional small grid pattern to suggest solar cells

#### 5. Antenna/Communication Array (Small Spike)

- **Geometry**: `CylinderGeometry(radius: 0.2, height: 2, radialSegments: 6)`
- **Position**: Top of central hub, centered
- **Purpose**: Visual complexity; sci-fi aesthetic, communication tower
- **Color**: Bright cyan (#00D9FF) matching UI accent
- **Effect**: Subtle emission, visually balances hub height

### Assembly Strategy

Use a **compound mesh** approach:

1. Create a Three.js `Group()` as the warehouse container
2. Add each component as a child mesh with relative positioning
3. Group positioned at warehouse world location: `Vector3(8, 0, 5)`
4. Single `rotation` on group for orientation; can rotate docking collar independently

```text
WarehouseGroup @ Vector3(8, 0, 5)
├── CentralHub (Cylinder) — Y: 0
├── StorageArm1 (Box) — Rotation 0°
├── StorageArm2 (Box) — Rotation 120°
├── StorageArm3 (Box) — Rotation 240°
├── DockingRing (Torus) — Y: 0.5, Rotation: animated
├── SolarPanel1 (Plane) — Top-angled
├── SolarPanel2 (Plane) — Bottom-angled
└── Antenna (Cylinder) — Y: +1.5 (top of hub)
```

---

## Positioning

**Warehouse Location** (fixed, not randomized):

- **Position**: `Vector3(8, 0, 5)` (near Factory 0 at origin)
- **Distance from Factory 0**: ~9.4 units (comfortably visible, not overlapping with factory scatter)
- **Justification**:
  - Far enough from Factory 0 spawn (~9 units > factory collision tolerance)
  - Close enough to be visible as a landmark from spawn
  - Z-offset makes it distinct on the display

**Rationale**: Fixed position ensures:

- Deterministic starting point (no randomization)
- Players know the warehouse is "out there" from start
- Simplifies serialization (no need to save warehouse position)

---

## Implementation Phases

### Phase 1: World Entity Setup

- [ ] Add static warehouse entity to `ecs/world.ts`
- [ ] Position at `Vector3(8, 0, 5)`
- [ ] No ECS query needed (static, non-interactive)

### Phase 2: 3D Rendering

- [ ] Create warehouse mesh assembly in R3F scene component (`src/r3f/Warehouse.tsx` or similar)
- [ ] Implement compound mesh with all sub-components
- [ ] Add materials (colors, emission, metallic sheen)
- [ ] Test positioning and visual scale relative to Factory 0
- [ ] Implement docking ring animation (rotation)

### Phase 3: Left Panel UI Redesign

- [ ] Extract or create reusable card/section component (if not already done)
- [ ] Rename/retitle left panel section to "Warehouse"
- [ ] Organize global resources into themed card matching factory panel
- [ ] Apply consistent borders, colors, padding
- [ ] Ensure responsive scaling (narrow/wide viewports)
- [ ] Verify Resource Bonuses section styling matches

### Phase 4: Visual Polish

- [ ] Add emission glow to hub and antenna
- [ ] Test visibility of warehouse from different camera angles
- [ ] Adjust colors/materials if needed for UI consistency
- [ ] Add optional particle effects at docking ring (future enhancement)

### Phase 5: Testing & Validation

- [ ] Unit tests: warehouse position is correct
- [ ] Visual tests: warehouse renders without clipping
- [ ] UI tests: left panel displays correctly, responsive
- [ ] Integration: warehouse visible in game world, left panel always shows inventory

### Phase 6: Future Extensions (Out of Scope)

- [ ] Warehouse upgrades UI (deferred)
- [ ] Docking animation when haulers arrive (deferred)
- [ ] Resource conversion hub (deferred)
- [ ] Warehouse-specific effects (particle bursts, etc.)

---

## Visual Design Details

### Materials & Shading

| Part         | Base Color            | Emission                          | Metallic | Roughness | Notes           |
| ------------ | --------------------- | --------------------------------- | -------- | --------- | --------------- |
| Central Hub  | #1A5F5F (dark teal)   | #00D9FF (0.5 intensity)           | 0.4      | 0.6       | Glowing core    |
| Storage Arms | #2A2A3E (dark gray)   | none                              | 0.6      | 0.8       | Weathered metal |
| Docking Ring | #1A5F5F               | #00D9FF (0.8 intensity, animated) | 0.8      | 0.3       | Bright, active  |
| Solar Panels | #1A3A5F (dark blue)   | none                              | 0.9      | 0.2       | Reflective      |
| Antenna      | #00D9FF (bright cyan) | #00D9FF (0.7 intensity)           | 0.7      | 0.4       | Beacon-like     |

### Animation

1. **Docking Ring**: Continuous slow rotation
   - Speed: 0.5 rad/sec (30° per second)
   - Purpose: Indicates activity, draws player attention
   - Direction: Around Y-axis (up/down)

2. **Antenna Glow** (Optional):
   - Emission intensity oscillates: 0.5–1.0
   - Frequency: 2 Hz
   - Purpose: Beacon-like pulsing, conveys "communication" concept

---

## Open Questions & Design Decisions

### Q1: Should warehouse be clickable or only visual landmark?

**Options**:

- A: Purely visual (current assumption) — no raycasting
- B: Clickable to open warehouse detail panel (deferred, future enhancement)
- C: Hover tooltip showing warehouse stats

**Recommendation**: **A (Purely Visual)** — Simplifies Phase 1; warehouse info always visible on left. Can add interactivity in future phases if needed.

---

### Q2: Should warehouse upgrades exist separately?

**Options**:

- A: No warehouse upgrades; all upgrades are global modules (current design)
- B: Warehouse has upgrade slots (like factories) — deferred
- C: Upgrades apply to warehouse capacity as global module (current design)

**Recommendation**: **A/C (Global Module Upgrades)** — Warehouse capacity driven by `state.modules.storage`. Can add dedicated warehouse upgrade UI later.

---

### Q3: Should warehouse entity be persistent or respawn?

**Options**:

- A: Persistent (fixed position always, no save state needed)
- B: Destroyable/respawnable (deferred, future feature)
- C: Repositionable (deferred, future feature)

**Recommendation**: **A (Persistent)** — Establishes a stable landmark; simplifies first iteration.

---

## Acceptance Criteria

- [ ] Warehouse space-station renders as multi-part structure near Factory 0
- [ ] Warehouse is visually recognizable using simple geometry
- [ ] Left panel displays warehouse inventory with themed styling matching factory panel
- [ ] "Warehouse" title appears at top of left panel (consistent typography)
- [ ] Resource cards use same borders, colors, and spacing as factory panel
- [ ] Responsive layout maintained (narrow/wide viewports)
- [ ] Docking ring rotates continuously (0.5 rad/sec)
- [ ] Emission glows visible on hub and antenna
- [ ] No visual clipping with Factory 0 or other scene elements
- [ ] Performance: warehouse rendering does not add >1ms to frame budget

---

## Technical Constraints

- **Three.js geometry**: Use standard geometries (Box, Cylinder, Torus, Plane)
- **Component reuse**: Extract and reuse card/section styling from factory panel
- **Persistence**: Warehouse position hardcoded (no state.warehouses array)
- **Responsiveness**: Left panel must adapt to viewport (CSS media queries, flexbox)
- **Performance**: Warehouse is a single compound mesh (not instanced), docking ring rotation uses simple animation loop

---

## Future Extensions

1. **Warehouse Upgrades**: Module-based storage expansion UI
2. **Docking Animation**: Haulers visibly dock at collar positions
3. **Resource Conversion**: Warehouse as crafting/conversion hub
4. **Travel Routes**: Visual graph showing logistics network
5. **Warehouse Stats**: Display capacity utilization, incoming/outgoing rates
6. **Click-to-Navigate**: Camera focuses on warehouse when clicked (later phases)
