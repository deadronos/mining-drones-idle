# DES004 — Refinery ECS System & Offline Alignment

**Status:** Draft
**Created:** 2025-10-16

## Summary

Move refinery logic into an ECS system to ensure parity between live ticks and offline simulation. Provide deterministic, fixed-timestep processing for offline catch-up.

## Interfaces

- `createRefinerySystem(world, store)` -> returns `{ initialize, update(dt), cleanup }`
- `store.processRefinery(dt)` proxies to the refinery system for offline use

## Acceptance

- Offline simulation using `processRefinery` produces identical ore->bar results as live ticks.

## Notes

- Add tests for parity and document system update order.
