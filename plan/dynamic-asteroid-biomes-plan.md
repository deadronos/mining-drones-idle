
# Dynamic Asteroid Biomes — Plan

## Summary

Introduce a biome system for asteroids with four initial biomes: ice, metal-rich, crystal, and organic. Each biome influences resource mixes, local gravity, hazard types, and visual language. Implement a runtime "biome fracture" emergent event where an asteroid splits into regions with differing biomes, requiring drone reassignment and introducing strategic trade-offs.

## Contract (inputs / outputs / success criteria)

- Inputs: asteroid entity definitions, drone assignment system, resource flow pipeline, visual/particle assets, RNG seed.
- Outputs: biome metadata applied to asteroids, biome-influenced resource production and physics modifiers, playable biome fracture event, visual/particle variations per biome, tests validating expected behavior.

Success criteria:

- Biomes deterministically alter resource yields and one physics parameter (gravity multiplier) per asteroid region.
- Biome fracture event spawns at least two biome regions on a single asteroid and triggers visible drone reassignment logic (drones change target region or return to base according to simple heuristics).
- Visual differences (palette and particle tint) are visible in the prototype scene.
- Unit tests cover resource-mix calculation and fracture event deterministic behavior given a RNG seed.

## Requirements (EARS-style)

1. WHEN an asteroid is spawned, THE SYSTEM SHALL assign it a biome from the set {ice, metal-rich, crystal, organic} (Acceptance: asteroids created in a seeded run match the expected biome sequence).

2. WHEN a biome is applied to an asteroid, THE SYSTEM SHALL modify the asteroid's resource mix and gravity multiplier according to the biome definition (Acceptance: unit test verifies expected multipliers and resource probabilities).

3. WHEN a biome fracture event occurs, THE SYSTEM SHALL split the asteroid into two or more regions with potentially different biomes and re-evaluate drone assignments (Acceptance: fracture simulation creates regions and moves/flags drones accordingly in a test harness).

4. WHEN the player inspects an asteroid, THE UI SHALL display the asteroid's biome(s) and their primary modifiers (Acceptance: small UI card shows biome name, color swatch, gravity modifier, and dominant resource).

5. THE SYSTEM SHALL provide deterministic behavior for biome assignment and fractures when a seed is supplied (Acceptance: seeded integration test reproduces same fracture map).

## Design overview

- Data model: Add a `Biome` type with fields: id, name, colorPalette (primary/secondary), particleTint, resourceWeights (map resource -> weight), gravityMultiplier, hazardProfile (list of possible hazards with weights), rarity.
- Asteroid model: extend to hold one or many `BiomeRegion` entries. A `BiomeRegion` has bounds (simple spherical cap or vector region), biomeId, productionModifiers.
- Systems:
  - BiomeAssignmentSystem: chooses and attaches biome(s) to asteroids on spawn.
  - BiomeProductionSystem: applies resourceWeights and gravityMultiplier when computing resource output and local physics effects.
  - BiomeFractureSystem: runs a fracture simulation (deterministic RNG) that subdivides an asteroid into regions and reassigns biomeIds; emits events for drones and UI.
  - DroneReassignment logic: simple policy functions (stay-if-same-biome, prefer-higher-yield, return-home-on-hazard) used by tests and prototype.

## Emergent event: Biome Fracture

- Trigger conditions: time-based probability, external damage threshold, or mission event.
- Outcome: asteroid splits into N regions (N = 2..4), each region assigned a biome (may repeat). Regions inherit scaled resource mixes and gravity multipliers.
- Effects: drones targeting the original asteroid evaluate region affinity and either redirect, split, or return to base depending on their policy.

## Tasks (rough breakdown)

1. Design & data (1 day)

- Define `Biome` schema and initial biome configs (resource weights, colors, multipliers).
- Document deterministic RNG interface for assignments/fractures.

1. Prototype visuals (1–2 days)

- Small scene showing one asteroid in each biome with palette/particle tint toggles.
- Inspect UI card to display biome info.

1. Implement biome model & assignment system (2 days)

- Add biome types, attach to asteroid spawn flow, unit tests for deterministic assignment.

1. Implement production modifiers (2 days)

- Update production/resource flow to account for biome resource weights and gravity multiplier.
- Unit tests validating resource outputs.

1. Implement biome fracture event (3 days)

- Fracture algorithm (simple split into spherical regions), deterministic RNG.
- Emit events to Drone system and update asteroid regions.
- Tests for fracture determinism and drone response.

1. Integrate drone reassignment heuristics (1–2 days)

- Implement simple policies and test scenarios.

1. Polish & QA (1–2 days)

- Tweak visuals, add particle variations, accessibility options (toggle particle density), and Playwright snapshot/UI checks.

Total estimate: 10–13 days (prototype + MVP systems + tests + polish)

### Assets & art

- Color palettes for 4 biomes (primary/secondary/particle) — team-provided or placeholder.
- Particle sprites or shader tints for mining sparks, frost, organic spores, crystal glints.
- Small UI icons for each biome.

### Testing & QA

Unit tests:

- Biome assignment deterministic test (seeded).
- Resource mix calculation test.
- Fracture region generation deterministic test.
- Drone reassignment policy unit tests.

Integration tests:

- Run a short simulation (seeded) where asteroids spawn and fracture; assert global resource tallies and drone counts remain consistent.

Playwright/UI:

- Snapshot of prototype scene per biome.
- UI card displays correct biome metadata.

### Risks & mitigations

- Risk: Visual particle cost with many asteroids/drones. Mitigation: particle pooling, quality presets, GPU instancing.
- Risk: Complexity explosion from too many region shapes. Mitigation: use simple region shapes (spherical caps) and limit N <= 4.

### Next steps

1. Commit initial `Biome` schema and seed configs. (Dev)
2. Create `memory/tasks/TASK013-dynamic-biomes.md` from this plan and break into smaller tickets. (PM)
3. Build a small visual prototype scene for review and iterate on palettes. (Artist/Dev)

---
_Generated plan — use as canonical starting point for implementation and task creation._
