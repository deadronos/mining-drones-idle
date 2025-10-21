# DES028: Hauler Tech Upgrades (Hybrid Global + Per-Factory)

**Status**: Approved  
**Created**: 2025-10-21  
**Last Updated**: 2025-10-21  
**Author**: Design Discussion

---

## Overview

Add a hauler technology upgrade system using a **hybrid approach**: global warehouse modules provide baseline improvements to all haulers, with optional per-factory specialization for advanced tuning. This addresses transfer congestion (206+ queued transfers observed) and provides late-game progression for logistics optimization.

---

## Problem Statement

- **Transfer bottleneck**: With only one warehouse capacity pool and default hauler configs, transfers queue up rapidly as player expands (observed: 206+ active transfers)
- **No late-game logistics progression**: Once warehouses are set up, there's no reason to invest further in hauling efficiency
- **Limited player agency**: Haulers have static performance; players can't optimize for their play style

---

## Design Decisions (EARS Requirements)

| Requirement              | Behavior                                                                                                                                    | Acceptance Criteria                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Global baseline**      | WHEN a player purchases a global hauler module, THE SYSTEM SHALL apply the upgrade to all haulers in the network                            | All factories' hauler configs reflect the global multiplier                       |
| **Per-factory override** | WHEN a player upgrades a specific factory's hauler, THE SYSTEM SHALL allow fine-tuning beyond the global baseline at higher cost            | Factory override costs 2–3x more than global; config applies only to that factory |
| **Transfer throughput**  | WHEN hauler capacity or speed increases, THE SYSTEM SHALL reduce transfer congestion and improve warehouse fill rates                       | Logistics tick count (transfers queued) decreases as upgrades are purchased       |
| **Progression**          | WHEN the player unlocks hauler upgrades, THE SYSTEM SHALL present them in a clear upgrade tree matching the factory/module upgrade metaphor | UI shows hauler upgrade panel with cost breakdown and effect preview              |

---

## Architecture

### 1. Global Hauler Modules (Warehouse-Level)

Add three new modules to the warehouse module system (`state/modules`):

```typescript
interface HaulerModules {
  haulerDepot?: number; // Increases capacity & baseline speed
  logisticsHub?: number; // Reduces pickup/dropoff overhead
  routingProtocol?: number; // Bonus to matching algorithm (future)
}
```

**Module Definitions**:

| Module               | Cost Base    | Per-Level Effect                | Max Level | Use Case                   |
| -------------------- | ------------ | ------------------------------- | --------- | -------------------------- |
| **Hauler Depot**     | 60 metals    | +10 capacity, +5% speed         | 20        | Primary throughput booster |
| **Logistics Hub**    | 80 metals    | −10% overhead (pickup+dropoff)  | 15        | QoL: faster turnaround     |
| **Routing Protocol** | 100 crystals | +2% surplus matching efficiency | 10        | Optimization (future)      |

**Implementation**:

- Add fields to `state/modules` (module registry)
- Create `getHaulerModuleBonuses(modules)` utility that returns aggregated multipliers
- Update `LOGISTICS_CONFIG` resolution to apply bonuses

---

### 2. Per-Factory Hauler Upgrades (Factory-Level)

Allow factories to purchase optional overrides beyond the global baseline:

```typescript
interface FactoryHaulerUpgrades {
  capacityBoost?: number; // +5 items per level, replaces global
  speedBoost?: number; // +0.1 tiles/s per level, replaces global
  efficiencyBoost?: number; // −5% overhead, stacks with global
}
```

**Costs** (per-factory, higher to discourage over-upgrading):

- Capacity Boost Lv1: 50 metals (vs. global Lv1: 60 metals network-wide)
- Speed Boost Lv1: 40 metals
- Efficiency Boost Lv1: 60 crystals

**Implementation**:

- Add fields to `BuildableFactory` type
- Store in factory snapshot for persistence
- `resolveHaulerConfig()` merges global + per-factory bonuses

---

### 3. Config Resolution Chain

When computing a factory's hauler config, resolve in order:

```
1. Defaults (LOGISTICS_CONFIG)
2. Apply global module bonuses (getHaulerModuleBonuses)
3. Apply per-factory overrides (if purchased)
4. Return merged config
```

Example:

```typescript
const globalMultiplier = getHaulerModuleBonuses(state.modules);
const factory = state.factories[i];
const config = {
  capacity:
    50 * globalMultiplier.capacityMult + (factory.haulerUpgrades?.capacityBoost ?? 0),
  speed:
    1.0 * globalMultiplier.speedMult + (factory.haulerUpgrades?.speedBoost ?? 0),
  ...
};
```

---

## UI / UX

### Warehouse Panel (New Hauler Tab)

Add a "Logistics" tab to the warehouse panel showing:

- **Active Module Upgrades**: Grid of module cards (Hauler Depot Lv3, etc.)
- **Purchase Buttons**: For next level of each module
- **Network Effect**: Show global bonuses (+40% capacity, +15% speed, etc.)
- **Next Module Cost**: Clearly displayed with affordability check

### Factory Inspector (New Hauler Upgrades Section)

Within each factory's hauler section:

- **Show per-factory override options** (collapsible)
- **Cost + effect preview** before purchase
- **Badge indicator** if factory is above/below global baseline

### Logistics Panel (Existing)

Optionally add a summary row:

- "Network Bonuses: +30% capacity, +10% speed"

---

## Data Schema

### Module Registry Extension

```typescript
// In state/types.ts
export interface Modules {
  // ... existing ...
  haulerDepot?: number;
  logisticsHub?: number;
  routingProtocol?: number;
}
```

### Factory Upgrades Extension

```typescript
export interface BuildableFactory {
  // ... existing ...
  haulerUpgrades?: {
    capacityBoost?: number;
    speedBoost?: number;
    efficiencyBoost?: number;
  };
}
```

### Snapshot Persistence

Update `FactorySnapshot` and `StoreSnapshot` to include the new fields.

---

## Migration

When loading old saves:

- Initialize `state.modules.haulerDepot` etc. to 0 (no upgrades)
- Initialize `factory.haulerUpgrades` to undefined (no overrides)
- No loss of functionality; old saves continue to work with defaults

Bump `SAVE_VERSION` to `'0.3.3'`.

---

## Implementation Phases

### Phase 1: Module Registry & Config

1. Add module fields to types
2. Implement `getHaulerModuleBonuses()`
3. Update `resolveHaulerConfig()` to apply bonuses
4. Add unit tests for multiplier stacking

### Phase 2: Purchase Logic

1. Extend store methods: `purchaseHaulerModule()`, `purchaseFactoryHaulerUpgrade()`
2. Deduct costs from warehouse bars/metals/crystals
3. Add validation (affordability, max level)

### Phase 3: UI

1. Add Hauler Upgrades section to warehouse panel
2. Add per-factory override UI in factory inspector
3. Update logistics panel summary

### Phase 4: Persistence

1. Update snapshot serialization
2. Add migration logic
3. Bump save version + migration tests

### Phase 5: Tuning & Polish

1. Adjust costs based on playtesting
2. Add tooltips explaining global vs. per-factory
3. Performance check (ensure bonus calculations don't slow ticks)

---

## Success Criteria

- ✅ Global hauler modules scale all factories consistently
- ✅ Per-factory overrides allow optional specialization (no required use)
- ✅ Transfer congestion observable decreases with upgrades
- ✅ New save version handles old saves gracefully
- ✅ UI clearly explains global + per-factory mechanics
- ✅ Cost scaling feels rewarding (not too cheap, not grindy)
- ✅ No regression in existing tests

---

## Future Extensions

1. **Routing Protocol effects**: Implement smarter matching algorithm at higher protocol levels
2. **Specialization bonuses**: e.g., "Ore Express" factory gets +50% speed if carrying only ore
3. **Prestige interaction**: Hauler module levels partially retained after prestige
4. **Logistics analytics**: Dashboard showing average transfer time, efficiency %, bottleneck detection
5. **Warehouse as entity**: Hauler upgrades could be purchasable at a warehouse building (DES027)

---

## Trade-offs & Rationale

| Decision                      | Alternative         | Why Chosen                                                                 |
| ----------------------------- | ------------------- | -------------------------------------------------------------------------- |
| Hybrid (global + per-factory) | Pure global modules | Gives late-game players more agency; avoids "set and forget"               |
| Capacity first                | Speed first         | Transfers are queued by capacity; speed helps less                         |
| Metals/crystals cost          | Bars cost           | Encourages factory refinement chains; doesn't compete with hauler purchase |
| Multiplier stacking           | Absolute bonuses    | Scales better into late game; easier to balance                            |

---

## Open Questions

1. **Max levels**: Should modules have hard caps (e.g., Lv20) or scale indefinitely?
2. **Per-factory cost scaling**: Should overrides cost exponentially or linear?
3. **Prestige reset**: Do hauler modules reset on prestige, or are they preserved with prestige cores?
4. **Routing Protocol**: What does +2% "matching efficiency" actually do mechanically? (Deferred to Phase 5)

---

## Links & References

- **Related**: DES018 (Per-Factory Upgrades), DES021 (Warehouse Reconciliation), DES027 (Warehouse Entity)
- **Code locations**: `src/state/modules`, `src/ecs/logistics.ts`, `src/state/processing/logisticsProcessing.ts`
- **Current issue**: 206+ transfers queued → capacity/speed bottleneck
