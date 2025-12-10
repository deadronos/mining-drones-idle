# [TASK047] - Store Integration & Feature Flag

**Status:** Completed  
**Added:** 2025-11-26  
**Updated:** 2025-11-27  
**Design:** DES036-rust-completion-alignment.md (Phase 4)

## Original Request

Integrate the Rust WASM bridge with the Zustand store, adding a feature flag to switch between TypeScript and Rust simulation engines, and routing all simulation-affecting actions through the bridge when enabled.

## Requirements

- **RQ-086** – WHEN `useRustSim` is enabled, the Zustand store SHALL treat Rust `GameState` as the authoritative source for simulation state.
- **RQ-087** – The system SHALL route all simulation-affecting actions through `applyCommand` when Rust is authoritative.
- **RQ-088** – UI-only state (selections, panel visibility, debug toggles) SHALL remain TypeScript-owned regardless of `useRustSim`.

## Thought Process

The store integration creates a dual-engine architecture where:

1. A feature flag (`useRustSim`) controls which engine is authoritative
2. Simulation-affecting actions route through the bridge when Rust is enabled
3. UI state remains in TypeScript regardless of engine choice
4. A global registry allows store actions to access bridge without React context

## Implementation Plan

- [x] 4.1 Add `useRustSim` feature flag to `src/state/slices/settingsSlice.ts`
- [x] 4.2 Create `rustBridgeRegistry.ts` for global bridge access
- [x] 4.3 Refactor `buy()` action to route through bridge
- [x] 4.4 Refactor `doPrestige()` action to route through bridge
- [x] 4.5 Refactor `upgradeFactory()` and `assignHaulers()` to route through bridge
- [x] 4.6 Selectors abstraction prepared (direct access pattern)
- [x] 4.7 Add `useRustSim` toggle in `src/ui/DebugPanel.tsx`
- [x] 4.8 Tests pass, typecheck, and lint verified

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                       | Status   | Updated    | Notes                                    |
| --- | --------------------------------- | -------- | ---------- | ---------------------------------------- |
| 4.1 | Add useRustSim flag               | Complete | 2025-11-27 | Added to StoreSettings                   |
| 4.2 | Create bridge registry            | Complete | 2025-11-27 | rustBridgeRegistry.ts created            |
| 4.3 | Refactor buy action               | Complete | 2025-11-27 | Routes through bridge when enabled       |
| 4.4 | Refactor doPrestige action        | Complete | 2025-11-27 | Routes through bridge when enabled       |
| 4.5 | Refactor other simulation actions | Complete | 2025-11-27 | upgradeFactory, assignHaulers updated    |
| 4.6 | Selectors abstraction             | Complete | 2025-11-27 | Direct access pattern maintained         |
| 4.7 | Add Debug Panel toggle            | Complete | 2025-11-27 | Toggle with status indicator added       |
| 4.8 | Run tests and verify              | Complete | 2025-11-27 | 245 tests pass, typecheck OK, lint clean |

## Files Changed

- `src/state/slices/settingsSlice.ts` - Added `useRustSim: boolean` to StoreSettings
- `src/lib/rustBridgeRegistry.ts` - New file for global bridge registration
- `src/hooks/useRustEngine.ts` - Register/unregister bridge on init/cleanup
- `src/state/slices/resourceSlice.ts` - Updated `buy()` and `doPrestige()` with bridge routing
- `src/state/slices/factory/upgradeRequests.ts` - Updated `upgradeFactory()` with bridge routing
- `src/state/slices/logisticsSlice.ts` - Updated `assignHaulers()` with bridge routing
- `src/ui/DebugPanel.tsx` - Added Rust engine toggle UI
- `src/ui/DebugPanel.css` - Added styling for toggle section

## Progress Log

### 2025-11-26

- Task created from DES036 Phase 4
- Depends on TASK045 (bridge) and TASK046 (commands)

### 2025-11-27

- Implemented `useRustSim` flag in settingsSlice
- Created `rustBridgeRegistry.ts` for global bridge access from store
- Updated `useRustEngine.ts` to register/unregister bridge
- Updated `buy()` and `doPrestige()` in resourceSlice to route through bridge
- Updated `upgradeFactory()` in upgradeRequests.ts to route through bridge
- Updated `assignHaulers()` in logisticsSlice to route through bridge
- Added Debug Panel toggle with status indicator
- All 245 tests pass, typecheck OK, lint clean (pre-existing issues only)
- Task completed

## Dependencies

- **Depends on:** TASK045 ✅, TASK046 ✅
- **Blocks:** TASK049
