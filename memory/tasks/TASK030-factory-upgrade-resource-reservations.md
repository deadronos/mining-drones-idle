# TASK030 – Factory Upgrade Resource Reservations# TASK030 – Factory Upgrade Resource Reservations

**Status:** In Progress **Status:** In Progress

**Added:** 2025-10-25 **Added:** 2025-10-25

**Updated:** 2025-10-25**Updated:** 2025-10-25

## Original Request## Original Request

Implement factory upgrade resource reservations: enable factories to detect when their local resources fall short of an upgrade's cost and request resources from the warehouse. The logistics scheduler then prioritizes fulfilling these requests, allowing factories to autonomously request and receive necessary upgrade materials without manual player intervention.Implement factory upgrade resource reservations: enable factories to detect when their local resources fall short of an upgrade's cost and request resources from the warehouse. The logistics scheduler then prioritizes fulfilling these requests, allowing factories to autonomously request and receive necessary upgrade materials without manual player intervention.

---

## Thought Process## Thought Process

**Context:\*\***Context:\*\*

- Current state: factories can only upgrade if they have sufficient resources locally right now- Current state: factories can only upgrade if they have sufficient resources locally right now

- Haul drones distribute based on buffer targets, not upgrade needs- Haul drones distribute based on buffer targets, not upgrade needs

- Players must manually manage inventory or wait for random resupply- Players must manually manage inventory or wait for random resupply

- This feature layers on top of existing warehouse logistics (TASK025)- This feature layers on top of existing warehouse logistics (TASK025 – Warehouse Reconciliation)

**Design approach:\*\***Design approach:\*\*

- Add `upgradeRequests: FactoryUpgradeRequest[]` to BuildableFactory- Add `upgradeRequests: FactoryUpgradeRequest[]` to BuildableFactory (similar to inventory structure)

- Extend request lifecycle: Detection → Reservation → Fulfillment → Completion- Extend request lifecycle: Detection → Reservation → Fulfillment → Completion

- Integrate into existing scheduler as a supply signal alongside buffer-target imports- Integrate into existing scheduler by treating upgrade requests as a supply signal alongside buffer-target imports

- Upgrade requests increase the effective buffer-target floor for needed resources- Upgrade requests increase the effective buffer-target floor for needed resources

- Do not preempt buffer-target imports; instead, elevate priority- Do not preempt buffer-target imports; instead, elevate priority

**Rationale:\*\***Rationale:\*\*

- Reuses proven reservation pattern from warehouse logistics- Reuses proven reservation pattern from warehouse logistics

- Integrates cleanly with existing scheduler and transfer execution- Integrates cleanly with existing scheduler and transfer execution

- Allows phased rollout: data model → detection → scheduling → execution → UI- Allows phased rollout: data model → detection → scheduling → execution → UI

- Minimizes new complexity by layering on proven patterns- Minimizes new complexity by layering on proven patterns

---

## Implementation Plan## Implementation Plan

### Subtasks### Subtasks

| ID | Description | Status || ID | Description | Status | Updated | Notes |

| --- | ---------------------------------------- | ----------- || --- | ------------------------------------------ | ----------- | ------- | ---------------------------------------- |

| 1.1 | Data Model Setup | Not Started || 1.1 | Data Model Setup | Not Started | - | Add types & schema to factories |

| 1.2 | Request Detection | Not Started || 1.2 | Request Detection | Not Started | - | Factory detects shortfall & creates req |

| 1.3 | Scheduler Integration | Not Started || 1.3 | Scheduler Integration | Not Started | - | Extend computeScheduledTransfers |

| 1.4 | Transfer Execution & Fulfillment | Not Started || 1.4 | Transfer Execution & Fulfillment | Not Started | - | Mark fulfilled as resources arrive |

| 1.5 | UI Display & Controls | Not Started || 1.5 | UI Display & Controls | Not Started | - | Show request status in UpgradeSection |

| 1.6 | Upgrade Purchase Integration | Not Started || 1.6 | Upgrade Purchase Integration | Not Started | - | Consume reserved resources on upgrade |

| 1.7 | Edge Case Handling | Not Started || 1.7 | Edge Case Handling | Not Started | - | Expiration, prestige, conflicts |

| 1.8 | Integration & Polish | Not Started || 1.8 | Integration & Polish | Not Started | - | E2E tests, manual play-test, perf check |

---

## Progress Tracking## Progress Tracking

**Overall Status:** Not Started – 0%**Overall Status:** Not Started – 0%

---### Step-by-Step Breakdown

## Step 1.1: Data Model Setup#### Step 1.1: Data Model Setup

**Goal:** Add TypeScript types and extend BuildableFactory with upgrade request tracking.**Goal:** Add TypeScript types and extend BuildableFactory with upgrade request tracking.

**Files to modify:\*\***Files to modify:\*\*

- `src/ecs/factories.ts`- `src/ecs/factories.ts` – Add `FactoryUpgradeRequest` interface and `upgradeRequests` array to `BuildableFactory`

- `src/state/serialization/`- `src/state/serialization/` – Update normalization/denormalization for new field

- `src/state/constants.ts`- `src/state/constants.ts` – Add any related configuration

**Implementation checklist:\*\***Implementation checklist:\*\*

- [ ] Define `FactoryUpgradeRequest` interface with properties: upgrade, resourceNeeded, fulfilledAmount, status, createdAt, expiresAt- [ ] Define `FactoryUpgradeRequest` interface with properties:

- [ ] Add `upgradeRequests: FactoryUpgradeRequest[]` to `BuildableFactory` - `upgrade: FactoryUpgradeId` (which upgrade is requested)

- [ ] Update factory serialization to handle new field - `resourceNeeded: Partial<FactoryResources>` (exact cost breakdown)

- [ ] Update factory normalization for backward compatibility - `fulfilledAmount: Partial<FactoryResources>` (how much has arrived)

- [ ] Add unit tests for schema round-trips - `status: 'pending' | 'partially_fulfilled' | 'fulfilled' | 'expired'`

- [ ] Verify tests pass - `createdAt: number` (for timeout logic)
  - `expiresAt: number` (timestamp for 60s expiration)

**Expected outcome:** Schema is in place; factories can store upgrade requests; save/load works correctly.- [ ] Add `upgradeRequests: FactoryUpgradeRequest[]` to `BuildableFactory`

- [ ] Update factory serialization to handle `upgradeRequests` in save/load

---- [ ] Update factory normalization for backward compatibility

- [ ] Add unit tests for schema round-trips (save → load → serialize)

## Step 1.2: Request Detection- [ ] Verify tests pass

**Goal:** Implement factory logic to detect when local resources fall short of next upgrade.**Expected outcome:** Schema is in place; factories can store upgrade requests; save/load works correctly.

**Files to modify:**---

- `src/ecs/factories.ts`#### Step 1.2: Request Detection

- `src/state/slices/factorySlice.ts`

- Tests**Goal:** Implement factory logic to detect when local resources fall short of next upgrade and create request.

**Implementation checklist:\*\***Files to modify:\*\*

- [ ] Create function `detectUpgradeShortfall(factory: BuildableFactory) → FactoryUpgradeRequest | null`- `src/ecs/factories.ts` – Add upgrade request detection function

- [ ] Call detection in factory processing tick- `src/state/slices/factorySlice.ts` – Hook detection into factory update/processing

- [ ] Only create request if not already pending/fulfilled- Tests: Add unit test for detection logic

- [ ] Handle multiple requests per factory

- [ ] Add unit tests for detection logic**Implementation checklist:**

- [ ] Verify tests pass

- [ ] Create function `detectUpgradeShortfall(factory: BuildableFactory) → FactoryUpgradeRequest | null`

**Expected outcome:** Factories automatically detect upgrade shortfalls and create requests. - Compute next affordable upgrade (iterate upgrade levels by cost)

- If cost > locally available, return request object with needed amounts

--- - Otherwise return null

- [ ] Call detection in factory processing tick (or relevant update hook)

## Step 1.3: Scheduler Integration- [ ] Only create request if not already pending/fulfilled (avoid duplicates)

- [ ] Handle multiple requests per factory (different resource needs)

**Goal:** Extend warehouse logistics scheduler to prioritize fulfilling upgrade requests.- [ ] Add unit test: "Factory with 10 metals detects landing bay (cost 40 metals) as unaffordable and creates request"

- [ ] Add unit test: "Factory with 50 metals does not create request for landing bay (cost 40 metals)"

**Files to modify:**- [ ] Verify tests pass

- `src/ecs/logistics.ts`**Expected outcome:** Factories automatically detect upgrade shortfalls and create requests. Detection logic is tested and working.

- Tests

---

**Implementation checklist:**

#### Step 1.3: Scheduler Integration

- [ ] In `computeScheduledTransfers`, add upgrade request loop after buffer-target imports

- [ ] Compute remaining resources needed for each request**Goal:** Extend warehouse logistics scheduler to prioritize fulfilling upgrade requests.

- [ ] Create outbound reservations for available amounts

- [ ] Sort requests by priority (creation time + warehouse availability)**Files to modify:**

- [ ] Respect warehouse minimum reserves

- [ ] Add logic to expire requests older than 60 seconds- `src/ecs/logistics.ts` – Extend `computeScheduledTransfers` to examine upgrade requests

- [ ] Add unit/integration tests for scheduler prioritization- Tests: Add unit/integration tests for scheduler prioritization

- [ ] Verify tests pass

**Implementation checklist:**

**Expected outcome:** Scheduler examines upgrade requests, allocates warehouse resources fairly, respects capacity constraints.

- [ ] In `computeScheduledTransfers`, after processing buffer-target imports, add upgrade request loop

---- [ ] For each factory with pending/partially_fulfilled upgrade request:

- Compute remaining resources needed (resourceNeeded - fulfilledAmount)

## Step 1.4: Transfer Execution & Fulfillment - Check warehouse availability for each resource

- Create outbound reservation for available amounts (similar to buffer-target import logic)

**Goal:** Mark upgrade requests as fulfilled when haul drones deliver resources. - Sort requests by priority: creation time (FIFO) + warehouse availability

- [ ] Respect warehouse minimum reserves (don't drain warehouse below threshold)

**Files to modify:**- [ ] Add configuration constant: `UPGRADE_REQUEST_TIMEOUT = 60000` (milliseconds)

- [ ] Add logic to expire requests older than UPGRADE_REQUEST_TIMEOUT

- `src/state/slices/factorySlice.ts`- [ ] Add unit test: "Scheduler allocates warehouse metals to factory upgrade request"

- Tests- [ ] Add unit test: "Scheduler respects warehouse minimum reserves when fulfilling requests"

- [ ] Add unit test: "Scheduler prioritizes older requests over newer ones"

**Implementation checklist:**- [ ] Add unit test: "Requests older than 60s are expired"

- [ ] Verify tests pass

- [ ] In unload/arrival handler, detect if destination factory has pending upgrade request

- [ ] Increment `fulfilledAmount` for arriving resource**Expected outcome:** Scheduler examines upgrade requests, allocates warehouse resources fairly, and respects capacity constraints.

- [ ] Mark status as `fulfilled` when all resources present

- [ ] Remove or archive request after fulfillment---

- [ ] Add integration tests for transfer delivery

- [ ] Verify tests pass#### Step 1.4: Transfer Execution & Fulfillment

**Expected outcome:** As haul drones deliver, upgrade request's fulfilled amount increases. Requests transition to fulfilled state when complete.**Goal:** Mark upgrade requests as fulfilled when haul drones deliver resources.

---**Files to modify:**

## Step 1.5: UI Display & Controls- `src/state/slices/factorySlice.ts` – Update `executeArrival` or equivalent unload path

- Tests: Add integration test for transfer delivery

**Goal:** Update UpgradeSection component to display request status and resource availability.

**Implementation checklist:**

**Files to modify:**

- [ ] In unload/arrival handler, detect if destination factory has pending upgrade request

- `src/ui/FactoryManager/sections/UpgradeSection.tsx`- [ ] If yes, increment `fulfilledAmount` for the arriving resource

- Tests- [ ] When all resources in request are fulfilled (fulfilledAmount >= resourceNeeded), mark status as `'fulfilled'`

- [ ] Remove request from list when status reaches `'fulfilled'` (or leave as history if desired)

**Implementation checklist:**- [ ] Add integration test: "Resources delivered to factory update upgrade request fulfillment state"

- [ ] Add integration test: "Request marked fulfilled when all resources present locally"

- [ ] Modify upgrade button display logic for different request states- [ ] Verify tests pass

- [ ] Show affordability status with need, reserved, in-transit information

- [ ] Add tooltip/expanded view with resource details**Expected outcome:** As haul drones deliver, upgrade request's fulfilled amount increases. Requests transition to fulfilled state when complete.

- [ ] Update `canUpgrade` logic to include reserved resources

- [ ] Add React tests for UI display---

- [ ] Verify tests pass, no visual regressions

#### Step 1.5: UI Display & Controls

**Expected outcome:** UI clearly shows upgrade needs and reserved resource status.

**Goal:** Update UpgradeSection component to display request status and resource availability.

---

**Files to modify:**

## Step 1.6: Upgrade Purchase Integration

- `src/ui/FactoryManager/sections/UpgradeSection.tsx` – Enhance upgrade button and display

**Goal:** Consume reserved resources when player clicks upgrade.- Tests: Add React component test for UI display

**Files to modify:\*\***Implementation checklist:\*\*

- `src/state/slices/factorySlice.ts`- [ ] Modify upgrade button display logic:

- Tests - If upgrade is affordable locally, show `[Upgrade (40 metals + 20 crystals)]` (enabled)
  - If upgrade is not affordable locally but no request exists, show button + "Request Resource" action

**Implementation checklist:** - If request exists (pending/partially_fulfilled), show request status:

    - Needed: X (local: Y, reserved: Z, in-transit: W, ETA: ~Ts)

- [ ] In `upgradeFactory`, consume local resources first, then fulfilled reserves - If request is fulfilled, show `[Upgrade]` button (enabled with reserved resources marked)

- [ ] Clear request after consumption- [ ] Add tooltip/expanded view showing:

- [ ] Add unit tests for upgrade purchase - Current local inventory

- [ ] Verify tests pass - Reserved resources (to be delivered)
  - In-flight hauls with ETA

**Expected outcome:** Upgrade purchase properly consumes reserved resources. Requests are cleaned up after use. - Request creation time

- [ ] Update `canUpgrade` logic to include reserved resources:

---

````typescript

## Step 1.7: Edge Case Handling  const reserved = factory.upgradeRequests

  .filter(r => r.status === 'fulfilled')

**Goal:** Handle request expiration, prestige, manual upgrades, and other edge cases.    .reduce((sum, req) => sum + (req.fulfilledAmount[key] ?? 0), 0);

return local + reserved >= cost;

**Files to modify:**  ```



- `src/state/slices/factorySlice.ts`- [ ] Add React test: "Upgrade button shows 'Need X metals' when not affordable"

- `src/ecs/logistics.ts`- [ ] Add React test: "Upgrade button enables when request fulfilled"

- Tests- [ ] Verify tests pass, no visual regressions



**Implementation checklist:****Expected outcome:** UI clearly shows upgrade needs, reserved resources, and in-transit status. Player can see at a glance what's needed and how long to wait.



- [ ] Implement request expiration (60s timeout)---

- [ ] Add prestige clearing logic

- [ ] Handle manual upgrade conflicts#### Step 1.6: Upgrade Purchase Integration

- [ ] Add 5–10 edge case unit tests

- [ ] Verify tests pass**Goal:** Consume reserved resources when player clicks upgrade.



**Expected outcome:** Edge cases are handled robustly. Requests expire, prestige clears state, conflicts don't crash game.**Files to modify:**



---- `src/state/slices/factorySlice.ts` – Update `upgradeFactory` to consume reserved resources

- Tests: Add unit test for upgrade purchase

## Step 1.8: Integration & Polish

**Implementation checklist:**

**Goal:** Full integration test, manual play-test, performance validation.

- [ ] In `upgradeFactory`, after spending local resources:

**Implementation checklist:**  - Check if factory has fulfilled upgrade request for this upgrade

- If yes, consume from `fulfilledAmount` in addition to (or instead of) local inventory

- [ ] Create E2E test scenario (detect → request → allocate → deliver → upgrade)  - Clear request after consumption

- [ ] Manual play-test for 5–10 minutes- [ ] Adjust resource consumption order: local first, then fulfilled reserves

- [ ] Performance check with profiler- [ ] Add unit test: "Upgrading factory consumes reserved resources from fulfilled request"

- [ ] Run `npm run typecheck`, `npm run lint`- [ ] Add unit test: "Request is cleared after upgrade purchase"

- [ ] Run `npm run test` – all tests pass- [ ] Verify tests pass

- [ ] Update documentation

- [ ] Mark TASK030 complete**Expected outcome:** Upgrade purchase properly consumes reserved resources. Requests are cleaned up after use.



**Expected outcome:** Feature is fully integrated, tested, and polished. No performance impact. Ready for merge.---



---#### Step 1.7: Edge Case Handling



## Progress Log**Goal:** Handle request expiration, prestige, manual upgrades, and other edge cases.



### 2025-10-25 – Task Creation**Files to modify:**



- Created TASK030 task file from DES026 design document- `src/state/slices/factorySlice.ts` – Add prestige clearing, manual upgrade conflicts

- Broke down design into 8 implementation steps with detailed checklists- `src/ecs/logistics.ts` – Add request expiration logic

- Ready to begin Step 1.1 (Data Model Setup)- Tests: Add edge case unit tests



---**Implementation checklist:**



## Acceptance Criteria- [ ] **Expiration:** Implement request age check in scheduler

- Mark requests older than 60s as `'expired'`

- ✓ Factory detects when local resources < next upgrade cost  - Periodically clean expired requests (or check on tick)

- ✓ Upgrade request is created and visible to scheduler  - Unit test: "Request marked expired after 60s"

- ✓ Scheduler allocates warehouse resources to fulfill requests- [ ] **Prestige:** Clear all pending/partially_fulfilled upgrade requests

- ✓ As haul drones deliver, request's `fulfilledAmount` increases  - Add call in prestige reset function

- ✓ UI shows resource shortfall, reserved in-transit, and current progress  - Unit test: "Prestige clears all upgrade requests"

- ✓ Upgrade button enables once request is fulfilled- [ ] **Manual Upgrade Conflicts:** If factory upgrades via another path, clear associated request

- ✓ Purchasing upgrade consumes reserved resources correctly  - Check in `upgradeFactory` to clear matching request

- ✓ Requests expire after 60s without fulfillment  - Unit test: "Manual upgrade clears associated request"

- ✓ Prestige clears all pending requests- [ ] **Warehouse Depletion:** Gracefully handle when warehouse can't fulfill requests

- ✓ All tests pass (unit, integration, playwright)  - Scheduler already checks warehouse availability; no new logic needed

- ✓ No performance regression  - Edge case test: "Request stays pending if warehouse has 0 of needed resource"

- [ ] **Concurrent Requests:** Ensure multiple requests per factory don't interfere

---  - Unit test: "Factory can have requests for different resources (metals & crystals)"

- [ ] Add 5–10 edge case unit tests covering all scenarios above

## Related Artifacts- [ ] Verify tests pass



- **Design Document:** DES026 – Factory Upgrade Resource Reservations**Expected outcome:** Edge cases are handled robustly. Requests expire, prestige clears state, conflicts don't crash game.

- **Dependencies:** TASK025 (Warehouse Reconciliation), TASK019 (Hauler Logistics)

- **Related Requirements:** RQ-037–RQ-040 (warehouse behavior & prestige)---


#### Step 1.8: Integration & Polish

**Goal:** Full integration test, manual play-test, performance validation.

**Implementation checklist:**

- [ ] **E2E Test:** Create integrated test scenario
- Factory starts with 10 metals
- Landing bay upgrade costs 40 metals
- Factory detects shortfall → creates request
- Scheduler allocates warehouse metals to request
- Haul dispatch executes
- Resources arrive at factory → request fulfilled
- Player clicks upgrade → factory upgrades successfully
- Request is cleared
- Verify all steps with assertions
- [ ] **Manual Play-Test:** Run in-game for 5–10 minutes
- Check that factories request resources when needed
- Verify haul drones deliver to requesting factories
- Observe UI updates for request status
- Confirm upgrades complete successfully
- Watch for any visual glitches or delays
- Test with multiple factories requesting simultaneously
- [ ] **Performance Check:**
- Run perf profiler on warehouse scheduler with 10+ factories + upgrade requests
- Ensure no frame drops or slowdowns
- Check memory usage (no leaks from request objects)
- [ ] **Lint & Type Check:**
- `npm run typecheck` – all clear
- `npm run lint` – all clear
- [ ] **Full Test Suite:**
- `npm run test` – all tests pass (unit + integration + React)
- No regressions in existing tests
- [ ] Update documentation/memory bank with final design notes
- [ ] Mark TASK030 complete

**Expected outcome:** Feature is fully integrated, tested, and polished. No performance impact. Ready for merge.

---

## Progress Log

### 2025-10-25 – Task Creation

- Created TASK030 task file from DES026 design document
- Broke down design into 8 implementation steps with detailed checklists
- Prepared subtask table and tracking structure
- Ready to begin Step 1.1 (Data Model Setup)

---

## Acceptance Criteria

- ✓ Factory detects when local resources < next upgrade cost
- ✓ Upgrade request is created and visible to scheduler
- ✓ Scheduler allocates warehouse resources to fulfill requests (respecting warehouse minimum reserves)
- ✓ As haul drones deliver, request's `fulfilledAmount` increases
- ✓ UI shows resource shortfall, reserved in-transit, and current progress
- ✓ Upgrade button enables once request is fulfilled (local + reserved ≥ cost)
- ✓ Purchasing upgrade consumes reserved resources correctly
- ✓ Requests expire after 60s without fulfillment
- ✓ Prestige clears all pending requests
- ✓ All tests pass (unit, integration, playwright)
- ✓ No performance regression

---

## Related Artifacts

- **Design Document:** DES026 – Factory Upgrade Resource Reservations
- **Dependencies:** TASK025 (Warehouse Reconciliation), TASK019 (Hauler Logistics)
- **Related Requirements:** RQ-037–RQ-040 (warehouse behavior & prestige)

---

## Notes

- Feature layers on top of existing warehouse logistics; no fundamental architecture changes needed
- Request lifecycle mirrors current buffer-target import pattern (leverage existing scheduler code)
- UI complexity is modest (inline status in upgrade section + tooltip for details)
- Edge cases (expiration, prestige) are straightforward; implement after core flow works
````
