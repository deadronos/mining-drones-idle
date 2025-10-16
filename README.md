# Mining Drones Idle

Mining Drones Idle is a small idle/automation prototype built with React, Three.js, and an ECS-driven simulation loop. The factory mines asteroids, refines ore into bars, and gradually unlocks upgrades through prestige resets.

This repository contains the interactive UI, simulation logic, and persistence utilities used by the prototype.

## Getting started

```bash
npm install
npm run dev
```

The app runs on Vite with hot module replacement. To build or preview production assets:

```bash
npm run build
npm run preview
```

## Persistence & settings

Player progress is stored in `localStorage` using the `space-factory-save` key. Persistence is handled by the `PersistenceManager` that boots alongside the Zustand store.

- **Autosave** – Enabled by default and configurable from the Settings panel. The interval respects the slider value (minimum 1 second) and pauses automatically if storage is unavailable.
- **Offline simulation** – When a save is loaded, the manager computes the elapsed time since the last save, clamps it to the configured offline cap, and replays refinery ticks through the same `processRefinery` path used in real-time play.
- **Import/Export** – Manual backups are available from Settings. Export generates a timestamped JSON download. Import validates the payload, applies store migrations, refreshes autosave, and reports errors inline without dropping the current save.
- **Migrations** – Snapshots store a semantic `save.version`. New fields (for example, throttle settings or RNG seeds) are normalized when loading older saves so existing progress continues to work without manual intervention.

## Energy throttling

Energy production and consumption are evaluated every simulation tick. When the battery level falls, a throttle factor computed from `energy / capacity` (clamped by the Settings "Throttle floor") slows mining progress and proportionally reduces per-drone consumption. This keeps the factory responsive—operations smooth out instead of stopping entirely—and allows excess generation to recharge the grid. The behavior is covered by dedicated unit tests for both the mining and power systems.

## Deterministic RNG seeds

Each save stores a `rngSeed` value. Fresh games generate a seed using `crypto.getRandomValues` (falling back to `Math.random` if necessary). Exported saves include the seed, and importing that payload restores the same seed so asteroid layouts and other random-driven systems stay reproducible. Seeds that are missing from older snapshots are regenerated automatically.

## Testing & quality checks

The project uses Vitest, ESLint, and TypeScript project references.

```bash
npm run test        # unit tests
npm run lint        # ESLint rules
npm run typecheck   # TypeScript project references
```

Playwright end-to-end tests are available with `npm run e2e` after running `npm run build`.

Prettier (with the Tailwind plugin) enforces formatting via `npm run format`.
