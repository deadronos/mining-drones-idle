# Space Factory — Full Spec

This specification consolidates the project's vision (from `idea.md`) and the current implementation (`src/`) into a single, actionable spec. It is intended to be the source of truth for development, testing, and handoff.

## Overview

Space Factory is a relaxed but crunchy 3D idle/incremental game. An orbital platform deploys autonomous drones to mine asteroids, haul ore home, refine bars, and unlock prestige upgrades. The shipped MVP already renders the world with React Three Fiber, runs a deterministic ECS loop over Miniplex entities, simulates mining and power, and exposes an Upgrade/Prestige panel. Persistence utilities and offline simulation helpers exist, but the bootstrap wiring, settings UI, and prestige recap remain roadmap items.

Stack: React, Vite, TypeScript, React Three Fiber (r3f), Drei, Miniplex (ECS), Zustand (state), Vitest, Playwright.

## Goals and Constraints

### Currently enforced

- Simulation uses a deterministic fixed timestep (default 0.1s) via `createTimeSystem`.
- ECS responsibilities are partitioned by system files (fleet, asteroids, drone AI, travel, mining, unload, power, refinery placeholder).
- Game state (resources, modules, prestige, save metadata) lives in a single Zustand store consumed by UI and systems.
- Render performance is maintained through lightweight meshes (Factory, instanced asteroids/drones) and capped frame delta (0.25s) before fixed stepping.

### Planned / backlog

- Expand persistence beyond utilities: integrate the persistence manager at bootstrap, expose autosave/offline settings UI, and add import/export affordances.
- Implement gradual energy throttling (instead of the current binary mining halt) and a dedicated refinery ECS system to offload conversion from the store.
- Persist and reuse deterministic RNG seeds for asteroid generation.
- Provide prestige/offline recap UI, richer drone visuals, and hazards once the core loop is hardened.

## Requirements (EARS-style)

| ID              | Requirement                                                                                                                                                                                                      | Status                      | Acceptance / Notes                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **RQ-006**      | WHEN maintainers consult the spec for save/offline behavior, THE SYSTEM SHALL describe the persistence manager API and offline simulation helpers that currently exist in the codebase.                          | Implemented (Documentation) | This spec enumerates manager methods, storage key, and offline simulation flow tied to `src/state/persistence.ts` and `src/lib/offline.ts`.                                                |
| **RQ-007**      | WHEN the spec covers UI and ECS systems, THE SYSTEM SHALL distinguish between implemented features and roadmap items.                                                                                            | Implemented (Documentation) | Sections below label "Currently enforced" vs. "Planned", and call out TODO systems (refinery, settings/offline recap).                                                                     |
| **RQ-PERSIST**  | WHEN the persistence manager loads a save, THE SYSTEM SHALL deserialize snapshot data, apply it to the store, compute offline seconds with the configured cap, and simulate catch-up before scheduling autosave. | Blocked (Store gap)         | `createPersistenceManager.load()` contains this logic but `StoreState` lacks `settings`, `applySnapshot`, and serialization helpers, so wiring cannot succeed until the store slice lands. |
| **RQ-TIME**     | WHEN the ECS tick runs, THE SYSTEM SHALL use a fixed timestep accumulator so larger frame deltas trigger multiple `step` invocations.                                                                            | Implemented                 | `createTimeSystem.update` loops over `fixed(step)` whenever the accumulator exceeds the configured step.                                                                                   |
| **RQ-002**      | WHEN a drone bay level increases, THE SYSTEM SHALL adjust the active drone count to match `max(1, modules.droneBay)` and update per-drone stats.                                                                 | Implemented                 | `createFleetSystem` spawns/removes drones and recalculates speed/capacity/mining rate each frame.                                                                                          |
| **RQ-DRONE-AI** | WHEN a drone is idle, THE SYSTEM SHALL target the nearest asteroid with ore and transition to `toAsteroid`; invalid targets reset the drone to idle.                                                             | Implemented                 | `createDroneAISystem` assigns `targetId`, kicks off travel, and clears invalid/empty assignments.                                                                                          |
| **RQ-MINING**   | WHEN a drone reaches an asteroid and mines, THE SYSTEM SHALL deduct ore, load cargo to capacity, and switch to `returning` when cargo is full or ore exhausted.                                                  | Implemented                 | `createMiningSystem` mutates `drone.cargo`/`asteroid.oreRemaining` and toggles drone state accordingly.                                                                                    |
| **RQ-UNLOAD**   | WHEN a returning drone finishes travel, THE SYSTEM SHALL unload cargo into the store and reset to idle at the factory.                                                                                           | Implemented                 | `createUnloadSystem` deposits ore via `store.addOre`, zeroes cargo, and snaps the drone home.                                                                                              |
| **RQ-001**      | WHEN the store tick executes, THE SYSTEM SHALL convert ore into bars based on refinery level and prestige bonus while respecting the 10:1 ratio and per-second cap.                                              | Implemented                 | `store.tick` enforces the cap, multiplies by refinery + prestige bonuses, and updates ore/bars totals.                                                                                     |
| **RQ-POWER**    | WHEN the power system runs, THE SYSTEM SHALL adjust energy by generation minus drone consumption, clamp to [0, capacity], and surface the result to the UI.                                                      | Implemented                 | `createPowerSystem` leverages `getEnergyGeneration/Consumption/Capacity` and writes energy back to the store.                                                                              |
| **RQ-UI**       | WHEN the UI renders, THE SYSTEM SHALL display HUD summaries (ore, bars, energy, drones) and an Upgrade/Prestige panel reflecting affordability and prestige readiness.                                           | Implemented                 | `App` HUD and `UpgradePanel` selectors keep values live and disable unaffordable actions; settings/offline recap remain roadmap items.                                                     |
| **RQ-003**      | WHEN asteroids deplete, THE SYSTEM SHALL recycle them and maintain the target asteroid count biased by scanner level.                                                                                            | Implemented                 | `createAsteroidSystem` trims empty asteroids and `ensureAsteroidTarget` repopulates using scanner-level richness bias.                                                                     |
| **RQ-005**      | WHEN prestige requirements are met, THE SYSTEM SHALL grant cores, reset resources/modules, and retain the base energy capacity.                                                                                  | Implemented                 | `store.doPrestige` guards the threshold, updates cores, and restores default resources/modules while keeping baseline energy.                                                              |

## Current Implementation Snapshot

### Data Model & Store

- `resources`: `{ ore: number; bars: number; energy: number; credits: number }`
- `modules`: `{ droneBay: number; refinery: number; storage: number; solar: number; scanner: number }`
- `prestige`: `{ cores: number }`
- `save`: `{ lastSave: number; version: string }`
- Actions: `addOre(amount)`, `buy(moduleId)`, `tick(dt)`, `prestigeReady()`, `preview()`, `doPrestige()`, `setLastSave(timestamp)`.
- Helpers: `moduleDefinitions` (label/baseCost/description), `costForLevel`, `computePrestigeGain`, `computePrestigeBonus`, `getStorageCapacity`, `getEnergyCapacity`, `getEnergyGeneration`, `getEnergyConsumption`.
- Credits exist on the resource slice but remain unused in gameplay; downstream systems should ignore them until an economy layer lands.
- Backlog:
  - Extend the store with a `settings` slice and persistence helpers (`applySnapshot`, `serializeStore`, `stringifySnapshot`, `parseSnapshot`, `exportState`, `importState`, `StoreSettings`, `saveVersion`) so the persistence manager can operate without runtime errors.
  - Introduce a dedicated `processRefinery(dt)` action to centralize ore→bars conversion for reuse by offline simulation (currently handled inside `tick`).

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
- No settings/offline recap UI yet; these remain roadmap work and are called out explicitly below.

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
- Store gap: the live store does not yet expose `settings`, `applySnapshot`, or serialization helpers, so `load/start/saveNow/importState` will throw until those slices and functions are introduced.
- Error handling: guards around storage availability (`hasStorage`) and try/catch on writes with console warnings.
- Integration TODO: wire manager into app bootstrap (`main.tsx`) and ensure store exposes `applySnapshot`, `serializeStore`, `stringifySnapshot`, `parseSnapshot`, `exportState`, `importState`, and settings slice publicly.

### Offline Utilities (`src/lib/offline.ts`)

- `clampOfflineSeconds(seconds, capHours)` limits simulation duration (default 8 hours when cap unspecified).
- `computeOfflineSeconds(lastSave, now, capHours)` converts elapsed milliseconds to clamped seconds.
- `simulateOfflineProgress(store, seconds, { step = 0.1, capHours })` iteratively ticks the store:
  - Normalizes and clamps seconds.
  - Runs floor(seconds/step) iterations plus remainder.
  - Prefers a store-provided `processRefinery` method when available; falls back to `tick` otherwise.
- Planned: once the refinery system is decoupled, `processRefinery` becomes first-class and offline simulation will no longer need the fallback branch.

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
  - `lib/offline.test.ts`: parity with manual refinery loop and offline cap handling (assumes `processRefinery` availability; fallback path still exercised via simulation store).
  - `state/persistence.test.ts`: verifies offline cap forwarded through persistence manager.
- Playwright:
  - `tests/e2e/basic.spec.ts`: app boot smoke test, HUD visibility, prestige button presence, resource accrual over time.
- Pending coverage:
  - Persistence manager wiring smoke tests (import/export, autosave toggle).
  - Energy throttle edge cases once implemented.
  - UI tests for forthcoming settings/offline recap interfaces.

## Roadmap (Next Steps)

1. **Persistence Integration & Settings UI**
   - Expose settings slice and snapshot helpers in the store.
   - Wire `createPersistenceManager` into `main.tsx` bootstrap (load/save lifecycle).
   - Build Settings panel with autosave toggle/interval, offline cap input, import/export controls, and error feedback.
2. **Refinery System & Offline Alignment**
   - Implement ECS refinery system consuming ore and producing bars; adjust store to expose `processRefinery` and delegate from `tick`.
   - Update offline simulation to rely solely on `processRefinery`.
3. **Energy Throttle Improvements**
   - Introduce per-drone battery model or smooth throttling floor; ensure mining slows instead of halts.
4. **RNG Persistence & World Feedback**
   - Add seeded RNG persisted in saves; include import/export migration path.
5. **UX Enhancements**
   - Implement offline recap toast, prestige summary improvements, and additional visual polish (drone trails, module meshes, scanner highlights).
6. **Stretch Goals**
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
