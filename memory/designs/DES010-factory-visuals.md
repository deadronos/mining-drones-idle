---
id: DES010
title: Factory Visuals — Improved Factory Rendering & Feedback
created: 2025-10-16
updated: 2025-10-16
author: automation-agent
---


# ## DES010 — Factory Visuals

Purpose: Improve the visual quality and feedback of the in-world factory component to better communicate activity, throughput, and machine state while preserving performance for WebGL / r3f rendering.

## Summary

- Improve factory building models, materials and lighting.
- Add animated conveyors and visible item transfer (small ore blobs / particles).
- Provide clear visual states for processing, idle, clogged, and boosted throughput.
- Keep all changes configurable and performant; graceful degrade on low-end devices.

## Why

- Current factory visuals are functional but lacking information density and polish. Clear visuals will improve player comprehension and perceived progress, increasing retention and satisfaction.

## Requirements (EARS-style)

- WHEN a drone unloads to the factory, THE SYSTEM SHALL show a localized transfer animation from drone to conveyor (Acceptance: visible animation in scenes where a drone is near a factory and unit tests for factory event emission).
- WHEN the factory is processing items, THE SYSTEM SHALL show animated conveyors and processing indicators (Acceptance: conveyors animate while processing; snapshot tests for animation-enabled state).
- WHEN throughput is high (burst/boost), THE SYSTEM SHALL show a temporary glow/particle accent on the factory and conveyors (Acceptance: visual accent appears for boost events and fades after given duration).
- WHEN the player has low-performance settings, THE SYSTEM SHALL reduce particle counts, disable expensive post-processing and fall back to simple sprites (Acceptance: toggle settings and verify visuals downgrade).

## Design

### High-level components

- FactoryModel: glTF/instanced mesh placeholder that supports material swaps (idle, active, clogged, boost).
- ConveyorSystem: CPU-driven UV-scroll on conveyor geometry + optional instanced item particles to imply throughput.
- TransferFX: short-lived particle/mesh that animates from drone -> conveyor -> refinery input (managed by an FX pool to avoid allocation spikes).
- PerformanceProfile: set of toggles (high/medium/low) that alter particle counts, post-processing, and instancing strategies.

### Data & interface

- FactoryState { id, position, processingRate, queueLength, lastActivityTimestamp, boostActive }
- Public APIs (event-driven):
  - emit('factory:transfer', { fromId, toFactoryId, itemType })
  - emit('factory:processing', { factoryId, rate })
  - emit('factory:boost', { factoryId, duration })

### Implementation notes

- Use existing r3f components and instancing patterns in `src/r3f` where possible.
- Avoid creating per-transfer mesh; use pooled particle/ sprite instances and LERP for motion.
- Use shader-based UV animation for conveyor belt scroll (cheap and GPU-friendly).
- Materials: use a simple PBR base, and a layered emissive mask for 'boost' pulse.
- Provide a debug flag to visualize bounding boxes and activity heatmap for development.

## Acceptance Criteria

- Functional: Transfer FX show when unload occurs and are correctly positioned between drone and conveyor in play tests.
- Visual: Conveyors animate while processing and show emissive boost on boost events (manual QA + visual snapshot tests).
- Performance: On 'medium' profile the framerate impact of factory visuals should be <= 5% in a stress scene (documented test scene).
- Configurable: Player settings expose performance profile toggles; low profile disables particles and simplifies materials.

## Tasks

- T1: Create FactoryModel placeholder and material states (idle/active/boost/clogged).
- T2: Implement ConveyorSystem with UV-scroll shader and optional instanced item sprites.
- T3: Implement TransferFX pool and event wiring for `factory:transfer` events.
- T4: Add boost emissive pulse and temporal fade.
- T5: Add PerformanceProfile toggles and integrate into Settings UI.
- T6: Add visual snapshot tests and a simple stress scene for perf measurement.

## Risks & mitigations

- Risk: Particle pools could leak or allocate heavily. Mitigation: Implement fixed-size pool and recycle, add guard instrumentation.
- Risk: New shaders increase build complexity. Mitigation: Keep shaders small, provide fallback materials.

## Metrics

- Measure frames-per-second before/after in `tests/perf/factory-stress` scene.
- Count active particles and transfer events per minute in debug logs.

## Attachments

- Link to design sketches and sprite assets TODO (add PR with art assets).

Finished: No
