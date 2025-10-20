# TASK021 — Factory Solar Regeneration Upgrade

**Status:** Completed  
**Added:** 2025-10-23  
**Updated:** 2025-10-23

## Original Request

Evaluate the optional factory solar regeneration upgrade identified in DES019/TASK020 and formalize a plan to implement it, including requirements, design, and execution tasks.

## Thought Process

- RQ-035 captures the behaviour: factories with solar collectors should regenerate energy each power tick without exceeding local capacity.
- The existing energy upgrade only raises capacity; a distinct solar collector upgrade provides a complementary regen mechanic.
- Implementing the upgrade requires schema updates (new `solar` slot), migration defaults, UI exposure, and power system adjustments to add regen ahead of the drone charging phase.
- Tests must cover regen math, purchase flows, and persistence to avoid regressions in save files.

## Implementation Plan

1. Update factory models, snapshots, and migrations to include a `solar` upgrade level with legacy defaults.
2. Add `solarCollector` to `factoryUpgradeDefinitions`, configure costs/tooltips, and expose the upgrade in the FactoryManager UI.
3. Introduce solar regen constants and integrate per-factory regeneration into `createPowerSystem`, ensuring energy clamps and order of operations remain correct.
4. Extend unit tests (power system, store upgrades, serialization) to validate regen behaviour and persistence.
5. (Optional) Surface solar regen stats in the factory inspector and document the feature in player-facing copy.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                                              | Status     | Updated    | Notes |
| --- | -------------------------------------------------------- | ---------- | ---------- | ----- |
| 1.1 | Add solar upgrade field to factories + migrations        | Completed  | 2025-10-23 | Added `solar` to upgrades, serialization, and new 0.3.1 migration. |
| 2.1 | Register solar collector upgrade and UI controls         | Completed  | 2025-10-23 | Added `solar` definition, costs, and FactoryManager display. |
| 3.1 | Implement solar regen in power system with constants     | Completed  | 2025-10-23 | Power system applies passive regen mapped per factory. |
| 4.1 | Add unit/persistence tests for solar regen and upgrades  | Completed  | 2025-10-23 | New vitest coverage for power system regen and upgrade flow. |
| 5.1 | Update UI/tooltips/documentation (optional polish)       | Completed  | 2025-10-23 | Factory panel shows solar regen rate; design notes updated. |

## Progress Log

### 2025-10-23

- Recorded RQ-035 and authored DES020 outlining architecture, interfaces, and validation strategy for per-factory solar regeneration.
- Logged TASK021 to track model, UI, power system, and testing work needed to deliver the upgrade.
- Implemented solar collector upgrade: schema/migrations, upgrade definitions, UI presentation, and power system regen flow.
- Added vitest coverage for solar charging and upgrade purchasing; full suite (`npm run test`) passes post-change.
