# DES020 — Factory Solar Regeneration Upgrade

**Status:** Draft  
**Date Created:** 2025-10-23  
**Date Last Updated:** 2025-10-23

## Design Overview

Introduce a per-factory solar collector upgrade that passively regenerates local factory energy each power tick. The upgrade extends the existing `FactoryUpgrades` model with a new solar track, adds a corresponding entry to `factoryUpgradeDefinitions`, and augments the power system so factories with collectors replenish their energy stores before the global grid is tapped. This work satisfies requirement RQ-035.

## Architecture & System Design

### Upgrade Definition

- Add `solar` to `FactoryUpgrades` and `FACTORY_CONFIG` derived defaults.
- Extend `factoryUpgradeDefinitions` with a `"solarCollector"` entry:
  - Costs: consume metals + crystals to align with energy infrastructure fantasy.
  - Effects: increments `factory.upgrades.solar` and stores a per-level regen bonus metadata (`factory.solarRegenPerSec` derived from config).
- Update persistence helpers (`snapshotToFactory`, `factoryToSnapshot`, migrations) to include the new upgrade slot with backward-compatible defaults.

### Power System Integration

- Introduce constants: `FACTORY_SOLAR_BASE = 0.25` energy/sec and `FACTORY_SOLAR_PER_LEVEL = 0.5` energy/sec (tunable).
- During `createPowerSystem` processing:
  1. Calculate per-factory solar contributions once per tick (e.g., map of `factoryId -> regenAmount * dt`).
  2. Before drone charging, add the solar regen to factory energy, clamping by `energyCapacity`.
  3. Record the actual energy added to allow telemetry or UI display (future optional).
- Ensure solar regen runs even if the global grid is empty, providing a soft recovery path for isolated factories.

### Store & ECS Touchpoints

- Update `processFactories` to avoid double-counting energy; regen occurs exclusively in power system.
- Consider exposing `getFactorySolarRegen(factory)` selector for UI use (tooltip copy in FactoryManager).
- Optionally display solar upgrade level/regen rate in the factory inspector.

## Data Flow

```
Power tick
  -> compute solar regen per factory (base + per level)
  -> clamp and apply to factory.energy (min with capacity)
  -> proceed with existing global energy generation
  -> attempt drone charging (global first, then factory pools)
```

## Interfaces & Data Model Changes

- `FactoryUpgrades`: add `solar: number`.
- Factory snapshot schema: include `upgrades.solar` with migration default `0`.
- New optional derived field `factory.solarRegenPerSec` stored for quick lookup (or computed on the fly).
- UI: extend upgrade enum with `"solarCollector"` option and attach description strings.

## Error Handling

- Clamp regen contributions to avoid floating point drift (epsilon tolerance).
- Skip regen for factories flagged as decommissioned (if applicable later).
- Ensure migration populates `upgrades.solar = 0` for legacy saves.

## Testing Strategy

1. **Power system solar regen:** unit test seeds factory with upgrade levels, runs `createPowerSystem`, and validates energy gain and capacity clamping.
2. **Upgrade purchase flow:** store-level test buys the solar upgrade and confirms level increments plus cost deduction.
3. **Persistence roundtrip:** serialization test saves a world with solar upgrades and verifies values survive load.
4. **UI availability (optional):** component test ensures solar upgrade button renders with correct cost and tooltip.

## Implementation Plan

1. Extend requirements (RQ-035) and create Task021 record (see TASK020 follow-up).
2. Add solar upgrade fields to factory models, snapshots, and migrations with default zero.
3. Register `"solarCollector"` in `factoryUpgradeDefinitions` and surface the button in FactoryManager UI.
4. Update power system to apply per-factory solar regen before drone charging; wire constants for tuning.
5. Write unit tests covering regen math, upgrade purchase, and persistence snapshots.
6. Update documentation/tooltip strings and optionally expose regen rate in the inspector.
