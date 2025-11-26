# [TASK047] - Store Integration & Feature Flag

**Status:** Pending  
**Added:** 2025-11-26  
**Updated:** 2025-11-26  
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
4. Selectors abstract data source for consumers

## Implementation Plan

- [ ] 4.1 Add `useRustSim` feature flag to `src/state/store.ts`
- [ ] 4.2 Add `rustBridge` reference to store state
- [ ] 4.3 Refactor `buyModule` action to route through bridge
- [ ] 4.4 Refactor `doPrestige` action to route through bridge
- [ ] 4.5 Refactor other simulation actions to route through bridge
- [ ] 4.6 Update selectors in `src/state/selectors.ts` to use abstraction hook
- [ ] 4.7 Add `useRustSim` toggle in `src/ui/DebugPanel.tsx`

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID  | Description                       | Status      | Updated | Notes |
| --- | --------------------------------- | ----------- | ------- | ----- |
| 4.1 | Add useRustSim flag               | Not Started |         |       |
| 4.2 | Add rustBridge reference          | Not Started |         |       |
| 4.3 | Refactor buyModule action         | Not Started |         |       |
| 4.4 | Refactor doPrestige action        | Not Started |         |       |
| 4.5 | Refactor other simulation actions | Not Started |         |       |
| 4.6 | Update selectors                  | Not Started |         |       |
| 4.7 | Add Debug Panel toggle            | Not Started |         |       |

## Store Integration Pattern

```typescript
// In useStore.ts actions
buyModule: (type: ModuleType) => {
  const { useRustSim, rustBridge } = get();

  if (useRustSim && rustBridge?.isReady()) {
    rustBridge.applyCommand({
      type: 'BuyModule',
      payload: { moduleType: type },
    });
    // Sync UI state from Rust snapshot
    const snapshot = rustBridge.exportSnapshot();
    set({ resources: snapshot.resources, modules: snapshot.modules });
  } else {
    // Existing TS logic
    legacyBuyModule(type);
  }
};
```

## Progress Log

### 2025-11-26

- Task created from DES036 Phase 4
- Depends on TASK045 (bridge) and TASK046 (commands)

## Dependencies

- **Depends on:** TASK045, TASK046
- **Blocks:** TASK049
