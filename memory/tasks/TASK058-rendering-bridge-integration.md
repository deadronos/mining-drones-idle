# TASK058 - Rendering & Bridge Integration

**Status:** Pending  
**Added:** 2025-12-10  
**Updated:** 2025-12-10  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 7 from DES039: Wire R3F/HUD to read authoritative Rust buffer views when `useRustSim` is enabled, eliminating visual drift between TS and Rust state.

## Thought Process

Even with perfect functional parity, visuals can drift if the renderer reads stale TS state instead of authoritative Rust buffers. This phase ensures the UI reflects the Rust simulation state when enabled, providing true end-to-end parity.

## Implementation Plan

- Wire renderer to Rust buffers:
  - Read drone positions from Rust SoA buffers when `useRustSim` enabled
  - Read factory energy/bars from Rust buffers
  - Read asteroid ore levels from Rust buffers
  - Implement opt-in `useRustEngine` toggle for visual testing
- Update HUD to use Rust aggregates:
  - Call `exportSnapshot()` for HUD aggregate data
  - Use Rust buffer views for real-time metrics
  - Fall back to TS state when Rust disabled
- Implement hybrid interaction mode:
  - Allow UI interactions to issue commands to Rust
  - Maintain TS state for UI-only features (tags, labels, etc.)
  - Document which features remain TS-only
- Add visual parity validation:
  - Compare rendered positions with expected Rust state
  - Add E2E tests for visual consistency
  - Measure HUD sync latency (<100ms target)
- Performance optimization:
  - Profile buffer read overhead
  - Optimize update frequency for rendering
  - Ensure 60 FPS maintained with Rust reads

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID    | Description                                    | Status      | Updated    | Notes |
| ----- | ---------------------------------------------- | ----------- | ---------- | ----- |
| 58.1  | Wire drone rendering to Rust buffers           | Not Started |            |       |
| 58.2  | Wire factory rendering to Rust buffers         | Not Started |            |       |
| 58.3  | Wire asteroid rendering to Rust buffers        | Not Started |            |       |
| 58.4  | Update HUD to use Rust aggregates              | Not Started |            |       |
| 58.5  | Implement useRustEngine toggle                 | Not Started |            |       |
| 58.6  | Add visual parity E2E tests                    | Not Started |            |       |
| 58.7  | Profile and optimize render buffer reads       | Not Started |            |       |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 7
- Initial implementation plan defined
- Dependencies: TASK053, TASK054, TASK055, TASK056 (all system parity must be achieved first)
