# Fix: Specialization Tech Unlock Path (Codex P1 Badge)

**Status**: ✅ Completed  
**Date**: 2025-10-23  
**Related**: Issue from `src/state/slices/resourceSlice.ts` (lines +117 to +121) - Codex Review P1 Badge

---

## Problem Statement

**Circular Dependency - Techs Permanently Locked**

The specialization tech unlock system had a critical flaw: `specTechSpent` (cumulative secondary resource spending) only incremented **after** a successful tech purchase. This created an impossible-to-break cycle:

1. Specialization techs require 50k+ metal/crystal/organics/ice to unlock (checked before purchase)
2. `specTechSpent` starts at 0 and only increments when a tech is successfully purchased
3. But purchase is blocked by the unlock check
4. **Result**: Every tech starts locked with no gameplay path to reach the unlock threshold

**As Quoted in Codex Review**:

> "The only place [specTechSpent] changes is after the unlocked check inside purchaseSpecTech, meaning every tech starts locked and there is no path in gameplay to reach the required specTechSpent threshold."

---

## Solution

**Track All Secondary Resource Spending Across All Systems**

Modified the store to accumulate `specTechSpent` whenever **any** secondary resource is spent:

### Changes Made

#### 1. **`investPrestige()` in `resourceSlice.ts`**

- Added: Track spending when prestige investments are purchased
- Increments `specTechSpent[resourceKey]` by investment cost

#### 2. **`purchaseFactory()` in `factorySlice.ts`**

- Added: Track metals and crystals spending when factories are purchased
- Increments `specTechSpent.metals` and `specTechSpent.crystals`

#### 3. **`upgradeFactory()` in `factorySlice.ts`**

- Added: Track secondary resource spending when factory upgrades are purchased
- Iterates through all upgrade costs and increments `specTechSpent` for metals/crystals/organics/ice

#### 4. **New Helper Method: `trackSecondaryResourceSpend()`**

- Added to `ResourceSliceMethods` interface for future use
- Validates that resourceKey is a valid secondary resource (metals, crystals, organics, ice)
- Can be called by other systems to track spending

### Design Intent Achieved

**DES029 Now Functional**: Specialization techs unlock **gradually** as players spend resources:

- Player buys factories → spends metals/crystals → `specTechSpent` grows
- Player upgrades factories with alternative costs → secondary resources tracked
- Player invests in prestige → spending accumulates
- Once `specTechSpent[resource] >= 50,000` → tech unlocks for purchase
- Purchasing tech further increments `specTechSpent` for next tier progression

---

## Test Coverage

Created comprehensive test suite: `src/state/slices/resourceSlice.unlock.test.ts`

**5 New Tests** (all passing):

1. ✅ **Unlock progression**: Verify techs unlock after 50k spending threshold
2. ✅ **Factory purchase tracking**: Confirm metals/crystals spending recorded
3. ✅ **Prestige investment tracking**: Verify prestige spending increments counter
4. ✅ **Multi-tier progression**: Ensure players can purchase tiers sequentially
5. ✅ **Factory upgrade tracking**: Verify alternative cost spending is tracked

---

## Validation

- ✅ TypeScript: Clean (no compilation errors)
- ✅ Lint: Clean
- ✅ Tests: **194 passing** (189 existing + 5 new)
- ✅ No regressions

---

## Gameplay Impact

**Before Fix**: Specialization Tech panel permanently locked, no access to Tier 2 bonuses  
**After Fix**: Tech panel unlocks naturally as players spend secondary resources on factories/upgrades

**Example Flow**:

1. Player gathers 60k metals from asteroid mining
2. Spends 20k on factory purchases → `specTechSpent.metals = 20,000`
3. Spends 15k on factory docking upgrades (metals variant) → `specTechSpent.metals = 35,000`
4. Spends 20k on hauler modules → `specTechSpent.metals = 55,000`
5. **Ore Magnet tech now unlocks** ✅
6. Player can now purchase Ore Magnet Lv1 (costs 8k metals, persistent bonus +3% ore)
7. Tier 2 costs 10.2k metals, tier 3 costs 13k → progression continues

---

## Code Quality

- Small, focused changes to three methods + one new helper
- Type-safe: All secondary resource keys validated
- No breaking changes to existing APIs
- Helper method (`trackSecondaryResourceSpend`) available for future resource sink systems
