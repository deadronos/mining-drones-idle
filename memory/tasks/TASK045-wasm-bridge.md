# [TASK045] - TypeScript WASM Bridge Implementation

**Status:** Pending  
**Added:** 2025-11-26  
**Updated:** 2025-11-26  
**Design:** DES036-rust-completion-alignment.md (Phase 2)

## Original Request

Implement the TypeScript bridge layer that loads and communicates with the Rust WASM module, including graceful fallback to TypeScript ECS when WASM is unavailable.

## Requirements

- **RQ-083** – WHEN the application initializes, the system SHALL load the WASM module and create typed-array views from `EntityBufferLayout`.
- **RQ-084** – The TS bridge SHALL expose `initWorld`, `step`, `applyCommand`, `exportSnapshot`, and `simulateOffline` functions.
- **RQ-085** – The TS bridge SHALL handle WASM loading failures gracefully, falling back to TypeScript ECS.

## Thought Process

The bridge serves as the abstraction layer between React/Zustand and the Rust simulation. It needs to:

1. Load WASM module asynchronously with error handling
2. Create typed array views for efficient data access
3. Expose a clean API matching `RustSimBridge` interface
4. Provide graceful degradation when WASM unavailable

## Implementation Plan

- [ ] 2.1 Create `src/lib/wasmSimBridge.ts` with `RustSimBridge` interface
- [ ] 2.2 Implement WASM module loading with error handling
- [ ] 2.3 Create typed-array view factories from `EntityBufferLayout`
- [ ] 2.4 Create `src/hooks/useSimulationData.ts` abstraction hook
- [ ] 2.5 Wire WASM initialization in `src/App.tsx` on mount

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID  | Description                       | Status      | Updated | Notes |
| --- | --------------------------------- | ----------- | ------- | ----- |
| 2.1 | Implement RustSimBridge interface | Not Started |         |       |
| 2.2 | WASM loading with error handling  | Not Started |         |       |
| 2.3 | Typed-array view factories        | Not Started |         |       |
| 2.4 | useSimulationData hook            | Not Started |         |       |
| 2.5 | App.tsx WASM initialization       | Not Started |         |       |

## RustSimBridge Interface

```typescript
interface RustSimBridge {
  // Lifecycle
  init(snapshot: StoreSnapshot): Promise<void>;
  dispose(): void;

  // Simulation
  step(dt: number): TickResult;
  applyCommand(cmd: SimulationCommand): void;
  simulateOffline(seconds: number, stepSize: number): OfflineResult;

  // Snapshots
  exportSnapshot(): StoreSnapshot;
  loadSnapshot(snapshot: StoreSnapshot): void;

  // Buffer Access (for rendering)
  getDronePositions(): Float32Array;
  getDroneStates(): Float32Array;
  getAsteroidPositions(): Float32Array;
  getFactoryPositions(): Float32Array;

  // Metadata
  getLayout(): EntityBufferLayout;
  isReady(): boolean;
}
```

## Progress Log

### 2025-11-26

- Task created from DES036 Phase 2
- Depends on TASK044 (critical fixes)

## Dependencies

- **Depends on:** TASK044
- **Blocks:** TASK047, TASK048, TASK049
