# Implementation Plan — Space Factory

This implementation plan operationalizes the goals in `spec/spec-full-idea.md` by decomposing them into ordered milestones, concrete tasks, validation steps, and risk mitigations. It is the working roadmap for building out persistence, ECS refinements, energy management, deterministic RNG, polish, automated testing, and documentation.

---

## Guiding requirements

The following spec requirements steer the plan (see `spec/spec-full-idea.md`):

- **RQ-PERSIST** — Persistence manager must deserialize saves, cap offline progress, and start autosave once helpers exist.
- **RQ-001** — Store tick/refinery parity must be maintained as refinery logic moves into ECS.
- **RQ-POWER** — Energy simulation must remain accurate when introducing per-drone batteries and throttling.
- **RQ-DRONE-AI / RQ-MINING** — Drone behavior must stay deterministic after energy throttling adjustments.
- **Visual polish roadmap** — Maintain render performance while adding new visual aids.

---

## Iteration strategy

1. **Prep** — Confirm Memory Bank context, update `memory/activeContext.md` and task index before/after work sessions.
2. **Milestone loop** — For each milestone: finalize design notes, implement in small branches, and run unit/UI tests before moving on.
3. **Retrospective** — After each milestone, reassess risks and adjust sequencing (record changes in plan and Memory Bank).
4. **PR cadence** — Target one PR per milestone where feasible to keep review scope manageable; include design/test artifacts in each PR.

---

## Cross-milestone dependencies

- **Persistence foundations (M1)** unlock offline simulation updates (M2) and seeded RNG persistence (M4).
- **Refinery ECS (M2)** must precede energy throttling (M3) to avoid rework in mining/power systems.
- **Energy throttling (M3)** depends on Settings UI from M1 to expose throttle controls.
- **Seeded RNG (M4)** requires persistence hooks from M1 and may affect visual polish (M5) due to deterministic asset placement.
- **Testing/CI (M6)** builds on unit suites introduced in earlier milestones.
- **Migration/docs (M7)** rely on finalized persistence behavior and APIs from M1–M4.

Recommended execution order: M1 → M2 → M3 → M4 → M5 → M6 → M7, with visual polish (M5) adjustable if schedule pressure exists after core systems harden.

---

## Milestone 1 — Persistence Integration & Settings UI

**Priority:** High  **Estimated effort:** 1.5–3 days  **Spec refs:** RQ-PERSIST, persistence roadmap

### Objectives

- Persist the full store snapshot, support autosave/offline caps, and expose JSON import/export via a Settings UI.

### Detailed tasks

1. **Store enhancements (`src/state/store.ts`)**
   - Add `settings` slice with default fields (`autosaveEnabled`, `autosaveIntervalSec`, `offlineCapHours`, `notation`, `throttleFloor`).
   - Implement helper APIs: `applySnapshot`, `serializeStore`, `exportState`, `importState`, plus a delegating `processRefinery` placeholder returning refinery stats for now.
   - Ensure type definitions cover migrations, including optional fields for backward compatibility.
2. **Persistence manager (`src/state/persistence.ts`)**
   - Implement `load`, `start`, `stop`, `saveNow`, `exportState`, `importState` using `localStorage` key (document fallback behavior).
   - Handle version/migration map; log warnings for invalid payloads, and always back up previous saves before overwriting.
   - Add event hooks for `beforeunload`/`visibilitychange` and offline simulation invocation.
3. **Offline simulation**
   - Integrate `simulateOfflineProgress` with configurable cap. Use `settings.offlineCapHours` when computing delta hours.
4. **Settings UI (`src/ui/Settings.tsx`)**
   - Build a modal or panel triggered from an icon in the HUD. Include:
     - Autosave toggle + interval slider (with validation and tooltips).
     - Offline cap numeric input (hours) and notation selector (engineering vs scientific).
     - Export button (downloads JSON file) and Import button (file picker with validation feedback).
     - Display last save timestamp and error alerts.
   - Wire to Zustand store actions; disable import while autosave running to avoid concurrent writes.
5. **Bootstrap wiring (`src/main.tsx` / `src/App.tsx`)**
   - Initialize persistence manager before rendering UI, call `load()`, run offline simulation, then `start()` autosave.
   - Register cleanup on unmount.
6. **Telemetry & accessibility**
   - Emit console info for successful loads/saves; ensure Settings UI is keyboard accessible and has ARIA labels.

### Files to add/modify

- Modify: `src/state/store.ts`, `src/main.tsx`, `src/App.tsx` (depending on integration point)
- Add: `src/state/persistence.ts`, `src/ui/Settings.tsx`, supporting UI styles/tests as needed
- Update: `src/lib/offline.ts` to accept cap/notation parameters if required

### Acceptance criteria

- Game loads previous session, caps offline progress per settings, and starts autosave by default (10s).
- Users can export/import JSON saves from the Settings panel with validation and migration handling.
- Settings persist across reloads and update UI immediately (e.g., autosave interval reflects new value).

### Validation

- **Unit tests**: `state/persistence.test.ts`, `state/store.test.ts` for migrations, `ui/Settings.test.tsx` for form logic.
- **Playwright smoke**: automate export/import cycle and offline recap verification.
- **Manual**: Confirm autosave resumes after tab focus loss and that invalid imports surface friendly errors.

### Risks & mitigations

- **Corrupted imports** — Validate schema, keep backups, and surface errors without breaking store.
- **Autosave race conditions** — Debounce `saveNow` and pause autosave during import.
- **UI regression** — Keep Settings isolated (lazy loaded) to avoid bloating initial bundle.

### Iteration checkpoints

- After wiring store helpers, run tests and perform manual import/export to validate before adding UI.
- After UI integration, execute Playwright scenario; adjust plan if UX feedback indicates missing affordances.

---

## Milestone 2 — Refinery ECS System & Offline Alignment

**Priority:** High  **Estimated effort:** 1–2 days  **Spec refs:** RQ-001, refinery roadmap

### Objectives

- Move refinery logic from store tick into an ECS system to align real-time and offline processing paths.

### Detailed tasks

1. **System implementation (`src/ecs/systems/refinery.ts`)**
   - Create `createRefinerySystem(world, store)` returning `initialize`, `update`, and `cleanup` handlers.
   - Consume refinery modules, prestige bonuses, and ore inputs; emit processed bars and updated ore totals each tick.
2. **Store integration (`src/state/store.ts`)**
   - Expose `processRefinery(dt)` that proxies to the ECS system for offline use; ensure determinism with fixed timestep.
3. **Offline alignment (`src/lib/offline.ts`)**
   - Replace fallback tick conversion with iterative `processRefinery` calls using stored snapshot data.
   - Add parity tests comparing offline results to live tick for same intervals.
4. **Bootstrap wiring (`src/r3f/Scene.tsx`)**
   - Register the new refinery system in system initialization order (after mining/unload, before power if dependencies).
5. **Instrumentation**
   - Log discrepancies during development; optionally expose debug counters in dev tools overlay.

### Acceptance criteria

- Live gameplay and offline simulation produce identical ore→bar conversions given identical inputs.
- No regression to store tick logic; tests confirm parity.

### Validation

- **Unit tests**: `ecs/systems/refinery.test.ts`, `lib/offline.test.ts` parity checks.
- **Manual**: Compare ore/bar totals before/after offline catch-up for a known save.

### Risks & mitigations

- **Order-of-operations bugs** — Document system update order and add assertions.
- **Performance** — Ensure offline simulation batches iterations efficiently.

### Iteration checkpoints

- After system integration, freeze offline tests to catch regressions before moving to energy work.

---

## Milestone 3 — Energy Throttle & Per-Drone Battery

**Priority:** High  **Estimated effort:** 1.5–3 days  **Spec refs:** RQ-POWER, RQ-DRONE-AI, RQ-MINING

### Objectives

- Introduce per-drone battery mechanics and graceful throttling while keeping drone AI deterministic.

### Detailed tasks

1. **Data model updates (`src/ecs/world.ts`)**
   - Extend `DroneEntity` with `battery`, `maxBattery`, `charging` states. Initialize values in `createDrone` using module bonuses.
2. **Travel & mining adjustments (`src/ecs/systems/travel.ts`, `src/ecs/systems/mining.ts`)**
   - Deduct battery consumption per second; compute `energyFraction = clamp(battery / maxBattery, throttleFloor, 1)`.
   - Scale movement speed, mining rate, and energy usage by `energyFraction`.
3. **Power system charging (`src/ecs/systems/power.ts`)**
   - Allocate energy surplus to charge docked drones; respect power capacity and avoid negative energy.
4. **Settings integration (`src/ui/Settings.tsx`)**
   - Surface throttle floor slider/input with descriptive copy and safeguards.
5. **UI feedback**
   - Update HUD to display average battery levels or warnings when throttling triggers.

### Acceptance criteria

- Drones slow down smoothly when low on battery and recover when charged; they never halt completely unless energy depleted.
- Energy graphs remain stable; no infinite energy loops or negative values.

### Validation

- **Unit tests**: Extend `ecs/systems/mining.test.ts`, `ecs/systems/power.test.ts`, add `ecs/systems/travel.test.ts` coverage.
- **Simulation test**: Run deterministic scenario verifying battery drains and recharge curves.
- **Manual**: Observe throttling effect in dev build with debug overlays.

### Risks & mitigations

- **AI instability** — Maintain deterministic order; add tests covering drone state transitions.
- **UX confusion** — Provide tooltips and color cues when throttling occurs.

### Iteration checkpoints

- Validate deterministic behavior with seeded RNG (placeholder until M4) before promoting change to mainline.

---

## Milestone 4 — Seeded RNG

**Priority:** Medium  **Estimated effort:** 0.5–1.5 days  **Spec refs:** Deterministic RNG backlog

### Objectives

- Provide reproducible world generation through persisted RNG seeds.

### Detailed tasks

1. **RNG utility (`src/lib/rng.ts`)**
   - Implement deterministic generator (e.g., Mulberry32) with seed setter and `next()` helpers.
2. **Integration (`src/lib/math.ts`, `src/ecs/world.ts`)**
   - Route random-dependent operations through RNG instance; update signatures to accept RNG parameter.
3. **Persistence (`src/state/store.ts`, `src/state/persistence.ts`)**
   - Add `rngSeed` to store snapshot; generate new seed on fresh saves using `crypto.getRandomValues` fallback.
4. **Settings/Debug UI**
   - Optionally expose seed view/copy to clipboard for reproducibility.

### Acceptance criteria

- Importing a save reproduces identical asteroid layouts and resource distributions.
- Changing seed and starting new game yields new arrangement.

### Validation

- **Unit tests**: `lib/rng.test.ts` for deterministic sequences; integration test verifying same seed yields same world state.
- **Manual**: Compare exported saves with same/different seeds.

### Risks & mitigations

- **Performance** — Ensure RNG wrapper does not introduce overhead; precompute where necessary.
- **Backward compatibility** — Provide default seed for legacy saves during import migration.

### Iteration checkpoints

- After RNG integration, rerun drone/battery tests to confirm determinism unaffected.

---

## Milestone 5 — Visual Polish (Trails first)

**Priority:** Medium  **Estimated effort:** 1–3 days  **Spec refs:** Visual polish roadmap

### Objectives

- Improve readability with drone trails, enhanced factory visuals, and scanner highlights while guarding performance.

### Detailed tasks

1. **Drone trails (`src/r3f/Drones.tsx`)**
   - Experiment with Drei `Trail` vs. custom instanced lines; profile performance and choose approach.
   - Add toggles in Settings for low-spec devices.
2. **Factory visuals (`src/r3f/Factory.tsx`)**
   - Render module-based geometry variations (e.g., additional bays, lights) using instancing to avoid draw-call explosion.
3. **Scanner highlights (`src/r3f/Asteroids.tsx`)**
   - Apply emissive overlays or outline passes for high-value asteroids based on scanner level.
4. **Performance verification**
   - Capture FPS metrics before/after; ensure minimal regression (<5%).

### Acceptance criteria

- Visual additions render smoothly on baseline hardware and enhance game clarity.
- Settings allow disabling effects for accessibility/performance.

### Validation

- **Visual QA**: Manual passes with screenshot artifacts.
- **Automated**: Optional screenshot regression tests via Playwright if feasible.

### Risks & mitigations

- **GPU overhead** — Use instancing, dynamic resolution adjustments, and optional toggles.
- **Visual clutter** — Iterate with feedback; provide colorblind-friendly palettes.

### Iteration checkpoints

- After trails implementation, gather internal feedback before expanding to factory/scanner work.

---

## Milestone 6 — Tests & CI

**Priority:** High  **Estimated effort:** 1–2 days  **Spec refs:** Testing roadmap

### Objectives

- Consolidate automated testing (Vitest + Playwright) and wire CI workflows.

### Detailed tasks

1. **Unit test suite**
   - Ensure all tests from previous milestones are passing and documented.
   - Add coverage reports or snapshot comparisons where meaningful.
2. **Playwright scenarios**
   - Implement flows: import/export round-trip, offline recap display, settings adjustments, battery throttling visuals.
   - Use test fixtures for seeded RNG saves.
3. **CI integration**
   - Update GitHub Actions workflows (or add new) to run `npm run lint`, `npm test`, `npm run e2e` headless.
   - Cache dependencies to keep pipeline efficient.
4. **Developer documentation**
   - Update README/testing section with commands and troubleshooting tips.

### Acceptance criteria

- Local `npm test` and Playwright suites green; CI pipeline runs automatically on PRs.
- Test artifacts (screenshots/videos) stored for failed runs.

### Risks & mitigations

- **Flaky e2e tests** — Use deterministic seeds/timeouts, retry logic, and stable selectors.

### Iteration checkpoints

- After CI pipeline runs successfully in a branch, document setup in Memory Bank and README.

---

## Milestone 7 — Migration Helpers & Documentation

**Priority:** Low  **Estimated effort:** 0.5–1 day  **Spec refs:** Persistence/migration backlog

### Objectives

- Finalize import migrations, documentation, and performance/responsive checklists.

### Detailed tasks

1. **Migration helpers**
   - Extend `importState` to detect missing/legacy fields, apply defaults, and return migration logs for UI display or console.
2. **Documentation updates**
   - Add README sections covering save format, import/export instructions, offline behavior, and troubleshooting.
   - Document Settings options, throttle behavior, and seeded RNG.
3. **Performance/responsive audit**
   - Run manual passes on various device sizes; note any layout issues.
4. **Handoff notes**
   - Update Memory Bank (`progress.md`, `activeContext.md`) with final status and open questions.

### Acceptance criteria

- Import handles legacy saves gracefully and surfaces migration summary to the player.
- README reflects new features and includes performance/responsive findings.

### Validation

- **Unit tests**: Extend persistence tests with migration cases.
- **Manual**: Validate README instructions by following them on a clean environment.

### Risks & mitigations

- **Documentation drift** — Review spec and README in tandem; include doc update checklist in PR template if needed.

### Iteration checkpoints

- After migration helpers validated, close out open Memory Bank tasks and archive plan references.

---

## Continuous considerations

- **Backward compatibility** — Always provide migration paths and backups for saved data.
- **Performance budgets** — Monitor FPS and memory usage after each visual/system change.
- **Accessibility** — Ensure new UI components meet keyboard navigation and contrast guidelines.
- **Telemetry/logging** — Maintain structured logs for debugging persistence and ECS flows.
- **Testing discipline** — Run linting, unit, and e2e suites before merging each milestone PR; document results in PR body.

---

## Error handling matrix

| Scenario | Detection | Automatic handling | Player feedback | Telemetry/logging |
| --- | --- | --- | --- | --- |
| **Autosave failure (quota, storage unavailable)** | Wrap `localStorage.setItem` in try/catch and track error count per session. | Pause autosave loop, retry once after 5 seconds, and queue manual save prompt. | Surface toast/banner explaining that autosave paused with link to export manually. | Log structured warning with error message, quota bytes, and throttled repetition guard.
| **Import payload invalid (schema mismatch, JSON parse)** | Validate JSON via Zod schema before applying snapshot. | Abort import, keep previous state untouched, and clear pending file reference. | Modal error with actionable text (“JSON malformed” vs. “Fields missing: …”) and docs link. | Emit analytics event containing validation errors (redacted of payload) for debugging trends.
| **Migration version gap** | Compare payload `version` against supported map. | Route through migration pipeline, populating defaults for new fields; if unrecoverable, fallback to backup snapshot. | Show summary dialog enumerating applied migrations or failure message instructing to update game. | Record migration results and durations; tag unrecoverable migrations for alerting.
| **Offline simulation exceeds cap** | Calculate elapsed hours on load; compare to `settings.offlineCapHours`. | Clamp simulated hours to cap and store truncated delta for analytics. | Display recap banner noting cap applied to avoid unexpected jumps. | Log info with elapsed vs. capped hours for balancing reviews.
| **Persistence load missing key/corrupted** | Guard `localStorage.getItem` response and JSON parse inside try/catch. | Revert to fresh default store while stashing corrupt payload in `localStorage` backup key. | Notify via startup dialog that save could not be loaded and where backup stored. | Log error including stack trace and backup key reference; increment metric for failed loads.
| **Settings UI interaction errors (invalid input, throttling conflicts)** | Form-level validation with controlled components and Zustand actions returning status. | Reject state update, reset field to last valid value, and focus problematic input. | Inline validation message plus tooltip explaining acceptable range/format. | Track validation error type and frequency for UX follow-up.

---

## Unit testing strategy

- **Core principles**
  - Favor deterministic simulations with seeded RNG to avoid flaky assertions.
  - Collocate Vitest suites beside implementation files (`*.test.ts`) to ensure quick discovery.
  - Mirror offline vs. live execution paths in paired tests to guarantee parity.
- **Milestone mapping**
  - **M1 (Persistence & Settings)** — Unit tests for store serialization, persistence timing, and Settings form reducers; Playwright smoke for import/export UX and autosave banner.
  - **M2 (Refinery ECS)** — Focused unit tests validating ore→bar conversion, ECS update ordering, and offline parity harness using shared fixtures.
  - **M3 (Energy throttling)** — Simulation tests covering battery drain/charge curves, throttle boundaries, and deterministic AI pathing with seeded inputs.
  - **M4 (Seeded RNG)** — Pure function tests for RNG outputs and integration snapshot ensuring identical world state given same seed.
  - **M5 (Visual polish)** — Lightweight rendering tests verifying Settings toggles wire up correctly; optional screenshot regression tests for trails/highlights.
  - **M6 (CI)** — Meta-tests verifying coverage thresholds and Playwright reliability (retries, artifact generation) within pipeline.
  - **M7 (Migration & Docs)** — Regression tests expanding persistence suites with legacy payload fixtures and doc linting (markdown, links) if feasible.
- **Tooling**
  - Use Vitest with jsdom environment for UI/unit tests, `@testing-library/react` for interaction fidelity, and Playwright for cross-browser scenarios.
  - Integrate coverage reporting (`vitest --coverage`) into CI gating; set thresholds once baseline established.
  - Employ synthetic clocks (`vi.useFakeTimers`) in persistence tests to accelerate autosave/offline scenarios without real delays.

---

## Next actions

1. Confirm Memory Bank entries for persistence work (create/update task in `memory/tasks`).
2. Begin Milestone 1 by enhancing `src/state/store.ts` and scaffolding the persistence manager.
3. Prepare draft tests while implementing to ensure acceptance criteria stay testable.
