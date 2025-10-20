# DES025 — Local-First Energy Priority

**Status:** Design  
**Created:** 2025-10-20  
**Related Tasks:** TASK029

## Problem Statement

Currently, energy distribution follows a **global-first** priority:

- **Drone charging**: Global stored energy is consumed first; factory local energy is only drawn if global is exhausted.
- **Factory refining & operations**: The global warehouse energy is pulled into factories at the start of each tick to top them off; factories then consume that filled local energy for idle, hauler, and refining.

This design incentivizes players to build **large global energy reserves** rather than invest in **per-factory local energy capacity** (solar upgrades, energy module upgrades). It centralizes energy management rather than encouraging local resilience.

## Desired State

Reverse the priority to **local-first**:

- **Factories prioritize their own energy** for idle drain, refining, and drone charging.
- **Global energy serves as a backup** when local capacity is exhausted or depleted.
- **Solar regen and factory energy upgrades** become more valuable for autonomous factory operation.

## Design Approach

### Principle: Local Autonomy with Global Fallback

Factories are the primary energy consumers and holders.

- Each factory uses its own local energy pool for idle, refining, and charging its drones.
- When a factory's local energy is depleted, it draws from the global warehouse as a fallback.
- Global energy is reserved for factories that need it, rather than being a primary source.

### Implementation Points

#### 1. Drone Charging (Power System)

**Current behavior:**

- Drones charge from `stored` (global) first.
- If `stored` is exhausted, drones draw from their docking factory's local energy.

**Desired behavior:**

- Drones charge from their docking factory's local energy first.
- If the factory's local energy is depleted, drones draw from `stored` (global) as backup.

**Technical change:**

- In `createPowerSystem` (src/ecs/systems/power.ts), invert the charge logic:
  1. For each drone, compute `availableFromFactory = dockingFactory.energy + factorySolarGain`.
  2. Charge up to `maxChargeThisTick` from factory local, recording usage in `factoryEnergyUse`.
  3. If there's remaining need, charge from global `stored`.

#### 2. Factory Energy Refills & Consumption (ProcessFactories)

**Current behavior:**

- At the start of the tick, factories pull from global `remainingEnergy` to top up their local capacity.
- Factories then consume their local energy for idle, hauler, and refining.

**Desired behavior:**

- Factories do not proactively pull from global at the start of the tick.
- Factories consume their local energy for idle, hauler, and refining as normal.
- When a factory's energy would go negative (or is low), it pulls from global as needed (clamp behavior).
- Solar regen continues to add to local capacity and may trigger a need to draw from global if it causes the factory to approach capacity.

**Technical change:**

- In `processFactories`, remove the upfront global energy pull loop.
- After applying local drains and refining consumption, check if factory energy is low/depleted:
  - If `factory.energy <= 0` and `remainingEnergy > 0`, pull enough from global to prevent shutdown (or pull a small buffer).
  - Or, allow factory energy to naturally drop to zero and drones will fall back to global.

**Trade-offs to consider:**

- If we allow factories to naturally drop to zero, they will not refine and drones will not be served by local energy.
- If we implement a "pull on demand" strategy, we need to define when to pull (e.g., when energy dips below 20%, or only when it hits zero).

#### 3. Solar Regen Integration

- Solar regen continues to be computed per-factory and applied each power system tick.
- Solar gains now benefit local-first consumption (factories will have more local energy to use before drawing global).
- No fundamental change to solar computation, only to its role in the priority chain.

#### 4. Warehouse Reconciliation

- The global energy pool becomes a buffer, not the primary store.
- Over time, factories with good solar and energy upgrades will hoard energy locally; global will stabilize at lower levels.
- Haulers and logistics may become the mechanism to redistribute surplus energy or other resources.

## Affected Files

- `src/ecs/systems/power.ts` — Invert drone charging priority.
- `src/state/processing/gameProcessing.ts` — Invert factory energy refill behavior.
- `src/ecs/systems/power.test.ts` — Update and add tests to verify local-first behavior.
- `src/state/processing/gameProcessing.test.ts` — Add/update tests for factory processing.

## Testing & Validation

### Unit Tests

- Drone charging prefers factory local energy.
- Drone charging falls back to global when factory is empty.
- Factory processing consumes local energy for idle, hauler, and refining.
- Factory processing pulls from global only when local is depleted.
- Solar regen increases available local energy.

### Integration Tests

- Run a full game loop with multiple factories: verify that some factories accumulate local energy via solar, while others remain low and draw from global.
- Verify that the global energy pool stabilizes at a lower level.

### Player Experience

- Factories with high solar upgrades should operate more autonomously.
- Factories without solar should draw from the global pool.
- Encourages players to balance per-factory energy investment with global reserves.

## Acceptance Criteria

- [ ] Drone charging prioritizes factory local energy first, then global.
- [ ] Factory processing consumes local energy for idle, hauler, and refining.
- [ ] Factory processing draws from global only when local is depleted.
- [ ] Unit tests confirm all three behaviors.
- [ ] Integration test runs without errors.
- [ ] Lint and typecheck pass.

## Decisions (Locked In)

1. **Pull-on-demand logic**: Factories sit at zero locally; drones will fall back to global. Simpler logic, less coupling. No proactive refill attempts.

2. **Solar regen at capacity**: Factories hoard up to their local capacity. When at full capacity, additional solar is ignored (wasted). Future: haulers can redistribute surplus to global.

3. **Performance**: Minimal impact expected; removing one upfront loop and adding simpler per-drone/per-factory fallback checks.

## Decision Log

- **2025-10-20**: Initial design drafted. Proposal: local-first priority for factories and drones. Fallback to global as backup.
- **2025-10-20**: Locked in decisions: (1) factories sit at zero, drones fallback; (2) solar ignored at capacity; (3) minimal perf impact expected.
