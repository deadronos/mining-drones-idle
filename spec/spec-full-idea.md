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

1. WHEN the persistence manager loads a save, THE SYSTEM SHALL deserialize snapshot data, apply it to the store, compute offline seconds with the configured cap, and simulate catch-up before scheduling autosave. [Acceptance: `createPersistenceManager.load()` persists a refreshed save after calling `simulateOfflineProgress` with `capHours` taken from store settings once wiring is complete.]
2. WHEN the ECS tick runs, THE SYSTEM SHALL use a fixed timestep accumulator so larger frame deltas trigger multiple `step` invocations (frame-rate independence). [Acceptance: `createTimeSystem.update` processes `fixed(step)` repeatedly when accumulator exceeds the configured step.]
3. WHEN a drone bay level increases, THE SYSTEM SHALL adjust the active drone count to match `max(1, modules.droneBay)` and update per-drone stats. [Acceptance: Fleet system spawns/removes drones and updates speed/capacity/mining rate each tick.]
4. WHEN a drone is idle, THE SYSTEM SHALL target the nearest asteroid with ore and transition to `toAsteroid`; invalid targets reset the drone to idle. [Acceptance: Drone AI assigns `targetId` and travel when asteroid exists, or clears when ore depleted.]
5. WHEN a drone reaches an asteroid and mines, THE SYSTEM SHALL deduct ore from the asteroid, load drone cargo up to capacity, and switch to `returning` when cargo full or ore exhausted. [Acceptance: Mining system mutates `drone.cargo` and `asteroid.oreRemaining`, transitioning state accordingly.]
6. WHEN a returning drone finishes travel, THE SYSTEM SHALL unload cargo into the store and reset its state/position to idle at the factory. [Acceptance: Unload system deposits ore via `store.addOre` and zeroes cargo/target/travel.]
7. WHEN the store tick executes, THE SYSTEM SHALL convert ore into bars based on refinery level and prestige bonus while respecting the 10:1 ratio and conversion-per-second cap. [Acceptance: `store.tick` applies refinement math for each timestep.]
8. WHEN the power system runs, THE SYSTEM SHALL adjust energy by generation minus drone consumption, clamp to [0, capacity], and expose the result to HUD/logic. [Acceptance: Power system uses `getEnergyGeneration`, `getEnergyConsumption`, and updates store energy.]
9. WHEN the UI renders, THE SYSTEM SHALL display HUD summaries (ore, bars, energy, drones) and an Upgrade/Prestige panel reflecting affordability and prestige readiness. [Acceptance: `App` HUD and `UpgradePanel` show live store values and disable unaffordable actions; planned settings/offline recap remain noted as backlog.]
10. WHEN asteroids deplete, THE SYSTEM SHALL recycle them and maintain the target asteroid count, biased by scanner level. [Acceptance: Asteroid system removes depleted nodes and `ensureAsteroidTarget` spawns replacements using current scanner level.]
11. WHEN the player prestige requirements are met, THE SYSTEM SHALL grant cores, reset resources/modules, and retain energy baseline. [Acceptance: `store.doPrestige` guards threshold, updates prestige cores, and resets resources/modules to initial defaults.]

## Current Implementation Snapshot

### Data Model & Store

- `resources`: `{ ore: number; bars: number; energy: number; credits: number }`
- `modules`: `{ droneBay: number; refinery: number; storage: number; solar: number; scanner: number }`
- `prestige`: `{ cores: number }`
- `save`: `{ lastSave: number; version: string }`
- Actions: `addOre(amount)`, `buy(moduleId)`, `tick(dt)`, `prestigeReady()`, `preview()`, `doPrestige()`, `setLastSave(timestamp)`.
- Helpers: `moduleDefinitions` (label/baseCost/description), `costForLevel`, `computePrestigeGain`, `computePrestigeBonus`, `getStorageCapacity`, `getEnergyCapacity`, `getEnergyGeneration`, `getEnergyConsumption`.
- Persistence helpers (`serializeStore`, `stringifySnapshot`, `parseSnapshot`, `exportState`, `importState`, `StoreSettings`) are defined in the store module in support of the persistence manager. Where absent in runtime, persistence utilities fall back gracefully but the spec treats them as required for completion.
- Planned: introduce a dedicated `processRefinery(dt)` action to centralize ore→bars conversion for reuse by offline simulation (currently handled inside `tick`).

### ECS Entities

- `DroneEntity`: `{ id, kind: 'drone', position: Vector3, state, targetId, cargo, capacity, speed, miningRate, travel: TravelData|null, miningAccumulator }`
- `AsteroidEntity`: `{ id, kind: 'asteroid', position: Vector3, oreRemaining, richness, radius, rotation, spin, colorBias }`
- `FactoryEntity`: `{ id, kind: 'factory', position: Vector3, orientation: Quaternion }`
- World bootstrap: `createGameWorld` seeds a factory, instantiates `ASTEROID_TARGET = 200` asteroids using `randomOnRing`, and exposes cached queries for drones/asteroids.

### Systems

| System | Responsibility | Notes |
| --- | --- | --- |
| `createTimeSystem(step)` | Fixed-timestep accumulator with clamp to `step * 10`; runs `fixed(step)` while accumulator ≥ step. | Step defaults to 0.1s; frame delta clamped to 0.25s in `Scene`. |
| `createFleetSystem` | Keeps drone count synced with `modules.droneBay`, updates per-drone stats (speed, capacity, mining rate). | Speed bonus +5% per level beyond the first. |
| `createAsteroidSystem` | Rotates asteroids, removes depleted ones, maintains target count using scanner level richness bias. | Scanner increases spawn richness by +5% per level. |
| `createDroneAISystem` | Assigns idle drones to nearest ore-rich asteroid, validates targets, ensures returning drones have travel plan. | Resets invalid targets to idle. |
| `createTravelSystem` | Advances travel interpolation and transitions drones to `mining` or `unloading` upon arrival. | Uses linear interpolation between cached vectors. |
| `createMiningSystem` | Mines ore while drone state is `mining`, respecting capacity and asteroid ore, transitions to returning when done. | Currently halts entirely when global energy ≤ 0.1; gradual throttling is a roadmap item. |
| `createUnloadSystem` | Transfers cargo to store ore, resets drone state/position to idle. | Calls `store.addOre` for deposit. |
| `createPowerSystem` | Computes generation vs. consumption and clamps energy to capacity. | No throttle feedback yet beyond mining guard noted above. |
| `createRefinerySystem` | Placeholder to eventually move ore→bars conversion out of the store. | TODO: implement once store exposes `processRefinery`. |

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

- [ ] Persistence manager integrated with store bootstrap and Settings UI delivered.
- [ ] Autosave/offline settings, import/export workflow, and migrations documented.
- [ ] Refinery ECS system implemented; offline simulation aligned with `processRefinery`.
- [ ] Energy throttle improvements validated with tests.
- [ ] RNG seed persisted and documented (new saves generate seed, import/export retains it).
- [ ] Responsive layout reviewed; performance target 60fps on modern browsers.
- [ ] README updated with developer setup, persistence instructions, and testing guidance.

## Spec Change Log

- 2025-02-14 — Refreshed spec to document current MVP, persistence/offline utilities, testing coverage, and roadmap gaps (DES002, TASK003).
- 2025-10-16 — Consolidated `idea.md` and initial implementation into `spec/spec-full-idea.md`, adding roadmap and priorities.

---

End of spec.
