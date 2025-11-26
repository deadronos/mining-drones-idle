# [TASK046] - Rust Command Expansion

**Status:** Pending  
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

- [ ] 3.1 Expand `SimulationCommand` enum in `rust-engine/src/api.rs`
- [ ] 3.2 Implement `BuyModule` command handler
- [ ] 3.3 Implement `DoPrestige` command handler
- [ ] 3.4 Implement `PurchaseFactoryUpgrade` handler
- [ ] 3.5 Implement `AssignHauler` command handler
- [ ] 3.6 Implement `ImportPayload` command handler
- [ ] 3.7 Add TS types for new commands in `src/lib/wasmSimBridge.ts`

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID  | Description                    | Status      | Updated | Notes |
| --- | ------------------------------ | ----------- | ------- | ----- |
| 3.1 | Expand SimulationCommand enum  | Not Started |         |       |
| 3.2 | BuyModule handler              | Not Started |         |       |
| 3.3 | DoPrestige handler             | Not Started |         |       |
| 3.4 | PurchaseFactoryUpgrade handler | Not Started |         |       |
| 3.5 | AssignHauler handler           | Not Started |         |       |
| 3.6 | ImportPayload handler          | Not Started |         |       |
| 3.7 | TS types for new commands      | Not Started |         |       |

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
    PurchaseFactoryUpgrade { factory_id: String, upgrade_type: String },
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

## Dependencies

- **Depends on:** TASK044
- **Blocks:** TASK047, TASK048
