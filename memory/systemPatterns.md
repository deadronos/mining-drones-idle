# System Patterns

## Architecture Overview

- Vite-powered React SPA with React Three Fiber scene for 3D rendering.
- Zustand store holds resources, modules, prestige state, and provides ticking logic.
- Miniplex ECS manages entities (factory, asteroids, drones) and systems for simulation.
- UI components overlay on Canvas using traditional React components.

## Key Patterns

- Fixed timestep accumulator to maintain deterministic simulation.
- ECS systems operate on entity queries to keep logic decoupled and testable.
- Upgrades follow exponential cost curves to provide long-term progression.
- Prestige resets resources while granting permanent multiplier bonuses.

## Integration Points

- Scene `useFrame` drives ECS system execution and store ticks.
- UI reads from Zustand store selectors for reactive updates without unnecessary renders.
- Tests target both store logic and ECS behavior for progression validation.
