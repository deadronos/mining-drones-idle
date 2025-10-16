# More ideas — Mining Drones Idle

This document collects gameplay, visual, UI, and prototype ideas for Mining Drones Idle. Use these as seeds for task cards, prototypes, and short design documents.

---

## Gameplay ideas (core loop, progression, emergent systems)

### Dynamic asteroid biomes

Asteroids belong to biomes (ice, metal-rich, crystal, organic). Each biome changes resource mixes, gravity, hazards, and visual language.

Visual cues: distinct color palettes, particles, and lighting.

Emergent event: "biome fracture" — an asteroid splits into regions with different biomes, forcing drone reassignment decisions.

### Drone specialization & modular upgrades

Drones have equipment slots (tool, engine, hull, AI-module). Combine modules to create gameplay synergies and cosmetic variants.

Module tiers and rarities enable progression and meaningful loot.

### Convoys & autonomous behaviors

Drones may form convoys for efficiency and safety. Convoys grant throughput bonuses and reduced loss but increase exposure to threats and events.

Configurable presets (risk-averse, fast transit, gather-only) make convoy behavior approachable.

### Idle + active hybrid interactions

Primary loop is idle (automated mining & refining) with short active interactions that yield meaningful, time-limited effects:

- Manual "focus" beam (tap/hold) to boost a drone temporarily.
- Quick skill-based mini-game (beam alignment) to reveal rare veins.
- Micro-interactions for emergency repairs or overrides during hazards.

### Refinery mini-systems & bottlenecks

Model the refinery as a small factory with throughput, heat, and by-product mechanics. Overdrive increases throughput at heat/failure risk; coolers and overflow tanks are upgrade paths.

By-products can feed secondary upgrade branches or be sold on the market.

### Missions, research, and progression

Timed contracts request X units of Y resource within a window and may include modifiers. Rewards include loot crates, rare modules, or cosmetics.

Research unlocks modules, shaders, and QoL features; procedural tech branches increase replayability.

---

## Visual & art direction ideas

Stylized low-poly models with shader-rich materials (iridescence, subsurface glow, worn metal). Prioritize silhouette clarity and readable palettes per biome.

- Ice: cyan/white with drifting frost particles
- Metal-rich: warm sparks and smoke
- Organic: bioluminescent greens/purples
- Crystal: prismatic glints and refractive caustics

Use particle/FX to communicate gameplay (mining sparks, energy tethers, vein shimmer). Make drone states visually clear (hull cracks, core glow, cargo bulge).

Accessibility: colorblind palettes, particle-density and motion toggles, adjustable text size, and redundant audio cues.

---

## UI / UX & HUD ideas

Animated production pipeline: asteroid → drones → refinery → market. Click segments to inspect or pause flows. Highlight bottlenecks and offer one-click suggestions with clear cost/effect.

Compact drone cards with one-click actions (send home, prioritize, join convoy, repair) and bulk tag/filter controls. Toggleable minimap layers, prioritized alerts, and sparklines for key metrics.

Assistive suggestions (one-click) to resolve common bottlenecks with transparent cost/effect.

---

## Prototype & technical notes (quick wins)

Priority prototypes:

1. Modular drone visuals + mining hit feedback (single asteroid scene)
2. Convoy logic + visual tether
3. Production pipeline UI with a working refinery

Implementation notes:

- GPU instancing + LOD for large drone counts
- Particle pooling and quality presets to avoid GC/CPU spikes
- Data-driven definitions (JSON) and deterministic RNG for tests

Suggested tests:

- Unit tests: resource flow consistency, convoy rules, market adjustments
- Visual snapshot/Playwright tests for core UI components

---

## Small extras & polish

- Procedural drone names and short personality quips; allow renaming
- Seasonal cosmetic events (cosmetics only)
- Photo mode: hide UI, adjust DOF, export screenshots

---

## Next steps

1. Convert high-priority items into `memory/tasks/` cards
2. Update `memory/activeContext.md` with the chosen focus
3. I can expand any section into EARS-style requirements, a short design doc, or a minimal prototype plan — tell me which to prioritize
