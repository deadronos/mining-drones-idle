# [TASK049] - Rendering Integration

**Status:** Pending  
**Added:** 2025-11-26  
**Updated:** 2025-11-26  
**Design:** DES036-rust-completion-alignment.md (Phase 6)

## Original Request

Update the R3F renderers and HUD components to read entity data from the Rust WASM bridge when `useRustSim` is enabled, using the typed array buffers for efficient rendering.

## Requirements

This task implements the rendering layer integration described in DES036 Phase 6. When Rust simulation is enabled, renderers should read position and state data directly from WASM memory buffers rather than the Miniplex ECS.

## Thought Process

The rendering integration is the final piece that connects the Rust simulation to the visual output. By reading directly from typed array buffers, we avoid the overhead of copying data between WASM and JavaScript. The `useSimulationData` hook provides abstraction so renderers don't need to know which engine is active.

## Implementation Plan

- [ ] 6.1 Update `src/r3f/DroneRenderer.tsx` to read positions from bridge when enabled
- [ ] 6.2 Update `src/r3f/AsteroidRenderer.tsx` to read positions from bridge when enabled
- [ ] 6.3 Update `src/r3f/FactoryRenderer.tsx` to read positions from bridge when enabled
- [ ] 6.4 Update `src/ui/HUD.tsx` to read aggregates from bridge when enabled
- [ ] 6.5 Verify visual parity between TS and Rust rendering

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID  | Description                      | Status      | Updated | Notes |
| --- | -------------------------------- | ----------- | ------- | ----- |
| 6.1 | DroneRenderer bridge integration | Not Started |         |       |
| 6.2 | AsteroidRenderer integration     | Not Started |         |       |
| 6.3 | FactoryRenderer integration      | Not Started |         |       |
| 6.4 | HUD aggregates integration       | Not Started |         |       |
| 6.5 | Visual parity verification       | Not Started |         |       |

## Buffer Access Pattern

```typescript
// In DroneRenderer.tsx
const { getDronePositions, getDroneStates, isReady } = useRustBridge();
const useRustSim = useStore((s) => s.useRustSim);

// When Rust is enabled and ready
if (useRustSim && isReady()) {
  const positions = getDronePositions(); // Float32Array from WASM memory
  const states = getDroneStates(); // Float32Array from WASM memory
  // Use instanced rendering with typed arrays
}
```

## Progress Log

### 2025-11-26

- Task created from DES036 Phase 6
- Depends on TASK047 (store integration)
- Final task in the Rust integration chain

## Dependencies

- **Depends on:** TASK047

## Success Criteria

- Renderers correctly display entities when `useRustSim` is enabled
- No visual differences between TS and Rust simulation rendering
- Performance is equal or better with Rust engine
- Graceful handling when bridge is not ready
