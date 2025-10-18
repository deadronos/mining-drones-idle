# Active Context

## Current Focus

Implement TASK017 (Factory Fleet Upgrades & Ownership): weighted drone return routing, per-factory ledgers, and selector-driven factory management UI.

## Recent Changes

- Drafted DES016 to outline per-factory resources, drone ownership, and selector UI interfaces.
- Logged TASK017 plan covering store/ECS updates, UI rebuild, and validation steps.
- Captured requirements RQ-026 through RQ-028 for routing distribution, per-factory energy, and UI selector expectations.

## Next Steps

1. Extend store models and migrations with per-factory energy/resource fields plus drone ownership metadata.
2. Update ECS systems (drone AI, unload, refining) to consume new helpers and enforce dock queues/energy caps.
3. Rebuild FactoryManager UI with selector navigation, per-factory upgrades, and drone roster display.
4. Implement validation tests (store, drone AI weighting, React panel) and refresh Playwright flow if necessary.

## References

- Task details: `memory/tasks/TASK017-factory-fleet-upgrades.md`
- Design: `memory/designs/DES016-factory-fleet-upgrades.md`
- Requirements: `memory/requirements.md` (RQ-026..RQ-028)
