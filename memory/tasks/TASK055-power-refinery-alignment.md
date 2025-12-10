# TASK055 - Power & Refinery Alignment

**Status:** Pending  
**Added:** 2025-12-10  
**Updated:** 2025-12-10  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 4 from DES039: Ensure per-factory energy accounting, idle/hauler drains, refinery slot logic, and solar bonuses match TS formulas exactly.

## Thought Process

Energy and refinery systems have subtle numeric differences that accumulate over time, causing resource production and energy state divergence. TS uses per-factory idle drain, hauler maintenance costs, and module-level bonuses. Aligning these formulas ensures refinery production and energy management match exactly.

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

**Overall Status:** Not Started - 0%

### Subtasks

| ID    | Description                                    | Status      | Updated    | Notes |
| ----- | ---------------------------------------------- | ----------- | ---------- | ----- |
| 55.1  | Align per-factory idle energy drain            | Not Started |            |       |
| 55.2  | Implement hauler maintenance costs             | Not Started |            |       |
| 55.3  | Port effective energy capacity calculation     | Not Started |            |       |
| 55.4  | Synchronize solar regeneration logic           | Not Started |            |       |
| 55.5  | Port refinery production formulas              | Not Started |            |       |
| 55.6  | Match local-first charging behavior            | Not Started |            |       |
| 55.7  | Add power/refinery parity tests                | Not Started |            |       |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 4
- Initial implementation plan defined
- Dependencies: TASK052 (measurement baseline)
