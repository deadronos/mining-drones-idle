# Active Context

## Current Work

### 🔄 **TASK060 – Shadcn UI Overhaul**

- Rebuilding the UI shell with nested collapsible sidebars and a mission-control header.
- Introducing a reusable `SidebarSection` component and reshaping the layout around the R3F canvas.
- Updating global styles to match shadcn-inspired surfaces, scrollable sidebar groups, and resizable handles.

### 🔄 **TASK050 – Full Parity Implementation**

- Added factory position/energy parity checks and deterministic-seed coverage in `tests/unit/step-parity.test.ts`.
- Added TS vs Rust offline comparison within 1% tolerance and kept existing offline determinism checks.
- Added `schemaVersion` (TS + Rust) with validation/defaults and migration defaulting; perf bench at `tests/perf/step-bench.spec.ts`.
- Added dedicated `wasm-parity` CI job running parity/perf suites; shadow-mode E2E now includes a 5s divergence-log guard.
- Remaining: asteroid/depletion + per-drone parity coverage, longer shadow-mode parity runs/nightly gating, WASM artifact caching, biome parity decision.

- Stabilized Playwright E2E after TS↔Rust handoff work:
  - Fixed hidden import file input interaction in `tests/e2e/import-invalid.spec.ts`.
  - Made `tests/e2e/factory-logistics.spec.ts` deterministic (snapshot-based setup + robust hauler-count handling).
  - Full `npm run e2e` suite now passes (shadow-mode Rust-enabled tests still skipped).

- Fixed late-step parity divergence caused by asteroid recycle semantics: Rust now re-keys asteroid IDs on respawn and invalidates drone targets, matching TS “remove + spawn new” behavior.

- Aligned RNG consumption between TS and Rust for drone asteroid targeting and path seeds by:
  - Moving TS pathSeed draw in `assignDroneTarget` to occur after region selection.
  - Restoring unconditional asteroid RNG burn in `GameState::from_snapshot` so Rust advances RNG to match TS asteroid spawning even when asteroid metadata is provided.

## Active Tasks

### ✅ **TASK045 – TypeScript WASM Bridge Implementation** (Just Completed)

- **Goal**: Implement the TypeScript bridge layer with graceful fallback.
- **Status**: Completed.
- **Completed**:
  - Extended `RustSimBridge` interface with full lifecycle: `init()`, `dispose()`, `isReady()`.
  - Added simulation methods: `step()` returns `TickResult`, `applyCommand()`, `simulateOffline()`.
  - Added snapshot methods: `exportSnapshot()`, `loadSnapshot()`.
  - Updated buffer types to match Rust `buffers.rs` (14 drone, 4 asteroid, 9 factory sections).
  - Created `src/lib/wasmLoader.ts` with WebAssembly feature detection and fallback.
  - Updated `useRustEngine` hook with `reinitialize()` and proper cleanup.
  - Created `useSimulationData` abstraction hook for TS/Rust data source switching.
  - All 245 tests pass.

### 🔄 **TASK043 – Full Rust → TypeScript Parity Rewrite**

- **Goal**: Replace Rust simulation skeleton with a 1:1 mapping of TS state, systems, and modifiers.
- **Status**: Implementation (Systems Complete).
- **Recent**:
  - Ported all remaining systems: Refinery, Power, Unload.
  - Updated ECS buffer layout with `haulers_assigned`.
  - Wired all systems into `api.rs` `step` function with correct modifiers.
  - Verified compilation of the full Rust codebase.
- **Next Steps**:
  - Verify runtime behavior (WASM build & integration).
  - Debug any logic mismatches.
  - Complete the TS-side integration (if not already done).

### 🔄 **TASK042 – Rust Integration & Parity Verification**

- **Goal**: Integrate `rust-engine` into the main game loop and verify parity.
- **Status**: Implementation Complete. Validation Pending.
- **Recent**:
  - Implemented `checkParity` and Shadow Mode.
  - Created `RustDrones` for direct WASM visualization.
  - Updated `Scene.tsx` to support engine switching.
  - **Fixed Parity Mismatch**: Fixed `sys_drone_ai` ignoring `RETURNING` state, causing drones to get stuck and not unload ore.
- Fixed `api.rs` crash when factory count is 0.
- Fixed `sys_power` unit test.
- **Next Steps**:
  - Run the game and verify "Shadow Mode" logs.
  - Fix any divergences found.
  - Implement `RustFactories` and `RustAsteroids` for full visual parity.

- 🚧 **TASK038 – Factory Metrics & Mini-Charts** remains in progress.
  - Factory Metrics tab now renders four sparklines with summary stats, sampling banner, and pause control.
  - Inline sparkline component ships on factory cards and hides when sampling disabled or empty.
  - Settings panel exposes metrics toggle, interval, and retention inputs; metrics helpers covered by new unit tests.
  - Sparklines now include descriptive titles/ARIA wiring and inline component gains narrated labels with dedicated Vitest coverage.
  - Metrics banner now surfaces the most recent sampling time so players can relate charts to gameplay moments.

---

## Recent Completions

✅ **Completed: TASK056 – Logistics Parity Implementation**

- Ported Rust logistics scheduler to mirror TS reservations (factory↔factory/warehouse, upgrade requests) and hauler config resolution; added upgrade request schema support.
- Added logistics parity unit test comparing scheduled transfers/reservations and rebuilt WASM artifacts.

✅ **Completed: TASK058 – Rendering & Bridge Integration**

- Rust rendering now reads drones, asteroids, and factories from Rust buffers when `useRustSim` is enabled; colors/scale derive from ore/resource profiles with TS biome fallback.
- HUD/Factory panels use Rust buffer aggregates via `useRustHUD` with graceful TS fallback and bridge readiness gating; selection clicks are disabled in Rust mode to avoid stale IDs.

✅ **Completed: TASK057 – Commands, Snapshot & Offline Parity**

- Aligned Rust command handlers with TS costs/effects (module/factory upgrades, hauler assignment, prestige gain, recycle asteroid sync) and tightened command parity tests to require zero drift.
- Rust offline simulation now mirrors TS refinery-only path with sink bonuses via the new WASM offline API; schemaVersion normalized/validated and covered by round-trip snapshot tests.

✅ **Completed: TASK052 – Parity Test Expansion & Measurement**

- Added shared parity logger (`PARITY_DEBUG`/`--debug-parity`) and optional enforcement flag (`PARITY_ENFORCE`), expanded step/offline/command parity suites, and enhanced shadow-mode E2E with rolling metrics and screenshot capture on drift.

✅ **Completed: TASK045 – TypeScript WASM Bridge Implementation**

- Extended `RustSimBridge` interface with full lifecycle and snapshot methods.
- Created `wasmLoader.ts` with WebAssembly feature detection and graceful fallback.
- Created `useSimulationData` abstraction hook.
- Updated `useRustEngine` with proper cleanup and reinitialize support.

✅ **Completed: TASK044 – Rust Critical Fixes & WASM Build**

- Fixed let-chain syntax errors (Rust 2024 feature in 2021 edition).
- Added safe slice helper methods to BufferSection.
- WASM build successful with wasm-pack.

✅ **Completed: TASK041 – Rust Simulation Systems & Logic Port**

- Implemented core ECS systems in Rust: Movement, Mining, Power, Refinery.
- Updated `wasmSimBridge.ts` to expose all SoA buffers.
- Verified parity with unit tests.

✅ **Completed: TASK040 – Rust Simulation Core**

- Scaffolding `/rust-engine` crate completed with RNG parity tests, snapshot import/export, layout planner, and data buffer.
- Implemented TS bridge (`wasmSimBridge`) matching `wasm-bindgen` class structure.

✅ **Completed: TASK053 – Drone AI & Travel Parity**

- Weighted asteroid targeting/region offsets, queue-aware returns, and travel seed/control parity matched to TS. RNG burn/path seed fixes keep flight seeds aligned in parity suites; rebuilt WASM and validated with `npm run typecheck`, `npm run lint`, `npm run test`.

✅ **Completed: TASK054 – Asteroids & Biomes Parity**

- Biome-driven respawn replaces uniform weights; scanner/sink richness multipliers applied, RNG draw count (11) mirrored, gravity metadata refreshed, and respawn parity test added. Validated with `npm run build:wasm`, `npm run typecheck`, `npm run lint`, `npm run test`.

✅ **Completed: TASK055 – Power & Refinery Alignment**

- Rust power/refinery now uses factory-specific idle/hauler drains, solar regen with effective caps, local-first drone charging (owner/target factory), and refinery slot start/tick parity. Added wasm parity test; `npm run build:wasm`, `npm run typecheck`, `npm run lint`, `npm run test` passing (parity divergence logs expected).

## Next Steps

1. **TASK046** – Expand `SimulationCommand` enum to support `BuyModule`, `DoPrestige`, etc.
2. **TASK047** – Store integration with feature flag routing commands through bridge.
3. **TASK048** – Parity testing suite for RNG, step, and offline simulation.
4. **TASK049** – Rendering integration to read positions from bridge when enabled.
