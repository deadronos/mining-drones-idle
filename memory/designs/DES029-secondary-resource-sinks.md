# DES029: Secondary Resource Sinks & Investment System

**Status**: Approved  
**Created**: 2025-10-21  
**Last Updated**: 2025-10-21  
**Author**: Design Discussion  
**Follows**: DES028 (Hauler Tech Upgrades)

---

## Overview

Create a three-tier resource sink system to address accumulation of secondary resources (metals, crystals, organics, ice). Combine immediate utility (bulk factory upgrades), medium-term progression (factory specialization techs), and long-term investment (prestige-linked bonuses). Each sink amplifies resource velocity and ties back into improved production, creating positive feedback loops.

---

## Problem Statement

- **Secondary resource glut**: Metals (147k), crystals (156k), organics (214k), ice (239k) accumulate with no meaningful exit
- **Warehouse bottleneck**: These resources fill warehouse capacity, blocking bars (needed for upgrades) from being imported
- **Weak upgrade economy**: Factory upgrades are finite purchases; once complete, resource consumption stops
- **No investment layer**: Players accumulate resources but have no long-term progression tied to "how much have I invested"

---

## Design Decisions (EARS Requirements)

| Requirement                 | Behavior                                                                                                                                            | Acceptance Criteria                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Immediate sink**          | WHEN a factory needs an upgrade, THE SYSTEM SHALL allow purchasing with alternative resource costs (e.g., metals instead of bars)                   | Bulk upgrades reduce warehouse occupancy immediately                      |
| **Medium-term progression** | WHEN a player accumulates 50k+ of a secondary resource, THE SYSTEM SHALL unlock specialization techs that scale with accumulated amount             | Tech unlocks gradually; bonuses improve resource velocity                 |
| **Long-term investment**    | WHEN a player spends resources on prestige investments, THE SYSTEM SHALL persist the investment across prestige resets and scale future investments | Higher investment costs (1k → 2k → 5k) create endless progression         |
| **Feedback loops**          | WHEN resources are consumed via sinks, THE SYSTEM SHALL improve production/logistics, enabling more resource generation                             | More metals → better haulers → faster exports → more bars → more upgrades |
| **Bonus compounding**       | WHEN multiple sinks are active, THE SYSTEM SHALL stack bonuses multiplicatively to reward diverse investment                                        | Investing in all three areas yields exponential benefits                  |

---

## Architecture

### Tier 1: Bulk Factory Upgrades (Immediate Utility)

Allow factories to purchase standard upgrades using alternative resource costs:

```typescript
interface UpgradeCostVariant {
  resourceId: string; // 'metals', 'crystals', 'organics', 'ice'
  amount: number;
  ratio: number; // How many of this resource = 1 bar value
}

interface FactoryUpgradeDefinition {
  // ... existing ...
  alternativeCosts?: Record<string, UpgradeCostVariant>;
}
```

**Cost Matrix** (per upgrade level):

| Upgrade      | Bars | Metals | Crystals         | Organics          | Ice               |
| ------------ | ---- | ------ | ---------------- | ----------------- | ----------------- |
| **Docking**  | 2672 | 1800   | —                | —                 | —                 |
| **Refinery** | 2672 | —      | —                | 1000 + 500 metals | —                 |
| **Storage**  | 2672 | —      | —                | 2000              | —                 |
| **Energy**   | 2672 | —      | —                | —                 | 1500 + 300 metals |
| **Solar**    | 2672 | —      | 500 + 200 metals | —                 | —                 |

**Implementation**:

- Add `alternativeCosts` to each upgrade definition in `constants.ts`
- Create `computeUpgradeCost(upgradeId, resourceType)` utility
- Extend store method `purchaseFactoryUpgrade()` to accept resource type parameter
- UI: Add cost tabs to upgrade buttons ("2672 bars" vs "1800 metals" vs "1000 organics")

**Why this tier**:

- Immediate pressure relief (use metals/crystals now, not later)
- Reduces warehouse bottleneck (alternative paths to progression)
- Natural choice-making (speed up with bars or save bars with metals?)

---

### Tier 2: Factory Specialization Techs (Medium-Term Progression)

Unlock permanent techs as players accumulate secondary resources. Each tech provides a passive bonus that scales with investment level.

```typescript
interface FactorySpecTech {
  id: string; // e.g., 'ore-magnet', 'crystal-resonance'
  name: string;
  description: string;
  resourceType: string; // 'metals', 'crystals', 'organics', 'ice'
  unlocksAt: number; // e.g., 50,000 total metals spent
  maxLevel: number;
  bonusPerLevel: (level: number) => number; // Scale function
  effect: (level: number, factories: BuildableFactory[]) => void; // Apply bonus
}
```

**Tech Definitions**:

| Tech                  | Resource | Unlocks At | Effect                                                 | Max Level | Bonus Formula           |
| --------------------- | -------- | ---------- | ------------------------------------------------------ | --------- | ----------------------- |
| **Ore Magnet**        | Metals   | 50k spent  | Factories attract +3% ore per level                    | 20        | Base (1 + level × 0.03) |
| **Crystal Resonance** | Crystals | 50k spent  | +2% asteroid richness per level (more resources spawn) | 20        | Base (1 + level × 0.02) |
| **Biotech Farming**   | Organics | 50k spent  | +3% refinery yield per level                           | 20        | Base (1 + level × 0.03) |
| **Cryo-Preservation** | Ice      | 50k spent  | +5% offline gains per level                            | 15        | Base (1 + level × 0.05) |

**Purchase Flow**:

1. Player accumulates 50k metals (purchase Docking upgrades with it)
2. System detects threshold → unlock "Ore Magnet" tech for purchase
3. Player can now spend 1000 metals → Ore Magnet Lv1 (persistent)
4. Can upgrade: 1000 → 2000 → 5000 (exponential) for Lv2, Lv3, etc.
5. Each level purchased increases accumulated total, enabling higher tiers

**Implementation**:

- Add `factorySpecTechs` to store state
- Create `unlockedSpecTechs()` selector based on cumulative spending
- Add `purchaseSpecTech(techId, resourceType)` store method
- Apply bonuses in main game loop (factory processing, asteroid generation)
- Track cumulative spend per resource type in store state

**Why this tier**:

- Rewards accumulation (you have 147k metals? That's valuable!)
- Medium-term goals (work toward Lv5 Ore Magnet)
- Bonuses tie back to production (more ore → more metals → buy more upgrades)
- Creates specialization (become "metal-focused" or balanced)

---

### Tier 3: Prestige Investment Board (Long-Term Progression)

One-time purchases of **permanent** bonuses that survive prestige reset.

```typescript
interface PrestigeInvestment {
  id: string; // e.g., 'drone-velocity'
  name: string;
  description: string;
  resourceType: string;
  basePrice: number; // Initial cost
  priceGrowth: number; // Exponential factor (1.5x per purchase)
  bonusPerTier: (tier: number) => number; // Bonus at each tier
  maxTiers: number;
}
```

**Investment Board**:

| Investment             | Resource | Base Cost | Growth | Bonus Per Tier         | Max Tiers |
| ---------------------- | -------- | --------- | ------ | ---------------------- | --------- |
| **Drone Velocity**     | Metals   | 1000      | 1.5×   | +2% drone speed        | 50        |
| **Asteroid Abundance** | Crystals | 1000      | 1.5×   | +2% spawn rate         | 50        |
| **Refinery Mastery**   | Organics | 1000      | 1.5×   | +1% bar yield          | 50        |
| **Offline Efficiency** | Ice      | 1000      | 1.5×   | +3% offline multiplier | 50        |

**Cost Progression**:

```
Tier 1: 1000 metals
Tier 2: 1500 metals (1000 × 1.5)
Tier 3: 2250 metals (1500 × 1.5)
Tier 4: 3375 metals (2250 × 1.5)
...endless scaling
```

**Implementation**:

- Add `prestigeInvestments` to store state (persisted separately, survives prestige)
- Create `investPrestige(investmentId, resourceType)` store method
- Apply bonuses globally during prestige calculation or game state initialization
- UI: "Investment Board" shows current tier + cost for next tier (like Prestige Cores)
- Tooltip: "You've invested 5 tiers in Drone Velocity: +10% speed"

**Why this tier**:

- True endgame content (invest forever)
- Bonuses feel meaningful (5 tiers × 2% = 10.8% actual speed)
- Survives prestige (reward for long-term play across runs)
- Exponential cost prevents "solve it in one run" (encourages multiple runs)
- Cross-run progression (this run: 1000 metals → Tier 1; next run: easier to reach Tier 2)

---

## Bonus Compounding

All three tiers stack multiplicatively:

```
Final Refinery Yield = Base × (1 + SpecTech_Tier × 0.03) × (1 + PrestigeBonus)

Example:
Base: 1 bar per ore
Biotech Farming Lv5: +15% = 1.15
Prestige Investment Tier 3: +3% = 1.03
Final: 1 × 1.15 × 1.03 = 1.1845 bars per ore
```

**Synergies**:

| Path 1                           | Path 2                            | Path 3                      | Result                                                           |
| -------------------------------- | --------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| **Metals** → Ore Magnet          | Docking upgrades (more factories) | Drone Velocity prestige     | More factories, each attracting more ore, with faster drones     |
| **Organics** → Biotech Farming   | Refinery upgrades (more slots)    | Refinery Mastery prestige   | More bars produced; feeds bar sink (upgrades) → feedback loop    |
| **Crystals** → Crystal Resonance | Solar upgrades (more energy)      | Asteroid Abundance prestige | More asteroids spawn, more resources; accelerates all production |
| **Ice** → Cryo-Preservation      | Energy upgrades                   | Offline Efficiency prestige | Better offline gains; passive progression encourages long play   |

---

## Data Schema

### Store State Extensions

```typescript
export interface StoreState {
  // ... existing ...

  // Tier 2: Specialization Techs
  specTechs: {
    oreMagnet?: number; // Current level
    crystalResonance?: number;
    biotechFarming?: number;
    cryoPreservation?: number;
  };
  specTechSpent: {
    metals?: number; // Cumulative metals spent on techs
    crystals?: number;
    organics?: number;
    ice?: number;
  };

  // Tier 3: Prestige Investments (persisted separately)
  prestigeInvestments: {
    droneVelocity?: number; // Current tier
    asteroidAbundance?: number;
    refineryMastery?: number;
    offlineEfficiency?: number;
  };
}
```

### Snapshot Extensions

```typescript
export interface StoreSnapshot {
  // ... existing ...
  specTechs?: StoreState['specTechs'];
  specTechSpent?: StoreState['specTechSpent'];
  prestigeInvestments?: StoreState['prestigeInvestments'];
}
```

---

## Migration

When loading old saves:

- Initialize `specTechs`, `specTechSpent` to 0/undefined (no techs)
- Initialize `prestigeInvestments` to 0/undefined (no investments)
- No loss of functionality

On prestige reset:

- **Keep**: `prestigeInvestments` (persists across resets)
- **Wipe**: `specTechs`, `specTechSpent` (reset per run)
- Preserve all factory-level upgrades and state normally

Bump `SAVE_VERSION` to `'0.3.4'`.

---

## Implementation Phases

### Phase 1: Tier 1 – Bulk Factory Upgrades

1. Add `alternativeCosts` to upgrade definitions
2. Create `computeUpgradeCost(upgradeId, resourceType)` utility
3. Extend purchase logic to accept resource type
4. Add cost variant UI to factory upgrade buttons
5. Unit tests: verify alternative costs work
6. **Timeline**: ~2–3 days (straightforward, mostly UI)

### Phase 2: Tier 2 – Specialization Techs

1. Add `specTechs` and `specTechSpent` to store state
2. Implement `unlockedSpecTechs()` selector
3. Create `purchaseSpecTech()` store method with progression logic
4. Apply tech bonuses in game loop (ore attraction, asteroid spawn, refinery yield, offline gains)
5. Add UI panel: "Specialization Techs" in warehouse panel (collapsible)
6. Unit + integration tests
7. **Timeline**: ~3–4 days (more complex state management)

### Phase 3: Tier 3 – Prestige Investments

1. Add `prestigeInvestments` to store (persisted separately)
2. Create `investPrestige(investmentId, resourceType)` with exponential pricing
3. Apply investment bonuses globally during prestige calculation
4. Add UI: "Investment Board" tab in prestige/settings panel
5. Show cumulative bonuses from all tiers
6. Unit + persistence tests
7. **Timeline**: ~2–3 days (simpler than Tier 2, but prestige interaction needs care)

### Phase 4: Bonus Compounding & UI Polish

1. Verify multipliers stack correctly in game loop
2. Add tooltips showing active bonuses (spec tech + prestige stacking)
3. Performance check (ensure bonus calculations don't slow ticks)
4. Balance tuning (costs feel rewarding, bonuses feel impactful)
5. **Timeline**: ~1–2 days

### Phase 5: Testing & Documentation

1. Full test suite (`npm run test`)
2. Manual playtesting: verify sinks feel rewarding
3. Verify warehouse bottleneck is improved (bar imports flow better)
4. Check prestige interactions (investments persist correctly)
5. Documentation: explain sinks to players (tooltips, UI hints)
6. **Timeline**: ~1 day

---

## Success Criteria

- ✅ Alternative upgrade costs allow purchasing without bars (immediate relief)
- ✅ Warehouse occupancy visibly decreases (bars can flow in)
- ✅ Specialization techs unlock at expected thresholds (50k accumulation)
- ✅ Techs provide meaningful bonuses (ore production increases, refinery improves, etc.)
- ✅ Prestige investments persist across resets
- ✅ Exponential pricing prevents "solve in one run" (encourages multiple runs)
- ✅ Bonuses compound correctly (multiplicative stacking verified in tests)
- ✅ UI clearly shows all available sinks + costs
- ✅ No performance regression in game loop
- ✅ All existing tests pass

---

## Future Extensions

1. **Specialization badges**: UI shows which player has invested most in each tech
2. **Milestone rewards**: Unlock cosmetics when reaching Tier 5 of a tech
3. **Prestige prestige**: After X runs, unlock "Ascension" tier with special investments
4. **Achievement system**: "Invested 10 tiers in Refinery Mastery", etc.
5. **Cross-resource tech**: "Ore Alchemy" (1000 metals + 500 crystals → unlock new capability)
6. **Weekly challenges**: "Spend 10k organics this week" → bonus prestige cores

---

## Trade-offs & Rationale

| Decision                           | Alternative                | Why Chosen                                             |
| ---------------------------------- | -------------------------- | ------------------------------------------------------ |
| Three-tier system                  | Single mega-sink           | Gives players choices + multiple progression paths     |
| Prestige investments survive reset | Reset like everything else | Reward long-term play; create cross-run progression    |
| Exponential prestige cost          | Linear cost                | Prevents "cap out" in one run; endless scaling         |
| Bonus multiplicative stacking      | Additive stacking          | Scales better late-game; encourages diverse investment |
| Tier 1 sinks via upgrades          | New currency system        | Reuses existing mechanics; lower implementation cost   |

---

## Open Questions

1. **Should Tier 2 techs also cost prestige cores** (hybrid currency)? Or just secondary resources?
2. **Max Tier 3 tier**: Should it be hard-capped (50) or infinite with exponential pricing forever?
3. **Prestige interaction**: Should _some_ spec tech progress carry over (partial prestige effect) or fully reset?
4. **UI clarity**: How to communicate all three tiers without overwhelming players? (Progressive disclosure?)
5. **Balance**: Are costs too cheap/expensive? (Deferred to playtesting in Phase 4)

---

## Links & References

- **Follows**: DES028 (Hauler Tech Upgrades – bars sink)
- **Related**: DES018 (Factory Upgrades), DES021 (Warehouse), DES025 (Prestige)
- **Code locations**: `src/state/constants.ts`, `src/state/types.ts`, `src/state/slices/`, `src/lib/`, `src/ui/`
- **Current issue**: 147k metals, 156k crystals, 214k organics, 239k ice accumulating with no sink
