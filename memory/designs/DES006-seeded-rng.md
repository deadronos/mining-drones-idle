# DES006 — Seeded RNG

**Status:** Draft
**Created:** 2025-10-16

## Summary

Add a deterministic RNG utility and route all random-dependent operations through it. Persist `rngSeed` in snapshot to enable reproducible worlds.

## API

- `createRNG(seed: number)` -> `{ next(): number, nextInt(max): number }`

## Notes

- Use a lightweight algorithm (Mulberry32 / xorshift) and keep wrapper minimal for performance.
