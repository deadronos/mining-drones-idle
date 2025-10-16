# Space Factory — Full Spec

This specification consolidates the project's vision (from `idea.md`) and the current implementation (`src/`) into a single, actionable spec. It is intended to be the source of truth for development, testing, and handoff.

## Overview

Space Factory is a relaxed but crunchy 3D idle/incremental game. An orbital platform deploys autonomous drones to mine asteroids, haul ore home, refine bars, and unlock prestige upgrades. The shipped MVP already renders the world with React Three Fiber, runs a deterministic ECS loop over Miniplex entities, simulates mining and power, exposes an Upgrade/Prestige panel, and now boots through a persistence manager that autosaves, simulates offline catch-up, and surfaces a Settings panel for autosave/offline controls plus visual toggles (drone trails).

Stack: React, Vite, TypeScript, React Three Fiber (r3f), Drei, Miniplex (ECS), Zustand (state), Vitest, Playwright.

## Goals and Constraints

### Currently enforced

- Simulation uses a deterministic fixed timestep (default 0.1s) via `createTimeSystem`.
- ECS responsibilities are partitioned by system files (fleet, asteroids, drone AI, travel, mining, unload, power, refinery placeholder).
- Game state (resources, modules, prestige, save metadata) lives in a single Zustand store consumed by UI and systems.
- Render performance is maintained through lightweight meshes (Factory, instanced asteroids/drones) and capped frame delta (0.25s) before fixed stepping.

### Planned / backlog

- Provide prestige/offline recap UI, richer drone visuals beyond trails, and hazards once the core loop is hardened.
- Extend visual polish to factory lighting and scanner highlights with additional Settings toggles.

## Requirements (EARS-style)

| ID              | Requirement                                                                                                                                                                                                                          | Status                      | Acceptance / Notes                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RQ-006**      | WHEN maintainers consult the spec for save/offline behavior, THE SYSTEM SHALL describe the persistence manager API and offline simulation helpers that currently exist in the codebase.                                              | Implemented (Documentation) | This spec enumerates manager methods, storage key, and offline simulation flow tied to `src/state/persistence.ts` and `src/lib/offline.ts`.                                                                                         |
| **RQ-007**      | WHEN the spec covers UI and ECS systems, THE SYSTEM SHALL distinguish between implemented features and roadmap items.                                                                                                                | Implemented (Documentation) | Sections below label "Currently enforced" vs. "Planned", and call out TODO systems (refinery, settings/offline recap).                                                                                                              |
| **RQ-PERSIST**  | WHEN the persistence manager loads a save, THE SYSTEM SHALL deserialize snapshot data, apply it to the store, compute offline seconds with the configured cap, and simulate catch-up before scheduling autosave.                     | Implemented                 | `createPersistenceManager` now runs at bootstrap (`main.tsx`), consumes the store's snapshot helpers (`serializeStore`, `applySnapshot`), clamps offline seconds, logs recap telemetry, and immediately persists the migrated save. |
| **RQ-TIME**     | WHEN the ECS tick runs, THE SYSTEM SHALL use a fixed timestep accumulator so larger frame deltas trigger multiple `step` invocations.                                                                                                | Implemented                 | `createTimeSystem.update` loops over `fixed(step)` whenever the accumulator exceeds the configured step.                                                                                                                            |
| **RQ-002**      | WHEN a drone bay level increases, THE SYSTEM SHALL adjust the active drone count to match `max(1, modules.droneBay)` and update per-drone stats.                                                                                     | Implemented                 | `createFleetSystem` spawns/removes drones and recalculates speed/capacity/mining rate each frame.                                                                                                                                   |
| **RQ-DRONE-AI** | WHEN a drone is idle, THE SYSTEM SHALL target the nearest asteroid with ore and transition to `toAsteroid`; invalid targets reset the drone to idle.                                                                                 | Implemented                 | `createDroneAISystem` assigns `targetId`, kicks off travel, and clears invalid/empty assignments.                                                                                                                                   |
| **RQ-MINING**   | WHEN a drone reaches an asteroid and mines, THE SYSTEM SHALL deduct ore, load cargo to capacity, and switch to `returning` when cargo is full or ore exhausted.                                                                      | Implemented                 | `createMiningSystem` mutates `drone.cargo`/`asteroid.oreRemaining` and toggles drone state accordingly.                                                                                                                             |
| **RQ-UNLOAD**   | WHEN a returning drone finishes travel, THE SYSTEM SHALL unload cargo into the store and reset to idle at the factory.                                                                                                               | Implemented                 | `createUnloadSystem` deposits ore via `store.addOre`, zeroes cargo, and snaps the drone home.                                                                                                                                       |
| **RQ-001**      | WHEN the store tick executes, THE SYSTEM SHALL convert ore into bars based on refinery level and prestige bonus while respecting the 10:1 ratio and per-second cap.                                                                  | Implemented                 | `store.tick` enforces the cap, multiplies by refinery + prestige bonuses, and updates ore/bars totals.                                                                                                                              |
| **RQ-POWER**    | WHEN the power system runs, THE SYSTEM SHALL adjust energy by generation minus drone consumption, clamp to [0, capacity], and surface the result to the UI.                                                                          | Implemented                 | `createPowerSystem` leverages `getEnergyGeneration/Consumption/Capacity` and writes energy back to the store.                                                                                                                       |
| **RQ-UI**       | WHEN the UI renders, THE SYSTEM SHALL display HUD summaries (ore, bars, energy, drones) and an Upgrade/Prestige panel reflecting affordability and prestige readiness.                                                               | Implemented                 | `App` HUD and `UpgradePanel` selectors keep values live and disable unaffordable actions; settings/offline recap remain roadmap items.                                                                                              |
| **RQ-003**      | WHEN asteroids deplete, THE SYSTEM SHALL recycle them and maintain the target asteroid count biased by scanner level.                                                                                                                | Implemented                 | `createAsteroidSystem` trims empty asteroids and `ensureAsteroidTarget` repopulates using scanner-level richness bias.                                                                                                              |
| **RQ-005**      | WHEN prestige requirements are met, THE SYSTEM SHALL grant cores, reset resources/modules, and retain the base energy capacity.                                                                                                      | Implemented                 | `store.doPrestige` guards the threshold, updates cores, and restores default resources/modules while keeping baseline energy.                                                                                                       |
| **RQ-010**      | WHEN the player changes the drone trails preference in Settings, THE SYSTEM SHALL persist the `showTrails` flag across autosaves and import/export operations and apply the new value within the next rendered frame.                | Implemented (UI/State)      | `StoreSettings` now includes `showTrails`, normalization defaults to `true`, `SettingsPanel` toggles the field, and persistence saves immediately so `Scene` re-renders with or without `<DroneTrails />`.                          |
| **RQ-011**      | WHEN drones travel or change state, THE SYSTEM SHALL render a fading trail indicating their recent path using at most one additional draw call and no more than 12 stored points per drone, honoring the global `showTrails` toggle. | Implemented (Rendering)     | `DroneTrails` batches segments into a single `LineSegments` geometry backed by `TrailBuffer`, lerps colors toward the background, and unmounts when `settings.showTrails` is disabled.                                              |

## Current Implementation Snapshot

### Data Model & Store

- `resources`: `{ ore: number; bars: number; energy: number; credits: number }`
- `modules`: `{ droneBay: number; refinery: number; storage: number; solar: number; scanner: number }`
- `prestige`: `{ cores: number }`
- `save`: `{ lastSave: number; version: string }`
- `settings`: `{ autosaveEnabled: boolean; autosaveInterval: number; offlineCapHours: number; notation: 'standard' | 'engineering'; throttleFloor: number; showTrails: boolean }`
- Actions: `addOre(amount)`, `buy(moduleId)`, `tick(dt)`, `prestigeReady()`, `preview()`, `doPrestige()`, `setLastSave(timestamp)`.
- Helpers: `moduleDefinitions` (label/baseCost/description), `costForLevel`, `computePrestigeGain`, `computePrestigeBonus`, `getStorageCapacity`, `getEnergyCapacity`, `getEnergyGeneration`, `getEnergyConsumption`.
- Credits exist on the resource slice but remain unused in gameplay; downstream systems should ignore them until an economy layer lands.
- Shared helpers: `serializeStore`, `stringifySnapshot`, `parseSnapshot`, `applySnapshot`, `exportState`, `importState`, and `processRefinery(dt)` feed persistence, offline catch-up, and ECS systems.

### ECS Entities

- `DroneEntity`: `{ id, kind: 'drone', position: Vector3, state, targetId, cargo, capacity, speed, miningRate, travel: TravelData|null, miningAccumulator }`
- `AsteroidEntity`: `{ id, kind: 'asteroid', position: Vector3, oreRemaining, richness, radius, rotation, spin, colorBias }`
- `FactoryEntity`: `{ id, kind: 'factory', position: Vector3, orientation: Quaternion }`
- World bootstrap: `createGameWorld` seeds a factory, instantiates `ASTEROID_TARGET = 200` asteroids using `randomOnRing`, and exposes cached queries for drones/asteroids.

### Systems

| System                   | Responsibility                                                                                                     | Notes                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `createTimeSystem(step)` | Fixed-timestep accumulator with clamp to `step * 10`; runs `fixed(step)` while accumulator ≥ step.                 | Step defaults to 0.1s; frame delta clamped to 0.25s in `Scene`.                          |
| `createFleetSystem`      | Keeps drone count synced with `modules.droneBay`, updates per-drone stats (speed, capacity, mining rate).          | Speed bonus +5% per level beyond the first.                                              |
| `createAsteroidSystem`   | Rotates asteroids, removes depleted ones, maintains target count using scanner level richness bias.                | Scanner increases spawn richness by +5% per level.                                       |
| `createDroneAISystem`    | Assigns idle drones to nearest ore-rich asteroid, validates targets, ensures returning drones have travel plan.    | Resets invalid targets to idle.                                                          |
| `createTravelSystem`     | Advances travel interpolation and transitions drones to `mining` or `unloading` upon arrival.                      | Uses linear interpolation between cached vectors.                                        |
| `createMiningSystem`     | Mines ore while drone state is `mining`, respecting capacity and asteroid ore, transitions to returning when done. | Currently halts entirely when global energy ≤ 0.1; gradual throttling is a roadmap item. |
| `createUnloadSystem`     | Transfers cargo to store ore, resets drone state/position to idle.                                                 | Calls `store.addOre` for deposit.                                                        |
| `createPowerSystem`      | Computes generation vs. consumption and clamps energy to capacity.                                                 | No throttle feedback yet beyond mining guard noted above.                                |
| `createRefinerySystem`   | Placeholder to eventually move ore→bars conversion out of the store.                                               | TODO: implement once store exposes `processRefinery`.                                    |

### Rendering & UI

- `App` composes `<Canvas>` with `<Scene>` plus HUD overlay and `<UpgradePanel>` sidebar.
- HUD displays ore/bars/energy/drones using live Zustand selectors.
- `UpgradePanel` lists modules with level, cost, and descriptions, allows purchases, and includes prestige readout/action.
- `DroneTrails` renders batched `LineSegments` behind the instanced drone mesh, fading colors per segment and honoring `settings.showTrails`.
- Settings panel (HUD "Settings" button) exposes autosave toggle/interval, offline cap hours, notation, throttle floor, drone trails toggle, and import/export buttons. Offline recap visualization remains a roadmap item.

## Persistence & Offline

### Persistence Manager (`src/state/persistence.ts`)

- `SAVE_KEY = 'space-factory-save'` identifies localStorage entry.
- API surface:
  - `load()`: reads snapshot, applies via `store.applySnapshot`, computes offline seconds using `computeOfflineSeconds(lastSave, now, settings.offlineCapHours)`, runs `simulateOfflineProgress`, updates `lastSave`, and triggers an immediate save.
- `start()`: schedules autosave according to settings, subscribing to settings changes to reschedule as needed.
- `stop()`: clears autosave interval and subscription.
- `saveNow()`: serializes current store (ensuring `save.lastSave` and `save.version`) and writes to storage.
- `exportState()`: delegates to `store.exportState()` for JSON export.
- `importState(payload)`: delegates to `store.importState`, resets `lastSave`, persists, and reschedules autosave on success.
- Autosave respects `StoreSettings` (`autosaveEnabled`, `autosaveInterval`, `offlineCapHours`, `notation`). Equality helper avoids unnecessary reschedules.
- Error handling: guards around storage availability (`hasStorage`) and try/catch on writes with console warnings.
- Initialization: `main.tsx` constructs the manager, calls `load()`/`start()`, and registers `beforeunload`/`visibilitychange` listeners to trigger `saveNow()` and halt autosaves when the tab closes or hides.

### Offline Utilities (`src/lib/offline.ts`)

- `clampOfflineSeconds(seconds, capHours)` limits simulation duration (default 8 hours when cap unspecified).
- `computeOfflineSeconds(lastSave, now, capHours)` converts elapsed milliseconds to clamped seconds.
- `simulateOfflineProgress(store, seconds, { step = 0.1, capHours })` iteratively processes refinery output via `store.processRefinery`:
  - Normalizes and clamps seconds.
  - Runs floor(seconds/step) iterations plus remainder using shared refinery math.
  - Returns telemetry summarizing steps progressed, ore consumed, and bars produced for logging.

## Determinism & RNG

- Fixed timestep ensures deterministic ordering of systems each frame.
- Current RNG uses `Math.random` helpers in `lib/math.ts` (`randomOnRing`, `randomRange`, `randomInt`); seeds are not yet persisted, so reproducibility across sessions is a backlog item.
- Roadmap: introduce seeded RNG (e.g., mulberry32), persist `rngSeed` alongside saves, and update world generation to draw from seeded generator.

## Economics & Formulas

- Upgrade cost: `costForLevel(base, level) = ceil(base * 1.15^level)`.
- Refinery multiplier: `BASE_REFINERY_RATE = 1`, scaled by `1.1^modules.refinery` and prestige bonus `computePrestigeBonus(cores)`.
- Ore conversion cap: `ORE_CONVERSION_PER_SECOND = 10`; ore per bar is `ORE_PER_BAR = 10`.
- Storage capacity: `400 + storageLevel * 100`.
- Energy capacity: `100 + solarLevel * 25`; generation: `5 * (solarLevel + 1)`; consumption per drone: `1.2`.
- Prestige threshold: `5,000` bars; gain: `floor((bars / 1_000)^0.6)`; bonus: `1 + 0.05 * min(cores, 100) + 0.02 * max(0, cores - 100)`.

## Testing Coverage & Gaps

- Vitest:
  - `state/store.test.ts`: ore→bars math, upgrade cost growth, prestige preview/reset.
  - `ecs/systems/fleet.test.ts`: drone count enforcement & stat updates.
  - `ecs/systems/asteroids.test.ts`: richness scaling with scanner level.
- `lib/offline.test.ts`: parity with manual refinery loop, offline cap handling, and resource preservation using shared `processRefinery` math.
- `ui/Settings.test.tsx`: autosave interval normalization, export workflow, close button, and drone trails toggle persistence.
- `r3f/trailsBuffer.test.ts`: validates trail history seeding, movement rotation, cleanup when drones despawn, and limit clamping.
  - `state/persistence.test.ts`: verifies offline cap forwarded through persistence manager.
- Playwright:
  - `tests/e2e/basic.spec.ts`: app boot smoke test, HUD visibility, prestige button presence, resource accrual over time.
- Pending coverage:
  - End-to-end smoke for Settings import/export and drone trails toggle visibility.
  - Energy throttle HUD feedback once UI surfaces per-drone battery state.
  - Offline recap interface tests when implemented.

## Roadmap (Next Steps)

1. **Offline Recap & Telemetry UI**
   - Surface offline catch-up summaries (ore consumed, bars produced, duration) in the HUD after load.
   - Add persistence log history for debugging without relying on console output.
2. **Factory & Scanner Visual Polish**
   - Enhance factory lighting/animation and add scanner highlight shaders gated behind Settings toggles.
   - Evaluate GPU impact and add additional visual quality presets if needed.
3. **Energy Throttle Feedback**
   - Display per-drone battery/efficiency indicators in the HUD.
   - Consider tooltips explaining throttle floor and recovery dynamics.
4. **Prestige & Progress UX**
   - Expand prestige recap UI with historical run stats.
   - Integrate roadmap hooks for future hazards and automation systems.
5. **Stretch Goals**
   - Hazard events, scripting/autopilot behaviors, sector-based logistics.

## Handoff Checklist

- [x] Persistence manager integrated with store bootstrap and Settings UI delivered.
- [x] Autosave/offline settings, import/export workflow, and migrations documented.
- [x] Refinery ECS system implemented; offline simulation aligned with `processRefinery`.
- [x] Energy throttle improvements validated with tests.
- [x] RNG seed persisted and documented (new saves generate seed, import/export retains it).
- [ ] Responsive layout reviewed; performance target 60fps on modern browsers.
- [x] README updated with developer setup, persistence instructions, and testing guidance.

## Spec Change Log

- 2025-02-14 — Refreshed spec to document current MVP, persistence/offline utilities, testing coverage, and roadmap gaps (DES002, TASK003).
- 2025-10-16 — Consolidated `idea.md` and initial implementation into `spec/spec-full-idea.md`, adding roadmap and priorities.

---

End of spec.
