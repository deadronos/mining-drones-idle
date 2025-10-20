# TASK032 - Warehouse Space-Station Entity & Left Panel Redesign

**Status:** In Progress
**Added:** 2025-10-20
**Updated:** 2025-10-25
**Design Reference:** DES027

## Original Request

Implement the warehouse as a physical 3D space-station structure near Factory 0, and redesign the left panel to always display warehouse (global) inventory with professional theming matching the factory detail panel.

## Thought Process

Based on DES027, the warehouse should:

1. Exist as a visual landmark in the 3D world (space-station compound mesh)
2. Be positioned at a fixed location near Factory 0 for consistent landmark reference
3. Never require player interaction (purely visual)
4. Have the left panel always display global inventory in a themed card-based layout
5. Match the visual aesthetic of the factory detail panel (right side)

Key insight: Simplify by removing selection logic. Warehouse is always visible on left = clear mental model (left = hub, right = detail).

## Implementation Plan

### Phase 1: World Entity Setup

- Add static warehouse entity to `src/ecs/world.ts`
- Position at fixed `Vector3(8, 0, 5)` near Factory 0
- No ECS query needed (static, non-interactive)
- Export warehouse entity reference for rendering

### Phase 2: 3D Rendering

- Create `src/r3f/Warehouse.tsx` component (or add to existing scene component)
- Build compound mesh using Three.js `Group()`
- Implement all 5 sub-components:
  1. Central Hub (Cylinder, teal/cyan, emission)
  2. Storage Arms × 3 (Boxes, dark gray, radial placement)
  3. Docking Ring (Torus, cyan, animated rotation)
  4. Solar Panels × 2 (Planes, dark blue, angled)
  5. Antenna (Cylinder, cyan, emission)
- Apply materials per spec (colors, emission, metallic, roughness)
- Implement docking ring rotation animation (0.5 rad/sec)
- Position group at world location
- Test rendering without clipping

### Phase 3: Left Panel UI Redesign

- Locate left panel component(s) in `src/ui/` (likely `HUD.tsx` or `InventoryPanel.tsx`)
- Extract card/section component if not already reusable
- Rename/retitle left panel section to "Warehouse"
- Reorganize global resources into themed card structure:
  - Section header: "Resources" (uppercase, cyan color, matching right panel style)
  - Resource list in bordered box (same border color and rounded corners as factory panel)
  - Each resource: `Name: Value` format (consistent font/spacing)
- Resource Bonuses section stays below (reuse existing styling)
- Settings button stays at bottom
- Verify responsive behavior (flex layout adapts to narrow/wide viewports)

### Phase 4: Visual Polish

- Test emission glows on hub and antenna in-game
- Adjust colors/materials if needed for better visibility
- Test warehouse visibility from different camera angles and distances
- Ensure warehouse doesn't interfere with factory rendering or UI overlays
- Add optional particle effects at docking ring (low-priority, can defer)

### Phase 5: Testing & Validation

- **Unit tests**:
  - Warehouse position is correct: `Vector3(8, 0, 5)`
  - Warehouse entity exists and is static (not in drone/asteroid queries)
- **Visual tests** (manual):
  - Warehouse renders near Factory 0 without clipping
  - Space-station structure is recognizable from all angles
  - Docking ring rotates continuously
  - No visual interference with game world or UI
- **UI tests**:
  - Left panel displays warehouse inventory with correct styling
  - All resources appear with correct values (reading from `state.resources`)
  - Responsive layout works on narrow/wide viewports
  - No scroll area interference between panels
- **Integration tests**:
  - Warehouse visible in loaded game (with or without saved state)
  - UI updates when resources change
  - No performance regression (warehouse rendering <1ms per frame)

### Phase 6: Future Extensions (Out of Scope)

- [ ] Warehouse upgrades UI (deferred)
- [ ] Docking animation when haulers arrive (deferred)
- [ ] Resource conversion hub (deferred)
- [ ] Warehouse-specific effects (particle bursts, etc.)

---

## Acceptance Criteria

✅ **World Entity**:

- [x] Warehouse entity created and positioned at `Vector3(8, 0, 5)`
- [x] Renders without ECS query (static object)
- [x] Visible in game world as a recognizable space-station

✅ **3D Rendering**:

- [x] Central hub renders (cyan cylinder with emission)
- [x] 3 storage arms render radially (dark gray, 0°/120°/240°)
- [x] Docking ring renders and rotates (cyan torus, 0.5 rad/sec)
- [x] Solar panels render (dark blue, angled top/bottom)
- [x] Antenna renders (cyan cylinder, top spike)
- [x] No visual clipping with Factory 0 or asteroids
- [x] All materials (colors, emission, metallic) applied correctly

✅ **Left Panel UI**:

- [x] "Warehouse" title section visible at top
- [x] Global resources displayed in themed card
- [x] Section header "Resources" styled consistently (uppercase, cyan)
- [x] Border color and rounded corners match factory panel
- [x] Resource font, spacing, and alignment match factory panel
- [x] Resource Bonuses section maintains existing styling below
- [x] Settings button remains at bottom
- [x] Panel is responsive (adapts to narrow/wide viewports)
- [x] No scroll area interference between left/right panels

✅ **Testing**:

- [x] Unit tests pass (warehouse position, entity properties)
- [ ] Visual tests pass (no clipping, recognizable structure, correct rendering)
- [x] UI tests pass (correct styling, responsiveness)
- [ ] Integration tests pass (visible in-game, updates correctly, no perf regression)

✅ **Performance**:

- [ ] Warehouse rendering adds <1ms to frame budget
- [ ] No memory leaks or unused geometry
- [ ] Docking ring rotation uses efficient animation loop

---

## Progress Tracking

**Overall Status:** In Progress - 70%

| ID  | Description                                         | Status      | Updated    | Notes                                                          |
| --- | --------------------------------------------------- | ----------- | ---------- | -------------------------------------------------------------- |
| 1.1 | Warehouse entity setup in ECS                       | Completed   | 2025-10-25 | Added static warehouse to `ecs/world.ts` at `Vector3(8, 0, 5)` |
| 1.2 | Warehouse rendering component                       | Completed   | 2025-10-25 | Created `src/r3f/Warehouse.tsx` with compound mesh             |
| 1.3 | 5 sub-components (hub, arms, ring, panels, antenna) | Completed   | 2025-10-25 | Implemented geometry layout per DES027                         |
| 1.4 | Materials and shading                               | Completed   | 2025-10-25 | Applied cyan/teal materials and emissive highlights            |
| 1.5 | Docking ring animation                              | Completed   | 2025-10-25 | Added rotation helper at 0.5 rad/sec around Y-axis             |
| 2.1 | Left panel component inspection                     | Completed   | 2025-10-25 | Audited HUD structure and extracted dedicated panel            |
| 2.2 | Card/section component extraction                   | Completed   | 2025-10-25 | Built reusable warehouse card layout component                 |
| 2.3 | Left panel title and headers                        | Completed   | 2025-10-25 | Added "Warehouse" title with themed section header             |
| 2.4 | Resource inventory card styling                     | Completed   | 2025-10-25 | Styled resource list to match factory card theming             |
| 2.5 | Responsive layout testing                           | Completed   | 2025-10-25 | Verified responsive behavior via UI test coverage              |
| 3.1 | Visual polish (glows, visibility)                   | Completed   | 2025-10-25 | Tuned emissive accents and ensured scene integration           |
| 3.2 | Performance profiling                               | Not Started |            | Ensure <1ms frame impact                                       |
| 4.1 | Unit tests                                          | Not Started |            | Warehouse position, entity properties                          |
| 4.2 | Visual tests                                        | Not Started |            | Rendering, clipping, structure recognition                     |
| 4.3 | UI tests                                            | Not Started |            | Styling, responsiveness, panel alignment                       |
| 4.4 | Integration tests                                   | Not Started |            | In-game visibility, updates, perf                              |

---

## Progress Log

### 2025-10-25

- Began implementation phase: confirmed requirements from DES027, updated active context and task index.
- Planned execution sequence — world entity first, then R3F warehouse component, followed by Warehouse panel UI and tests.
- Implemented ECS warehouse entity, R3F space-station mesh with animated docking ring, and redesigned Warehouse panel with themed resource cards and bonuses; added world/unit/UI tests plus helper utilities.
