# Active Context

## Current Focus

Finish Milestone 1 deliverables: land the persistence-ready store slice, wire the persistence manager into bootstrap, and expose autosave/offline controls through a Settings UI.

## Recent Changes

- Store now exposes `settings`, snapshot helpers, and import/export APIs consumed by persistence.
- Persistence manager loads/saves at bootstrap with autosave timers and unload listeners.
- Settings panel allows autosave/offline configuration plus save import/export with regression tests.

## Next Steps

- Monitor autosave/offline flows for edge cases; capture follow-up issues if needed.
- Start Milestone 2 prep: design refinery ECS integration and align offline simulation once persistence feels stable.
