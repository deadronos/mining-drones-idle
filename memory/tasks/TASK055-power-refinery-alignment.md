# TASK055 - Power & Refinery Alignment

**Status:** Completed  
**Added:** 2025-12-10  
**Updated:** 2025-12-12  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 4 from DES039: Ensure per-factory energy accounting, idle/hauler drains, refinery slot logic, and solar bonuses match TS formulas exactly.

## Thought Process

Energy and refinery systems have subtle numeric differences that accumulate over time, causing resource production and energy state divergence. TS uses per-factory idle drain, hauler maintenance costs, and module-level bonuses. Aligning these formulas ensures refinery production and energy management match exactly.

## Requirements (EARS)

- WHEN a factory ticks, THE SYSTEM SHALL apply idle energy drain and hauler maintenance using the factory’s stored rates and energyDrainMultiplier before starting/refining slots [Acceptance: parity test shows matching factory energy after a tick].
- WHEN computing factory energy capacity and solar regen, THE SYSTEM SHALL use factory energyCapacity plus Solar Array bonuses and energyStorageMultiplier to cap regen [Acceptance: parity test asserts Rust factory energy equals TS after regen for a seeded tick].
- WHEN starting and ticking refinery slots, THE SYSTEM SHALL use factory refineSlots, storageCapacity (with storageCapacityMultiplier), energyPerRefine, and refineryYieldMultiplier to match TS bar production [Acceptance: parity test compares bars and ore deltas within epsilon].
- WHEN drones charge, THE SYSTEM SHALL charge from local factory energy (including solar gain) before falling back to global energy and consider target factory if owner is missing [Acceptance: parity test keeps drone battery parity within epsilon].

## Implementation Plan

- Align per-factory energy drain:
  - Port `idleEnergyPerSec` per-factory calculation
  - Implement hauler maintenance cost (energyPerHaulerMaintenance)
  - Match timing and order of energy drains
- Synchronize energy capacity and solar:
  - Port `getFactoryEffectiveEnergyCapacity()` with module bonuses
  - Implement solar-array effective capacity logic
  - Match solar regeneration rate and modifiers
- Port refinery production formulas:
  - Implement `computeRefineryProduction` logic
  - Match slot-based production calculations
  - Port `enforceMinOneRefining` semantics
  - Apply yield modifiers consistently
- Ensure local-first charging:
  - Match factory local energy → global energy fallback logic
  - Verify drone charging order and timing
- Add power/refinery parity tests:
  - Per-factory energy drain verification
  - Refinery production rate checks
  - Solar regeneration validation

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID    | Description                                    | Status      | Updated    | Notes |
| ----- | ---------------------------------------------- | ----------- | ---------- | ----- |
| 55.1  | Align per-factory idle energy drain            | Completed   | 2025-12-12 | Idle + hauler drains pulled from factory snapshot, energyDrainMultiplier applied. |
| 55.2  | Implement hauler maintenance costs             | Completed   | 2025-12-12 | 0.5 energy/sec per hauler with modifiers. |
| 55.3  | Port effective energy capacity calculation     | Completed   | 2025-12-12 | Uses factory energyCapacity + Solar Array bonus scaled by energyStorageMultiplier. |
| 55.4  | Synchronize solar regeneration logic           | Completed   | 2025-12-12 | Factory regen uses solar upgrades + array bonus with effective caps. |
| 55.5  | Port refinery production formulas              | Completed   | 2025-12-12 | Slot start/tick mirror TS batch sizing, speed, energy per refine, and yield flow. |
| 55.6  | Match local-first charging behavior            | Completed   | 2025-12-12 | Drones charge from owner/target factory before global energy. |
| 55.7  | Add power/refinery parity tests                | Completed   | 2025-12-12 | Added wasm-backed parity test covering energy and bar outputs. |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 4
- Initial implementation plan defined
- Dependencies: TASK052 (measurement baseline)

### 2025-12-12

- Started Task055; captured EARS requirements and began mapping TS power/refinery semantics (idle drain, solar regen, local-first charging, refinery slot handling) to Rust.
- Implemented parity in Rust: power system now considers target factory for charging and uses effective caps; refinery system consumes factory-specific idle/hauler drain, storage/slots, energy-per-refine, and low-energy throttling to mirror TS `processFactories`.
- Added parity test `tests/unit/power-refinery-parity.test.ts`; ran `npm run build:wasm`, `npm run typecheck`, `npm run lint`, `npm run test` (parity divergence logs expected; suites pass). Task marked completed.
