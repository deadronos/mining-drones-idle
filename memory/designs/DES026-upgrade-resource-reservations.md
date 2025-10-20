# DES026 – Factory Upgrade Resource Reservations# DES026 – Factory Upgrade Resource Reservations# DES026 – Factory Upgrade Resource Reservations

**Status:** Pending

**Created:** 2025-10-20

**Updated:** 2025-10-20**Status:** Pending **Status:** Pending

---**Created:** 2025-10-20 **Created:** 2025-10-20

## Overview**Updated:** 2025-10-20**Updated:** 2025-10-20

Enable factories to **reserve and request resources from the warehouse** when their local inventory is insufficient to cover the cost of the next (or current) available upgrade. This ensures the logistics system automatically prioritizes delivering resources needed for progression rather than leaving factories starved of upgrade-enabling materials.

---

## Problem Statement

**Current Behavior:**## Overview## Overview

- Factories can only upgrade if they hold sufficient local resources **right now**.

- Haul drones distribute based on buffer targets (inventory levels), not upgrade needs.

- A factory with 20 metals cannot upgrade landing bay (costs 40 metals) even if the warehouse has 200 metals available.Enable factories to **reserve and request resources from the warehouse** when their local inventory is insufficient to cover the cost of the next (or current) available upgrade. This ensures the logistics system automatically prioritizes delivering resources needed for progression rather than leaving factories starved of upgrade-enabling materials.Enable factories to **reserve and request resources from the warehouse** when their local inventory is insufficient to cover the cost of the next (or current) available upgrade. This ensures the logistics system automatically prioritizes delivering resources needed for progression rather than leaving factories starved of upgrade-enabling materials.

- Players must manually manage micro-scale inventory shuffling or wait for drones to randomly resupply.

**Desired Behavior:**

---

- Factories detect when local resources fall below the next upgrade's cost.

- The factory signals an **upgrade request** to the warehouse logistics system.

- Haul drones prioritize delivering the requested resources to that factory.

- Once resources arrive, the upgrade becomes available for purchase.## Problem Statement## Problem Statement

---

## Goals**Current Behavior:\*\***Current Behavior:\*\*

1. **Continuous Progression:** Players experience smoother upgrade flow without inventory micro-management.

2. **Logistics Awareness:** The warehouse system becomes conscious of upgrade needs as supply signals.

3. **Deterministic Distribution:** Upgrade requests become part of the formal reservation/scheduling pipeline (like current buffer-target imports).- Factories can only upgrade if they hold sufficient local resources **right now**.- Factories can only upgrade if they hold sufficient local resources **right now**.

4. **Clear Visibility:** Factory UI shows which resources are needed for the next upgrade and how much is reserved/in-flight.

- Haul drones distribute based on buffer targets (inventory levels), not upgrade needs.- Haul drones distribute based on buffer targets (inventory levels), not upgrade needs.

---

- A factory with 20 metals cannot upgrade landing bay (costs 40 metals) even if the warehouse has 200 metals available.- A factory with 20 metals cannot upgrade landing bay (costs 40 metals) even if the warehouse has 200 metals available.

## Design

- Players must manually manage micro-scale inventory shuffling or wait for drones to randomly resupply.- Players must manually manage micro-scale inventory shuffling or wait for drones to randomly resupply.

### 1. Data Model

#### 1.1 Per-Factory Upgrade Request State

**Desired Behavior:\*\***Desired Behavior:\*\*

Add to `BuildableFactory`:

```typescript

interface FactoryUpgradeRequest {- Factories detect when local resources fall below the next upgrade's cost.- Factories detect when local resources fall below the next upgrade's cost.

  upgrade: FactoryUpgradeId;

  resourceNeeded: Partial<FactoryResources>;- The factory signals an **upgrade request** to the warehouse logistics system.- The factory signals an **upgrade request** to the warehouse logistics system.

  fulfilledAmount: Partial<FactoryResources>;

  status: 'pending' | 'partially_fulfilled' | 'fulfilled';- Haul drones prioritize delivering the requested resources to that factory.- Haul drones prioritize delivering the requested resources to that factory.

  createdAt: number;

}- Once resources arrive, the upgrade becomes available for purchase.- Once resources arrive, the upgrade becomes available for purchase.



interface BuildableFactory {

  // ... existing fields ...

  upgradeRequests: FactoryUpgradeRequest[];------

}

```

#### 1.2 Warehouse-Level Upgrade Tracking## Goals## Goals

Track global upgrade requests in warehouse state:

```typescript1. **Continuous Progression:** Players experience smoother upgrade flow without inventory micro-management.1. **Continuous Progression:** Players experience smoother upgrade flow without inventory micro-management.

interface UpgradeReservationPool {

  factoryId: string;2. **Logistics Awareness:** The warehouse system becomes conscious of upgrade needs as supply signals.2. **Logistics Awareness:** The warehouse system becomes conscious of upgrade needs as supply signals.

  upgrade: FactoryUpgradeId;

  resourcesNeeded: Partial<FactoryResources>;3. **Deterministic Distribution:** Upgrade requests become part of the formal reservation/scheduling pipeline (like current buffer-target imports).3. **Deterministic Distribution:** Upgrade requests become part of the formal reservation/scheduling pipeline (like current buffer-target imports).

  priorityScore: number;

}4. **Clear Visibility:** Factory UI shows which resources are needed for the next upgrade and how much is reserved/in-flight.4. **Clear Visibility:** Factory UI shows which resources are needed for the next upgrade and how much is reserved/in-flight.

```

### 2. Request Lifecycle

---

#### Phase 1: Detection (Per-Factory)

- When factory UI renders upgrade options, compute next affordable upgrade.

- If current upgrade costs more than locally available, mark as **unaffordable**.## Design## Design

- Signal to logistics: "`Factory-{id}` needs `{resource}: {amount}`".

**Implementation point:** `UpgradeSection` component detects shortfall and triggers action.

### 1. Data Model### 1. Data Model

#### Phase 2: Reservation (Warehouse Scheduler)

- Logistics scheduler (`scheduleTransfers`) checks all factories for upgrade requests.

- For each unmet request, create a **resource reservation** in warehouse (similar to current buffer-target logic).#### 1.1 Per-Factory Upgrade Request State#### 1.1 Per-Factory Upgrade Request State

- Sort requests by:
  1. **Priority:** Time since request (older = higher priority).

  2. **Warehouse availability:** Can we fulfill this?

  3. **Distance/efficiency:** Can we batch deliveries?Add to `BuildableFactory`:Add to `BuildableFactory`:

**Implementation point:** Extend `computeScheduledTransfers` in `logistics.ts`.

#### Phase 3: Fulfillment (Hauler Execution)`typescript`typescript

- Haul drones execute transfers to deliver reserved resources.interface FactoryUpgradeRequest {interface FactoryUpgradeRequest {

- Mark as **partially_fulfilled** as resources arrive.

- Once all resources in the request are present, mark as **fulfilled**. upgrade: FactoryUpgradeId; upgrade: FactoryUpgradeId; // which upgrade is being requested

**Implementation point:** Extend `executeArrival` to update `fulfilledAmount`. resourceNeeded: Partial<FactoryResources>; resourceNeeded: Partial<FactoryResources>; // exact cost breakdown

#### Phase 4: Completion (UI Feedback) fulfilledAmount: Partial<FactoryResources>; fulfilledAmount: Partial<FactoryResources>; // how much has arrived

- UI detects fulfilled request and enables upgrade button. status: 'pending' | 'partially_fulfilled' | 'fulfilled'; statusA: 'pending' | 'partially_fulfilled' | 'fulfilled';

- On upgrade click, consume the reserved resources from `fulfilledAmount`.

  createdAt: number; createdAt: number; // timestamp for diagnostics

**Implementation point:** Update `upgradeFactory` to consume reserved resources first.

}}

### 3. Integration with Existing Logistics

The upgrade request system **layers on top** of the current warehouse import/export pipeline:

interface BuildableFactory {interface BuildableFactory {

```````

┌────────────────────────────────────────────────┐  // ... existing fields ...  // ... existing fields ...

│    Warehouse Logistics Scheduler               │

├────────────────────────────────────────────────┤  upgradeRequests: FactoryUpgradeRequest[];  upgradeRequests: FactoryUpgradeRequest[];  // active requests

│                                                │

│ ┌─ Check Buffer Targets (existing)             │}}

│ │   - Export surplus                           │

│ │   - Import to meet demand                    │``````

│ │                                              │

│ └─ Check Upgrade Requests (NEW)                │

│     - Detect shortfalls in factories           │

│     - Allocate warehouse resources to requests │#### 1.2 Warehouse-Level Upgrade Tracking#### 1.2 Warehouse-Level Upgrade Tracking

│     - Prioritize by age + importance           │

│                                                │

└────────────────────────────────────────────────┘

        ↓Track global upgrade requests in warehouse state:Track global upgrade requests in warehouse state:

   Hauler dispatch

        ↓

   Transfer execution

``````typescript```typescript



**Key Design Decisions:**interface UpgradeReservationPool {// Add to WAREHOUSE_CONFIG or logistics tracking



- Upgrade requests do **not** preempt buffer-target imports; instead, they increase the effective buffer-target floor for the needed resource.  factoryId: string;interface UpgradeReservationPool {

- If a factory needs metals for an upgrade, logistics treats metals as critical for that factory and schedules transport accordingly.

- Once the upgrade is purchased, the request is cleared.  upgrade: FactoryUpgradeId;  factoryId: string;



### 4. UI Flow  resourcesNeeded: Partial<FactoryResources>;  upgrade: FactoryUpgradeId;



#### 4.1 Upgrade Section Enhancement  priorityScore: number;  resourcesNeeded: Partial<FactoryResources>;



**Current:**}  priorityScore: number;  // time since request, used for scheduling fairness



``````}

Landing Bay Lv 0

+1 docking slot for concurrent drones```

[Upgrade (40 metals + 20 crystals)]  ← grayed out if can't afford

```### 2. Request Lifecycle



**New (insufficient resources):**### 2. Request Lifecycle



```#### Phase 1: Detection (Per-Factory)

Landing Bay Lv 0

+1 docking slot for concurrent drones#### Phase 1: Detection (Per-Factory)

[Upgrade (40 metals + 20 crystals)]  ← grayed out

- When factory UI renders upgrade options, compute next affordable upgrade.- When factory UI renders upgrade options, compute next affordable upgrade.

⚠️ Need: 40 metals (have 10)

   Reserved in transit: 30 metals- If current upgrade costs more than locally available, mark as **unaffordable**.- If current upgrade costs more than locally available, mark as **unaffordable**.

   ETA: ~5s

```- Signal to logistics: "`Factory-{id}` needs `{resource}: {amount}`".- Signal to logistics: "`Factory-{id}` needs `{resource}: {amount}` by `{deadline}`".



Or (no transit):



```**Implementation point:** `UpgradeSection` component detects shortfall and triggers action.**Implementation point:** `UpgradeSection` component detects shortfall and triggers action.

⚠️ Need: 40 metals (have 10)

   [Request Resource] button

```````

#### Phase 2: Reservation (Warehouse Scheduler)#### Phase 2: Reservation (Warehouse Scheduler)

#### 4.2 Affordability Check

- Logistics scheduler (`scheduleTransfers`) checks all factories for upgrade requests.

Update `hasResources` to account for **reserved in transit**:

- Logistics scheduler (`scheduleTransfers`) checks all factories for upgrade requests.- For each unmet request, create a **resource reservation** in warehouse (similar to current buffer-target logic).

```typescript

export const canUpgrade = (- For each unmet request, create a **resource reservation** in warehouse (similar to current buffer-target logic).- Sort requests by:

  factory: BuildableFactory,

  cost: Partial<FactoryResources>,- Sort requests by:  1. **Priority:** Time since request (older = higher priority).

): boolean => {

  return Object.entries(cost).every(([key, value]) => {  1. **Priority:** Time since request (older = higher priority).  2. **Warehouse availability:** Can we fulfill this?

    if (typeof value !== 'number' || value <= 0) return true;

  2. **Warehouse availability:** Can we fulfill this?  3. **Distance/efficiency:** Can we batch deliveries?

    const local = factory.resources[key as keyof FactoryResources] ?? 0;

    const reserved = factory.upgradeRequests  3. **Distance/efficiency:** Can we batch deliveries?

      .filter(r => r.status !== 'expired')

      .reduce((sum, req) => sum + (req.fulfilledAmount[key as keyof FactoryResources] ?? 0), 0);**Implementation point:** Extend `computeScheduledTransfers` in `logistics.ts`.



    return local + reserved >= value;**Implementation point:** Extend `computeScheduledTransfers` in `logistics.ts`.

  });

};#### Phase 3: Fulfillment (Hauler Execution)

```

#### Phase 3: Fulfillment (Hauler Execution)- Haul drones execute transfers to deliver reserved resources.

### 5. Edge Cases & Constraints

- Mark as **partially_fulfilled** as resources arrive.

1. **Request Expiration:** If a request sits unfulfilled for >60s, expire it and re-evaluate.
   - Prevents stale requests from blocking future assignments.- Haul drones execute transfers to deliver reserved resources.- Once all resources in the request are present, mark as **fulfilled**.

2. **Warehouse Depletion:** If warehouse runs out of a requested resource, other factories' requests are deprioritized.- Mark as **partially_fulfilled** as resources arrive.
   - Fairness: rotate priority among waiting factories.

- Once all resources in the request are present, mark as **fulfilled**.**Implementation point:** Extend `executeArrival` to update `fulfilledAmount`.

3. **Multiple Requests per Factory:** A single factory can have requests for different resources (metals for landing bay, crystals for solar, etc.).
   - Scheduler prioritizes multi-resource requests to batch hauls.

4. **Conflict with Prestige:** On prestige, clear all pending upgrade requests (player is resetting anyway).**Implementation point:** Extend `executeArrival` to update `fulfilledAmount`.#### Phase 4: Completion (UI Feedback)

5. **Conflict with Manual Upgrade:** If player manually upgrades via another mechanism, clear associated request.- UI detects fulfilled request and enables upgrade button.

---#### Phase 4: Completion (UI Feedback)- On upgrade click, consume the reserved resources from `fulfilledAmount`.

## Implementation Plan

### Task Breakdown- UI detects fulfilled request and enables upgrade button.**Implementation point:** Update `upgradeFactory` to consume reserved resources first.

1. **Data Model Setup**- On upgrade click, consume the reserved resources from `fulfilledAmount`.
   - Add `upgradeRequests: FactoryUpgradeRequest[]` to `BuildableFactory`.

   - Update serialization/normalization for upgrade requests.### 3. Integration with Existing Logistics

   - Add TypeScript types.

   - Tests: Verify schema round-trips.**Implementation point:** Update `upgradeFactory` to consume reserved resources first.

2. **Request Detection**The upgrade request system **layers on top** of the current warehouse import/export pipeline:
   - Implement factory upgrade detection logic: "are we short on resources for the next upgrade?"

   - Hook into factory processing tick to evaluate unmet needs.### 3. Integration with Existing Logistics

   - Create or update upgrade request when shortfall detected.

   - Tests: Unit test detects shortfall and creates request.```

3. **Scheduler Integration**The upgrade request system **layers on top** of the current warehouse import/export pipeline:┌─────────────────────────────────────────────────────┐
   - Extend `computeScheduledTransfers` to examine all factory upgrade requests.

   - Allocate warehouse resources to fulfill requests (respecting warehouse minimum reserves).│ Warehouse Logistics Scheduler │

   - Sort by priority (time + warehouse availability).

   - Tests: Unit tests verify scheduler prioritizes requests and respects warehouse caps.```├─────────────────────────────────────────────────────┤

4. **Transfer Execution & Fulfillment**┌────────────────────────────────────────────────┐│ │
   - Update `executeArrival` to mark request's `fulfilledAmount` when resources land.

   - Auto-mark request as `fulfilled` when all resources present.│ Warehouse Logistics Scheduler ││ ┌─ Check Buffer Targets (existing) │

   - Tests: Integration test sends resources, verifies fulfilled state.

├────────────────────────────────────────────────┤│ │ - Export surplus │

5. **UI Display & Controls**
   - Update `UpgradeSection` to show request status (need, reserved, in-transit, fulfilled).│ ││ │ - Import to meet demand │

   - Add visual affordability check that includes reserved resources.

   - Tests: React component test verifies display updates as requests progress.│ ┌─ Check Buffer Targets (existing) ││ │ │

6. **Upgrade Purchase Integration**│ │ - Export surplus ││ └─ Check Upgrade Requests (NEW) │
   - Update `upgradeFactory` to consume reserved resources.

   - Clear request after successful upgrade.│ │ - Import to meet demand ││ - Detect shortfalls in factories │

   - Tests: Unit test verifies reserved resources are consumed correctly.

│ │ ││ - Allocate warehouse resources to requests │

7. **Edge Case Handling**
   - Implement request expiration logic.│ └─ Check Upgrade Requests (NEW) ││ - Prioritize by age + importance │

   - Clear requests on prestige.

   - Handle warehouse depletion gracefully.│ - Detect shortfalls in factories ││ │

   - Tests: Edge case unit tests.

│ - Allocate warehouse resources to requests │└─────────────────────────────────────────────────────┘

8. **Integration & Polish**
   - End-to-end test: factory detects shortfall → request created → scheduler allocates → hauls deliver → upgrade enabled.│ - Prioritize by age + importance │ ↓

   - Manual play-test to verify UX flow.

   - Performance check (no degradation from request tracking).│ │ Hauler dispatch

---└────────────────────────────────────────────────┘ ↓

## Acceptance Criteria ↓ Transfer execution

- ✓ Factory detects when local resources < next upgrade cost. Hauler dispatch```

- ✓ Upgrade request is created and visible to scheduler.

- ✓ Scheduler allocates warehouse resources to fulfill requests (respecting warehouse minimum reserves). ↓

- ✓ As haul drones deliver, request's `fulfilledAmount` increases.

- ✓ UI shows resource shortfall, reserved in-transit, and current progress. Transfer execution**Key Design Decisions:**

- ✓ Upgrade button enables once request is fulfilled (local + reserved ≥ cost).

- ✓ Purchasing upgrade consumes reserved resources correctly.```- Upgrade requests do **not** preempt buffer-target imports; instead, they increase the effective buffer-target floor for the needed resource.

- ✓ Requests expire after 60s without fulfillment (prevents stale state).

- ✓ Prestige clears all pending requests.- If a factory needs metals for an upgrade, logistics treats metals as critical for that factory and schedules transport accordingly.

- ✓ All tests pass (unit, integration, playwright).

- ✓ No performance regression.**Key Design Decisions:**- Once the upgrade is purchased, the request is cleared.

---

## Success Metrics- Upgrade requests do **not** preempt buffer-target imports; instead, they increase the effective buffer-target floor for the needed resource.### 4. UI Flow

1. **Feature Completeness:** Player can observe factory requesting resources and receiving them via haul logistics.- If a factory needs metals for an upgrade, logistics treats metals as critical for that factory and schedules transport accordingly.

2. **UX Clarity:** Factory UI clearly indicates what's needed and what's in transit.

3. **Fairness:** Multiple factories' requests are scheduled fairly (no single factory starves others).- Once the upgrade is purchased, the request is cleared.#### 4.1 Upgrade Section Enhancement

4. **Robustness:** Requests expire gracefully; no infinite loops or memory leaks.

---

### 4. UI Flow**Current:**

## Risk Analysis

```````

| Risk | Probability | Impact | Mitigation |

|------|-------------|--------|-----------|#### 4.1 Upgrade Section EnhancementLanding Bay Lv 0

| Scheduler complexity | Medium | Medium | Start simple; optimize if needed. |

| Request staleness | Low | Medium | Implement 60s expiration. |+1 docking slot for concurrent drones

| Warehouse depletion | Low | Low | Enforce warehouse minimum reserves. |

| UI clutter | Low | Low | Use tooltips and progressive disclosure. |**Current:**[Upgrade (40 metals + 20 crystals)]  ← grayed out if can't afford



---```



## Notes & Open Questions```



1. **Request Visibility:** Should requests appear in a separate panel, or only inline in the upgrade section?Landing Bay Lv 0**New (insufficient resources):**

   - *Tentative:* Inline in upgrade section for simplicity.

+1 docking slot for concurrent drones```

2. **Cancellation:** Can factories manually cancel a request?

   - *Tentative:* Yes, but auto-clear on upgrade. Cancellation frees resources for other factories.[Upgrade (40 metals + 20 crystals)]  ← grayed out if can't affordLanding Bay Lv 0



3. **Priority Scoring:** Should older requests always win?```+1 docking slot for concurrent drones

   - *Tentative:* Simple FIFO (older = higher priority). Revisit if fairness issues arise.

[Upgrade (40 metals + 20 crystals)]  ← grayed out

4. **Multi-Resource Batch Dispatch:** Should scheduler batch requests that share resources?

   - *Tentative:* Out of scope for v1; consider for v2 optimization.**New (insufficient resources):**



---⚠️ Need: 40 metals (have 10)



## Related Issues & Tasks```   Reserved in transit: 30 metals



- TASK025 – Warehouse Reconciliation (foundational reserve/import logic)Landing Bay Lv 0   ETA: ~5s

- TASK019 – Hauler Logistics (transfer execution)

- RQ-037–RQ-040 (warehouse behavior & prestige)+1 docking slot for concurrent drones```



---[Upgrade (40 metals + 20 crystals)]  ← grayed out



## Decision RecordOr (no transit):



**Date:** 2025-10-20⚠️ Need: 40 metals (have 10)```



**Decision:** Implement upgrade resource reservations as a layer on top of existing buffer-target logistics, leveraging the current `outboundReservations` and haul dispatch mechanisms.   Reserved in transit: 30 metals⚠️ Need: 40 metals (have 10)



**Rationale:**   ETA: ~5s   [Request Resource] button



- Reuses proven reservation pattern; minimizes new complexity.``````

- Integrates cleanly with existing scheduler and transfer execution.

- Allows phased rollout (detection → scheduling → execution → UI).



**Alternatives Considered:**Or (no transit):#### 4.2 Affordability Check



1. **Direct priority boost:** Give upgrade-related resources a temporary priority boost in the standard buffer-target logic.

   - *Rejected:* Less explicit; harder to debug and reason about fairness.

```Update `hasResources` to account for **reserved in transit**:

2. **Separate "upgrade logistics" pipeline:** Maintain a parallel request → fulfillment flow independent of warehouse logistics.

   - *Rejected:* Duplication; harder to coordinate with warehouse reserves.⚠️ Need: 40 metals (have 10)



3. **Hard-coded quotas per resource:** Allocate a fixed percentage of warehouse capacity to upgrade requests.   [Request Resource] button```typescript

   - *Rejected:* Inflexible; prevents organic adjustment to player needs.

```export const canUpgrade = (

---

  factory: BuildableFactory,

## Appendix: Code References

#### 4.2 Affordability Check  cost: Partial<FactoryResources>,

- **Data Model:** `src/ecs/factories.ts` (BuildableFactory)

- **Serialization:** `src/state/serialization/` (factory normalization)): boolean => {

- **Scheduler:** `src/ecs/logistics.ts` (computeScheduledTransfers)

- **Transfer Execution:** `src/state/slices/factorySlice.ts` (upgradeFactory, addResourcesToFactory)Update `hasResources` to account for **reserved in transit**:  // Check if locally available OR will be fulfilled by reserved transport

- **UI:** `src/ui/FactoryManager/sections/UpgradeSection.tsx`

- **Constants:** `src/state/constants.ts` (factoryUpgradeDefinitions)  return Object.entries(cost).every(([key, value]) => {


```typescript    if (typeof value !== 'number' || value <= 0) return true;

export const canUpgrade = (

  factory: BuildableFactory,    const local = factory.resources[key as keyof FactoryResources] ?? 0;

  cost: Partial<FactoryResources>,    const reserved = factory.upgradeRequests

): boolean => {      .filter(r => r.status !== 'expired')

  return Object.entries(cost).every(([key, value]) => {      .reduce((sum, req) => sum + (req.fulfilledAmount[key as keyof FactoryResources] ?? 0), 0);

    if (typeof value !== 'number' || value <= 0) return true;

    return local + reserved >= value;

    const local = factory.resources[key as keyof FactoryResources] ?? 0;  });

    const reserved = factory.upgradeRequests};

      .filter(r => r.status !== 'expired')```

      .reduce((sum, req) => sum + (req.fulfilledAmount[key as keyof FactoryResources] ?? 0), 0);

### 5. Edge Cases & Constraints

    return local + reserved >= value;

  });1. **Request Expiration:** If a request sits unfulfilled for >60s, expire it and re-evaluate.

};   - Prevents stale requests from blocking future assignments.

```````

2. **Warehouse Depletion:** If warehouse runs out of a requested resource, other factories' requests are deprioritized.

### 5. Edge Cases & Constraints - Fairness: rotate priority among waiting factories.

1. **Request Expiration:** If a request sits unfulfilled for >60s, expire it and re-evaluate.3. **Multiple Requests per Factory:** A single factory can have requests for different resources (metals for landing bay, crystals for solar, etc.).
   - Prevents stale requests from blocking future assignments. - Scheduler prioritizes multi-resource requests to batch hauls.

2. **Warehouse Depletion:** If warehouse runs out of a requested resource, other factories' requests are deprioritized.4. **Conflict with Prestige:** On prestige, clear all pending upgrade requests (player is resetting anyway).
   - Fairness: rotate priority among waiting factories.

3. **Conflict with Manual Upgrade:** If player manually upgrades via another mechanism, clear associated request.

4. **Multiple Requests per Factory:** A single factory can have requests for different resources (metals for landing bay, crystals for solar, etc.).
   - Scheduler prioritizes multi-resource requests to batch hauls.---

5. **Conflict with Prestige:** On prestige, clear all pending upgrade requests (player is resetting anyway).## Implementation Plan

6. **Conflict with Manual Upgrade:** If player manually upgrades via another mechanism, clear associated request.### Task Breakdown

---1. **Data Model Setup** (TASK##-step-1)

- Add `upgradeRequests: FactoryUpgradeRequest[]` to `BuildableFactory`.

## Implementation Plan - Update serialization/normalization for upgrade requests.

- Add TypeScript types.

### Task Breakdown - ✓ Tests: Verify schema round-trips.

1. **Data Model Setup**2. **Request Detection** (TASK##-step-2)
   - Add `upgradeRequests: FactoryUpgradeRequest[]` to `BuildableFactory`. - Implement factory upgrade detection logic: "are we short on resources for the next upgrade?"

   - Update serialization/normalization for upgrade requests. - Hook into factory processing tick to evaluate unmet needs.

   - Add TypeScript types. - Create or update upgrade request when shortfall detected.

   - Tests: Verify schema round-trips. - ✓ Tests: Unit test detects shortfall and creates request.

2. **Request Detection**3. **Scheduler Integration** (TASK##-step-3)
   - Implement factory upgrade detection logic: "are we short on resources for the next upgrade?" - Extend `computeScheduledTransfers` to examine all factory upgrade requests.

   - Hook into factory processing tick to evaluate unmet needs. - Allocate warehouse resources to fulfill requests (respecting warehouse minimum reserves).

   - Create or update upgrade request when shortfall detected. - Sort by priority (time + warehouse availability).

   - Tests: Unit test detects shortfall and creates request. - ✓ Tests: Unit tests verify scheduler prioritizes requests and respects warehouse caps.

3. **Scheduler Integration**4. **Transfer Execution & Fulfillment** (TASK##-step-4)
   - Extend `computeScheduledTransfers` to examine all factory upgrade requests. - Update `executeArrival` to mark request's `fulfilledAmount` when resources land.

   - Allocate warehouse resources to fulfill requests (respecting warehouse minimum reserves). - Auto-mark request as `fulfilled` when all resources present.

   - Sort by priority (time + warehouse availability). - ✓ Tests: Integration test sends resources, verifies fulfilled state.

   - Tests: Unit tests verify scheduler prioritizes requests and respects warehouse caps.

4. **UI Display & Controls** (TASK##-step-5)

5. **Transfer Execution & Fulfillment** - Update `UpgradeSection` to show request status (need, reserved, in-transit, fulfilled).
   - Update `executeArrival` to mark request's `fulfilledAmount` when resources land. - Add visual affordability check that includes reserved resources.

   - Auto-mark request as `fulfilled` when all resources present. - ✓ Tests: React component test verifies display updates as requests progress.

   - Tests: Integration test sends resources, verifies fulfilled state.

6. **Upgrade Purchase Integration** (TASK##-step-6)

7. **UI Display & Controls** - Update `upgradeFactory` to consume reserved resources.
   - Update `UpgradeSection` to show request status (need, reserved, in-transit, fulfilled). - Clear request after successful upgrade.

   - Add visual affordability check that includes reserved resources. - ✓ Tests: Unit test verifies reserved resources are consumed correctly.

   - Tests: React component test verifies display updates as requests progress.

8. **Edge Case Handling** (TASK##-step-7)

9. **Upgrade Purchase Integration** - Implement request expiration logic.
   - Update `upgradeFactory` to consume reserved resources. - Clear requests on prestige.

   - Clear request after successful upgrade. - Handle warehouse depletion gracefully.

   - Tests: Unit test verifies reserved resources are consumed correctly. - ✓ Tests: Edge case unit tests.

10. **Edge Case Handling**8. **Integration & Polish** (TASK##-step-8)
    - Implement request expiration logic. - End-to-end test: factory detects shortfall → request created → scheduler allocates → hauls deliver → upgrade enabled.

    - Clear requests on prestige. - Manual play-test to verify UX flow.

    - Handle warehouse depletion gracefully. - Performance check (no degradation from request tracking).

    - Tests: Edge case unit tests.

---

8. **Integration & Polish**
   - End-to-end test: factory detects shortfall → request created → scheduler allocates → hauls deliver → upgrade enabled.## Acceptance Criteria

   - Manual play-test to verify UX flow.

   - Performance check (no degradation from request tracking).- ✓ Factory detects when local resources < next upgrade cost.

- ✓ Upgrade request is created and visible to scheduler.

---- ✓ Scheduler allocates warehouse resources to fulfill requests (respecting warehouse minimum reserves).

- ✓ As haul drones deliver, request's `fulfilledAmount` increases.

## Acceptance Criteria- ✓ UI shows resource shortfall, reserved in-transit, and current progress.

- ✓ Upgrade button enables once request is fulfilled (local + reserved ≥ cost).

- ✓ Factory detects when local resources < next upgrade cost.- ✓ Purchasing upgrade consumes reserved resources correctly.

- ✓ Upgrade request is created and visible to scheduler.- ✓ Requests expire after 60s without fulfillment (prevents stale state).

- ✓ Scheduler allocates warehouse resources to fulfill requests (respecting warehouse minimum reserves).- ✓ Prestige clears all pending requests.

- ✓ As haul drones deliver, request's `fulfilledAmount` increases.- ✓ All tests pass (unit, integration, playwright).

- ✓ UI shows resource shortfall, reserved in-transit, and current progress.- ✓ No performance regression.

- ✓ Upgrade button enables once request is fulfilled (local + reserved ≥ cost).

- ✓ Purchasing upgrade consumes reserved resources correctly.---

- ✓ Requests expire after 60s without fulfillment (prevents stale state).

- ✓ Prestige clears all pending requests.## Success Metrics

- ✓ All tests pass (unit, integration, playwright).

- ✓ No performance regression.1. **Feature Completeness:** Player can observe factory requesting resources and receiving them via haul logistics.

2. **UX Clarity:** Factory UI clearly indicates what's needed and what's in transit.

---3. **Fairness:** Multiple factories' requests are scheduled fairly (no single factory starves others).

4. **Robustness:** Requests expire gracefully; no infinite loops or memory leaks.

## Success Metrics

---

1. **Feature Completeness:** Player can observe factory requesting resources and receiving them via haul logistics.

2. **UX Clarity:** Factory UI clearly indicates what's needed and what's in transit.## Risk Analysis

3. **Fairness:** Multiple factories' requests are scheduled fairly (no single factory starves others).

4. **Robustness:** Requests expire gracefully; no infinite loops or memory leaks.| Risk | Probability | Impact | Mitigation |

|------|-------------|--------|-----------|

---| Scheduler complexity overload | Medium | Medium | Start with simple priority queue; optimize if needed. |

| Request staleness | Low | Medium | Implement 60s expiration + re-evaluation on each tick. |

## Risk Analysis| Warehouse depletion abuse | Low | Low | Enforce warehouse minimum reserves; throttle requests per resource. |

| UI clutter | Low | Low | Use tooltips and progressive disclosure (click to expand request details). |

| Risk | Probability | Impact | Mitigation |

|------|-------------|--------|-----------|---

| Scheduler complexity | Medium | Medium | Start simple; optimize if needed. |

| Request staleness | Low | Medium | Implement 60s expiration. |## Notes & Open Questions

| Warehouse depletion | Low | Low | Enforce warehouse minimum reserves. |

| UI clutter | Low | Low | Use tooltips and progressive disclosure. |1. **Request Visibility:** Should requests appear in a separate panel, or only inline in the upgrade section?

- _Tentative:_ Inline in upgrade section for simplicity; consider dashboard later if feature becomes important.

---

2. **Cancellation:** Can factories manually cancel a request?

## Notes & Open Questions - _Tentative:_ Yes, but auto-clear on upgrade. Cancellation frees resources for other factories.

1. **Request Visibility:** Should requests appear in a separate panel, or only inline in the upgrade section?3. **Priority Scoring:** Should older requests always win, or should we consider factory "productivity"?
   - _Tentative:_ Inline in upgrade section for simplicity. - _Tentative:_ Simple FIFO (older = higher priority). Revisit if fairness issues arise.

2. **Cancellation:** Can factories manually cancel a request?4. **Multi-Resource Batch Dispatch:** Should scheduler try to batch requests that share resources?
   - _Tentative:_ Yes, but auto-clear on upgrade. Cancellation frees resources for other factories. - _Tentative:_ Out of scope for v1; consider for v2 optimization.

3. **Priority Scoring:** Should older requests always win?---
   - _Tentative:_ Simple FIFO (older = higher priority). Revisit if fairness issues arise.

## Related Issues & Tasks

4. **Multi-Resource Batch Dispatch:** Should scheduler batch requests that share resources?
   - _Tentative:_ Out of scope for v1; consider for v2 optimization.- TASK025 – Warehouse Reconciliation (foundational reserve/import logic)

- TASK019 – Hauler Logistics (transfer execution)

---- RQ-037–RQ-040 (warehouse behavior & prestige)

## Related Issues & Tasks---

- TASK025 – Warehouse Reconciliation (foundational reserve/import logic)## Decision Record

- TASK019 – Hauler Logistics (transfer execution)

- RQ-037–RQ-040 (warehouse behavior & prestige)**Date:** 2025-10-20

**Decision:** Implement upgrade resource reservations as a layer on top of existing buffer-target logistics, leveraging the current `outboundReservations` and haul dispatch mechanisms.

---

**Rationale:**

## Decision Record- Reuses proven reservation pattern; minimizes new complexity.

- Integrates cleanly with existing scheduler and transfer execution.

**Date:** 2025-10-20- Allows phased rollout (detection → scheduling → execution → UI).

**Decision:** Implement upgrade resource reservations as a layer on top of existing buffer-target logistics, leveraging the current `outboundReservations` and haul dispatch mechanisms.**Alternatives Considered:**

1. **Direct priority boost:** Give upgrade-related resources a temporary priority boost in the standard buffer-target logic.

**Rationale:** - _Rejected:_ Less explicit; harder to debug and reason about fairness.

- Reuses proven reservation pattern; minimizes new complexity.2. **Separate "upgrade logistics" pipeline:** Maintain a parallel request → fulfillment flow independent of warehouse logistics.

- Integrates cleanly with existing scheduler and transfer execution. - _Rejected:_ Duplication; harder to coordinate with warehouse reserves.

- Allows phased rollout (detection → scheduling → execution → UI).

3. **Hard-coded quotas per resource:** Allocate a fixed percentage of warehouse capacity to upgrade requests.

**Alternatives Considered:** - _Rejected:_ Inflexible; prevents organic adjustment to player needs.

1. **Direct priority boost:** Give upgrade-related resources a temporary priority boost in the standard buffer-target logic.---
   - _Rejected:_ Less explicit; harder to debug and reason about fairness.

## Appendix: Code References

2. **Separate "upgrade logistics" pipeline:** Maintain a parallel request → fulfillment flow independent of warehouse logistics.
   - _Rejected:_ Duplication; harder to coordinate with warehouse reserves.- **Data Model:** `src/ecs/factories.ts` (BuildableFactory)

- **Serialization:** `src/state/serialization/` (factory normalization)

3. **Hard-coded quotas per resource:** Allocate a fixed percentage of warehouse capacity to upgrade requests.- **Scheduler:** `src/ecs/logistics.ts` (computeScheduledTransfers)
   - _Rejected:_ Inflexible; prevents organic adjustment to player needs.- **Transfer Execution:** `src/state/slices/factorySlice.ts` (upgradeFactory, addResourcesToFactory)

- **UI:** `src/ui/FactoryManager/sections/UpgradeSection.tsx`

---- **Constants:** `src/state/constants.ts` (factoryUpgradeDefinitions)

## Appendix: Code References

- **Data Model:** `src/ecs/factories.ts` (BuildableFactory)
- **Serialization:** `src/state/serialization/` (factory normalization)
- **Scheduler:** `src/ecs/logistics.ts` (computeScheduledTransfers)
- **Transfer Execution:** `src/state/slices/factorySlice.ts` (upgradeFactory, addResourcesToFactory)
- **UI:** `src/ui/FactoryManager/sections/UpgradeSection.tsx`
- **Constants:** `src/state/constants.ts` (factoryUpgradeDefinitions)
