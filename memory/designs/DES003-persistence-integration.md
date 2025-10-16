# DES003 — Persistence Integration & Settings UI

**Status:** Draft
**Created:** 2025-10-16

## Summary

Design for Persistence manager, store snapshot serialization, offline simulation capping, and Settings UI to control autosave and offline behavior as described in the implementation plan (Milestone 1).

## Goals

- Implement robust persistence manager with versioned migrations and backup behavior.
- Provide import/export JSON with validation and migration.
- Expose settings UI to control autosave, offline cap, notation and throttle floor.
- Wire persistence startup sequence: load -> simulate offline -> start autosave.

## Interfaces

- Persistence API (src/state/persistence.ts)
  - `load(): Promise<void>`
  - `start(): void`
  - `stop(): void`
  - `saveNow(): Promise<void>`
  - `exportState(): string`
  - `importState(json: string): { migrated: boolean; warnings?: string[] }`

- Store helpers (src/state/store.ts)
  - applySnapshot(snapshot: StoreSnapshot): void
  - serializeStore(): StoreSnapshot
  - processRefinery(dt: number): RefineryStats

## Data model

- Store snapshot includes: version, settings, rngSeed, world, entities, lastTick, lastSave
- Settings defaults: autosaveEnabled=true, autosaveIntervalSec=10, offlineCapHours=24, notation='engineering', throttleFloor=0.25

## Migration strategy

- Maintain a migration map keyed by integer version. On import, run migrations sequentially. For unknown/unrecoverable payloads, backup payload and abort with friendly error.

## Error handling

- Wrap storage calls with try/catch. On failure, pause autosave and surface UI banner with backup key.

## Notes

- Keep Settings UI lazy-loaded to avoid bundle size impact.
