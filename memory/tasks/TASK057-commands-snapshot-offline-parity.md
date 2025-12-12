# TASK057 - Commands, Snapshot & Offline Parity

**Status:** Completed  
**Added:** 2025-12-10  
**Updated:** 2025-12-13  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 6 from DES039: Align `apply_command()` behavior across engines, ensure snapshot/migration compatibility, and normalize offline simulation semantics between TS and Rust.

## Thought Process

Command handling and offline simulation are critical for game state integrity. Differences in command application cause snapshot divergence, while offline semantic differences break long-term parity. This phase ensures both engines produce identical results for all commands and offline catch-up.

## Requirements (EARS)

- WHEN a supported command (BuyModule, PurchaseFactoryUpgrade, SpawnDrone, AssignHauler, RecycleAsteroid, DoPrestige) is applied to identical TS and Rust snapshots, THE SYSTEM SHALL produce matching resources/modules/ownership outputs across both engines [Acceptance: command parity suite shows no divergences].
- WHEN offline catch-up runs for a given duration and step size, THE SYSTEM SHALL yield TS and Rust snapshots matching within parity tolerances and equal step counts [Acceptance: offline parity matrix within 1% and exact steps].
- WHEN a snapshot with missing/mismatched `schemaVersion` is loaded, THE SYSTEM SHALL normalize or reject it using the current schema version before initialization [Acceptance: schema validation/migration tests enforce SCHEMA_VERSION].
- WHEN a snapshot round-trips TS → Rust → TS, THE SYSTEM SHALL preserve logistics queues, drone ownership, factory resources/upgrades, and schema metadata [Acceptance: round-trip snapshot tests keep structural fields intact].

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

**Overall Status:** Completed - 100%

### Subtasks

| ID    | Description                                    | Status      | Updated    | Notes |
| ----- | ---------------------------------------------- | ----------- | ---------- | ----- |
| 57.1  | Verify and align all command implementations   | Completed   | 2025-12-13 | Rust commands now match TS costs/effects; parity tests enforce zero drift. |
| 57.2  | Choose and implement offline policy            | Completed   | 2025-12-13 | Rust offline now mirrors TS refinery-only path with sink bonuses; bridge uses new API. |
| 57.3  | Add offline command application support        | Completed   | 2025-12-13 | Offline catch-up handled via Rust `simulate_offline`; no extra command replay needed. |
| 57.4  | Enhance snapshot version validation            | Completed   | 2025-12-13 | Schema version normalized and validated in TS/Rust. |
| 57.5  | Implement migration paths                      | Completed   | 2025-12-13 | Schema version defaulting ensures backward snapshots normalize to current version. |
| 57.6  | Add round-trip snapshot tests                  | Completed   | 2025-12-13 | Added TS↔Rust round-trip coverage. |
| 57.7  | Create per-command parity tests                | Completed   | 2025-12-13 | Command parity suite tightened to require zero divergences. |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 6
- Initial implementation plan defined
- Dependencies: TASK052 (measurement baseline)

### 2025-12-13

- Reviewed parity instructions, active context, and existing command/offline logic in TS and Rust.
- Drafted EARS requirements for commands, offline semantics, schema validation, and round-trip parity.
- Set task status to In Progress and noted offline policy decision path (prefer Rust-backed offline).
- Implemented Rust command parity (module/factory upgrade/hauler cost ceil, prestige gain, recycle asteroid snapshot sync) and offline simulation matching TS refinery semantics with sink bonuses; exposed WASM offline API.
- Updated TS schema normalization/validation and added round-trip/command parity assertions (now strict zero-divergence).
- Rebuilt WASM (`npm run build:wasm`) and validated with `npm run typecheck`, `npm run lint`, `npm run test`.
