# TASK056 - Logistics Parity Implementation

**Status:** Completed  
**Added:** 2025-12-10  
**Updated:** 2025-12-11  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 5 from DES039: Port TS logistics scheduler's reservoir/reservation logic, buffer targets, and hauler routing to achieve identical transfer flows between TS and Rust.

## Thought Process

Logistics scheduling differences cause throughput and per-factory resource mismatches. TS uses `scheduleFactoryToFactoryTransfers`, `scheduleFactoryToWarehouseTransfers`, and `scheduleUpgradeRequests` with complex reservation maps and buffer targets. Rust has a simplified scheduler. Porting the full TS logic ensures identical resource flows.

## Requirements (EARS)

- WHEN the logistics scheduler runs each interval, THE SYSTEM SHALL propose factory-to-factory transfers using TS buffer targets/min reserves and resolved hauler configs so pending transfers/reservations match TS snapshots [Acceptance: TS/Rust pending transfers and outbound reservations align for shared snapshots].
- WHEN the warehouse has space or stock, THE SYSTEM SHALL mirror TS factory↔warehouse scheduling using module/upgrade-aware hauler capacity and reservation accounting [Acceptance: per-resource warehouse totals and factory reservations match within 0.01 after a scheduler run].
- WHEN upgrade requests are pending and warehouse stock exists, THE SYSTEM SHALL dispatch shipments and update fulfilled/status fields identically to TS [Acceptance: upgradeRequests status and fulfilledAmount match between engines after deliveries].
- WHEN transfers reach ETA on a scheduler tick, THE SYSTEM SHALL release reservations and update factory/warehouse inventories and currentStorage consistently with TS bounds [Acceptance: resource totals and reservation maps remain within parity thresholds after completion].

## Implementation Plan

- Port TS scheduler structure to Rust:
  - Implement `scheduleFactoryToFactoryTransfers` logic
  - Port `scheduleFactoryToWarehouseTransfers` behavior
  - Add `scheduleUpgradeRequests` routing
- Implement reservation system:
  - Port per-factory reservation maps
  - Track pending transfers and reserved resources
  - Prevent double-allocation of resources
- Port hauler configuration:
  - Implement `resolveFactoryHaulerConfig` equivalently
  - Match capacity, speed, and route overhead calculations
  - Apply upgrade modifiers consistently
- Align warehouse buffering:
  - Port buffer target calculations
  - Match warehouse space management
  - Implement overflow handling
- Keep 2s scheduler cadence:
  - Ensure timing matches TS (every 2 seconds)
  - Verify frame-rate independence
- Add logistics transfer parity tests:
  - Verify transfer amounts and timing
  - Check reservation state consistency
  - Validate throughput rates

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID    | Description                                       | Status      | Updated    | Notes |
| ----- | ------------------------------------------------- | ----------- | ---------- | ----- |
| 56.1  | Port factory-to-factory transfer scheduler        | Completed   | 2025-12-11 | Rust scheduler mirrors TS matcher and ETA math |
| 56.2  | Port factory-to-warehouse transfer scheduler      | Completed   | 2025-12-11 | Uses buffer targets/min reserves with reservations |
| 56.3  | Implement upgrade request routing                 | Completed   | 2025-12-11 | Warehouse requests scheduled and fulfilled statuses updated |
| 56.4  | Port reservation system and tracking              | Completed   | 2025-12-11 | Outbound reservations/inbound schedules aligned with TS |
| 56.5  | Implement `resolveFactoryHaulerConfig`            | Completed   | 2025-12-11 | Module + upgrade bonuses match TS hauler config |
| 56.6  | Port warehouse buffer calculations                | Completed   | 2025-12-11 | Warehouse capacity uses modifiers and storage multiplier |
| 56.7  | Add logistics transfer parity tests               | Completed   | 2025-12-11 | Added focused Rust/TS parity test harness |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 5
- Initial implementation plan defined
- Dependencies: TASK052 (measurement baseline)

### 2025-12-11

- Captured parity requirements and moved task to In Progress.
- Ported Rust logistics scheduler to match TS factory↔factory/warehouse logic, reservations, hauler config resolution, upgrade requests, and warehouse capacity math.
- Added upgrade request schema to Rust snapshots for parity.
- Built focused logistics parity unit test comparing scheduled transfers/reservations and rebuilt WASM.
- Validation: `npm run typecheck`, `npm run lint`, `npm run build:wasm`, `npm run test`.
