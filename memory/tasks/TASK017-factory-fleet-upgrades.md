# TASK017 — Factory Fleet Upgrades & Ownership

**Status:** In Progress
**Added:** 2025-10-21
**Updated:** 2025-10-21

## Summary

Implement weighted drone return routing, per-factory energy/resource ledgers, and a selector-based factory management UI with per-factory upgrades and drone ownership display.

## Goals

- Fulfil requirements RQ-026, RQ-027, and RQ-028.
- Ensure persistence, migrations, and tests cover new factory and drone fields.
- Maintain deterministic behaviour for seeded simulations despite randomized routing weights.

## Non-Goals

- Rebalancing factory costs or refining throughput beyond what new upgrades require.
- Introducing new resource types beyond existing ore/bars/metals/crystals/organics/ice.

## Design Reference

- `memory/designs/DES016-factory-fleet-upgrades.md`

## Implementation Plan (6-Phase Loop)

### Phase 1 — Analyze

- [x] Capture requirements RQ-026 to RQ-028.
- [x] Draft DES016 covering architecture, interfaces, and test strategy.
- [ ] Confirm impact on persistence snapshots and migrations.

### Phase 2 — Design

- [ ] Detail per-factory upgrade costs and leveling mechanics aligned with existing moduleDefinitions.
- [ ] Define weighting constants for routing randomness (e.g., nearest weight 0.7, others share 0.3).
- [ ] Specify UI layout updates and accessibility checks for selector controls.

### Phase 3 — Implement

1. Extend store data models (factories, drones, snapshots, migrations) with per-factory resources/energy and drone ownership.
2. Update ECS systems (`droneAI`, `unload`, `travel`, `mining`, `power`) to respect new routing/energy rules and transfer logic.
3. Rebuild `FactoryManager` UI with selector navigation, per-factory upgrade purchase actions, and drone roster list.
4. Wire upgrades to consume per-factory resources and adjust stats (docking capacity, energy cap, etc.).

### Phase 4 — Validate

- Add/extend unit tests: store factory processing, drone AI routing weights, UI selector interactions.
- Update Playwright scenario if UI flow changes materially.
- Run `npm run lint`, `npm run typecheck`, `npm run test`.

### Phase 5 — Reflect

- Document follow-up tuning needs (e.g., balancing randomness weights, upgrade costs).
- Update memory progress log with outcomes and open questions.

### Phase 6 — Handoff

- Prepare PR summary referencing DES016 and TASK017.
- Ensure reviewer notes cover testing evidence and outstanding TODOs.

## Dependencies

- Existing factory buyable infrastructure (TASK016).
- Drone AI target assignment (TASK012).

## Risks & Mitigations

- **Routing randomness destabilizes determinism:** Use seeded RNG from world/store to ensure reproducibility.
- **Per-factory resources desync from global HUD:** Provide aggregate selectors that recompute from factory data each tick.
- **UI complexity:** Build modular components (selector header, stats grid, upgrades section) to keep readability high.

## Status Log

- 2025-10-21 — Initialized task, captured requirements and design draft. Implementation pending.

### 2025-10-19 - Verification

- Local verification performed on 2025-10-19:
  - `npm run typecheck` completed with no TypeScript errors.
  - `npm run test` executed successfully as part of the full test suite run; relevant factory/drone tests passed.
  - `npm run build` completed successfully.

Next steps: add concrete migration plan and per-factory snapshot examples; define upgrade cost table and routing weighting constants in code.
