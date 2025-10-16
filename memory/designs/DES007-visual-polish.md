# DES007 — Visual Polish (Trails First)

**Status:** In Progress
**Created:** 2025-10-16
**Updated:** 2025-10-16

## Summary

Add configurable drone trail effects that convey motion without harming performance, expose the toggle in Settings, and document the feature for persistence and spec consumers. Defer factory/scanner polish to follow-up tasks.

## Goals

- Render light-weight drone trails that match instanced drone colors and fade over time.
- Allow players to disable trails from the Settings panel; persist the choice across sessions/import/export.
- Keep the trail buffers GPU-friendly (single `LineSegments` draw call) and clamp to the existing drone cap (128).
- Update the spec and requirements to reflect persistence completion and the new visual toggle.

## Architecture

- **State:** Extend `StoreSettings` with `showTrails: boolean` (default `true`). Normalized in `normalizeSettings`, serialized with snapshots, and observed by the scene.
- **UI:** Add a "Drone trails" toggle row to `SettingsPanel`. When toggled, dispatches `updateSettings({ showTrails })`.
- **Rendering:** Introduce `DroneTrails` under `src/r3f/` using a shared `TrailBuffer` helper. The helper maintains a ring-buffer of recent positions per drone slot (aligned with instancing order) and writes batched position/color attributes for a `LineSegments` geometry. Colors lerp toward the scene background per segment for a fade effect.
- **Scene Integration:** `Scene` reads `settings.showTrails` via `useStore` and mounts `<DroneTrails />` when enabled.
- **Documentation:** Refresh `spec/spec-full-idea.md` to mark persistence as implemented, describe Settings/offline behavior, and mention the new trails toggle under rendering/UX.

## Data Flow

1. Settings UI updates `showTrails` in the store.
2. Persistence manager serializes/deserializes the new flag with other settings; import/export include it automatically.
3. `Scene` re-renders when `showTrails` changes, mounting/unmounting `DroneTrails`.
4. On each frame, `DroneTrails` pulls current drones from `gameWorld`, pushes their positions into the `TrailBuffer`, rebuilds the geometry attributes, and updates draw range based on active drone count.

## Interfaces

- `StoreSettings.showTrails: boolean` — persisted and normalized.
- `TrailBuffer.update(drones: readonly DroneSnapshot[]): void` — updates internal typed arrays and exposes `positions`, `colors`, and `vertexCount` for the geometry.
- `DroneTrails` component consumes `TrailBuffer`, writes arrays into a shared `BufferGeometry`, and marks attributes dirty in `useFrame`.

`DroneSnapshot` will mirror the subset of `DroneEntity` that the buffer needs (`position`, `state`).

## Implementation Plan

1. Extend store settings/persistence serialization to include `showTrails`; add normalization and tests for roundtrips.
2. Update `SettingsPanel` UI + tests to surface the new toggle and confirm it updates the store.
3. Implement `TrailBuffer` helper with unit tests covering history rotation, color fade, and clamped vertex counts.
4. Add `DroneTrails` component that uses `TrailBuffer` and conditionally render it from `Scene` based on `settings.showTrails`.
5. Refresh the spec/requirements and memory/task files to mark TASK002 complete and document the new visual polish milestone.

## Risks & Mitigations

- **Performance:** Updating typed arrays each frame could be expensive. Mitigate by keeping history length short (e.g., 12 samples) and performing simple `Float32Array` shifts. Profiling can guide future optimizations.
- **Store migrations:** Ensure the new `showTrails` default is applied when older saves lack the field via `normalizeSettings`.
- **Tests in headless environment:** R3F components rely on WebGL. Keep render logic in a pure helper to allow Vitest coverage without needing a WebGL context.

## Follow-ups

- Factory lighting/scanner highlight polish.
- Additional Settings toggles for bloom/particle density once effects exist.
- Optional battery HUD indicators tied to energy throttle work.
