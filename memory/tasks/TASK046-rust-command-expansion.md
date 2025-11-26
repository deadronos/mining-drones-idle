# [TASK046] - Rust Command Expansion

**Status:** Completed  
**Added:** 2025-11-26  
**Updated:** 2025-11-26  
**Design:** DES036-rust-completion-alignment.md (Phase 3)

## Original Request

Expand the `SimulationCommand` enum in Rust to support all game actions, and implement the corresponding command handlers.

## Requirements

- **RQ-089** – `SimulationCommand` SHALL support: `BuyModule`, `DoPrestige`, `PurchaseFactoryUpgrade`, `AssignHauler`, `ImportPayload`.

## Thought Process

The current Rust implementation has basic commands. To achieve full parity with TypeScript, we need to expand the command system to handle all player actions that affect simulation state. Each command needs a handler that modifies GameState appropriately.

## Implementation Plan

- [x] 3.1 Expand `SimulationCommand` enum in `rust-engine/src/api.rs`
- [x] 3.2 Implement `BuyModule` command handler
- [x] 3.3 Implement `DoPrestige` command handler
- [x] 3.4 Implement `PurchaseFactoryUpgrade` handler
- [x] 3.5 Implement `AssignHauler` command handler
- [x] 3.6 Implement `ImportPayload` command handler
- [x] 3.7 Add TS types for new commands in `src/lib/wasmSimBridge.ts`

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                    | Status   | Updated    | Notes                           |
| --- | ------------------------------ | -------- | ---------- | ------------------------------- |
| 3.1 | Expand SimulationCommand enum  | Complete | 2025-11-26 | Added 7 new command variants    |
| 3.2 | BuyModule handler              | Complete | 2025-11-26 | Supports all module types       |
| 3.3 | DoPrestige handler             | Complete | 2025-11-26 | Reset resources, modules, cores |
| 3.4 | PurchaseFactoryUpgrade handler | Complete | 2025-11-26 | Supports cost variants          |
| 3.5 | AssignHauler handler           | Complete | 2025-11-26 | Delta-based assignment          |
| 3.6 | ImportPayload handler          | Complete | 2025-11-26 | Uses load_snapshot_str          |
| 3.7 | TS types for new commands      | Complete | 2025-11-26 | Full union type coverage        |

## Expanded SimulationCommand

```rust
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum SimulationCommand {
    // Existing
    UpdateResources(Resources),
    UpdateModules(Modules),
    SetSettings(StoreSettings),

    // New
    BuyModule { module_type: String, factory_id: Option<String> },
    DoPrestige,
    PurchaseFactoryUpgrade { factory_id: String, upgrade_type: String, cost_variant: Option<String> },
    AssignHauler { factory_id: String, count: i32 },
    ImportPayload { snapshot_json: String },
    SpawnDrone { factory_id: String },
    RecycleAsteroid { asteroid_id: String },
}
```

## Progress Log

### 2025-11-26

- Task created from DES036 Phase 3
- Depends on TASK044 (critical fixes)

### 2025-11-26 (Implementation)

- Expanded `SimulationCommand` enum with 7 new variants:
  - `BuyModule` – deducts bars and increments module level
  - `DoPrestige` – converts bars to cores, resets progress
  - `PurchaseFactoryUpgrade` – handles all factory upgrades with cost variants
  - `AssignHauler` – adjusts hauler counts per factory
  - `ImportPayload` – loads full snapshot via `load_snapshot_str`
  - `SpawnDrone` – placeholder (handled by TS ECS)
  - `RecycleAsteroid` – sets asteroid ore to 0
- Implemented command handlers in `GameState::apply_command`:
  - `handle_buy_module` – supports all 8 module types with cost calculation
  - `handle_prestige` – computes gain, resets resources/modules/drones
  - `handle_factory_upgrade` – supports all 5 upgrade types with 4 cost variants
  - `handle_assign_hauler` – delta-based hauler assignment with buffer sync
  - `handle_recycle_asteroid` – clears asteroid ore via buffer
- Added `sync_factory_to_buffer` helper for factory state synchronization
- Updated TypeScript `SimulationCommand` union type with all new variants
- All 245 TS tests pass
- All 13 Rust tests pass
- TypeScript type check passes

## Dependencies

- **Depends on:** TASK044 ✅
- **Blocks:** TASK047, TASK048

## Files Changed

- `rust-engine/src/api.rs` – Expanded SimulationCommand enum and command handlers
- `src/lib/wasmSimBridge.ts` – Added new SimulationCommand type variants
