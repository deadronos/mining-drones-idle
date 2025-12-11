# TASK058 - Rendering & Bridge Integration

**Status:** In Progress  
**Added:** 2025-12-10  
**Updated:** 2025-12-13  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 7 from DES039: Wire R3F/HUD to read authoritative Rust buffer views when `useRustSim` is enabled, eliminating visual drift between TS and Rust state.

## Thought Process

Even with perfect functional parity, visuals can drift if the renderer reads stale TS state instead of authoritative Rust buffers. This phase ensures the UI reflects the Rust simulation state when enabled, providing true end-to-end parity.

## Requirements (EARS)

- WHEN `useRustSim` is enabled and Rust buffers are ready, THE SYSTEM SHALL render drones and asteroids directly from Rust SoA buffers without relying on stale TS world entities [Acceptance: buffer-driven R3F components display positions/colors with no missing instances].
- WHEN Rust buffers are active, THE SYSTEM SHALL use Rust-derived resources/factory stats for HUD and inspector panels while falling back to TS state when Rust is disabled [Acceptance: HUD/Factory panels reflect Rust buffer values when `useRustSim` is on].
- WHEN Rust buffers are unavailable or invalid, THE SYSTEM SHALL gracefully fall back to TS rendering/data paths without crashes [Acceptance: smoke tests keep scenes/HUD working with useRustSim off or without WASM].

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

**Overall Status:** In Progress - 60%

### Subtasks

| ID    | Description                                    | Status      | Updated    | Notes |
| ----- | ---------------------------------------------- | ----------- | ---------- | ----- |
| 58.1  | Wire drone rendering to Rust buffers           | Completed   | 2025-12-13 | RustDrones gated on buffer readiness |
| 58.2  | Wire factory rendering to Rust buffers         | In Progress | 2025-12-13 | Factory renderer now reads positions/resources/energy from Rust buffers when ready |
| 58.3  | Wire asteroid rendering to Rust buffers        | Completed   | 2025-12-13 | RustAsteroids now buffer-driven (positions/ore/profile) |
| 58.4  | Update HUD to use Rust aggregates              | In Progress | 2025-12-13 | useRustHUD buffer polling retained; factories/resources read from Rust when active |
| 58.5  | Implement useRustEngine toggle                 | Not Started |            |       |
| 58.6  | Add visual parity E2E tests                    | Not Started |            |       |
| 58.7  | Profile and optimize render buffer reads       | Not Started |            |       |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 7
- Initial implementation plan defined
- Dependencies: TASK053, TASK054, TASK055, TASK056 (all system parity must be achieved first)

### 2025-12-13

- Reviewed rendering components (Scene, RustDrones, RustAsteroids, FactoryManager/useRustHUD) and identified buffer-driven paths vs TS fallbacks.
- Captured EARS requirements emphasizing buffer-driven rendering under `useRustSim`, HUD sync from Rust, and graceful fallback when WASM unavailable.
- Implemented buffer-driven RustAsteroids (positions/ore/resource profile) with safer selection gating when `useRustSim` is active; RustDrones readiness gate noted. HUD remains Rust-buffer-driven for resources/factory stats.
- Factory renderer now consumes Rust buffer views for positions/resources/energy/haulers when the bridge is ready, falling back to TS state otherwise.
