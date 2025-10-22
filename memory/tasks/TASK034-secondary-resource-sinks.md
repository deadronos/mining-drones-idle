# TASK034 - Secondary Resource Sinks & Investment System

**Status**: Pending  
**Added**: 2025-10-21  
**Updated**: 2025-10-21  
**Design Reference**: DES029-secondary-resource-sinks.md  
**Follows**: TASK033 (Hauler Tech Upgrades)

---

## Original Request

Implement a three-tier resource sink system to address accumulation of secondary resources (metals, crystals, organics, ice). The system combines:

1. **Tier 1**: Bulk factory upgrades with alternative resource costs (immediate utility)
2. **Tier 2**: Factory specialization techs unlocked by accumulation (medium-term progression)
3. **Tier 3**: Prestige investment board with exponential scaling (long-term progression)

This addresses the warehouse bottleneck where secondary resources prevent bar imports and upgrades.

---

## Thought Process

The problem: Players accumulate 100k+ of secondary resources with no meaningful exit, blocking warehouse capacity and preventing bar imports.

The solution integrates three layers of sinks:

- **Tier 1** reuses existing upgrade mechanics but accepts alternative resources (low implementation cost, immediate relief)
- **Tier 2** introduces permanent techs with passive bonuses that scale with investment (rewards accumulation, creates medium-term goals)
- **Tier 3** provides endgame content via prestige investments that survive resets (cross-run progression, exponential scaling prevents "solving in one run")

Each tier creates feedback loops: metals → better haulers → faster exports → more bars → more upgrades.

Bonuses compound multiplicatively, rewarding diverse investment paths.

---

## Implementation Plan

### Phase 1: Tier 1 – Bulk Factory Upgrades

- [x] Add `alternativeCosts` to upgrade definitions in constants.ts
- [x] Create `computeUpgradeCost()` utility function
- [x] Extend `purchaseFactoryUpgrade()` store method to accept resource type parameter
- [x] Add cost variant UI to factory upgrade buttons (tabs/toggle for "Bars vs Metals" etc.)
- [x] Write unit tests for alternative cost calculation
- [ ] Verify warehouse occupancy decreases (bar imports improve)

Notes: Phase 1 is functionally implemented in the codebase. Key implementations:

- `src/state/constants.ts` — `factoryUpgradeDefinitions` includes `alternativeCosts` entries.
- `src/state/utils.ts` — `computeFactoryUpgradeCost` / `getFactoryUpgradeCost` implement variant cost math.
- `src/state/slices/factorySlice.ts` — `upgradeFactory(factoryId, upgrade, variant)` accepts variants and deducts factory-local resources.
- `src/ui/FactoryManager/sections/UpgradeSection.tsx` — UI shows "Pay with" selector and wires variant to upgrade action.
- `src/state/store.factories.test.ts` — tests cover alternative resource payment flows.

**Remaining Phase 1 task**: manual verification of warehouse occupancy/impact on bar imports (playtesting / metrics).

**Depends on**: TASK033 completion (no hard dependency, but review hauler tech to understand store patterns)  
**Estimated effort (remaining)**: 0.5–1 day (playtesting + validation)

-### Phase 2: Tier 2 – Specialization Techs *(In Progress 2025-10-23)*

- [ ] Add `specTechs` and `specTechSpent` to store state types
- [ ] Create `unlockedSpecTechs()` selector based on cumulative spending
- [ ] Implement `purchaseSpecTech()` store method with progression logic
- [ ] Apply tech bonuses in game loop:
  - [ ] Ore Magnet: +3% ore per level (factory attraction)
  - [ ] Crystal Resonance: +2% asteroid richness (spawn rate)
  - [ ] Biotech Farming: +3% refinery yield (bar production)
  - [ ] Cryo-Preservation: +5% offline gains
- [ ] Create UI panel: "Specialization Techs" in warehouse (collapsible)
- [ ] Show unlocked techs with current level and upgrade cost
- [ ] Write integration tests for tech unlocking and bonus application
- [ ] Test bonus stacking with Tier 1 upgrades

**Depends on**: Phase 1 completion  
**Estimated effort**: 3–4 days

Notes: The codebase already contains a resource-driven modifiers system (`src/lib/resourceModifiers.ts`) which provides passive bonuses based on accumulated secondary resources (metals/crystals/organics/ice). That system is used by refinery and capacity calculations and can be re-used when implementing discrete "spec techs". However, the purchasable/unlockable tech mechanics, state fields and UI are not yet implemented.

-### Phase 3: Tier 3 – Prestige Investment Board *(Queued 2025-10-23)*

- [ ] Add `prestigeInvestments` to store state (persisted separately)
- [ ] Ensure prestige investments survive reset (separate from regular state wipe)
- [ ] Implement `investPrestige()` store method with exponential pricing:
  - [ ] Base cost: 1000 resource
  - [ ] Growth factor: 1.5× per tier
- [ ] Apply investment bonuses globally:
  - [ ] Drone Velocity: +2% speed per tier
  - [ ] Asteroid Abundance: +2% spawn rate per tier
  - [ ] Refinery Mastery: +1% bar yield per tier
  - [ ] Offline Efficiency: +3% offline multiplier per tier
- [ ] Create UI: "Investment Board" tab in prestige/settings panel
- [ ] Show cumulative investment cost and total bonuses granted
- [ ] Update prestige reset logic to preserve investments
- [ ] Write tests for persistence across resets
- [ ] Update SAVE_VERSION to reflect new schema

**Depends on**: Phase 2 completion  
**Estimated effort**: 2–3 days

Notes: Base prestige mechanics are already implemented (`src/state/slices/resourceSlice.ts`, `src/state/utils.ts`, and `src/ui/UpgradePanel.tsx` provide `computePrestigeGain`, `computePrestigeBonus`, `preview`, and `doPrestige`). What is missing is a persistent investment board (tiered investments, invest API, UI, serialization and ensuring investments persist across resets).

### Phase 4: Bonus Compounding & Balance Tuning

- [ ] Verify multiplicative stacking:
  - [ ] Factory Refinery Yield = Base × (1 + SpecTech × 0.03) × (1 + PrestigeBonus)
- [ ] Add tooltips showing active bonuses (tech + prestige totals)
- [ ] Performance check: ensure bonus calculations don't slow tick rate
- [ ] Balance tuning:
  - [ ] Costs feel rewarding (spending resources provides tangible benefit)
  - [ ] Bonuses feel impactful (at least 20% improvement at Tier 5)
- [ ] Manual playtesting: verify sinks relieve warehouse bottleneck
- [ ] Check edge cases: prestige reset with active investments

**Depends on**: Phase 3 completion  
**Estimated effort**: 1–2 days

### Phase 5: Testing, Documentation & Polish

- [ ] Run full test suite: `npm run test`
- [ ] Run lint and type check: `npm run typecheck`, `npm run lint`
- [ ] Manual playtesting scenarios:
  - [ ] Accumulate 50k metals, verify Ore Magnet unlocks
  - [ ] Invest in all four specialization techs, verify bonuses stack
  - [ ] Prestige with active investments, verify they persist
  - [ ] Verify bars can now be imported (warehouse space freed)
- [ ] Add UI hints/tooltips explaining each sink
- [ ] Update README or in-game docs with sink explanation
- [ ] Verify no performance regression in game loop
- [ ] All existing tests pass

**Depends on**: Phase 4 completion  
**Estimated effort**: 1 day

---

## Progress Tracking

- **Overall Status**: Phase 1 Complete (Tier 1 implemented); Phase 2 & 3 pending

### Subtasks

| ID  | Description                                 | Status      | Updated    | Notes                                       |
| --- | ------------------------------------------- | ----------- | ---------- | ------------------------------------------- |
| 1.1 | Phase 1: Tier 1 Bulk Factory Upgrades       | Completed   | 2025-10-22 | Implemented (see notes above)               |
| 1.2 | Phase 2: Tier 2 Specialization Techs        | Not Started | 2025-10-21 | Medium-term progression, complex state mgmt |
| 1.3 | Phase 3: Tier 3 Prestige Investment Board   | Not Started | 2025-10-21 | Long-term endgame, prestige persistence     |
| 1.4 | Phase 4: Bonus Compounding & Balance Tuning | Not Started | 2025-10-21 | Verify math, playtesting                    |
| 1.5 | Phase 5: Testing, Documentation & Polish    | Not Started | 2025-10-21 | Final validation before merge               |

### Critical Dependencies

- **Design validation**: DES029 must be reviewed and approved before Phase 1 starts
- **TASK033 patterns**: Reference Hauler Tech Upgrades for store mutation patterns
- **Prestige mechanism**: Understand existing prestige reset logic before Phase 3
- **Schema versioning**: Update SAVE_VERSION before Phase 3 ships

---

## Progress Log

### 2025-10-21

- Task file created
- Documented three-phase implementation plan
- Identified critical dependencies and estimated effort (~8–13 days total)
- Ready for Phase 1 kickoff once design is approved

### 2025-10-22

- Codebase scan performed to map TASK034 to implemented files.
- Confirmed Phase 1 (Tier 1 alternative-cost factory upgrades) is implemented:
  - `factoryUpgradeDefinitions` include `alternativeCosts`.
  - Cost computation and UI variant selection are present (`computeFactoryUpgradeCost`, `UpgradeSection.tsx`).
  - Store accepts `variant` in `upgradeFactory()` and tests cover alternate payment flows.
- Noted existing supporting systems useful for Phase 2 and 3:
  - `src/lib/resourceModifiers.ts` implements resource-accumulation-driven bonuses used by refinery and capacity calculations.
  - Base prestige flow (cores, preview, doPrestige, computePrestigeBonus) exists in `resourceSlice` and `utils` and is surfaced in the UI (`UpgradePanel.tsx`).
- Remaining work recommended:
  - Implement Phase 2: spec techs as purchasable state with UI and tests (3–4 days est.).
  - Implement Phase 3: prestige investment board with persistence (2–3 days est.).
  - Manual playtesting to validate warehouse occupancy improvement from Phase 1.

---

## Success Criteria

- ✅ Alternative upgrade costs reduce warehouse occupancy
- ✅ Specialization techs unlock at 50k thresholds
- ✅ Techs provide measurable production bonuses (ore, refinery, asteroids, offline)
- ✅ Prestige investments persist across resets
- ✅ Exponential cost scaling prevents "one-run solutions"
- ✅ Bonuses compound correctly (multiplicative stacking)
- ✅ UI clearly shows all available sinks + costs + current progress
- ✅ No performance regression in game loop
- ✅ All tests pass (unit, integration, and full suite)
- ✅ Manual playtesting confirms warehouse bottleneck is resolved

---

## Implementation Notes

### Code Locations

- **Upgrade definitions**: `src/state/constants.ts`
- **Store types**: `src/state/types.ts`
- **Store mutations**: `src/state/slices/` (factory upgrades, specialization techs, prestige)
- **Utilities**: `src/lib/` (cost calculation, bonus application)
- **UI**: `src/ui/` (warehouse panel, prestige settings)
- **Game loop**: `src/ecs/systems/` (apply bonuses during factory processing, asteroid generation)
- **Serialization**: `src/lib/serialization.ts` (prestige investment persistence)

### Schema Changes

- Add to `StoreState`:

```typescript
specTechs: { oreMagnet?: number; crystalResonance?: number; biotechFarming?: number; cryoPreservation?: number };
specTechSpent: { metals?: number; crystals?: number; organics?: number; ice?: number };
prestigeInvestments: { droneVelocity?: number; asteroidAbundance?: number; refineryMastery?: number; offlineEfficiency?: number };
```

- Update `StoreSnapshot` to include new fields
- Bump `SAVE_VERSION` (e.g., '0.3.4')

### Open Questions (For Clarification Before Phase 1)

1. Should Tier 2 techs cost prestige cores + resources, or just resources?
2. Should Tier 3 tier be hard-capped (50) or infinite?
3. Should some spec tech progress carry over at prestige (partial bonus)?
4. How to avoid overwhelming UI with all three tiers?
5. Any balance concerns before implementation?

---

## Related Tasks & Designs

- **Follows**: TASK033 (Hauler Tech Upgrades – understanding store patterns)
- **References**: DES029 (this design)
- **Related**: DES028 (Hauler Tech Upgrades), DES025 (Prestige), DES021 (Warehouse)
