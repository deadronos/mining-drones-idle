# TASK037: Hauler Ship Visuals – Implementation

**Status:** Pending  
**Created:** 2025-10-26  
**Design Reference:** DES030-hauler-ship-visuals.md  
**Priority:** Blocker for next release  
**Estimated Effort:** 5–8 days (6 phases)

---

## Original Request

Replace static transfer line visuals with animated hauler ships that fly between factories and warehouse, creating a more dynamic and immersive experience. Every transfer should display as an actual "hauler ship" flying along a path, rather than just a line.

---

## Thought Process

The design evolved through stakeholder feedback to a 6-phase implementation approach:

1. **Procedural geometry** (capsule/cone-based) is simpler than asset loading and sufficient for visual impact
2. **Bezier arc paths** (cubic curves) add visual variety and feel more natural than straight lines
3. **Instancing** (matching Drones.tsx pattern) ensures performance with 50+ concurrent transfers
4. **Settings toggle** allows graceful fallback to TransferLines if needed
5. **Factory highlighting on hover** improves usability and context
6. **Particle trails** add subtle polish without harming performance

---

## Implementation Plan

### Phase 1: Component Scaffold & Procedural Geometry

**Objective:** Create HaulerShips component with basic instanced rendering.

**Tasks:**

- [ ] Create `/src/r3f/HaulerShips.tsx`
- [ ] Define procedural capsule/cone mesh (~0.5 units with engine nozzle)
- [ ] Implement instanced mesh rendering (similar to Drones.tsx)
- [ ] Create base material with resource-specific colors (RESOURCE_COLORS)
- [ ] Add test that renders a single test hauler at origin
- [ ] Verify geometry visibility and scale relative to factories/drones

**Acceptance Criteria:**

- Procedural hauler mesh visible in 3D scene
- Instanced rendering compiles without errors
- Base material applies correct colors
- Tests confirm instanced mesh structure

**Dependencies:** None

---

### Phase 2: Bezier Arc & Position Interpolation

**Objective:** Implement smooth Bezier path interpolation.

**Tasks:**

- [ ] Extract transfer duration from logistics queue (derive from `transfer.eta` and start time)
- [ ] Implement cubic Bezier curve helper (P0, P1, P2, P3 with t ∈ [0, 1])
- [ ] Compute elevated control points for natural arcing (midpoint elevation ~1.5×)
- [ ] Calculate current hauler position based on `gameTime` and transfer progress
- [ ] Update instanced matrix transforms in `useFrame` each frame
- [ ] Add unit tests for Bezier interpolation with edge cases

**Acceptance Criteria:**

- Hauler moves smoothly along Bezier path from source to destination
- Position is frame-rate independent
- Bezier helper is pure function with deterministic tests
- Edge cases (progress < 0, progress > 1) handled correctly

**Dependencies:** Phase 1

---

### Phase 3: Orientation & Visual Polish

**Objective:** Orient haulers and add visual polish.

**Tasks:**

- [ ] Compute quaternion from Bezier curve tangent (face direction of travel)
- [ ] Apply quaternion to instanced mesh rotation each frame
- [ ] Implement particle trail effect from hauler rear (engine exhaust)
- [ ] Apply resource-specific emissive color
- [ ] Increase emissive intensity on hover (prepare for Phase 4)
- [ ] Verify scale (~0.5 units) appears distinct from drones visually
- [ ] Add snapshot tests for orientation and color accuracy

**Acceptance Criteria:**

- Haulers always face direction of travel
- Particle trails visible and smooth
- Resource colors match TransferLines palette
- Haulers appear visually distinct from drones (size/color)

**Dependencies:** Phase 2

---

### Phase 4: Interaction, Hover & Tooltips

**Objective:** Add hover detection, factory highlighting, and tooltips.

**Tasks:**

- [ ] Implement raycast picking on mouse move (map instanceId to transfer)
- [ ] Display HTML-overlay tooltip (styled to match TransferLines)
- [ ] Show source → destination, resource amount, ETA remaining
- [ ] **Add ETA and speed info from transfer metadata**
- [ ] Highlight source factory (outline or glow effect)
- [ ] Highlight destination factory (outline or glow effect)
- [ ] Ensure hover state persists while tooltip is visible
- [ ] Add E2E tests for tooltip display and factory highlighting

**Acceptance Criteria:**

- Hovering a hauler displays accurate tooltip
- Source and destination factories highlight on hover
- Tooltip contains source, dest, amount, resource, ETA, speed
- Highlighting clears when mouse leaves hauler

**Dependencies:** Phase 3

---

### Phase 5: Performance Limits & Stress Testing

**Objective:** Cap rendering and validate performance.

**Tasks:**

- [ ] Define `HAULER_RENDER_LIMIT = 256` constant (configurable)
- [ ] Implement cap logic: render first N haulers, skip remainder
- [ ] **Continue calculating all transfers (even if not rendered)**
- [ ] Create stress test: generate 500+ concurrent transfers
- [ ] Profile with DevTools: measure FPS, GPU memory, draw calls
- [ ] Validate ≥60 FPS on typical hardware with 100+ transfers
- [ ] Add performance regression tests

**Acceptance Criteria:**

- Rendering is capped at 256 haulers (configurable)
- All transfers are still calculated/tracked in store
- Stress test achieves ≥60 FPS with 100 concurrent visible transfers
- No memory leaks in DevTools Profiler
- Cap behavior documented in code comments

**Dependencies:** Phase 4

---

### Phase 6: Settings Toggle & Integration

**Objective:** Integrate toggle and fallback to TransferLines.

**Tasks:**

- [ ] Add boolean setting `showHaulerShips` to Settings slice (default: true)
- [ ] Update `/src/r3f/Scene.tsx` to conditionally render HaulerShips or TransferLines
- [ ] Add UI toggle in Settings panel: "Show Hauler Ships"
- [ ] Test toggle: verify switching between HaulerShips and TransferLines works smoothly
- [ ] Verify Settings persist (toggle state survives reload)
- [ ] Update README with feature documentation
- [ ] Full integration test: all systems (store, ui, r3f) working together

**Acceptance Criteria:**

- Settings panel has "Show Hauler Ships" toggle
- Toggle switches between HaulerShips and TransferLines
- State persists across page reloads
- No visual glitches or lag during toggle
- README documents the feature and toggle location

**Dependencies:** Phase 5

---

## Progress Tracking

**Overall Status:** Not Started – 0%

### Subtasks

| Phase | ID  | Description                     | Status      | Updated | Notes |
| ----- | --- | ------------------------------- | ----------- | ------- | ----- |
| 1     | 1.1 | Create HaulerShips.tsx scaffold | Not Started | —       | —     |
| 1     | 1.2 | Procedural mesh + instancing    | Not Started | —       | —     |
| 1     | 1.3 | Resource-specific coloring      | Not Started | —       | —     |
| 1     | 1.4 | Test render single hauler       | Not Started | —       | —     |
| 2     | 2.1 | Extract transfer duration       | Not Started | —       | —     |
| 2     | 2.2 | Cubic Bezier helper             | Not Started | —       | —     |
| 2     | 2.3 | Position interpolation          | Not Started | —       | —     |
| 2     | 2.4 | useFrame matrix update          | Not Started | —       | —     |
| 2     | 2.5 | Unit tests for Bezier           | Not Started | —       | —     |
| 3     | 3.1 | Quaternion from tangent         | Not Started | —       | —     |
| 3     | 3.2 | Particle trails                 | Not Started | —       | —     |
| 3     | 3.3 | Resource coloring + glow        | Not Started | —       | —     |
| 3     | 3.4 | Snapshot tests                  | Not Started | —       | —     |
| 4     | 4.1 | Raycast picking                 | Not Started | —       | —     |
| 4     | 4.2 | HTML tooltip + styling          | Not Started | —       | —     |
| 4     | 4.3 | Factory highlighting            | Not Started | —       | —     |
| 4     | 4.4 | E2E interaction tests           | Not Started | —       | —     |
| 5     | 5.1 | Render cap logic                | Not Started | —       | —     |
| 5     | 5.2 | Stress test scenario            | Not Started | —       | —     |
| 5     | 5.3 | Performance profiling           | Not Started | —       | —     |
| 6     | 6.1 | Settings slice + toggle         | Not Started | —       | —     |
| 6     | 6.2 | Scene.tsx conditional render    | Not Started | —       | —     |
| 6     | 6.3 | Settings UI integration         | Not Started | —       | —     |
| 6     | 6.4 | Full integration test           | Not Started | —       | —     |

---

## Progress Log

### 2025-10-26 – Task Created

- Design finalized with user decisions (DES030)
- Task file created with 6 phases and detailed subtasks
- Implementation plan ready for Phase 1 kickoff
- Estimated effort: 5–8 days

---

## Key Design Decisions

| Decision                  | Rationale                                                             |
| ------------------------- | --------------------------------------------------------------------- |
| **Procedural geometry**   | Simpler than asset loading; capsule/cone sufficient for visual impact |
| **Bezier arc paths**      | Natural flight feel; visual variety vs. straight lines                |
| **Always face direction** | More immersive; matches expected behavior                             |
| **256 hauler cap**        | Instanced rendering limit; still calculate above cap                  |
| **Settings toggle**       | Graceful fallback to TransferLines if needed                          |
| **Particle trails**       | Visual polish without major performance cost                          |
| **Factory highlighting**  | Improves usability and context awareness                              |

---

## Success Criteria

- [ ] All 6 phases completed and integrated
- [ ] HaulerShips render smoothly with Bezier paths
- [ ] Hover interaction works (tooltip + factory highlighting)
- [ ] Performance: ≥60 FPS with 100+ concurrent transfers
- [ ] Settings toggle works and persists
- [ ] All tests pass (unit, E2E, regression)
- [ ] README updated with feature docs

---

## Risks & Mitigations

| Risk                             | Likelihood | Impact | Mitigation                                      |
| -------------------------------- | ---------- | ------ | ----------------------------------------------- |
| Complex raycast picking          | Medium     | Medium | Use existing TransferLines raycast as reference |
| Bezier interpolation performance | Low        | Medium | Profile early; use efficient math library       |
| Particle trail overhead          | Medium     | Low    | Start with simple trail, optimize if needed     |
| Settings persistence bug         | Low        | Low    | Leverage existing Settings slice pattern        |
| High transfer volume regression  | Medium     | High   | Stress test in Phase 5; monitor metrics         |

---

## References

- **Design Document:** `/memory/designs/DES030-hauler-ship-visuals.md`
- **Existing TransferLines:** `/src/r3f/TransferLines.tsx` (reference for raycast, tooltip style)
- **Drones Component:** `/src/r3f/Drones.tsx` (reference for instancing pattern)
- **Settings Integration:** `/src/state/slices/settingsSlice.ts`
- **Store Types:** `/src/state/types.ts` → `PendingTransfer`, `LogisticsQueues`
- **Logistics Config:** `/src/ecs/logistics/config.ts` (transfer duration reference)
