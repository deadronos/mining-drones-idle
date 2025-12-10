# TASK057 - Commands, Snapshot & Offline Parity

**Status:** Pending  
**Added:** 2025-12-10  
**Updated:** 2025-12-10  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 6 from DES039: Align `apply_command()` behavior across engines, ensure snapshot/migration compatibility, and normalize offline simulation semantics between TS and Rust.

## Thought Process

Command handling and offline simulation are critical for game state integrity. Differences in command application cause snapshot divergence, while offline semantic differences break long-term parity. This phase ensures both engines produce identical results for all commands and offline catch-up.

## Implementation Plan

- Align command implementations:
  - Verify `BuyModule` produces identical snapshots
  - Match `PurchaseFactoryUpgrade` preconditions and effects
  - Align `SpawnDrone` owner mapping and capacity updates
  - Port `RecycleAsteroid` behavior exactly
  - Match `AssignHauler` routing logic
  - Synchronize `DoPrestige` reset behavior
- Normalize offline semantics:
  - Choose policy: TS refinery-only vs Rust full-step
  - Implement matching offline path in both engines
  - Or make TS offline call Rust bridge (preferred)
  - Add offline command application support
- Enhance snapshot compatibility:
  - Add `schemaVersion` validation in both engines
  - Implement migration paths for version mismatches
  - Add round-trip snapshot tests (TS→Rust→TS)
  - Verify property name consistency (owner mapping, drone_flights, etc.)
- Add command parity tests for each command type:
  - Apply same command to identical TS and Rust snapshots
  - Compare resulting snapshots field-by-field
  - Use epsilon assertions for floats, exact for discrete values

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID    | Description                                    | Status      | Updated    | Notes |
| ----- | ---------------------------------------------- | ----------- | ---------- | ----- |
| 57.1  | Verify and align all command implementations   | Not Started |            |       |
| 57.2  | Choose and implement offline policy            | Not Started |            |       |
| 57.3  | Add offline command application support        | Not Started |            |       |
| 57.4  | Enhance snapshot version validation            | Not Started |            |       |
| 57.5  | Implement migration paths                      | Not Started |            |       |
| 57.6  | Add round-trip snapshot tests                  | Not Started |            |       |
| 57.7  | Create per-command parity tests                | Not Started |            |       |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 6
- Initial implementation plan defined
- Dependencies: TASK052 (measurement baseline)
