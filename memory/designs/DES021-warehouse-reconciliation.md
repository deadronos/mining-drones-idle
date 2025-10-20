---
adr: Warehouse-based resource reconciliation model
description: Introduce a warehouse (hub) station to consolidate and distribute resources, fixing the dual-inventory (global vs. local factory) accounting problem.
status: approved
date: 2025-10-19
decisions_approved_on: 2025-10-19
---

# DES021: Warehouse-Based Resource Reconciliation

## ✅ Approved Decisions (2025-10-19)

| Q#  | Question             | Selected                                    | Notes                                                                                   |
| --- | -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Q1  | Warehouse visibility | **Hidden/abstract**                         | Players see haulers deliver to warehouse via FX; no building object.                    |
| Q2  | Resource flow        | **Factories buffer locally, export excess** | Factories can request ore from warehouse to keep refineries busy.                       |
| Q3  | Starting haulers     | **1 free hauler on Factory 1**              | Teaches logistics early; balances onboarding.                                           |
| Q4  | Warehouse upgrades   | **Global module upgrades**                  | Warehouse capacity = `BASE_STORAGE + modules.storage * STORAGE_PER_LEVEL * MULTIPLIER`. |
| Q5  | Prestige interaction | **Warehouse wiped on prestige**             | Full reset; future prestige-upgradeable bank (out-of-scope).                            |

## Problem Statement

Currently, resources exist in two separate accounting systems:

1. **Global pool** (`state.resources`) — used for prestige checks, module upgrades, HUD display.
2. **Factory-local pools** (`factory.resources` on each factory) — used for local refining, facility upgrades, hauler purchases.

Both systems receive updates from the same production events (e.g., factory refines produce bars in both local AND global, creating apparent duplication). Additionally:

- Drone unloads deposit ore only locally, leaving global ore untouched.
- Logistics transfers only move local inventories.
- The global bank and factory banks are not reconciled into a coherent accounting invariant.

**Solution**: Introduce a **Warehouse** entity that acts as the canonical global resource store. All inter-factory transfers route through it, and it becomes the single point of truth. Factories become primarily local production/consumption nodes, and the warehouse handles redistribution.

## Design Goals

1. **Single source of truth**: The warehouse holds the canonical global resource pool.
2. **No duplication**: When resources are produced at a factory, they either stay local or are sent to the warehouse — not both.
3. **Clear semantics**: Resources in the warehouse are "available for global spending" (prestige, modules); resources in factories are "locked in local production/storage."
4. **Simplify accounting**: Implement a consistent rule: `total_resources = warehouse + sum(factories)` (plus in-transit).
5. **Early onboarding**: Start the first factory with at least one hauler drone so players immediately engage with the logistics system.

## Open Questions & Design Choices

### Q1: Should the warehouse be a visible entity (like a factory) or a background abstraction?

#### Suggestion A: Visible warehouse building

- Warehouse is spawned as a third building type (alongside Factory and Mining Node).
- Players can click on it to see resource inventory, queue up purchases, or toggle filters.
- **Pros**: Transparent to the player; adds a UI element to manage; consistent with factory metaphor.
- **Cons**: More 3D assets; extra UI complexity; may clutter the scene.

#### Suggestion B: Hidden/abstract warehouse

- Warehouse state lives in `state.resources` but is conceptually tied to a fixed world position (e.g., origin or first factory location).
- No separate building object; resources are shown in the HUD or a dedicated "Inventory" panel.
- **Pros**: Minimal visual clutter; simpler to implement; keeps focus on factories.
- **Cons**: Less discoverable; players may not immediately understand what "global resources" represent.

#### Suggestion C: Hybrid — warehouse-as-central-bank icon

- Warehouse is a small non-interactive visual marker or icon at a fixed location (e.g., center of the map).
- Resources are managed via HUD / panel, not by clicking the warehouse.
- Players understand there's a "bank" but don't need to navigate to it.
- **Pros**: Balances clarity and simplicity; visually indicates the concept without full UX overhead.
- **Cons**: Still needs some visual asset; intermediate complexity.

#### Recommendation: **Suggestion B (Hidden/abstract)** ✅ SELECTED

- Keeps the focus on factories and mining nodes as the primary player interaction points.
- Simplifies the 3D scene; avoids additional assets.
- The warehouse concept is well-explained in onboarding and reflected in UI terminology ("Warehouse Inventory" or "Global Bank").
- **Added clarity**: Players will see haulers delivering resources _to_ the warehouse, making the concept visible through action/FX even without a physical building.

---

### Q2: How should resources flow between factories and the warehouse?

#### Suggestion A: All factory output → warehouse; players manually route back

- When factories refine bars, produce metals, or drones unload, all resources go to the warehouse.
- Haulers act as the reverse pipeline: they ferry warehouse resources back to factories as needed.
- **Pros**: Completely eliminates duplication; clean accounting.
- **Cons**: More hauler trips; may feel like busywork; harder to run a local, self-contained factory.

#### Suggestion B: Factory output stays local; only "excess" goes to warehouse

- Factories retain locally-produced resources up to a configurable capacity or buffer.
- Once a factory has enough ore/bars for its own refining, it exports surplus to the warehouse via dedicated "export haulers" or a separate export mode.
- **Pros**: Factories feel more autonomous; less granular logistics management required.
- **Cons**: More complex logic; need to define "surplus" thresholds; potential for local hoarding.

#### Suggestion C: Resource type-based routing

- Raw resources (ore, ice, metals, organics) stay local on factories for refining.
- Refined resources (bars, credits) automatically route to warehouse; factories import what they need for local upgrades.
- **Pros**: Natural separation based on production pipeline; reduces warehouse congestion.
- **Cons**: Adds special-case logic; harder to change rules later.

#### Recommendation: **Suggestion B (Excess → warehouse with buffering)** ✅ SELECTED

- Factories retain a reasonable local buffer (e.g., 30s worth of local consumption).
- Once buffer is full, excess routes to the warehouse via existing hauler system.
- Keeps factories self-sufficient and allows players to feel "base-building" while still reconciling to warehouse.
- Implement via updated `computeBufferTarget` in logistics: factories only export when above threshold.
- **Added capability**: Factories with 0 ore can _request_ ore from warehouse to keep refineries busy, enabling active resource management.

---

### Q3: Should the first factory spawn with 1–2 hauler drones pre-assigned?

#### Suggestion A: Start with 2 haulers on Factory 1

- Game gives the player 2 free haulers at the beginning to kick off logistics immediately.
- They'll see the system in action from the first moment.
- **Pros**: Engaging first experience; encourages trading/redistribution early.
- **Cons**: Removes early sense of scarcity; haulers become less valuable milestone.

#### Suggestion B: Start with 1 hauler on Factory 1

- Minimal onboarding; player sees logistics but isn't overwhelmed.
- Feels like a tutorial drone.
- **Pros**: Balances learning curve with engagement; 1 hauler is visible and useful but not game-changing.
- **Cons**: Still feels slightly handed to the player (albeit less so than 2).

#### Suggestion C: First hauler is a quest/milestone reward

- Player buys their first factory normally but cannot assign haulers until they hit a milestone (e.g., refine 100 ore or reach 5,000 bars).
- **Pros**: Teaches the single-factory loop first, then unlocks trading.
- **Cons**: Delays the "aha!" moment of multi-factory logistics; more onboarding friction.

#### Recommendation: **Suggestion B (Start with 1 hauler on Factory 1)** ✅ SELECTED

- Minimally prescriptive: the player gets one "free" hauler to understand the system.
- Not so many that the player feels like haulers are infinite.
- Pairs well with initial bar-based costs for additional haulers, teaching the resource-trade-off early.
- Update `createDefaultFactories()` to set `haulersAssigned: 1` on the first factory.

---

### Q4: Should the warehouse have independent upgrades or inherit factory mechanics?

#### Suggestion A: Warehouse has its own upgrade tree

- Warehouse can buy capacity, speed, and filtering upgrades (parallel to factory logistics upgrades).
- **Pros**: Deep late-game progression; warehouse becomes another node to invest in.
- **Cons**: More content to balance; warehouse becomes as complex as factories.

#### Suggestion B: Warehouse uses global module upgrades

- The warehouse capacity is derived from player-level module upgrades (e.g., `state.modules.storage`).
- No independent warehouse upgrades; capacity scales with prestige and module level.
- **Pros**: Simpler; warehouse capacity is proportional to player power level.
- **Cons**: Warehouse feels less "upgradeable"; all storage gains are global, which may not feel directed at the warehouse.

#### Suggestion C: Warehouse is a special "high-capacity" factory

- Warehouse is a fifth building type with fixed upgrades (e.g., 10x normal storage, 2x throughput).
- Inherits factory UI and upgrade metaphors but cannot refine or mine.
- **Pros**: Reuses code; consistent mental model; adds a unique endgame facility.
- **Cons**: Blurs the warehouse concept; may confuse players if warehouse looks like a factory but acts differently.

#### Recommendation: **Suggestion B (Global module upgrades)** ✅ SELECTED

- Warehouse capacity = `BASE_STORAGE + state.modules.storage * STORAGE_PER_LEVEL * WAREHOUSE_MULTIPLIER`.
- Keep it simple; warehouse is a logical consolidation point, not a separate upgrade sink.
- Focus on making factories and haulers the upgrade targets.
- **Implementation note**: Global module upgrades are converted/mapped to warehouse capacity as the single resource pool increases via player's module purchases.

---

### Q5: How should prestige runs interact with the warehouse?

#### Suggestion A: Warehouse inventory is wiped on prestige

- Prestige resets factories AND clears the warehouse (like today).
- Cores are earned from pre-prestige warehouse inventory.
- **Pros**: Clean slate; prestige is a full reset.
- **Cons**: Players feel punished for storing resources in the "safe" warehouse.

#### Suggestion B: Warehouse survives prestige (resource carry-over)

- Prestige resets factories but NOT the warehouse.
- Players can "bank" resources in the warehouse before prestige and carry them forward.
- **Pros**: Rewarding strategy; encourages mid-game planning.
- **Cons**: May break balance if players hoard too much; needs caps or rarity rules.

#### Suggestion C: Partial survival based on warehouse level

- Only a percentage of warehouse resources survive prestige (e.g., 10% per prestige core).
- **Pros**: Balances rewards with reset flavor; scales with player progression.
- **Cons**: Complex rule; harder to communicate; requires tuning.

#### Recommendation: **Suggestion A (Warehouse wiped on prestige)** ✅ SELECTED

- Keeps prestige as a full reset, preserving the restart feel.
- Cores earned from final factory inventories (visible at prestige screen).
- Simpler design; easier to test and explain.
- If later we want carry-over, we can add a prestige "bank" upgrade.
- **Future scope (out-of-scope for DES021)**: Prestige-specific upgrades buyable with earned cores (e.g., "Prestige Bank" to carry over X% of warehouse on next run).

---

## Implementation Outline

### 1. Warehouse Type Definition

- Add `warehouse: { resources: Resources; id: string }` to `StoreState`.
- Or: alias `state.resources` as the warehouse and treat factories as secondary stores.

### 2. Resource Flow Updates

- **Factory production**: Bars refine at the factory local. Once local buffer > threshold, schedule export haulers.
- **Drone unload**: Ore unloaded at a factory stays local. Other resources go to warehouse IF no factory docking.
- **Hauler transfers**: Existing scheduler updated to offer factory-to-warehouse and warehouse-to-factory transfers.

### 3. Initial State & Onboarding

- First factory spawned with `haulersAssigned: 1`.
- Factory created with some initial resources (e.g., ore: 50, bars: 10) for bootstrap.

### 4. UI Updates

- HUD shows warehouse inventory (relabel current "global resources").
- Factory inspector shows local resources and distinguishes from warehouse.
- Logistics panel includes warehouse as a node.

### 5. Migration

- For saved games: treat existing `state.resources` as the new warehouse; treat existing factory inventories as local.
- No reset required if logic is backward-compatible.

---

## Related Requirements

- RQ-001: Resources must be uniquely counted (no duplication).
- RQ-002: Prestige must reset all factory inventory but preserve cores.
- RQ-???: Initial game experience should teach haulers and logistics early (new).
- RQ-???: Warehouse should be the hub for global purchases (prestige, modules).

---

## Questions for User

1. **Visibility of warehouse**: Do you prefer the abstract (hidden) or visible building approach?
2. **Resource flow**: Should factories export surplus to warehouse, or should all output go to warehouse?
3. **Starting haulers**: Does 1 free hauler on the first factory feel right?
4. **Warehouse upgrades**: Should it have independent upgrades or use global module scaling?
5. **Prestige interaction**: Should the warehouse be wiped or carry over partial resources?

---

## Implementation Tasks

See `memory/tasks/TASK025-warehouse-reconciliation.md` for full implementation roadmap.
