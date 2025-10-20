 # Source code audit vs. docs/best-practices.md

 Date: 2025-10-20

 This document summarizes an automated manual audit of the repository's hot code paths against the recommendations in `docs/best-practices.md`. It highlights where the codebase follows guidance, where small wins exist, and prioritized, actionable recommendations.

 ## Quick summary

 Overall the codebase follows the best-practices very well: instancing for large numbers, slice-based Zustand store, client-only texture creation guards, performance profiles to reduce visual load, and sensible ECS separation (Miniplex world + systems). The biggest, high-impact improvements are small and targeted: avoid selecting whole objects from Zustand in top-level React components, share repeated Three assets (textures/materials) across instances, and consider on-demand rendering when the scene is static.

 ---

 ## Ratings and notes for inspected hot paths

 (Scale used: Excellent / Good / Fair / Needs Attention)

 ### `src/App.tsx` — Rating: Fair → Good
 # Source code audit vs. docs/best-practices.md

 Date: 2025-10-20

 This document summarizes an audit of the repository's hot code paths against the recommendations in `docs/best-practices.md`. It highlights where the codebase follows guidance, where small wins exist, and prioritized, actionable recommendations.

 ## Quick summary

 Overall the codebase follows the best-practices very well: instancing for large numbers, slice-based Zustand store, client-only texture creation guards, performance profiles to reduce visual load, and sensible ECS separation (Miniplex world + systems). The highest-impact improvements are small and targeted: avoid selecting whole objects from Zustand in top-level React components, share repeated Three assets across instances, and consider on-demand rendering when the scene is static.

 ---

 ## Ratings and notes for inspected hot paths

 (Scale: Excellent / Good / Fair / Needs attention)

 ### `src/App.tsx` — Rating: Fair → Good

 Why

 - UI structure is simple; uses `ToastProvider` and splits HUD / sidebar; `SettingsPanel` and persistence wiring are explicit.
 - `const resources = useStore((state) => state.resources)` selects the whole resources object. If `resources` is updated frequently, the `App` component and its HUD will re-render on any field change.

 Recommendations

 - Select only the fields the HUD displays (e.g. `useStore(s => s.resources.ore)`) or use a shallow array selector.
 - Move heavy UI into memoized subcomponents so only the small HUD re-renders.
 - Use React transitions for non-blocking UI updates when showing/hiding panels.

 ### `src/main.tsx` — Rating: Good

 Why

 - Persistence lifecycle is explicit and client-only; helpers are exposed for e2e.
 - Uses `StrictMode` and validates the root element.

 Recommendations

 - Optionally defer `persistence.start()` until after initial render for stricter determinism.
 - Gate test-only globals (`window.__persistence`, `__appReady`) behind NODE_ENV if needed.

 ### `src/r3f/Scene.tsx` — Rating: Good

 Why

 - Systems are created in `useMemo` and the main tick runs in `useFrame` (proper R3F idiom).
 - Keeps ECS simulation logic in systems rather than pushing sim state through React.

 Recommendations

 - Consider an on-demand render mode when the scene is static (saves CPU/GPU).
 - Ensure components subscribe only to minimal derived store data.

 ### `src/r3f/Drones.tsx` — Rating: Excellent

 Why

 - Uses `InstancedMesh` and updates matrices/colors in `useFrame` — high-performance pattern.
 - Caps instance count and reuses geometry/materials.

 Recommendations

 - Monitor allocation frequency of `droneQuery.entities`; reuse buffers if reallocation is frequent.

 ### `src/r3f/Factory.tsx` — Rating: Excellent

 Why

 - Uses instanced meshes and performance profiles to reduce visual load.
 - Generates belt `CanvasTexture` client-side and disposes textures on unmount.

 Recommendations

 - Share conveyor textures/materials across factory instances via a small asset cache to reduce GPU memory and texture uploads.
 - If deterministic visuals are necessary, seed initial states.

 ### `src/state/store.ts` — Rating: Good

 Why

 - Uses slice composition for Zustand and provides serialization and orchestration functions.

 Issues

 - Several `@ts-expect-error` markers indicate type composition pain points that could be hardened.
 - Some UI code subscribes to large objects which can trigger excessive re-renders.

 Recommendations

 - Prefer minimal selectors (or `subscribeWithSelector`) and shallow equality where appropriate.
 - Consider `immer` middleware for easier immutable updates if desired.
 - Add JSDoc for high-frequency store methods to clarify intent.

 ### `src/ecs/world.ts` — Rating: Good

 Why

 - Proper Miniplex world/query usage and entity shapes built with Three objects.
 - `createGameWorld` supports custom RNG for deterministic tests.

 Recommendations

 - For strict test isolation, provide an explicit `initGameWorld()` that tests can call instead of relying on module side-effects.

 ### `src/ecs/systems/droneAI.ts` — Rating: Good → Excellent

 Why

 - Robust assignment and synchronization logic with defensive validation of persisted flight snapshots.

 Recommendations

 - Profile this system at scale; it's a hot CPU path if many drones are active.


 ## Cross-cutting observations and priorities

 1. Avoid broad selectors in React components (high)

 - Replace subscriptions like `useStore(s => s.resources)` with per-field selectors or shallow array selectors to reduce re-renders.

 2. Share Three assets across instances (medium)

 - Implement a small cache for `CanvasTexture` and repeated materials used by `Factory` instances.

 3. Consider on-demand rendering when idle (medium)

 - Use `frameloop="demand"` or a global `renderEnabled` flag and call `invalidate()` only when the scene changes.

 4. Batch per-frame store updates (medium)

 - Consolidate multiple `set()` calls into single batched updates where possible.

 5. Tighten types and run test/typecheck (low→medium)

 - Run `npm run typecheck` and address `@ts-expect-error` sites where feasible.

 6. Add performance checks to CI (low→medium)

 - Consider a simple perf job that records frame loop time under a standard scene.


 ## Suggested immediate tasks

 - Replace whole-object selectors in HUD (`App.tsx`) with per-field selectors (low risk, high impact).
 - Add a small shared asset cache for conveyor textures (medium effort).
 - Add a dev-only on-demand render toggle and measure CPU/GPU savings (medium).
 - Run `npm run typecheck`, `npm run lint`, `npm run test` and fix issues (small).


 ## Tests & verification

 - Run unit tests: `npm run test`.
 - Run typecheck: `npm run typecheck`.
 - Use React Profiler to confirm fewer unnecessary re-renders after selector changes.
 - Measure frame loop timings with/without on-demand rendering.


 ## Closing notes

 The project already implements many recommended patterns for React + R3F + Zustand + Miniplex. The highest-return improvements are small and focused: tighten selectors in UI, share repeated GPU assets, and consider on-demand rendering in static scenarios.

 ---

 This audit was written programmatically and saved to `docs/src-best-practices-audit.md`.
       ---

       ## Ratings and notes for inspected hot paths

       (Scale: Excellent / Good / Fair / Needs attention)

       ### `src/App.tsx` — Rating: Fair → Good

       Why

       - UI structure is simple; uses `ToastProvider` and splits HUD / sidebar; `SettingsPanel` and persistence wiring are explicit.
       - `const resources = useStore((state) => state.resources)` selects the whole resources object. If `resources` is updated frequently, the `App` component and its HUD will re-render on any field change.

       Recommendations

       - Select only the fields the HUD displays (e.g. `useStore(s => s.resources.ore)`) or use a shallow array selector.
       - Move heavy UI into memoized subcomponents so only the small HUD re-renders.
       - Use React transitions for non-blocking UI updates when showing/hiding panels.

       ### `src/main.tsx` — Rating: Good

       Why

       - Persistence lifecycle is explicit and client-only; helpers are exposed for e2e.
       - Uses `StrictMode` and validates the root element.

       Recommendations

       - Optionally defer `persistence.start()` until after initial render for stricter determinism.
       - Gate test-only globals (`window.__persistence`, `__appReady`) behind NODE_ENV if needed.

       ### `src/r3f/Scene.tsx` — Rating: Good

       Why

       - Systems are created in `useMemo` and the main tick runs in `useFrame` (proper R3F idiom).
       - Keeps ECS simulation logic in systems rather than pushing sim state through React.

       Recommendations

       - Consider an on-demand render mode when the scene is static (saves CPU/GPU).
       - Ensure components subscribe only to minimal derived store data.

       ### `src/r3f/Drones.tsx` — Rating: Excellent

       Why

       - Uses `InstancedMesh` and updates matrices/colors in `useFrame` — high-performance pattern.
       - Caps instance count and reuses geometry/materials.

       Recommendations

       - Monitor allocation frequency of `droneQuery.entities`; reuse buffers if reallocation is frequent.

       ### `src/r3f/Factory.tsx` — Rating: Excellent

       Why

       - Uses instanced meshes and performance profiles to reduce visual load.
       - Generates belt `CanvasTexture` client-side and disposes textures on unmount.

       Recommendations

       - Share conveyor textures/materials across factory instances via a small asset cache to reduce GPU memory and texture uploads.
       - If deterministic visuals are necessary, seed initial states.

       ### `src/state/store.ts` — Rating: Good

       Why

       - Uses slice composition for Zustand and provides serialization and orchestration functions.

       Issues

       - Several `@ts-expect-error` markers indicate type composition pain points that could be hardened.
       - Some UI code subscribes to large objects which can trigger excessive re-renders.

       Recommendations

       - Prefer minimal selectors (or `subscribeWithSelector`) and shallow equality where appropriate.
       - Consider `immer` middleware for easier immutable updates if desired.
       - Add JSDoc for high-frequency store methods to clarify intent.

       ### `src/ecs/world.ts` — Rating: Good

       Why

       - Proper Miniplex world/query usage and entity shapes built with Three objects.
       - `createGameWorld` supports custom RNG for deterministic tests.

       Recommendations

       - For strict test isolation, provide an explicit `initGameWorld()` that tests can call instead of relying on module side-effects.

       ### `src/ecs/systems/droneAI.ts` — Rating: Good → Excellent

       Why

       - Robust assignment and synchronization logic with defensive validation of persisted flight snapshots.

       Recommendations

       - Profile this system at scale; it's a hot CPU path if many drones are active.


       ## Cross-cutting observations and priorities

       1. Avoid broad selectors in React components (high)

       - Replace subscriptions like `useStore(s => s.resources)` with per-field selectors or shallow array selectors to reduce re-renders.

       2. Share Three assets across instances (medium)

       - Implement a small cache for `CanvasTexture` and repeated materials used by `Factory` instances.

       3. Consider on-demand rendering when idle (medium)

       - Use `frameloop="demand"` or a global `renderEnabled` flag and call `invalidate()` only when the scene changes.

       4. Batch per-frame store updates (medium)

       - Consolidate multiple `set()` calls into single batched updates where possible.

       5. Tighten types and run test/typecheck (low→medium)

       - Run `npm run typecheck` and address `@ts-expect-error` sites where feasible.

       6. Add performance checks to CI (low→medium)

       - Consider a simple perf job that records frame loop time under a standard scene.


       ## Suggested immediate tasks

       - Replace whole-object selectors in HUD (`App.tsx`) with per-field selectors (low risk, high impact).
       - Add a small shared asset cache for conveyor textures (medium effort).
       - Add a dev-only on-demand render toggle and measure CPU/GPU savings (medium).
       - Run `npm run typecheck`, `npm run lint`, `npm run test` and fix issues (small).


       ## Tests & verification

       - Run unit tests: `npm run test`.
       - Run typecheck: `npm run typecheck`.
       - Use React Profiler to confirm fewer unnecessary re-renders after selector changes.
       - Measure frame loop timings with/without on-demand rendering.


       ## Closing notes

       The project already implements many recommended patterns for React + R3F + Zustand + Miniplex. The highest-return improvements are small and focused: tighten selectors in UI, share repeated GPU assets, and consider on-demand rendering in static scenarios.

       ---

       This audit was written programmatically and saved to `docs/src-best-practices-audit.md`.
