# [TASK045] - TypeScript WASM Bridge Implementation

**Status:** Completed  
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

- [x] 2.1 Create `src/lib/wasmSimBridge.ts` with `RustSimBridge` interface
- [x] 2.2 Implement WASM module loading with error handling
- [x] 2.3 Create typed-array view factories from `EntityBufferLayout`
- [x] 2.4 Create `src/hooks/useSimulationData.ts` abstraction hook
- [x] 2.5 Wire WASM initialization in `src/App.tsx` on mount

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                       | Status   | Updated    | Notes                         |
| --- | --------------------------------- | -------- | ---------- | ----------------------------- |
| 2.1 | Implement RustSimBridge interface | Complete | 2025-11-26 | Full interface with lifecycle |
| 2.2 | WASM loading with error handling  | Complete | 2025-11-26 | wasmLoader.ts with fallback   |
| 2.3 | Typed-array view factories        | Complete | 2025-11-26 | All drone/asteroid/factory    |
| 2.4 | useSimulationData hook            | Complete | 2025-11-26 | Abstracts TS/Rust data source |
| 2.5 | App.tsx WASM initialization       | Complete | 2025-11-26 | Via Scene.tsx useRustEngine   |

## RustSimBridge Interface

```typescript
interface RustSimBridge {
  // Lifecycle
  init(snapshot: StoreSnapshot): Promise<void>;
  dispose(): void;
  isReady(): boolean;

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
  // ... all buffer accessors

  // Metadata
  getLayout(): EntityBufferLayout;
}
```

## Progress Log

### 2025-11-26

- Task created from DES036 Phase 2
- Depends on TASK044 (critical fixes)

### 2025-11-26 (Implementation)

- Extended `RustSimBridge` interface with full lifecycle methods:
  - `init()`, `dispose()`, `isReady()` for lifecycle
  - `step()` returns `TickResult` with dt, gameTime, rngSample
  - `applyCommand()` for simulation commands
  - `simulateOffline()` for offline catch-up
  - `exportSnapshot()`, `loadSnapshot()` for state persistence
- Updated buffer types to match Rust `buffers.rs`:
  - DroneBuffers: 14 sections (positions, velocities, states, cargo, battery, max_battery, capacity, mining_rate, cargo_profile, target indices, charging)
  - AsteroidBuffers: 4 sections (positions, ore_remaining, max_ore, resource_profile)
  - FactoryBuffers: 9 sections (positions, orientations, activity, resources, energy, max_energy, upgrades, refinery_state, haulers_assigned)
- Created `src/lib/wasmLoader.ts`:
  - Feature detects WebAssembly support
  - Dynamic imports WASM module
  - Returns fallback reason on failure
- Updated `src/hooks/useRustEngine.ts`:
  - Uses new wasmLoader
  - Provides `reinitialize()` method
  - Properly disposes bridge on unmount
  - Exports fallbackReason for UI feedback
- Created `src/hooks/useSimulationData.ts`:
  - Abstracts between Rust WASM and TS ECS data sources
  - Provides `getDrones()`, `getAsteroids()`, `getFactories()` methods
  - Automatically switches based on `useRustSim` flag
- All 245 tests pass
- TypeScript type check passes

## Dependencies

- **Depends on:** TASK044 ✅
- **Blocks:** TASK047, TASK048, TASK049

## Files Changed

- `src/lib/wasmSimBridge.ts` - Extended interface and implementation
- `src/lib/wasmLoader.ts` - New file for WASM loading with fallback
- `src/hooks/useRustEngine.ts` - Updated to use wasmLoader
- `src/hooks/useSimulationData.ts` - New abstraction hook
