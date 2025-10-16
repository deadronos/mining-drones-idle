# DES006 — Seeded RNG

**Status:** Completed
**Created:** 2025-10-16

## Summary

Add a deterministic RNG utility and route all random-dependent operations through it. Persist `rngSeed` in snapshot to enable reproducible worlds.

## API

- `createRng(seed: number)` -> `{ seed: number, next(): number, nextInt(min, max): number, nextRange(min, max): number }`

## Notes

- Use a lightweight algorithm (Mulberry32 / xorshift) and keep wrapper minimal for performance.
