# [TASK044] - Rust Critical Fixes & WASM Build

**Status:** Pending  
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

- [ ] 1.1 Change `edition = "2024"` to `edition = "2021"` in `rust-engine/Cargo.toml`
- [ ] 1.2 Extract unsafe slice operations into safe helper functions in `rust-engine/src/api.rs`
- [ ] 1.3 Verify WASM compilation with `wasm-pack build --target web`
- [ ] 1.4 Fix any additional compilation errors discovered

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID  | Description                       | Status      | Updated | Notes |
| --- | --------------------------------- | ----------- | ------- | ----- |
| 1.1 | Fix Cargo.toml edition            | Not Started |         |       |
| 1.2 | Extract safe slice helpers        | Not Started |         |       |
| 1.3 | Verify WASM compilation           | Not Started |         |       |
| 1.4 | Fix additional compilation errors | Not Started |         |       |

## Progress Log

### 2025-11-26

- Task created from DES036 Phase 1
- This task blocks TASK045-TASK049

## Dependencies

- **Blocks:** TASK045, TASK046, TASK047, TASK048, TASK049
