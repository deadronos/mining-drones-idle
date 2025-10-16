# DES012 - Dynamic Asteroid Biomes

Status: Draft

## Summary

Implement biome-aware asteroids that change mining outcomes, gravity effects, and visuals. Four core biomes (ice, metal-rich, crystal, organic) deterministically attach to asteroids using the world RNG seed. Asteroids can fracture into multiple biome regions, triggering deterministic resource remaps and drone reassignment heuristics. Provide UI surfacing biome modifiers and ensure tests cover deterministic behavior and resource calculations.

## Linked Plan / Sources

- `/plan/dynamic-asteroid-biomes-plan.md`

## Goals & Acceptance Criteria

1. **WHEN** an asteroid is spawned, **THE SYSTEM SHALL** assign it a biome from {ice, metal-rich, crystal, organic}. Acceptance: seeded runs reproduce the same biome sequence.
2. **WHEN** a biome is applied to an asteroid, **THE SYSTEM SHALL** modify its resource mix and gravity multiplier per biome definition. Acceptance: unit tests validate multiplier and resource distributions.
3. **WHEN** a biome fracture event occurs, **THE SYSTEM SHALL** split an asteroid into ≥2 regions with potentially different biomes and trigger drone reassignment heuristics. Acceptance: simulation test shows region creation and deterministic drone responses.
4. **WHEN** the player inspects an asteroid, **THE UI SHALL** display biome name(s), color swatch, gravity modifier, and dominant resource. Acceptance: React component snapshot/UI test or DOM assertion.
5. **THE SYSTEM SHALL** remain deterministic given a RNG seed for biome assignment and fracture outcomes. Acceptance: tests confirm identical results with identical seed inputs.

## Non-Goals

- Rebalancing downstream prestige or module progression.
- Introducing new 3D assets beyond color/particle tint adjustments.
- Full-blown hazard AI; hazards stay as simple flags that drive drone heuristics.

## Architecture Overview

- **Biome Data Module (`src/lib/biomes.ts`)** — holds biome definitions (id, name, palette, resource weights, gravity multiplier, hazard profile). Exposes helpers for deterministic selection and normalization.
- **Asteroid Biome State (`src/ecs/biomes.ts`)** — utilities to attach biome metadata to `AsteroidEntity`, compute resource profiles, handle fractures, and pick drone-facing regions.
- **World Integration (`src/ecs/world.ts`)** — extends `AsteroidEntity` with biome fields (`biomeId`, `gravityMultiplier`, `resourceProfile`, `regions`, `activeHazard?`). `createAsteroid` assigns a biome via RNG and seeds deterministic fracture data.
- **Biome Systems**:
  - `createBiomeSystem` updates asteroid visuals/state and schedules fracture triggers.
  - `createBiomeFractureSystem` processes queued fractures, builds deterministic region lists (2–4 regions), assigns offsets, hazards, and resource mixes, and applies drone reassignment heuristics.
  - Integrate both into the main scene loop before mining/travel to keep state consistent.
- **Drone & Mining Updates**:
  - `DroneEntity` gains `targetRegionId` and `cargoProfile` for resource breakdown.
  - `assignDroneTarget` chooses a region for asteroids with fractures; heuristics prefer highest yield safe region.
  - Mining distributes mined mass across resource profile; travel duration adjusts by gravity multiplier derived from the targeted region.
  - Unload system deposits full resource breakdown via new store action.
- **Store Enhancements (`src/state/store.ts`)** — extend `Resources` with biome-specific commodities (ice, metals, crystals, organics) and update persistence/normalization. Provide `addResources` utility to merge breakdowns with storage caps.
- **UI Components**:
  - Expand HUD resource summary to display new biome commodities.
  - Add `AsteroidInspector` component showing currently inspected asteroid, with controls to cycle through asteroids and display biome/region modifiers (color swatch, gravity, dominant resource, hazard badge).

## Data Flow

1. **Spawn** → `createAsteroid` generates base asteroid, selects biome with RNG seed, computes initial profile.
2. **Biome Update** → `createBiomeSystem` increments asteroid timers, enqueues fracture events based on biome hazard weights and world time.
3. **Fracture** → `createBiomeFractureSystem` splits asteroid into regions, stores deterministic seeds/offsets, signals drones via heuristics (redirect to safe region, or return if hazard high).
4. **Drone Assignment** → `assignDroneTarget`/`startTravel` choose region, adjust travel duration using gravity multiplier, store path seed.
5. **Mining** → `createMiningSystem` uses asteroid+region profile to compute mined mass, updates `drone.cargo`, `drone.cargoProfile`, reduces asteroid ore with gravity-adjusted throughput.
6. **Unload** → `createUnloadSystem` flushes `cargoProfile` to store via `addResources`; events log remains unchanged.
7. **UI** → `AsteroidInspector` reads from `gameWorld.asteroidQuery` snapshots, formats biome info, highlights hazards.

## Interfaces

```ts
// src/lib/biomes.ts
type BiomeId = 'ice' | 'metalRich' | 'crystal' | 'organic';
interface ResourceWeights {
  ore: number;
  metals: number;
  crystals: number;
  organics: number;
  ice: number;
}
interface BiomeDefinition {
  id: BiomeId;
  name: string;
  palette: { primary: string; secondary: string };
  particleTint: string;
  gravityMultiplier: number;
  resourceWeights: ResourceWeights;
  hazardProfile: { id: 'storm' | 'flare' | 'spores' | 'quakes'; weight: number; severity: 'low' | 'medium' | 'high' }[];
}
```

```ts
// src/ecs/world.ts
interface BiomeRegionState {
  id: string;
  biomeId: BiomeId;
  weight: number;
  gravityMultiplier: number;
  resourceProfile: ResourceWeights;
  hazard?: HazardState;
  offset: Vector3; // relative landing point for drones
}
interface AsteroidEntity {
  // existing fields ...
  biomeId: BiomeId;
  gravityMultiplier: number;
  resourceProfile: ResourceWeights;
  regions: BiomeRegionState[] | null;
  fractureTimer: number;
  fractureSeed: number;
}
```

```ts
// src/state/store.ts
interface ResourceBreakdown {
  ore: number;
  bars: number;
  energy: number;
  credits: number;
  ice: number;
  metals: number;
  crystals: number;
  organics: number;
}
addResources(payload: Partial<ResourceBreakdown> & { capacityAware?: boolean }): void;
```

## Error Handling & Determinism

- Default fallback biome `metalRich` if RNG yields invalid index.
- Normalize resource weights to avoid zero totals; guard against NaNs.
- Clamp gravity multipliers (0.5–1.5) to prevent extreme travel durations.
- Fracture system respects cooldown to avoid repeated splits; uses stored seed for deterministic region creation.
- Drone reassignment handles missing regions by forcing return-to-base.
- UI gracefully handles missing asteroid list (shows placeholder message).

## Testing Strategy

- **Unit Tests**:
  - `biomes.test.ts`: deterministic biome selection + resource mix normalization.
  - `biomeFracture.test.ts`: fracture generator yields same regions given same seed, and drone reassignment heuristics behave as expected.
  - Update mining/unload tests to verify resource breakdown accumulation and gravity multiplier impact.
- **Integration Tests**:
  - Seeded simulation ensures asteroid biome sequence identical across runs.
- **UI Tests**:
  - React Testing Library test verifying `AsteroidInspector` renders biome info and hazard tags for provided snapshot.

## Implementation Notes / Tasks Link

- See `memory/tasks/TASK013-dynamic-asteroid-biomes.md` for actionable steps and progress tracking.
