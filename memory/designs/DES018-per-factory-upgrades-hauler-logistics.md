# DES018: Per-Factory Upgrades & Hauler Logistics

**Status:** Draft  
**Created:** 2025-10-19  
**Updated:** 2025-10-19

## Executive Summary

With multiple buyable factories now in the game, this design addresses:

1. Which global upgrades/resources should remain global vs become per-factory
2. Introduction of "hauler drones" to redistribute resources between factories
3. Migration strategy for existing saves
4. Implementation guidance mapped to repository structure

**Key Decisions:**

- Keep empire-level tech (scanner, prestige, global fleet) global
- Move throughput/storage/speed mechanics to per-factory where they affect local operations
- Add hauler drones as configurable per-factory logistics using reservation-based scheduling
- Provide save migration and UI to explain differences

---

## Current State Analysis

### Global Modules (from `src/state/store.ts`)

```typescript
moduleDefinitions = {
  droneBay: { label: 'Drone Bay', baseCost: 4, description: '+1 drone, +5% travel speed' },
  refinery: { label: 'Refinery', baseCost: 8, description: '+10% bar output' },
  storage: { label: 'Storage', baseCost: 3, description: '+100 ore capacity' },
  solar: { label: 'Solar Array', baseCost: 4, description: '+5 energy/s, +25 max energy' },
  scanner: { label: 'Scanner', baseCost: 12, description: '+5% new asteroid richness' },
}
```

### Per-Factory Upgrades (already exist)

```typescript
factoryUpgradeDefinitions = {
  docking: { label: 'Landing Bay', description: '+1 docking slot' },
  refine: { label: 'Refinery Line', description: '+1 refine slot' },
  storage: { label: 'Bulk Storage', description: '+150 ore storage' },
  energy: { label: 'Capacitors', description: '+30 local energy capacity' },
}
```

### Global Resources & Modifiers

**Resources:** `ore`, `ice`, `metals`, `crystals`, `organics`, `bars`, `energy`, `credits`

**Modifiers** (from `src/lib/resourceModifiers.ts`):

- Computed from global totals of metals/crystals/organics/ice
- Produce empire-wide multipliers: `droneCapacityMultiplier`, `refineryYieldMultiplier`, `energyStorageMultiplier`, etc.
- Used in `computeRefineryProduction`, `getStorageCapacity`, `getEnergyCapacity`

### Overlap & Friction Points

1. **Storage Duplication:**
   - `modules.storage` → global central storage cap
   - `factory.upgrades.storage` → per-factory local buffer
   - Both are legitimate but need clear UX distinction

2. **Drone Count Split:**
   - `modules.droneBay` → global fleet size + speed
   - `factory.dockingCapacity` + `factory.ownedDrones` → per-factory allocation
   - Mixed model needs clarification

3. **Refinery Overlap:**
   - `modules.refinery` → global yield multiplier (used in `computeRefineryProduction`)
   - `factory.refineSlots` → per-factory parallelism
   - Complementary but could add per-factory yield option

---

## Design Recommendations

### A. Keep Global (Empire-Level)

**Rationale:** These affect player-wide strategy, economy, or unlocks

- **`scanner`** — global tech unlock affecting all asteroid generation
- **`solar`** — global energy generation (though `factory.upgrades.energy` adds local capacity)
- **`prestige`** — persistent cross-run progression
- **`modules.refinery`** — keep as baseline global yield multiplier
- **`modules.storage`** — keep as central/empire storage cap (distinct from factory buffers)
- **Resource modifiers** (`getResourceModifiers`) — keep as empire bonuses derived from global totals

### B. Make Per-Factory (Local Operations)

**Rationale:** These affect single-factory throughput, capacity, or internal behavior

- **Per-factory yield/speed** — add optional local refinery yield bonus or make `factory.upgrades.refine` grant both slots + small yield
- **Factory specialization** — emphasize `factory.upgrades` as place for storage, docking, energy, and future specializations
- **Hauler assignments** — per-factory configurable (counts, priority, filters, mode)

### C. Clarify Mixed Systems

**`modules.droneBay` (global fleet):**

- **Option 1 (Recommended):** Keep as global fleet cap; enhance `factory.upgrades.docking` to control local throughput/speed bonuses
- **Option 2:** Convert part into per-factory purchasable drones

**Decision:** Use Option 1 (minimal friction). Keep global fleet, add per-factory assignment UI.

---

## Hauler Drones Design

### Purpose

Lightweight logistics layer to move resources between factories, reducing starvation and excess, approximating inventory equalization.

### High-Level Behavior

- **Dispatch-transfer model** (not full pathfinding): each tick, haulers check source/destination inventories and schedule batch transfers
- **Auto-mode:** system finds supply/demand pairs based on thresholds
- **Manual-mode:** player assigns routes or priorities
- Operate on `factory.resources` (local inventories), NOT `state.resources` (global pool)

### Key Parameters

```typescript
interface HaulerConfig {
  capacity: number;           // items per trip (default: 50)
  speed: number;              // tiles/s (default: 1.0)
  pickupOverhead: number;     // seconds (default: 1.0)
  dropoffOverhead: number;    // seconds (default: 1.0)
  resourceFilters: string[];  // e.g., ['ore', 'metals']
  mode: 'auto' | 'manual' | 'demand-first' | 'supply-first';
  priority: number;           // 0-10
}

interface FactoryLogisticsState {
  outboundReservations: Record<string, number>;  // resource → reserved amount
  inboundSchedules: Array<{
    fromFactoryId: string;
    resource: string;
    amount: number;
    eta: number;  // game time when arrival occurs
  }>;
}
```

### Scheduling Algorithm

**Frequency:** Every 1-5 seconds (configurable)

**Steps:**

1. **Sampling:** For each resource R, collect factories that produce/accept R
2. **Buffer Target:** `target = buffer_seconds * consumption_rate` (e.g., 30s * rate)
3. **Need & Surplus:**
   - `need = max(0, target - current_inventory)`
   - `surplus = max(0, current_inventory - target - min_reserve)` (min_reserve: 5s worth)
4. **Matching:** Greedily match highest surplus → highest need, prefer shorter travel_time
5. **Reservation:** Reserve at source immediately to prevent double-booking
6. **Execute:** Schedule transfer; decrement source on dispatch, increment destination on arrival
7. **Smoothing:** Add cooldown to prevent thrashing (e.g., 20% difference threshold, no back-and-forth within X seconds)

### Travel Time Calculation

```typescript
const distance = factoryA.position.distanceTo(factoryB.position);
const travel_time = (distance / hauler.speed) + hauler.pickupOverhead + hauler.dropoffOverhead;
```

### Edge Case Protections

- **Min reserve:** Never reduce factory below `min_reserve_seconds` worth of resources
- **Batch size:** Use multiples of recipe batch size where applicable
- **Canceled trips:** If source consumed before pickup, release reservation and reschedule
- **Factories offline:** Deliver to fallback hub or return to source

---

## Data Shape Changes

### Extend `FactorySnapshot` & `BuildableFactory`

```typescript
interface FactorySnapshot {
  // ... existing fields ...
  haulersAssigned?: number;
  haulerConfig?: HaulerConfig;
  logisticsState?: FactoryLogisticsState;
}
```

### Add to `StoreState`

```typescript
interface StoreState {
  // ... existing fields ...
  logisticsQueues?: {
    pendingTransfers: Array<{
      id: string;
      fromFactoryId: string;
      toFactoryId: string;
      resource: string;
      amount: number;
      status: 'scheduled' | 'in-transit' | 'completed';
      eta: number;
    }>;
  };
}
```

---

## Implementation Plan

### Code Locations

**Primary:**

- `src/state/store.ts` — add hauler fields, logistics state, `processLogistics(dt)` method
- `src/ecs/logistics.ts` (new) — scheduler, matching algorithm, reservation logic
- `src/lib/resourceModifiers.ts` — keep as-is (global modifiers)
- `src/config/resourceBalance.ts` — keep as-is (tuning)

**UI:**

- `src/ui/UpgradePanel.tsx` — global modules (keep current)
- `src/ui/LogisticsPanel.tsx` (new) — global logistics overview
- `src/ui/FactoryInspector.tsx` — add hauler assignment controls

**Tests:**

- `tests/unit/logistics.spec.ts` (new) — scheduling, reservations, no global sum drift
- `tests/e2e/persistence.spec.ts` — update to include new snapshot fields
- `tests/e2e/factory-logistics.spec.ts` (new) — integration test for starvation resolution

### Pseudo-Code: processLogistics

```typescript

// In src/state/store.ts, add to StoreState methods
processLogistics(dt: number) {
  // Only run every N seconds (configurable tick rate)
  if (this.logisticsTick < LOGISTICS_INTERVAL) {
    this.logisticsTick += dt;
    return;
  }
  this.logisticsTick = 0;

  // For each resource type
  for (const resource of RESOURCE_TYPES) {
    const factoriesWithResource = this.factories.filter(f => 
      f.resources[resource] !== undefined
    );

    // Compute buffer targets, needs, surpluses
    const needs = factoriesWithResource.map(f => ({
      factoryId: f.id,
      need: Math.max(0, computeBufferTarget(f, resource) - f.resources[resource])
    })).filter(entry => entry.need > 0);

    const surpluses = factoriesWithResource.map(f => ({
      factoryId: f.id,
      surplus: Math.max(0, f.resources[resource] - computeBufferTarget(f, resource) - MIN_RESERVE)
    })).filter(entry => entry.surplus > 0);

    // Match greedily
    for (const needEntry of needs.sort((a,b) => b.need - a.need)) {
      const dest = this.getFactory(needEntry.factoryId);
      if (!dest) continue;

      for (const surplusEntry of surpluses.sort((a,b) => b.surplus - a.surplus)) {
        const source = this.getFactory(surplusEntry.factoryId);
        if (!source) continue;

        const transferAmount = Math.min(
          needEntry.need,
          surplusEntry.surplus,
          source.haulerConfig?.capacity ?? DEFAULT_HAULER_CAPACITY
        );

        if (transferAmount <= 0) continue;

        // Reserve at source
        source.logisticsState.outboundReservations[resource] = 
          (source.logisticsState.outboundReservations[resource] ?? 0) + transferAmount;

        // Schedule transfer
        const eta = this.gameTime + computeTravelTime(source, dest);
        this.logisticsQueues.pendingTransfers.push({
          id: generateTransferId(),
          fromFactoryId: source.id,
          toFactoryId: dest.id,
          resource,
          amount: transferAmount,
          status: 'scheduled',
          eta
        });

        // Update need/surplus for next iteration
        needEntry.need -= transferAmount;
        surplusEntry.surplus -= transferAmount;

        if (needEntry.need <= 0) break;
      }
    }
  }

  // Execute arrivals
  for (const transfer of this.logisticsQueues.pendingTransfers) {
    if (this.gameTime >= transfer.eta && transfer.status === 'scheduled') {
      const source = this.getFactory(transfer.fromFactoryId);
      const dest = this.getFactory(transfer.toFactoryId);
      
      if (source && dest) {
        // Decrement source (if not already done at scheduling)
        source.resources[transfer.resource] -= transfer.amount;
        
        // Increment destination
        dest.resources[transfer.resource] += transfer.amount;
        
        transfer.status = 'completed';
      }
    }
  }

  // Clean up completed transfers
  this.logisticsQueues.pendingTransfers = 
    this.logisticsQueues.pendingTransfers.filter(t => t.status !== 'completed');
}
```

---

## Balance & Tuning

### Default Parameters (Starting Point)

```typescript
const LOGISTICS_CONFIG = {
  buffer_seconds: 30,           // target 30s worth of resources
  min_reserve_seconds: 5,       // never drop below 5s
  hauler_capacity: 50,          // items per trip
  hauler_speed: 1.0,            // tiles/s
  pickup_overhead: 1.0,         // seconds
  dropoff_overhead: 1.0,        // seconds
  scheduling_interval: 2.0,     // seconds between scheduling ticks
  hysteresis_threshold: 0.2,    // 20% difference required to move
  cooldown_period: 10.0,        // seconds before reversing same transfer
};
```

### Cost & Maintenance

**Hauler Purchase:**

```typescript
const haulerCost = (count: number) => ({
  metals: 50 * Math.pow(1.25, count),
  crystals: 30 * Math.pow(1.25, count),
  energy: 10
});
```

**Maintenance:** Small per-second cost (e.g., 0.1 energy/hauler/s) to disincentivize spam

### Interactions with Per-Factory Upgrades

- **Storage upgrade** → reduces hauler necessity (fewer trips needed)
- **Speed/refine upgrades** → increases consumption, requires more haulers
- **Efficiency upgrades** → reduces input needs, lowers hauler demand
- **Docking upgrades** → can reduce pickup/drop overhead (optional enhancement)

---

## Migration Strategy

### Save Version Bump

**Current:** `SAVE_VERSION = '0.2.0'`  
**Next:** `SAVE_VERSION = '0.3.0'`

### Migration Code

```typescript
// In normalizeSnapshot / applySnapshot
if (snapshot.save.version < '0.3.0') {
  // Add default hauler fields to all factories
  snapshot.factories = snapshot.factories?.map(factory => ({
    ...factory,
    haulersAssigned: factory.haulersAssigned ?? 0,
    haulerConfig: factory.haulerConfig ?? {
      capacity: 50,
      speed: 1.0,
      pickupOverhead: 1.0,
      dropoffOverhead: 1.0,
      resourceFilters: [],
      mode: 'auto',
      priority: 5
    },
    logisticsState: factory.logisticsState ?? {
      outboundReservations: {},
      inboundSchedules: []
    }
  }));

  // Initialize global logistics queues
  if (!snapshot.logisticsQueues) {
    snapshot.logisticsQueues = { pendingTransfers: [] };
  }
}
```

### User-Facing Migration

**One-time UI notice on first load:**

```text
"New Logistics System!"

Hauler drones can now redistribute resources between your factories.
- Assign haulers to factories in the Factory Inspector
- Configure auto-balancing or manual routes
- Upgrade factory storage to reduce hauler needs

Your existing factories have been updated with logistics capabilities.
Global Storage vs Factory Storage:
- Global Storage (Upgrade Panel): Empire-wide resource cap
- Factory Storage (Factory Upgrades): Local buffer for production
```

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/logistics.spec.ts`

```typescript
describe('Logistics Scheduler', () => {
  it('should match surplus to need correctly', () => {
    // Given 3 factories with known inventories
    // When scheduling runs
    // Then transfers should equalize inventories up to capacity
  });

  it('should respect min_reserve and not empty sources', () => {
    // Ensure source never goes below min_reserve
  });

  it('should not double-book reserved resources', () => {
    // Run scheduler twice in succession
    // Verify reservations prevent double-allocation
  });

  it('should not change global resource totals when moving between factories', () => {
    // Sum state.resources before and after
    // Should be unchanged (factories are internal redistribution)
  });

  it('should apply hysteresis to prevent thrashing', () => {
    // Setup oscillating scenario
    // Verify cooldown prevents back-and-forth
  });
});
```

### Integration Tests

**File:** `tests/e2e/factory-logistics.spec.ts`

```typescript
test('haulers resolve factory starvation', async ({ page }) => {
  // Setup: 2 factories, one producing ore, one consuming
  // Consumer starts starving
  // Assign haulers to producer
  // Wait for transfers to complete
  // Verify consumer inventory replenished
});

test('logistics persists across save/load', async ({ page }) => {
  // Setup factories with haulers and pending transfers
  // Export state
  // Import state
  // Verify hauler config and in-transit transfers preserved
});
```

### Performance Tests

**Scaling:** Test with 50+ factories

- Measure logistics tick time
- Ensure < 16ms (target 60fps)
- If exceeded, implement optimizations:
  - Top-K matching instead of full O(N²)
  - Region-based clustering
  - Cached distance matrix

---

## UI/UX Design

### Per-Factory Logistics Panel

**Location:** Factory Inspector (when factory selected)

**Elements:**

- Haulers Assigned: `[0] [+] [-]` buttons
- Mode: `[Auto ▼]` dropdown (auto/manual/demand-first/supply-first)
- Resource Filters: Checkboxes for ore/metals/crystals/organics/ice
- Priority Slider: 0-10
- Inbound Shipments: List with `[Resource] [Amount] ETA: [Xs]`
- Outbound Reservations: List with `[Resource] [Amount] Status: [In-transit]`

### Global Logistics Overview

**Location:** New "Logistics" button in Upgrade Panel

**Elements:**

- Total Haulers: `[15 assigned] [5 idle]`
- Network Throughput: `[125 items/min]`
- Bottleneck Detection: "Factory #3 needs more haulers (starving on metals)"
- Quick Actions:
  - "Auto-balance all resources"
  - "View hauler efficiency"

### Visual Indicators

**3D Scene:**

- Lines/arrows between factories showing active transfers
- Line thickness proportional to transfer amount
- Color coded by resource type
- Hover: shows transfer details and ETA

---

## Known Limitations & Future Enhancements

### Current Limitations

1. **No multi-hop routing:** Haulers only move directly between two factories
2. **No central hubs:** All transfers are point-to-point
3. **No specialized haulers:** All haulers carry any resource type (with filters)
4. **Energy not hauled:** Energy transfers use separate `allocateFactoryEnergy` system

### Future Enhancements

**V2 Features:**

- Central storage hub (factory type that only stores/distributes)
- Multi-hop routing for networks > 10 factories
- Specialized hauler types (heavy haulers, fast couriers)
- Energy haulers or wireless energy transfer upgrades
- Hauler efficiency upgrades (speed, capacity) as global/per-factory techs

**V3 Features:**

- Route editor for manual routing
- Logistics analytics dashboard with bottleneck heatmaps
- Auto-specialization suggestions ("Make Factory #2 a metals hub")

---

## Decision Records

### DR-018-001: Haulers operate on factory.resources, not state.resources

**Rationale:** Moving resources between factories is internal redistribution and should not affect global totals. Global resources represent the sum of all factory inventories + any central storage.

**Implication:** `processLogistics` must never increment/decrement `state.resources` when transferring between factories.

### DR-018-002: Keep global modules mostly unchanged

**Rationale:** Minimize disruption to existing balance and player expectations. Per-factory upgrades already exist and can be expanded without rewriting global systems.

**Implication:** Migration is low-risk; haulers are additive feature.

### DR-018-003: Use reservation-based scheduling

**Rationale:** Prevents double-booking and makes logistics state deterministic and debuggable.

**Implication:** Requires careful bookkeeping but avoids race conditions and simplifies testing.

### DR-018-004: Scheduling runs on coarse intervals (1-5s)

**Rationale:** Performance and stability. High-frequency logistics would thrash and add negligible gameplay value.

**Implication:** Players experience slight delay before haulers react to changes; acceptable tradeoff for stability.

---

## Success Criteria

**Feature Complete When:**

- [ ] Factories have hauler assignment UI
- [ ] Scheduler runs and transfers resources between factories
- [ ] Reservations prevent double-booking
- [ ] Save/load preserves hauler state
- [ ] Global resource totals unaffected by internal transfers
- [ ] Unit tests pass for scheduling logic
- [ ] Integration test confirms starvation resolution
- [ ] Performance acceptable at 50+ factories

**Player Value:**

- Reduces micromanagement of factory inputs
- Enables specialization strategies (producer vs consumer factories)
- Adds depth without overwhelming new players (default: 0 haulers)

---

## References

**Related Designs:**

- DES015: Factory Buyable (introduced multiple factories)
- DES016: Factory Fleet Upgrades (per-factory drone management)
- DES014: Tie Resources (resource interdependencies)

**Code Files:**

- `src/state/store.ts` — main state, modules, factory upgrades
- `src/lib/resourceModifiers.ts` — global resource bonuses
- `src/ecs/factories.ts` — factory behaviors
- `src/config/resourceBalance.ts` — tuning parameters

**Testing:**

- `tests/e2e/persistence.spec.ts` — save/load
- `tests/e2e/factory-flow.spec.ts` — factory operations

---

## Appendix: Example Scenarios

### Scenario 1: Simple Two-Factory Setup

**Setup:**

- Factory A: Produces ore (drones mining nearby asteroids)
- Factory B: Consumes ore (refines into bars)

**Before Haulers:**

- Player must manually monitor Factory B, purchase storage upgrades, or micro-manage production

**After Haulers:**

- Assign 2 haulers to Factory A
- Configure auto-mode with ore filter
- Haulers automatically transfer ore from A to B when B's buffer drops below target
- Player focuses on strategic decisions (adding more factories, upgrading refine slots)

### Scenario 2: Multi-Factory Network

**Setup:**

- 5 factories specialized: 2 ore producers, 1 metals producer, 2 refineries

**Strategy:**

- Assign haulers to producers (ore, metals)
- Configure demand-first mode so refineries get priority
- Refineries operate continuously without starvation
- Player upgrades hauler speed/capacity to scale throughput

### Scenario 3: Emergency Rebalancing

**Setup:**

- Factory C producing crystals but inventory full
- Factory D needs crystals urgently

**Action:**

- Player manually assigns haulers to Factory C with crystals filter
- Sets high priority on Factory D
- Haulers immediately redistribute excess crystals
- Player then adjusts production balance or storage upgrades

---

## End of Design Document
