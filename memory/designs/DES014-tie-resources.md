---
id: DES014
title: Tie resource types (Metals, Crystals, Organics, Ice) into game loop
created: 2025-10-17
updated: 2025-10-17
authors:
  - copilot
---

# DES014 — Tie resource types into game loop

Goal
----
Make Metals, Crystals, Organics and Ice meaningful gameplay resources by mapping them to persistent global modifiers and consumable effects that influence drones, the refinery, and energy systems.

Requirements (EARS-style)
-------------------------
- WHEN the player accumulates resource stocks, THE SYSTEM SHALL provide persistent, visible modifiers to drone stats, refinery yields, and energy systems (Acceptance: UI shows computed modifiers, tests validate formulas).
- WHEN resources are spent as consumables, THE SYSTEM SHALL immediately update modifiers and apply consumable effects (Acceptance: spending resources reduces stock and recomputes modifiers).
- THE SYSTEM SHALL use diminishing returns and configurable caps so extremely high stock does not break balance (Acceptance: unit tests assert caps are respected).

Design
------

Conventions
- Use a single source `getResourceModifiers(resources)` that returns derived multipliers.
- Expose tunable constants in `src/config/resourceBalance.ts`.

Core formula (diminishing returns)
```
M_r(S) = cap_r * (1 - exp(-S / scale_r))
```

Suggested tunables (defaults)
- Metals: cap=0.30, scale=10  — affects drone health, storage capacity
- Crystals: cap=0.25, scale=5  — affects refinery yield, upgrade/research speed
- Organics: cap=0.40, scale=8  — affects drone production speed, passive energy regen
- Ice: cap=0.35, scale=6       — affects energy storage, drain reduction, cold-processing bonus

Modifier outputs (suggested)
- droneHealthMultiplier = 1 + M_metals
- refineryYieldMultiplier = 1 + M_crystals
- droneProductionSpeedMultiplier = 1 + 1.2 * M_organics
- energyStorageMultiplier = 1 + M_ice
- energyDrainMultiplier = 1 - 0.5 * M_ice  (multiplies base drain)

Consumables and special uses
- Spend crystals to trigger a "precision burst": temporary +X% yield chance for N seconds.
- Spend organics to instantly queue/produce drones.
- Spend ice to freeze energy drain for T seconds.

Integration points
- Implement `src/lib/resourceModifiers.ts` (pure functions + tests).
- Add `src/config/resourceBalance.ts` to hold caps/scales.
- Consume modifiers in `src/ecs/energy.ts`, `src/ecs/refinery.ts` (or `world.ts`), and drone production systems (`src/ecs/flights.ts` / `src/r3f/Drones.tsx`).

Testing
- Unit tests for modifier math (`src/lib/resourceModifiers.test.ts`).
- Integration tests: small test ensuring refinery yields scale with crystals and energy storage scales with ice.

Notes
- Tuning will require iterating caps/scales based on average resource levels. Add debug UI to surface per-resource M_r values for balancing.
