# [TASK044] - Rust Critical Fixes & WASM Build

**Status:** Completed  
**Added:** 2025-11-26  
**Updated:** 2025-11-26  
**Design:** DES036-rust-completion-alignment.md (Phase 1)

## Original Request

Fix blocking issues preventing Rust WASM compilation and reduce unsafe code in the crate. This is a prerequisite for all other Rust integration work.

## Requirements

- **RQ-081** – The Rust crate SHALL compile with a valid edition (`"2021"`) [BLOCKER].
- **RQ-082** – The `GameState::step()` method SHOULD minimize unsafe code through safer slice abstractions.

## Thought Process

The Rust crate currently uses `edition = "2024"` which doesn't exist yet. This must be changed to `"2021"` before any WASM build can succeed. Additionally, the unsafe slice operations in `api.rs` should be refactored into safe helper functions to improve code quality and reduce potential bugs.

## Implementation Plan

- [x] 1.1 Change `edition = "2024"` to `edition = "2021"` in `rust-engine/Cargo.toml`
- [x] 1.2 Extract unsafe slice operations into safe helper functions in `rust-engine/src/api.rs`
- [x] 1.3 Verify WASM compilation with `wasm-pack build --target web`
- [x] 1.4 Fix any additional compilation errors discovered

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                       | Status   | Updated    | Notes                                     |
| --- | --------------------------------- | -------- | ---------- | ----------------------------------------- |
| 1.1 | Fix Cargo.toml edition            | Complete | 2025-11-26 | Already set to "2021"                     |
| 1.2 | Extract safe slice helpers        | Complete | 2025-11-26 | Added `as_f32_slice_mut` to BufferSection |
| 1.3 | Verify WASM compilation           | Complete | 2025-11-26 | wasm-pack build successful                |
| 1.4 | Fix additional compilation errors | Complete | 2025-11-26 | Fixed 15 let-chain syntax errors          |

## Progress Log

### 2025-11-26

- Task created from DES036 Phase 1
- This task blocks TASK045-TASK049

### 2025-11-26 (Implementation)

- Verified Cargo.toml already has `edition = "2021"` (was already correct)
- Added safe slice helper methods to `BufferSection` in `buffers.rs`:
  - `as_f32_slice_mut()` - safely cast u32 buffer to f32 slice
  - `as_f32_slice()` - immutable version
  - `bytemuck_cast_slice_mut()` / `bytemuck_cast_slice()` - internal helpers
- Refactored `get_*_mut()` methods in `api.rs` to use safe helpers
- Added safety documentation to the remaining unsafe block in `step()`
- Fixed 15 let-chain syntax errors (Rust 2024 feature used in 2021 edition):
  - `api.rs`: drone_owners, target_asteroid_id, target_factory_id, owner_factory_id, asteroid initialization
  - `systems/movement.rs`: returning state check, arrived state handling
- All 13 Rust tests pass
- WASM build successful with `wasm-pack build --target web`

## Dependencies

- **Blocks:** TASK045, TASK046, TASK047, TASK048, TASK049
