# DES005 — Energy Throttle & Per-Drone Battery

**Status:** Draft
**Created:** 2025-10-16

## Summary

Introduce per-drone battery, throttleFloor, and charging rules. Ensure deterministic AI behavior while scaling movement and mining rates by available energy fraction.

## Interfaces

- Drone component additions: `battery`, `maxBattery`, `charging`
- Energy system: charge allocation to docked drones; `energyFraction` computation

## Acceptance

- Drones throttle smoothly, battery pool respects power capacity, deterministic under seeded RNG.
