# TASK016 — Factory Buyable Implementation — Completion Summary

**Date:** 2025-10-20  
**Status:** Completed (Phases 1–6)  
**Session Duration:** ~5 implementation cycles (core feature + integration + validation)

## Overview
- Delivered a fully functional factory gameplay loop: drones reserve docking slots, unload into per-factory storage, refuel, and trigger refining with minimum-throughput safeguards under low energy.
- Integrated factories into the ECS update pipeline, store persistence, and camera UX. Purchase flow, UI panels, and autofit controls are wired into the live HUD.
- Added unit, integration, and end-to-end coverage to lock the new behavior and regression-proof persistence and UI workflows.

## Feature Highlights
- **Factory domain model (`src/ecs/factories.ts`)**: buildable factory type, cost scaling, docking queues, storage, refining, energy accounting, min-one-running enforcement, and nearest-available assignment with round-robin tie-breaks.
- **Store integration (`src/state/store.ts`)**: persisted factory state, purchase API, docking/undocking helpers, ore transfer, round-robin counter, and a `processFactories(dt)` tick that drains energy and converts refined ore to player resources. Snapshot serialization/import handles drone flights with `targetFactoryId`.
- **Drone systems**:
  - `droneAI`, `travel`, `mining`, `unload`, `fleet`, and `world` updated to route drones to factories, persist return targets, dock/undock safely, and reset state when factories disappear.
  - Defensive guards ensure invalid flight snapshots are cleared and fallback behaviors recover drones.
- **UI & camera**:
  - `FactoryManager` panel integrated beside the upgrade UI with cost gating, factory cards, pin toggles, and an Autofit button.
  - `useFactoryAutofit` hook animates the camera; `Scene` invokes it while `processFactories` is ticked with the rest of the ECS systems.
  - `App.tsx`, `ToastProvider`, `Settings`, and styling updates expose the new panel and maintain layout balance.
- **Persistence & migrations**: snapshots include factories, new migrations normalise `targetFactoryId`, and persistence helpers expose import/export via `window.__persistence` for tests.
- **Testing**:
  - Expanded unit suites (`src/ecs/factories.test.ts`, `src/state/store.factories.test.ts`, updated system tests) cover docking queues, storage transfer, energy drain, travel recovery, and unload behavior.
  - Playwright scenario `tests/e2e/factory-flow.spec.ts` exercises buying a factory, verifying resource deductions, and triggering camera autofit from the UI.
  - Legacy tests updated to set `targetFactoryId`, align expectations with factory storage, and use typed helpers instead of `any`.

## Validation
- ✅ `npm run typecheck`
- ✅ `npm run lint`
- ✅ `npm run test` (83 tests including new factory E2E)

## Follow-up considerations
- Balance numbers (cost curve, energy usage, storage) once real gameplay telemetry is available.
- Additional UX polish such as hover-card pin persistence and factory placement previews can iterate in future tasks.
- Consider broader e2e coverage for multi-factory docking saturation and low-energy throttling when the scene grows.

## File inventory
- Core logic: `src/ecs/factories.ts`, `src/ecs/systems/{droneAI,travel,mining,unload,fleet,power}.ts`, `src/ecs/world.ts`, `src/lib/biomes.ts`, `src/lib/resourceModifiers.ts`.
- Store & persistence: `src/state/store.ts`, `src/state/persistence.ts`, `src/state/migrations.ts`, `src/state/import-migrations.test.ts`, `src/state/store.factories.test.ts`.
- UI & camera: `src/App.tsx`, `src/r3f/Scene.tsx`, `src/r3f/Factory.tsx`, `src/hooks/useFactoryAutofit.ts`, `src/ui/FactoryManager.tsx`, `src/ui/FactoryManager.css`, `src/styles.css`.
- Tests: `src/ecs/factories.test.ts`, `src/ecs/systems/*.test.ts`, `src/ui/UpgradePanel.test.tsx`, `tests/e2e/{persistence.spec.ts,factory-flow.spec.ts}`.

Task016 is now ready for handoff; all code paths compile, lint, and test cleanly with documented follow-up ideas captured as future enhancements.
