# TASK056 - Logistics Parity Implementation

**Status:** Pending  
**Added:** 2025-12-10  
**Updated:** 2025-12-10  
**Design:** [DES039 — Parity Audit & Action Plan](../designs/DES039-parity-audit-and-recommendations.md)

## Original Request

Phase 5 from DES039: Port TS logistics scheduler's reservoir/reservation logic, buffer targets, and hauler routing to achieve identical transfer flows between TS and Rust.

## Thought Process

Logistics scheduling differences cause throughput and per-factory resource mismatches. TS uses `scheduleFactoryToFactoryTransfers`, `scheduleFactoryToWarehouseTransfers`, and `scheduleUpgradeRequests` with complex reservation maps and buffer targets. Rust has a simplified scheduler. Porting the full TS logic ensures identical resource flows.

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

**Overall Status:** Not Started - 0%

### Subtasks

| ID    | Description                                       | Status      | Updated    | Notes |
| ----- | ------------------------------------------------- | ----------- | ---------- | ----- |
| 56.1  | Port factory-to-factory transfer scheduler        | Not Started |            |       |
| 56.2  | Port factory-to-warehouse transfer scheduler      | Not Started |            |       |
| 56.3  | Implement upgrade request routing                 | Not Started |            |       |
| 56.4  | Port reservation system and tracking              | Not Started |            |       |
| 56.5  | Implement `resolveFactoryHaulerConfig`            | Not Started |            |       |
| 56.6  | Port warehouse buffer calculations                | Not Started |            |       |
| 56.7  | Add logistics transfer parity tests               | Not Started |            |       |

## Progress Log

### 2025-12-10

- Task created from DES039 Phase 5
- Initial implementation plan defined
- Dependencies: TASK052 (measurement baseline)
