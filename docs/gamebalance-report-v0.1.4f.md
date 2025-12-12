# Game Balance Report — v0.1.4f

Date: 2025-11-01
Repo: mining-drones-idle
Author: automated balance audit

## Summary

This report reviews the core balancing systems implemented in the codebase at `src/` with a focus on: mining/refining, drones & energy, factories (purchase & placement), haulers/logistics, and upgrade trees (global modules, factory-local upgrades, spec-tech, and prestige). The analysis is based on the actual code paths and constants in `src/state` and `src/ecs` (notably `constants.ts`, `utils.ts`, `processing/*`, and `ecs/*`).

Key findings (short)

- Core refinery math is straightforward and predictable: ore → bars conversion uses a fixed conversion rate (10 ore → 1 bar) and a fixed ore-to-second throughput (10 ore/s). Refinery modules apply multiplicative bonuses (10% per module).
- Drone energy bookkeeping, solar generation, and global/local solar bonuses form a coherent system but numbers (drone energy cost, solar regen, energy capacity gains) need tuning for early-game pacing.
- Factories and factory upgrades are implemented, but there is a critical inconsistency: upgrade base costs are defined in two different places with drastically different base values (small `bars: 13` in `src/state/constants.ts` vs `bars: 1350` in `src/ecs/factories/config.ts`). This will cause mismatches depending on which codepath is used and is a major balancing bug.
- Hauler logistics has reasonable buffer/threshold logic, but some default constants (hauler trip capacity, buffer seconds) drive conservative transfers that may feel slow early-game.
- Progression gating through SpecTech and Prestige looks intentionally late-game (unlockAt values at 50_000 bars for SpecTechs) — good for long-term goals but may be unreachable if early economy is too slow.

## Detailed analysis

All numbers below reference the constants and code in:

- `src/state/constants.ts`
- `src/state/utils.ts`
- `src/state/processing/*.ts`
- `src/ecs/factories/*` and `src/ecs/logistics/*`

1. Refining and Mining

- Ore conversion: ORE_PER_BAR = 10. ORE_CONVERSION_PER_SECOND = 10.
  - That implies a single refinery baseline converts 10 ore per second → 1 bar/sec (before refinery and prestige multipliers).
  - `BASE_REFINERY_RATE = 1` and refinery module multiplier = 1.1^modules.refinery.
  - Example: with 1 refinery module (modules.refinery = 1) refineryMult = 1.1 → bars/sec = 1 \* 1.1 = 1.1 bars/sec (per ORE_CONVERSION throughput). With more modules this scales multiplicatively.
- Prestige multiplier (computePrestigeBonus) is large but capped behavior: +5% per core up to 100 cores then +2% per overflow. This is a late-game power curve appropriate for prestige systems.

Balance notes:

- The baseline 1 bar/sec per active refinery process is fairly generous. With even modest ore supply (10 ore/s) a single refining slot produces 1 bar/s = 3600 bars/hour which is a rapid accumulation — this can make mid/late progression very fast unless ore supply or factory count is constrained.
- The refinery consumes local factory energy per refine (`energyPerRefine` and per-tick drain in `processFactories`). Energy budgeting and solar regen are therefore central knobs to throttle throughput.

2. Energy, Drones, Solar

- Drone energy cost: DRONE_ENERGY_COST = 1.2 (per drone, used in getEnergyConsumption). That is applied as drones \* 1.2 energy/sec baseline (modified by modifiers).
- Global solar generation: SOLAR_BASE_GEN = 5; getEnergyGeneration returns SOLAR_BASE_GEN \* (modules.solar + 1). So with modules.solar = 0 you still generate 5 energy/s global.
- Base energy cap: BASE_ENERGY_CAP = 100; each solar module adds ENERGY_PER_SOLAR = 25.
- Factory-local solar upgrade: FACTORY_SOLAR_BASE_REGEN = 1.25 and FACTORY_SOLAR_REGEN_PER_LEVEL = 0.5. Additionally FACTORY_SOLAR_MAX_ENERGY_PER_LEVEL = 10 (add to energyCapacity on apply).
- Solar Array module (global): SOLAR_ARRAY_LOCAL_REGEN_PER_LEVEL = 0.15 and adds +3 max energy per level.

Balance notes:

- With baseline global generation 5/sec and base capacity 100, the system provides a steady but limited budget. If you have many drones (modules.droneBay grows), drone energy drain scales linearly and can outpace generation quickly. Example: 20 drones → 24 energy/sec drain vs global 5/s base (plus any solar modules). Therefore either players must rely on factory-local solar or limit drones early.
- DRONE_ENERGY_COST = 1.2 seems high when drone counts grow, pushing players to pursue solar modules or factory capacitors early. That's a legitimate design lever but may feel punitive if factory energy options are expensive.

3. Factories (purchase, placement, base stats)

- Factory purchase cost: `FACTORY_CONFIG.baseCost = { metals: 100, crystals: 50 }` with `priceScaleIncrement = 50` added linearly per factory purchased. Linear scaling keeps factory purchase predictable.
- Default factory stats: dockingCapacity = 3, refineSlots = 2, storageCapacity = 300, energyCapacity = 80, initialEnergy = 40.

Balance notes:

- A single factory with 2 refine slots and initial energy 40 can only sustain limited refining without energy regeneration or attached haulers: energyPerRefine=2 and idleEnergyPerSec=1. If a refine consumes 2 energy/sec (through energyPerRefine) then two concurrent refines might consume ~4 energy/sec — initial energy 40 provides ~10s of full-speed refining unless solar/regeneration is applied. However `processFactories` consumes energy per refine based on `working.energyPerRefine * dt * process.speedMultiplier` so actual consumption depends on code's refine time and speed multipliers. This emphasizes need for solar upgrades or global solar.
- Spacing/placement constraints (FACTORY_MIN_DISTANCE / MAX_DISTANCE) mean factories won't bunch up, increasing hauler travel times and incentivizing logistics upgrades.

4. Haulers, Logistics, and Buffers

- LOGISTICS_CONFIG: hauler_capacity = 50, scheduling_interval = 2s, buffer_seconds = 30s. computeBufferTarget uses approx 50 ore/min per refine slot baseline → ~0.833 ore/s per slot. The code's comment says 50 ore/min per active refine slot; math then uses orePerMinute/60.
- computeTravelTime includes pickup/dropoff overhead + travel distance / speed.
- Hauler maintenance cost (energy drain) = 0.5 energy/sec per active hauler.

Balance notes:

- Default hauler capacity 50 is reasonable for batch transfers but with large local storage (storageCapacity 300) and buffering (warehouse multiplier etc.) transfers may be infrequent. The buffer model of 30s keeps factories autonomous for short bursts but will cause haulers to move large batches less often — good for performance but may feel slow if players expect rapid balancing.
- Hauler maintenance energy cost interacts with factory energy budgets; assigned haulers consume local factory energy per second, which can conflict with refining unless factories have ample energy.

5. Upgrades (global modules, factory-local upgrades, hauler modules)

- Global modules (from `constants.moduleDefinitions`) have small baseCost values (droneBay baseCost = 4, refinery baseCost = 8, scanner = 12 etc.). These look like module purchase costs counted in the global module system — the currency used is not explicit here but presumably bars/metals depending on UI.
- Hauler module definitions and factory hauler upgrade definitions use baseCost in intermediate resources (metals/crystals) with costGrowth around 1.16–1.2 — moderate exponential growth.
- FactoryUpgrade definitions (in `src/state/constants.ts`) show per-upgrade baseCost: bars: 13 with alternativeCosts. These are small numbers compared to the `computeUpgradeCost` in `src/ecs/factories/config.ts` which uses 1350 as baseCost.

Critical inconsistency (major):

- Two different baseCost sets for factory upgrades exist in the codebase:
  - `src/state/constants.ts` internal `factoryUpgradeDefinitions` uses small values (e.g., baseCost: { bars: 13 }). This is used by `utils.computeFactoryUpgradeCost` and by UI-level code that references `factoryUpgradeDefinitions`.
  - `src/ecs/factories/config.ts` `computeUpgradeCost` uses `baseCost: { bars: 1350 }` and growth 1.35 for every upgrade type. `factories/upgrades.ts` imports `computeUpgradeCost` from this file to detect shortfalls and create upgrade requests.
- Result: detection and request creation logic may insist factories need extremely large resource amounts (1350 bars scaled exponentially) while the UI or actual purchase code may think costs are tiny (13 bars). This will completely break progression and balance — either upgrades are trivial or impossible depending on which codepath is used.

6. Spec Tech & Prestige

- Spec techs unlock at 50_000 bars and cost thousands of the resource type (baseCost 5k–8k), with moderate growth and bonuses per level (2–5% per level). These are clearly late-game long-term progression items.
- Prestige investments have baseCost 1_000 and growthFactor 1.5, granting small percentage bonuses per tier.

Balance notes:

- If the early-game economy is faster than intended (due to e.g., refinery throughput being high), spec-tech unlocks may be reached quickly — but if early-game is slow because of energy/drone bottle-necks, players may never reach the long-term techs.

## Ratings and recommendations

I rate each area on a 1–10 scale (10 = well-balanced/clear, 1 = broken/unusable):

- Refining & Mining: 7/10
  - Clear algebra and predictable numbers. High baseline throughput risks making progression too fast; suggest lowering ORE_CONVERSION_PER_SECOND to ~5 or reducing BASE_REFINERY_RATE, or increasing ORE_PER_BAR to slow bar accumulation if pacing is a problem.

- Drones & Energy System: 6/10
  - Conceptually solid (energy drain vs generation). DRONE_ENERGY_COST interacts strongly with global generation. Consider:
    - Lower DRONE_ENERGY_COST from 1.2 → 0.6–0.9 for smoother early scaling.
    - Or increase SOLAR_BASE_GEN slightly (5 → 8) to give breathing room before solar modules are bought.
    - Add clearer early-game ways to regain energy (cheaper factory solar level 0 baseline or cheap capacitors).

- Factories & Purchase/Placement: 8/10
  - Linear factory pricing is easy to reason about. Base stats look sensible and placement rules encourage spread. Consider raising `initialEnergy` slightly or making `energyCapacity` a touch larger to allow initial refining without feeling punishing.

- Haulers/Logistics: 7/10
  - Good conservative defaults (buffering and conservative transfers). If players report "sluggish" feel, reduce buffer_seconds to 20 or increase scheduling frequency to 1.0s for snappier transfers.

- Upgrades (Global & Factory-local): 3/10 (currently problematic)
  - The duplication/inconsistency of upgrade cost constants is a critical bug and must be fixed before meaningful tuning. Once unified, consider the following tuning:
    - If the smaller numbers (bars:13) are intended, set `computeUpgradeCost` to match (use same baseCost). If the 1350 values are intended, update UI and `factoryUpgradeDefinitions` to match and adjust progression accordingly.
    - Re-evaluate growth factor: 1.35 is steep. If upgrades are meant to be numerous, consider lowering growth to ~1.2 for more gradual escalation.

- SpecTechs & Prestige: 8/10
  - Well-scoped long-term goals. They look intentionally gated. Ensure early economy allows players to reach the unlock thresholds occasionally; otherwise these will feel unreachable.

## Priority action list (short)

1. Fix the factory upgrade base-cost inconsistency (HIGH priority). Decide canonical source (prefer single source-of-truth under `src/state/constants.ts` or move all factory cost computations to `src/ecs/factories/config.ts` and remove duplicates). This will unblock all tuning.
2. Playtest early-game pacing with current constants:
   - Track bars/hour with a single factory and two refine slots and default modules. If bars accumulate >2000/hr too early, reduce ORE_CONVERSION_PER_SECOND or increase ORE_PER_BAR.
3. Adjust drone/energy numbers for early smooth progression (reduce DRONE_ENERGY_COST or increase SOLAR_BASE_GEN).
4. Consider lowering factory upgrade growth or base costs after step 1, to give players meaningful upgrade rhythm (several purchaseable levels before costs blow up).
5. Add automated balance unit tests that assert: expected bars/sec range for defined starter setups; expected energy drain vs generation with starter modules; upgrade cost parity tests (ensure both places compute identical costs).

Suggested quick numeric adjustments (start here)

- Set ORE_CONVERSION_PER_SECOND = 7 (down from 10) — slower bar accumulation.
- Set DRONE_ENERGY_COST = 0.9 (down from 1.2) — reduces energy pressure on drones.
- Increase SOLAR_BASE_GEN = 6 or 8 if lowering drone cost is undesirable.
- Unify factory upgrade baseCost to 1350 OR change the value in `src/ecs/factories/config.ts` to 13. My recommendation: use 1350 only if bars are a common high-volume currency; otherwise 13 seems too small. Choose canonical place and update code.

## Testing checklist

- After changes, run the following checks:
  - Start with 1 factory, 2 refine slots, initial energy: simulate 60s and record bars produced (should be in reasonable range, e.g., 30–120 bars in first minute depending on intended speed).
  - With 10 drones and no extra solar, energy should trend down but not drop to zero instantly. Test with new DRONE_ENERGY_COST.
  - Confirm computeFactoryUpgradeCost returns the same values everywhere (unit test)

## Closing notes

The codebase shows a mostly coherent economic model with clear levers for tuning. The single largest issue is the duplicated/contradictory upgrade cost definitions which effectively break upgrade requests and balance; fixing that will let designers tune growth rates and base costs safely. After that, I recommend a short playtest loop to validate the practical pacing and then iterative adjustments to the three fastest-acting knobs: ORE_CONVERSION_PER_SECOND, DRONE_ENERGY_COST, and FACTORY_UPGRADE_GROWTH.

If you want, I can:

- Open a small PR that unifies the factory upgrade cost definitions and runs `npm run test` (and add unit tests asserting parity).
- Run quick simulations (scripted) that compute bars/sec for starter configurations and output time-to-x-bars metrics so you can pick a target pacing.

Appendix: Code references (most relevant files)

- src/state/constants.ts
- src/state/utils.ts
- src/state/processing/gameProcessing.ts
- src/ecs/factories/config.ts
- src/ecs/factories/upgrades.ts
- src/ecs/logistics/config.ts
- src/ecs/logistics/math.ts
