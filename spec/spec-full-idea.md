# Space Factory — Full Spec

This specification consolidates the project's vision (from `idea.md`) and the current implementation (src/) into a single, actionable spec. It is intended to be the source of truth for development, testing, and handoff.

## Overview

A chill but crunchy 3D idle/incremental game where an orbital factory deploys autonomous drones to mine asteroids, process ore in refineries, and expand via modules and prestige tech. The game runs a deterministic, frame-rate independent simulation (fixed-timestep) so offline/idle simulation and reproducible seeds are possible.

Stack: React, Vite, TypeScript, React Three Fiber (r3f), Drei, Miniplex (ECS), Zustand (state), Vitest, Playwright.

## Goals and Constraints

- Core loop must run deterministically with a fixed timestep (configurable fixedDt, e.g., 0.1s).
- Keep ECS responsibilities in systems (AI, travel, mining, unload, power, asteroids, fleet, refinery).
- Keep game state (resources, modules, prestige) in a single Zustand store for UI and persistence.
- Render performance: use instancing for asteroids & drones and keep scene simple and readable.
- Offline/idle: on load calculate `delta = now - lastSave`, clamp to a maximum (default 8 hours), simulate using fixed timestep and apply results to store. The offline cap is user-configurable in Settings.
- Work iteratively: provide unit tests for economic invariants and e2e smoke tests for major flows (persistence, offline, import/export).

## Requirements (EARS-style)

1. WHEN the game starts, THE SYSTEM SHALL load saved state from persistent storage and, IF time has passed since the last save, simulate offline progress for up to the user-configured cap (default 8 hours) and update resources (Acceptance: simulated resource increases after load when lastSave < now).

2. WHEN a `droneBay` module is increased, THE SYSTEM SHALL ensure the number of drone entities equals `max(1, modules.droneBay)` (Acceptance: regular loop maintains droneQuery.size == modules.droneBay).

3. WHEN a drone is `idle`, THE SYSTEM SHALL assign it to the nearest asteroid with remaining ore and transition to `toAsteroid` state (Acceptance: drone state changes from `idle` to `toAsteroid` with a valid targetId).

4. WHEN a drone reaches an asteroid, THE SYSTEM SHALL allow it to mine until either its capacity or asteroid's oreRemaining depletes, then transition to returning/unloading and transfer cargo into store via `addOre` (Acceptance: asteroid.oreRemaining decreases, drone.cargo increases, store.ore increases on unload).

5. THE SYSTEM SHALL convert ore into bars at a refinery rate controlled by `modules.refinery` and the prestige multiplier (Acceptance: refinery system produces bars at expected rates given modules and prestige).

6. THE SYSTEM SHALL simulate energy generation and consumption per tick, using `modules.solar` for generation and drone consumption; energy is bounded by capacity and influences drone behavior (Acceptance: energy remains within capacity and affects drone performance rather than hard-stopping them).

7. THE UI SHALL present resource HUD (ore, bars, energy), upgrade panel (module list + buy buttons), a modular Settings (wrench) menu, and a prestige summary (Acceptance: UpgradePanel renders module rows and buy buttons honor affordability; Settings exposes export/import and offline/autosave controls).

8. THE SYSTEM SHALL respawn asteroids to maintain a target count, with `modules.scanner` affecting richness bias (Acceptance: ensureAsteroidTarget results in target count and richness scales with scanner level).

9. WHEN the player chooses prestige and meets threshold, THE SYSTEM SHALL reset run state appropriately and apply prestige cores & bonus (Acceptance: doPrestige modifies prestige.cores and resets resources/modules per spec).

10. THE SYSTEM SHALL use a fixed timestep time accumulator to ensure frame-rate independence (Acceptance: TimeSystem.update calls step(fixedDt) multiple times when needed when dt is large).

## Data Model

Zustand store (single source of truth for meta & save):

- `resources`: { ore: number, bars: number, energy: number, credits: number }
- `modules`: { droneBay: number, refinery: number, storage: number, solar: number, scanner: number }
- `prestige`: { cores: number }
- `save`: { lastSave: number, version: string }

ECS Entities (Miniplex):

- AsteroidEntity: id, kind='asteroid', position (Vector3), oreRemaining, richness, radius, rotation, spin, colorBias
- DroneEntity: id, kind='drone', position, state ('idle','toAsteroid','mining','returning','unloading'), targetId|null, cargo, capacity, speed, miningRate, travel: TravelData|null, miningAccumulator, battery: number
- FactoryEntity: id, kind='factory', position, orientation

Derived / Helper Data:

- TravelData: { from: Vector3, to: Vector3, elapsed: number, duration: number }

## Systems and Responsibilities

All systems should be factories that accept the `GameWorld` and `storeApi` where needed and return a runner function `(dt: number) => void`. Systems are called inside a fixed timestep loop.

1. TimeSystem (fixed timestep)

- accumulator, fixedDt configurable (e.g., 0.1s)
- update(dt, step) executes `step(fixedDt)` while accumulator >= fixedDt

2. FleetSystem

- Ensure drone count matches `max(1, modules.droneBay)`
- Spawn and remove drones using `spawnDrone`/`removeDrone`
- Update drone stats (speed, capacity, miningRate) based on modules

3. AsteroidSystem

- Rotate asteroids
- Remove depleted asteroids
- Ensure total asteroid count equals ASTEROID_TARGET; spawn using `createAsteroid(scannerLevel)`

4. DroneAISystem

- Idle → assign nearest asteroid → set travel
- Handle target invalidation (if asteroid depleted) and transitions
- When returning/unloading handle travel to factory

5. TravelSystem

- Update `drone.travel.elapsed`, lerp position, finalize arrival and set next state transitions (to mining/unloading)

6. MiningSystem

- If `drone.state === 'mining'` extract ore from asteroid based on `drone.miningRate * dt`, `drone.capacity`, and asteroid.oreRemaining
- When cargo full or asteroid depleted, set `returning`
- Energy handling: each drone has a `battery` and consumes energy for travel and mining. When battery is low, drone performance (speed and mining rate) is scaled by an energy fraction rather than hard-stopping. The scaling should include a configurable minimum floor (e.g., 20%) to avoid soft-locks.

7. UnloadSystem

- When `drone.state === 'unloading'`, transfer cargo → `store.addOre(cargo)` and reset drone cargo/state/position

8. RefinerySystem

- The refinery is implemented as a separate ECS system (not only in `store.tick`) to keep responsibilities separated for future refactors. It converts ore → bars at a rate influenced by `modules.refinery` and the prestige multiplier. The system may operate on a refinery buffer in the store or on dedicated Refinery entities exposing `workInProgress`.

9. PowerSystem

- Calculate generation: `getEnergyGeneration(modules)`
- Calculate consumption: `getEnergyConsumption(modules, droneQuery.size)`
- Update `store.resources.energy` bounded by `getEnergyCapacity(modules)`
- Optionally provide global power routing that affects charging rates for drones.

10. Cleanup/Other Systems

- Optional: hazard events, cleanup, or sector transitions

## Rendering

- `Asteroids` component uses instanced mesh with per-instance color bias based on richness
- `Drones` component uses instanced capsule geometry with per-instance color for state
- `Factory` group is a simple mesh for now; expandable to show module bays
- Scene: sets background, fog, lights, Stars (Drei), and wires TimeSystem + systems in useFrame

Visual priority (initial):
1. Drone trails (improve readability and motion)
2. Factory module visuals (show drone bays, refinery units)
3. Scanner / rich-node highlight

## Persistence & Offline

- Storage format (localStorage key: `space-factory-save`): a JSON with shape:

```json
{
	"resources": {...},
	"modules": {...},
	"prestige": {...},
	"save": {"lastSave": 0, "version": "0.1.0"},
	"rngSeed": 12345
}
```

- Autosave interval: default 10 seconds. The UI exposes a Settings panel where the user can change the autosave interval or disable autosave.
- Save export/import: provide a Settings (wrench) menu with an Export button that serializes the current save to JSON and offers it for copy/download, and an Import textbox where users can paste JSON to restore a save. Import validates the JSON and attempts graceful migration/field-filling (see Migration guidance).
- Offline simulation cap: default 8 hours; the setting is user-configurable in Settings. On load the app reads the save, applies it to `useStore` (`storeApi.setState`), computes offline seconds via `computeOfflineSeconds(lastSave, now)`, clamps to the configured cap, and calls `simulateOfflineProgress(storeApi, seconds)`.
- On unload/visibilitychange hidden: write save with `lastSave = Date.now()` (and persist current RNG seed if used).

Migration guidance on import:

- When importing a save, validate presence of known keys and types. For missing fields, fill with sensible defaults. If new systems require fields not in the save, migrate ad-hoc with documented defaults. Log or show a short notification about any fields that were added during migration.

## Determinism & RNG

- We use a seeded RNG (e.g., mulberry32) for world generation and any simulation branching that needs reproducibility. The RNG seed is persisted as `rngSeed`.
- On a new save the seed is randomly generated (introduces variability). If a player exports the save, the seed is included so the run can be reproduced when re-imported.

## UI / UX

- HUD: left-top showing Ore, Bars, Energy, Drones
- UpgradePanel: right-side panel listing modules with current level, description, cost, and a Buy button; Prestige panel below
- Settings (Wrench icon): modular settings menu accessible from the HUD. Initial items:
	- Save Export: copy/download JSON text of current save
	- Save Import: paste JSON into a textbox to import
	- Autosave interval (seconds) with default 10s and option to disable
	- Offline simulation cap (hours) default 8, user-configurable
	- Number notation: "normal", "scientific", "engineering" (future)
- Offline recap: after load show a "Welcome back" toast summarizing simulated offline time and gained resources; allow dismiss.

Settings should be modular so additional options (formatting, autosave, advanced toggles) can be added later.

## Economics & Formulas

- Cost(base, lvl): `ceil(base * growth^lvl)` with `growth = 1.15` (configurable)
- Refinery base: `BASE_REFINERY_RATE = 1` (scale by `1.1^refineryLevel` and prestige bonus)
- Ore → Bars: `ORE_PER_BAR = 10`, conversion rate `ORE_CONVERSION_PER_SECOND = 10`
- Prestige gain: `floor( (bars / 1000) ^ 0.6 )`
- Prestige bonus: `1 + 0.05*min(cores,100) + 0.02*max(0, cores-100)`
- Drone capacity base, speed base, miningRate base in `world.createDrone`
- Balancing note: initial tuning is acceptable; drone cost reduction can be tuned later as requested.

## Acceptance Criteria (tests)

Write Vitest unit tests for:

- Refinery system converts ore → bars at correct rate for given modules & prestige.
- CostForLevel returns expected values and growth curve is monotonic.
- simulateOfflineProgress produces same results as repeated tick() calls for the same dt.
- Fleet system enforces drone count based on module level.
- Mining system behavior under varying global energy and per-drone battery states (throttle floor behavior).

Playwright e2e:

- App loads, HUD renders, and resources increase over a short timeframe (smoke test already present under `tests/e2e/basic.spec.ts`).
- For major changes (persistence/import/export, offline simulation), include an e2e smoke that imports a test save and verifies expected state changes.

## Tasks & Roadmap (next steps)

Priority 1 (High impact, small effort):

- Persist & load save file; implement autosave (default 10s) and offline catch-up on start. Add Settings UI with Export/Import JSON and offline cap control. (Files: `src/state/persistence.ts`, modify `src/main.tsx`/`src/App.tsx`, add `src/ui/Settings.tsx`).
- Implement separate `createRefinerySystem` as an ECS system and add unit tests.
- Add unit tests for offline simulation and energy throttle; add an e2e smoke test for import/export and offline recap.

Priority 2 (Improve fidelity):

- Add individual drone battery/charging model, and implement gradual throttle with a configurable minimum floor (e.g., 20%).
- Add seeded RNG persisted in save; generate random seed on new save by default.

Priority 3 (UX & polish):

- Add offline recap toast UI on load (welcome back summary).
- Add simple trails for drones (visual priority #1), then improve factory module visuals, then scanner/rich-node highlight.

Stretch:

- Hazard events, scripting/autopilot, sectors & logistics.

## Handoff Checklist

- [ ] Save/persistence implemented and tested, including Export/Import UI
- [ ] Migration/validation on import for missing/new fields (graceful/ad-hoc)
- [ ] Energy throttle tested and integrated
- [ ] Unit tests for economics & offline and mining/battery behavior
- [ ] Add RNG seed to save and document reproducible-run flow (random seed on new save)
- [ ] Responsive layout consideration for mobile viewports and performance target: 60fps on modern browsers/hardware
- [ ] Document developer setup steps in README

## Spec change log

- 2025-10-16 — Consolidated `idea.md` and current `src/` implementation into `spec/spec-full-idea.md`. Included identified gaps and a prioritized roadmap and updated with user's settings/answers.


---

End of spec.
- Ensure drone count matches `max(1, modules.droneBay)`
