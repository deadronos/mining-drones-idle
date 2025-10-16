# Active Context

## Current Focus

Translate the refreshed spec into implementation tasks—start with extending the store to support the persistence manager (settings slice, snapshot helpers) before wiring it into the app bootstrap.

## Recent Changes

- Core MVP delivered with ECS loop, rendering, and UI panel.
- Persistence/offline iteration introduced new tests and utilities but integration is pending.
- Spec updated with requirement status table and explicit persistence manager gaps (DES002/TASK003).

## Next Steps

- Extend the store with persistence settings/snapshot APIs so `createPersistenceManager` can operate safely.
- Plan bootstrap wiring and settings UI per the updated roadmap once the store work lands.
