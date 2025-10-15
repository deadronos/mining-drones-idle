# Tech Context

## Frontend Stack

- React 19.2 with TypeScript using Vite (rolldown variant) for bundling.
- React Three Fiber (r3f) and Drei for 3D scene composition.
- Zustand for state management, Miniplex for ECS, Radix UI themes for overlay styling.

## Tooling

- ESLint + Prettier for linting and formatting.
- Vitest for unit testing, React Testing Library for component tests.
- Playwright for end-to-end testing.

## Constraints

- Keep individual files under 300 LOC per guidance.
- Ensure deterministic simulation by using fixed time step.
- Provide offline-friendly tick logic (time delta catch-up) though initial offline may be stubbed.
