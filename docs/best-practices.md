Here’s a concise “what to do in 2025” summary for the stack you’re using in dev (React + R3F + Zustand + Miniplex). I’ve focused on practices that line up with today’s stable docs and the typical versions you’d pin in a modern package.json.

React (19.x)

Target React 19.x (React 19.2 is current) for the latest concurrency & ergonomics. Key upgrades include better transitions/error handling and perf tooling in DevTools.
react.dev
+1

Use transitions for async UI (forms, optimistic updates), and avoid ad-hoc loaders sprinkled in effects.
react.dev

Prefer Server/Client boundaries only if you’re on a framework that supports them (Next, etc.). If you’re staying Vite-SPA, keep it simple: Client Components everywhere.
react.dev

React-Three-Fiber (R3F)

Version pairing matters: @react-three/fiber@9 pairs with React 19, @react-three/fiber@8 pairs with React 18. Don’t mix.
r3f.docs.pmnd.rs

Performance checklist

Turn on on-demand rendering / invalidateFrameloop when the scene is mostly static to reduce React/Three churn.
r3f.docs.pmnd.rs
+1

Avoid setState in loops (useFrame) and fast events; mutate refs and use deltas for frame-based movement.
r3f.docs.pmnd.rs

Memoize heavyweight Three objects (geometries/materials) and reuse them; prefer instancing for many similar meshes.
r3f.docs.pmnd.rs
+1

Reach for @react-three/drei for cameras, loaders, helpers; it’s the sanctioned utility set.
docs.pmnd.rs

General R3F guidance: Keep React modeling the scene graph declaratively; let useFrame drive animation/imperative bits.
r3f.docs.pmnd.rs

Zustand

Selectors everywhere: subscribe to slices, not the whole store, to avoid rerenders. Use shallow (or useShallow) when selecting multiple fields.
zustand.docs.pmnd.rs
+2
zustand.docs.pmnd.rs
+2

Slices pattern for modularity (matches your project’s “pure selectors/actions” ethos).
zustand.docs.pmnd.rs

Middleware:

subscribeWithSelector for precise subscriptions.
zustand.docs.pmnd.rs

immer for convenient immutable updates.
zustand.docs.pmnd.rs
+1

(Optional) devtools only in development to inspect state changes. (Supported pattern referenced in docs & community guides.)
Yuan's Blog

Store shape: multiple small stores or one “root + slices” are both valid; pick what keeps dependencies tidy—Zustand is intentionally unopinionated here.
GitHub
+1

Miniplex (ECS)

Entity/component hygiene: always use addComponent / removeComponent so queries/indexing stay correct; mutating component values in place is fine.
GitHub

With React: @miniplex/react provides a simple bridge; typical pattern is: world + queries → React hooks → render with R3F.
npm

Version note: Miniplex 2.x emphasizes lighter, flexible ECS primitives; upgrades from 1.x are mostly surface API changes.
hmans.dev
+1

Practical package.json guardrails

React/R3F pair: if you’re on React 19.x, pin @react-three/fiber ^9 (and keep three current). If you must stay on React 18, keep @react-three/fiber ^8.
r3f.docs.pmnd.rs

Zustand: add zustand, plus zustand/middleware for immer, subscribeWithSelector, and devtools in dev only.
zustand.docs.pmnd.rs
+1

Drei: include @react-three/drei for utilities (cameras, loaders, controls).
docs.pmnd.rs

Miniplex: miniplex + @miniplex/react if you’re wiring ECS into React.
npm

Gotchas to avoid (esp. for your sim)

Don’t pipe high-frequency sim state through React—drive it via refs in useFrame; only surface low-frequency/UI state to React/Zustand.
r3f.docs.pmnd.rs

Don’t recreate geometries/materials each frame; memo & reuse (and instance fleets of drones/asteroids).
r3f.docs.pmnd.rs
+1

Keep persistence/migrations pure and store-level (your current approach matches Zustand’s “slices + middleware” guidance).
zustand.docs.pmnd.rs
