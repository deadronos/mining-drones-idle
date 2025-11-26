# DES036 – Rust Simulation Completion & Alignment

## Summary

This design addresses the remaining work to complete the Rust simulation port, focusing on critical fixes, TypeScript bridge implementation, store integration, and comprehensive parity testing. It builds upon DES033 (core scaffolding), DES034 (systems), and DES035 (integration) to bring the migration to production readiness.

## Status: In Progress

**Current Completion:** ~60%

- ✅ Steps 1-3 (Schema, Binary Layout, Systems) – Complete
- ✅ Step 4 (WASM wrapper) – Complete
- 🔸 Step 4 (TS bridge) – Partial
- ⚠️ Step 5 (Store refactor) – Not started
- 🔸 Step 6 (Parity tests) – RNG only

## Requirements (EARS)

### Critical Fixes

- **RQ-081** – The Rust crate SHALL compile with a valid edition (`"2021"`) [BLOCKER].
- **RQ-082** – The `GameState::step()` method SHOULD minimize unsafe code through safer slice abstractions.

### TypeScript Bridge

- **RQ-083** – WHEN the application initializes, the system SHALL load the WASM module and create typed-array views from `EntityBufferLayout`.
- **RQ-084** – The TS bridge SHALL expose `initWorld`, `step`, `applyCommand`, `exportSnapshot`, and `simulateOffline` functions.
- **RQ-085** – The TS bridge SHALL handle WASM loading failures gracefully, falling back to TypeScript ECS.

### Store Integration

- **RQ-086** – WHEN `useRustSim` is enabled, the Zustand store SHALL treat Rust `GameState` as the authoritative source for simulation state.
- **RQ-087** – The system SHALL route all simulation-affecting actions through `applyCommand` when Rust is authoritative.
- **RQ-088** – UI-only state (selections, panel visibility, debug toggles) SHALL remain TypeScript-owned regardless of `useRustSim`.

### Command Expansion

- **RQ-089** – `SimulationCommand` SHALL support: `BuyModule`, `DoPrestige`, `PurchaseFactoryUpgrade`, `AssignHauler`, `ImportPayload`.

### Parity Testing

- **RQ-090** – The system SHALL verify RNG parity: same seed produces identical sequences in TS and Rust.
- **RQ-091** – The system SHALL verify step parity: identical snapshots + N steps produce matching economic outcomes (within epsilon).
- **RQ-092** – The system SHALL verify offline parity: `simulateOffline(seconds, step)` produces matching telemetry.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        React/R3F Layer                          │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌──────────────┐ │
│  │ HUD/UI   │  │ Renderers │  │ Selectors  │  │ Debug Panel  │ │
│  └────┬─────┘  └─────┬─────┘  └─────┬──────┘  └──────┬───────┘ │
│       │              │              │                │          │
│       └──────────────┴──────────────┴────────────────┘          │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │ useSimulationData │ (abstraction hook)     │
│                    └─────────┬─────────┘                        │
└──────────────────────────────┼──────────────────────────────────┘
                               │
            ┌──────────────────┴───────────────────┐
            │         Feature Flag Router          │
            │         useRustSim: boolean          │
            └──────────────────┬───────────────────┘
                    ┌──────────┴──────────┐
                    ▼                     ▼
    ┌───────────────────────┐ ┌───────────────────────────┐
    │   TypeScript ECS      │ │   Rust/WASM Bridge        │
    │   (Miniplex/Zustand)  │ │   (wasmSimBridge.ts)      │
    │   [Legacy/Fallback]   │ │   [Primary when enabled]  │
    └───────────────────────┘ └─────────────┬─────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │   WebAssembly.Memory      │
                              │   (Typed Array Views)     │
                              └─────────────┬─────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │   rust-engine.wasm        │
                              │   (GameState + Systems)   │
                              └───────────────────────────┘
```

### TypeScript Bridge (`src/lib/wasmSimBridge.ts`)

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

### Store Integration Pattern

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

## Implementation Plan

### Phase 1: Critical Fixes (Blocking)

| Task | File                     | Description                                                |
| ---- | ------------------------ | ---------------------------------------------------------- |
| 1.1  | `rust-engine/Cargo.toml` | Change `edition = "2024"` to `edition = "2021"`            |
| 1.2  | `rust-engine/src/api.rs` | Extract unsafe slice operations into safe helper functions |
| 1.3  | N/A                      | Verify WASM compilation with `wasm-pack build`             |

### Phase 2: TypeScript Bridge

| Task | File                             | Description                                       |
| ---- | -------------------------------- | ------------------------------------------------- |
| 2.1  | `src/lib/wasmSimBridge.ts`       | Implement `RustSimBridge` interface               |
| 2.2  | `src/lib/wasmSimBridge.ts`       | Add WASM module loading with error handling       |
| 2.3  | `src/lib/wasmSimBridge.ts`       | Create typed-array view factories from layout     |
| 2.4  | `src/hooks/useSimulationData.ts` | Abstraction hook to select TS vs Rust data source |
| 2.5  | `src/App.tsx`                    | Wire WASM initialization on mount                 |

### Phase 3: Command Expansion

| Task | File                       | Description                                |
| ---- | -------------------------- | ------------------------------------------ |
| 3.1  | `rust-engine/src/api.rs`   | Expand `SimulationCommand` enum            |
| 3.2  | `rust-engine/src/api.rs`   | Implement `BuyModule` command handler      |
| 3.3  | `rust-engine/src/api.rs`   | Implement `DoPrestige` command handler     |
| 3.4  | `rust-engine/src/api.rs`   | Implement `PurchaseFactoryUpgrade` handler |
| 3.5  | `src/lib/wasmSimBridge.ts` | Add TS types for new commands              |

### Phase 4: Store Integration

| Task | File                     | Description                              |
| ---- | ------------------------ | ---------------------------------------- |
| 4.1  | `src/state/store.ts`     | Add `useRustSim` feature flag            |
| 4.2  | `src/state/store.ts`     | Add `rustBridge` reference to store      |
| 4.3  | `src/state/store.ts`     | Refactor actions to route through bridge |
| 4.4  | `src/state/selectors.ts` | Update selectors to use abstraction hook |
| 4.5  | `src/ui/DebugPanel.tsx`  | Add toggle for `useRustSim`              |

### Phase 5: Parity Testing

| Task | File                                | Description                        |
| ---- | ----------------------------------- | ---------------------------------- |
| 5.1  | `tests/unit/rng-parity.test.ts`     | Cross-validate RNG sequences       |
| 5.2  | `tests/unit/step-parity.test.ts`    | Compare N-step economic outcomes   |
| 5.3  | `tests/unit/offline-parity.test.ts` | Compare offline simulation results |
| 5.4  | `tests/e2e/shadow-mode.spec.ts`     | E2E test running both engines      |

### Phase 6: Rendering Integration

| Task | File                           | Description                              |
| ---- | ------------------------------ | ---------------------------------------- |
| 6.1  | `src/r3f/DroneRenderer.tsx`    | Read positions from bridge when enabled  |
| 6.2  | `src/r3f/AsteroidRenderer.tsx` | Read positions from bridge when enabled  |
| 6.3  | `src/r3f/FactoryRenderer.tsx`  | Read positions from bridge when enabled  |
| 6.4  | `src/ui/HUD.tsx`               | Read aggregates from bridge when enabled |

## Data Models

### Expanded SimulationCommand (Rust)

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

### TickResult Extension

```rust
pub struct TickResult {
    pub dt: f32,
    pub game_time: f32,
    pub rng_sample: f32,
    // New fields for parity checking
    pub total_ore_mined: f32,
    pub total_energy_consumed: f32,
    pub active_drone_count: u32,
}
```

## Error Handling

### WASM Loading Failures

```typescript
async function initRustBridge(): Promise<RustSimBridge | null> {
  try {
    const wasm = await import('../pkg/rust_engine');
    // ... initialization
    return bridge;
  } catch (err) {
    console.error('WASM failed to load, falling back to TS:', err);
    return null; // Caller uses TS ECS
  }
}
```

### Graceful Degradation

- If WASM fails: Log error, disable `useRustSim`, continue with TS ECS
- If parity check fails: Log divergence metrics, optionally auto-correct by re-syncing from TS snapshot
- If command fails: Return error to UI, do not corrupt state

## Testing Strategy

### Unit Tests

| Test               | Tolerance | Frequency       |
| ------------------ | --------- | --------------- |
| RNG sequence match | Exact     | Per-sample      |
| Resource totals    | ε = 0.01  | Per-frame       |
| Drone positions    | ε = 0.1   | Every 60 frames |
| Offline catch-up   | ε = 1%    | Per-test        |

### Integration Tests

1. Load game → Initialize Rust → Run 1000 frames → Compare snapshots
2. Shadow mode → Run both engines → Log divergences → Assert < threshold
3. WASM failure → Verify fallback to TS ECS works

### Performance Benchmarks

- Measure `step(dt)` time for both TS and Rust at 100/500/1000 drones
- Target: Rust ≤ 50% of TS time for equivalent workload
- Shadow mode overhead: < 2x single-engine time

## Risks & Mitigations

| Risk                       | Likelihood | Impact | Mitigation                                               |
| -------------------------- | ---------- | ------ | -------------------------------------------------------- |
| WASM bundle size too large | Medium     | Medium | Use `wasm-opt -O3`, consider streaming compilation       |
| Floating-point divergence  | High       | Low    | Use epsilon comparisons, document precision expectations |
| Memory leak in bridge      | Medium     | High   | Implement `dispose()`, test with long sessions           |
| Browser WASM support       | Low        | High   | Feature detect, provide clear error message              |

## Open Questions

1. **Snapshot versioning**: How to handle Rust snapshot format changes across game updates?
   - _Proposed_: Add `schemaVersion` field, implement migration in `load_snapshot_str`

2. **Command ordering**: If user spams commands, how to ensure deterministic ordering?
   - _Proposed_: Queue commands in TS, flush in order to Rust each frame

3. **Hot reload**: Can we reload WASM without losing game state?
   - _Proposed_: Export snapshot before reload, re-init after

## Success Criteria

- [ ] Rust crate compiles with `cargo build --features wasm`
- [ ] WASM bundle loads in browser without errors
- [ ] `useRustSim` toggle switches simulation source
- [ ] Parity tests pass for RNG, step, and offline simulation
- [ ] No performance regression (target: ≥2x speedup for large drone counts)
- [ ] Fallback to TS ECS works when WASM unavailable

## References

- DES033 – Rust Simulation Core & WASM Bridge
- DES034 – Rust Simulation Systems
- DES035 – Rust Integration & Parity Verification
- `plan/plan-rust-simulation.md` – Original migration plan
