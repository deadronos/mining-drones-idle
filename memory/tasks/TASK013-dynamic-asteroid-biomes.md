# TASK013 - Dynamic Asteroid Biomes Implementation

**Status:** In Progress
**Added:** 2025-10-18
**Updated:** 2025-10-18

## Original Request

Introduce biome-aware asteroids per `/plan/dynamic-asteroid-biomes-plan.md`: deterministic biome assignment, biome fracture events, gravity/resource modifiers, drone reassignment heuristics, and UI to surface biome data.

## Thought Process

- Biomes require first-class data definitions with deterministic RNG hooks so seeded runs stay reproducible.
- Extending `AsteroidEntity` is less disruptive than layering a secondary registry; we can add biome metadata plus region state behind feature flags.
- Resource mixes imply new commodities; adding them to the global store keeps unloading logic consistent and surfaces new materials in the HUD.
- Fracture logic must operate before AI/mining each tick to ensure drones react promptly; heuristics can stay simple (prefer safe/high-yield regions or bail out when hazards spike).
- UI should not depend on raycasting; a cycling inspector offers deterministic verification and avoids R3F event plumbing.

## Implementation Plan

1. **Data & Store Foundations**
   - Define biome constants (`src/lib/biomes.ts`) with resource weights, colors, gravity multipliers, hazard weights.
   - Extend `Resources` in the store to track biome commodities and add helper to merge resource breakdowns while honoring storage caps.
2. **World & Entity Changes**
   - Update `AsteroidEntity` and `DroneEntity` to include biome-related fields (`biomeId`, `regions`, `targetRegionId`, `cargoProfile`).
   - Adjust creation helpers (`createAsteroid`, `createDrone`) to initialize biome state deterministically from the world RNG.
3. **Systems: Assignment & Fracture**
   - Add biome management utilities (`src/ecs/biomes.ts`) and wire new systems for scheduling and executing fractures.
   - Enhance drone AI to choose biome regions and handle fracture-triggered reassignment heuristics.
4. **Mining, Travel, Unload Integration**
   - Modify mining to distribute cargo across biome resource mixes and respect gravity multipliers.
   - Update travel duration/waypoints using region gravity data; ensure unload deposits full resource breakdown.
5. **UI & Visualization**
   - Adjust instanced asteroid colors based on biome palettes/regions.
   - Create HUD inspector component showing biome modifiers, region breakdowns, and hazard states.
   - Surface new resources alongside existing ore/bars/energy.
6. **Testing & Determinism Verification**
   - Add unit tests covering biome selection, fracture determinism, and resource calculations.
   - Update existing system tests affected by new resource fields.

## Progress Tracking

**Overall Status:** In Progress - 5%

### Subtasks

| ID  | Description                                     | Status      | Updated    | Notes |
| --- | ----------------------------------------------- | ----------- | ---------- | ----- |
| 1.1 | Biome data module & store resource extensions   | Not Started | 2025-10-18 |       |
| 1.2 | Entity updates & deterministic biome assignment | Not Started | 2025-10-18 |       |
| 1.3 | Fracture system & drone heuristics              | Not Started | 2025-10-18 |       |
| 1.4 | Mining/travel/unload integration                | Not Started | 2025-10-18 |       |
| 1.5 | UI updates for resources & asteroid inspector   | Not Started | 2025-10-18 |       |
| 1.6 | Unit/UI tests for deterministic biome behaviors | Not Started | 2025-10-18 |       |

## Progress Log

### 2025-10-18

- Created design document (DES012) and task plan capturing biome data flow, system integration points, and testing strategy.
