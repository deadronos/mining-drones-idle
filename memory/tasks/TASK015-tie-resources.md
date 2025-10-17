---
id: TASK015
title: Tie resource types into game loop
status: Completed
added: 2025-10-17
updated: 2025-10-18
authors:
  - copilot
---

# TASK015 — Tie resource types into game loop

**Status:** Completed

## Original Request

Add meaningful uses for Metals, Crystals, Organics, and Ice by mapping them to persistent modifiers and consumable effects that influence drones, refinery, and energy systems. Include formulas, examples, and an implementation plan.

## Implementation Plan

- Create `src/config/resourceBalance.ts` containing tunable caps and scales.
- Implement `src/lib/resourceModifiers.ts` with `getResourceModifiers(resources)` and tests.
- Wire modifiers into `src/ecs/energy.ts`, `src/ecs/refinery.ts` (or `src/ecs/world.ts`), and drone production (`src/ecs/flights.ts` / `src/r3f/Drones.tsx`).
- Add UI debug displays and tooltips showing current resource bonuses.
- Add unit and integration tests.

## Acceptance Criteria

- Unit tests for formula correctness and clamping pass.
- Mods are visible in debug UI.
- Refinery yield, drone production speed, and energy storage reflect modifier values in-play.

## Progress Log

2025-10-17 — Created task and linked design DES014.
2025-10-18 — Reviewing DES014 formulas and planning integration touchpoints for refinery, energy, fleet, and HUD.
2025-10-18 — Implemented resource modifier config + helper, propagated multipliers through refinery, power, travel, mining, and fleet systems, added HUD debug panel, and expanded test coverage; lint, typecheck, and vitest suites all pass.
