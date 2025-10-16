# Implementation Plan — Space Factory

This document captures the concrete implementation plan derived from `spec/spec-full-idea.md`. It lists milestones, tasks, files to change, acceptance criteria, tests, risks, and a recommended sequence of work.

---

## High-level milestones (ordered)

1. Persistence Integration & Settings UI (Export/Import JSON, autosave, offline cap)
2. Refinery ECS System & Offline Alignment (`processRefinery`)
3. Energy Throttle & Per-Drone Battery (gradual throttle, charging)
4. Seeded RNG (persisted seed, random-on-new-save)
5. Visual Polish (drone trails, factory visuals, scanner highlights)
6. Tests & CI (unit tests + Playwright e2e for import/export/offline)
7. Migration helpers, docs, README, performance and responsive checks

---


## Milestone 1 — Persistence Integration & Settings UI

Priority: High
Estimated effort: 1.5–3 days

- Tasks

- Add `settings` slice to store with fields: `autosaveEnabled`, `autosaveIntervalSec`, `offlineCapHours`, `notation`.
- Add store serialization helpers: `applySnapshot`, `serializeStore`, `exportState`, `importState`, and a placeholder `processRefinery` wrapper.
- Implement persistence manager `src/state/persistence.ts` exposing: `load()`, `start()`, `stop()`, `saveNow()`, `exportState()`, `importState(payload)`.
- Create Settings UI: `src/ui/Settings.tsx` with Wrench icon (Export, Import, autosave toggle/interval, offline cap, notation selector).
- Wire persistence into bootstrap (`src/main.tsx` or `src/App.tsx`): call `persistence.load()` on start, run `simulateOfflineProgress()`, and start autosave.
- Add `beforeunload`/`visibilitychange` handlers to persist `lastSave`.

Files to create/modify

- modify: `src/state/store.ts` (extend store with `settings` and serialization helpers)
- add: `src/state/persistence.ts`
- add: `src/ui/Settings.tsx`
- modify: `src/main.tsx` or `src/App.tsx`

Acceptance criteria

- Export/Import JSON UI works; import validates and migrates missing fields; export returns current save JSON.
- On load, offline simulation is applied up to configured cap; HUD reflects updated resources.
- Autosave persists state at interval (default 10s).

Tests

- Unit: `state/persistence.test.ts` (load/save/export/import/migration)
- E2E: Playwright smoke for import/export + offline recap

Risks & mitigations

- Changes to store API may affect many modules: keep new functions additive and non-breaking.
- Import malicious JSON: validate and sanitize; do not execute or eval payloads.

---


## Milestone 2 — Refinery ECS System & Offline Alignment

Priority: High
Estimated effort: 1–2 days

Tasks

- Implement `createRefinerySystem(world, store)` in `src/ecs/systems/refinery.ts`.
- Expose `store.processRefinery(dt)` (store wrappers call into refinery logic or set of refiners).
- Update `src/lib/offline.ts` to prefer `processRefinery` over fallback tick conversion.
- Wire `createRefinerySystem` into `src/r3f/Scene.tsx` system list.

Acceptance criteria

- Refinery outputs match previous store.tick outputs for same inputs.
- Offline simulation uses `processRefinery` path and parity tests pass.

Tests

- Unit: `ecs/systems/refinery.test.ts`
- Offline parity: `lib/offline.test.ts`

---


## Milestone 3 — Energy Throttle & Per-Drone Battery

Priority: High
Estimated effort: 1.5–3 days

Tasks

- Add `battery` and `maxBattery` fields to `DroneEntity` in `src/ecs/world.ts` and initialize in `createDrone`.
- Modify `createTravelSystem` and `createMiningSystem` to consume battery per second and to scale speed/miningRate by `energyFraction = max(minFloor, battery/maxBattery)`.
- Update `createPowerSystem` to include a charging model that charges drones at factory when energy buffer allows.
- Expose throttle floor in Settings UI.

Acceptance criteria

- Drones throttle gradually when battery low; they still return slowly instead of halting.
- Energy flows and battery charge are visible in state and tests.

Tests

- Unit: `ecs/systems/mining.test.ts` and `power.test.ts`

---


## Milestone 4 — Seeded RNG

Priority: Medium
Estimated effort: 0.5–1.5 days

Tasks

- Add `src/lib/rng.ts` implementing mulberry32 or similar.
- Wrap `lib/math.ts` random calls to use seeded RNG instance; pass RNG from `createGameWorld` if provided.
- Persist `rngSeed` to save and generate a random seed on new saves (crypto.getRandomValues where available).

Acceptance criteria

- Same seed + same save reproduce asteroid positions/richness on re-import.

Tests

- Unit: `lib/rng.test.ts` and integration test verifying deterministic world generation.

---


## Milestone 5 — Visual Polish (Trails first)

Priority: Medium
Estimated effort: 1–3 days

Tasks

- Implement drone trails (Drei `Trail` or a lightweight instanced line strip in `src/r3f/Drones.tsx`).
- Add basic module visuals for Factory (show bays/units based on module levels).
- Implement scanner rich-node highlight (shading or emissive ring for richer asteroids).

Acceptance criteria

- Visuals are performant (no major FPS drop); trails improve readability.

---

## Milestone 6 — Tests & CI

Priority: High
Estimated effort: 1–2 days

Tasks

- Add unit tests enumerated above and make sure Vitest runs green.
- Add Playwright tests for import/export and offline recap.
- Add/update CI workflows to run tests on PRs.

Acceptance criteria
- Green test suite in local runs and CI.

---

## Milestone 7 — Migration helpers & Docs

Priority: Low
Estimated effort: 0.5–1 day

Tasks

- Implement import migration helpers in `store.importState` that fill missing fields and return migration logs.
- Add README section documenting save JSON format, import/export, and migration notes.
- Performance/responsive checklist and handoff notes.

Acceptance criteria
- Clear README and migration behavior; developer onboarding updated.

---

## Cross-cutting concerns

- Keep changes additive where possible; wrap new features behind Settings flags to allow safe rollout.
- Always backup current save on import (automated temporary backup key in localStorage).
- Use small incremental commits and run tests after each milestone.

---

## Dev commands (local)

Install dependencies:

```powershell
npm install
```

Start dev server:

```powershell
npm run dev
```

Run unit tests:

```powershell
npm test
```

Run e2e (requires server running):

```powershell
npm run e2e
```

---

## Next step (I can start now)

I'll begin with Milestone 1 (persistence + Settings UI). Confirm and I will:
 
1. Add store `settings` slice and serialization helpers.
2. Implement `src/state/persistence.ts` and `src/ui/Settings.tsx`.
3. Wire persistence into bootstrap and add autosave, export/import, and offline simulation on load.
4. Add tests for the persistence flow.

If you prefer a different starting point, tell me which milestone to prioritize and I'll start implementing it immediately.
