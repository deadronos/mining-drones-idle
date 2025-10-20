# TASK029 — Implement Local-First Energy Priority

**Status:** Completed  
**Added:** 2025-10-20  
**Updated:** 2025-10-25

## Original Request

User requested that the energy system be reversed: factories should use their local energy first for refining and drone charging, and only draw from the global warehouse as a backup. Currently it's the opposite (global first, then local).

## Thought Process

**Current system (global-first):**

- Drone charging consumes global stored energy first; factory local only as backup.
- Factory processing pulls global energy into factories at start of tick; factories then consume locally.

**Desired system (local-first):**

- Drone charging consumes factory local energy first; global only as backup.
- Factory processing does NOT proactively pull global; factories consume local, and only tap global when depleted.
- Solar regen and per-factory energy upgrades become more valuable for autonomy.
- Encourages players to invest in local resilience rather than hoarding global reserves.

**Rationale:** Local-first creates factory autonomy, makes per-factory upgrades more impactful, and creates a more interesting energy economy where some factories are well-powered (high solar) and others draw from the global buffer.

## Implementation Plan

1. **Update drone charging logic in power system** (`src/ecs/systems/power.ts`):
   - Invert the charge priority: try factory local first, then global.
   - For each charging candidate drone, compute available factory energy (local + solar gain).
   - Charge from factory first, recording usage in `factoryEnergyUse`.
   - Only charge from global `stored` if factory is depleted.

2. **Update factory energy refills in processFactories** (`src/state/processing/gameProcessing.ts`):
   - Remove the upfront global energy pull loop (currently pulls global to fill factories).
   - Factories naturally consume local energy for idle, hauler, and refining.
   - After consumption, check if factory hits zero energy; if so, can optionally pull a small buffer from global (or leave at zero for now).

3. **Add/update tests** (`src/ecs/systems/power.test.ts` and `src/state/processing/gameProcessing.test.ts`):
   - Verify drone charging prioritizes factory local energy.
   - Verify drone charging falls back to global when factory is empty.
   - Verify factory processing no longer proactively pulls from global.
   - Verify solar regen still increases local energy.

4. **Validate integration**:
   - Run full test suite.
   - Run linter and typecheck.
   - Manual gameplay check (if applicable).

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                                | Status    | Updated    | Notes                                 |
| --- | ---------------------------------------------------------- | --------- | ---------- | ------------------------------------- |
| 1.1 | Implement drone charging local-first logic in power.ts     | Completed | 2025-10-25 | Inverted fromFactory/fromGlobal order |
| 1.2 | Implement factory processing local-first logic in gamePr.. | Completed | 2025-10-25 | Removed upfront global pull           |
| 1.3 | Add/update unit tests for power system                     | Completed | 2025-10-25 | 6 power tests pass                    |
| 1.4 | Add/update tests for factory processing                    | Completed | 2025-10-25 | 6 gameProcessing tests created/pass   |
| 1.5 | Run full test suite, lint, typecheck                       | Completed | 2025-10-25 | All 165 tests pass, lint clean        |

## Progress Log

### 2025-10-25

**Completed Implementation:**

1. **Modified `src/ecs/systems/power.ts` drone charging logic (lines ~38-80):**
   - Inverted priority: now charges drones from factory-local energy first
   - Falls back to global warehouse energy only when factory is depleted
   - Added factorySolarGain tracking to include solar regen in available factory energy
   - Charge order: (1) factory-local + solar gain, (2) global warehouse

2. **Modified `src/state/processing/gameProcessing.ts` factory processing (removed global pull):**
   - Removed upfront global energy pull loop that was pulling energy into factories
   - Factories now consume local energy only for idle drain, hauler maintenance, and refining
   - Factories sit at zero energy when local is depleted (no emergency pull)
   - Solar regeneration still fills factories locally up to capacity

3. **Refactored and created tests:**
   - `src/ecs/systems/power.test.ts`: Refactored all 6 tests to verify local-first drone charging
     - Charges from factory local first
     - Falls back to global when factory empty
     - Avoids negative energy
     - Prioritizes factory local over global
     - Regenerates factory energy via solar
     - Scales stored energy with organics/ice modifiers
   - `src/state/processing/gameProcessing.test.ts`: Created new test file with 6 tests for factory processing
     - Consumes local energy for idle drain
     - Sits at zero when local exhausted
     - Consumes local for hauler maintenance
     - Consumes local for refining
     - Does not pull from global when factory has energy
     - Applies both idle and hauler costs
   - `src/state/store.factories.test.ts`: Updated 1 integration test
     - Changed assertion from "drains global into factories" to "no proactive global pull"

4. **Test Suite Validation:**
   - All 165 tests pass ✅
   - Lint: clean (only React version warning, not an error)
   - Typecheck: clean ✅

**Key Behavioral Changes:**

- Factories now draw from local energy first → encourages per-factory autonomy
- Solar upgrades become more valuable → local resilience matters
- Global warehouse is now backup/buffer → prevents factories from starving but not primary
- Performance impact: minimal (no additional systems added, just reordered logic)

**Design Decisions Locked (from DES025):**

1. Factories sit at zero locally with fallback to global draw (not pull-on-demand emergency fill)
2. Solar ignored at capacity (overflow is waste, doesn't spill to global)
3. Minimal performance impact (no new systems, just priority inversion)

## Notes

- Design document: `/memory/designs/DES025-local-first-energy-priority.md`
- Key files to modify:
  - `src/ecs/systems/power.ts` — drone charging loop
  - `src/state/processing/gameProcessing.ts` — factory energy pulls and consumption
  - `src/ecs/systems/power.test.ts` — test drone charging priority
  - `src/state/processing/gameProcessing.test.ts` — test factory processing
- Related tests show current global-first behavior; update assertions to expect local-first.
