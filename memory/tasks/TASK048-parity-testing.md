# [TASK048] - Parity Testing Suite

**Status:** Pending  
**Added:** 2025-11-26  
**Updated:** 2025-11-26  
**Design:** DES036-rust-completion-alignment.md (Phase 5)

## Original Request

Create comprehensive parity tests to verify that the Rust and TypeScript simulations produce identical results for RNG sequences, economic outcomes, and offline catch-up calculations.

## Requirements

- **RQ-090** – The system SHALL verify RNG parity: same seed produces identical sequences in TS and Rust.
- **RQ-091** – The system SHALL verify step parity: identical snapshots + N steps produce matching economic outcomes (within epsilon).
- **RQ-092** – The system SHALL verify offline parity: `simulateOffline(seconds, step)` produces matching telemetry.

## Thought Process

Parity testing is critical to ensure the Rust engine produces identical gameplay to the TypeScript engine. This includes:

1. RNG sequences must match exactly (same seed → same numbers)
2. Economic outcomes (resources, production) must match within epsilon
3. Offline catch-up must produce equivalent results
4. E2E shadow mode can run both engines and compare

## Implementation Plan

- [ ] 5.1 Create `tests/unit/rng-parity.test.ts` - Cross-validate RNG sequences
- [ ] 5.2 Create `tests/unit/step-parity.test.ts` - Compare N-step economic outcomes
- [ ] 5.3 Create `tests/unit/offline-parity.test.ts` - Compare offline simulation results
- [ ] 5.4 Create `tests/e2e/shadow-mode.spec.ts` - E2E test running both engines

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID  | Description          | Status      | Updated | Notes |
| --- | -------------------- | ----------- | ------- | ----- |
| 5.1 | RNG parity test      | Not Started |         |       |
| 5.2 | Step parity test     | Not Started |         |       |
| 5.3 | Offline parity test  | Not Started |         |       |
| 5.4 | E2E shadow mode test | Not Started |         |       |

## Testing Tolerances

| Test               | Tolerance | Frequency       |
| ------------------ | --------- | --------------- |
| RNG sequence match | Exact     | Per-sample      |
| Resource totals    | ε = 0.01  | Per-frame       |
| Drone positions    | ε = 0.1   | Every 60 frames |
| Offline catch-up   | ε = 1%    | Per-test        |

## Integration Test Scenarios

1. Load game → Initialize Rust → Run 1000 frames → Compare snapshots
2. Shadow mode → Run both engines → Log divergences → Assert < threshold
3. WASM failure → Verify fallback to TS ECS works

## Performance Benchmarks

- Measure `step(dt)` time for both TS and Rust at 100/500/1000 drones
- Target: Rust ≤ 50% of TS time for equivalent workload
- Shadow mode overhead: < 2x single-engine time

## Progress Log

### 2025-11-26

- Task created from DES036 Phase 5
- Depends on TASK045 (bridge) and TASK046 (commands)
- RNG parity test may already exist from previous work

## Dependencies

- **Depends on:** TASK045, TASK046
