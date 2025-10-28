# TASK038 - Factory Metrics & Mini-Charts

**Status:** In Progress  
**Added:** 2025-10-29  
**Updated:** 2025-10-29

## Original Request

Add per-factory visual analytics: time-series sparklines for ore-in, bars-produced,
energy usage, and hauler throughput. Present as a `Metrics` tab on each factory
detail panel and as compact inline sparklines in factory lists. Sampling interval
defaults to 5s and retention to 5 minutes. Performance profile 'low' throttles or
disables sampling.

## Thought Process

Lightweight charts help players identify immediate bottlenecks without adding
heavy storage or persistence concerns. Sampling should be authoritative (driven
by the game tick) to avoid browser throttling misalignment. Keeping data
ephemeral simplifies save/restore concerns and avoids long-term memory growth.

## Implementation Plan

Phased approach with granular subtasks (tracked below):

1. **Runtime data plumbing**
   - Extend `StoreSettings` with `metrics` block (enabled, intervalSeconds, retentionSeconds).
   - Introduce ephemeral metrics slice (`buffers`, `lastSnapshots`, `pendingHauler`, `accumulatorMs`).
   - Build circular buffer helpers (`appendSample`, `trimToRetention`).

2. **Sampling & logistics integration**
   - Implement `collectFactoryMetrics` invoked from `processFactories` tick.
   - Gate cadence by `performanceProfile` (`low` ≥ 15s) and metrics toggle.
   - Hook logistics arrivals to `recordHaulerTransfer` for throughput accumulation.

3. **UI surface**
   - Factory Metrics tab with three sparklines + stats summary + pause toggle.
   - Inline sparkline component for factory list rows/cards.
   - Tab wiring & metrics toggle controls inside Factory Manager.

4. **Lifecycle & configuration cleanup**
   - Clear buffers on factory removal, snapshot import, and reset.
   - Persist settings normalization defaults; ensure low profile auto-throttles interval & retention.

5. **Validation**
   - Vitest coverage for buffer rotation, sampling cadence, throughput accumulation, and cleanup.
   - React unit test verifying Metrics tab renders expected series and number summaries.

### Subtasks

| ID  | Description                                         | Status      | Updated    | Notes                                                                   |
| --- | --------------------------------------------------- | ----------- | ---------- | ----------------------------------------------------------------------- |
| 1.1 | Define metrics types and settings schema            | Completed   | 2025-10-29 | Types + settings normalization landed in `types.ts` and serialization.  |
| 1.2 | Implement metrics buffer utilities                  | Completed   | 2025-10-29 | `src/state/metrics/buffers.ts` created with tests pending.              |
| 1.3 | Add metrics slice to store + reset/backfill hooks   | Completed   | 2025-10-29 | Metrics state initialized/reset on snapshot/reset/import.               |
| 2.1 | Create sampling driver (collectFactoryMetrics)      | Completed   | 2025-10-29 | Sampling wired via `processFactories` with performance gating.          |
| 2.2 | Wire logistics throughput accumulation              | Completed   | 2025-10-29 | Logistics returns per-factory throughput map consumed by metrics slice. |
| 3.1 | Build Factory Metrics tab UI (sparklines + stats)   | Not Started | —          |                                                                         |
| 3.2 | Add inline sparkline to factory list cards          | Not Started | —          |                                                                         |
| 3.3 | Expose metrics toggle/interval controls in settings | Not Started | —          |                                                                         |
| 4.1 | Cleanup buffers on factory removal/reset/import     | Completed   | 2025-10-29 | Metrics cleared on reset/import and per-factory removal helpers ready.  |
| 5.1 | Add unit tests for buffers & sampling cadence       | Not Started | —          |                                                                         |
| 5.2 | Add UI test for Metrics tab render                  | Not Started | —          |                                                                         |

## Acceptance Criteria

1. Metrics tab visible for a factory and shows 4 interactive sparklines.
2. Sampling occurs at 5s intervals by default; buffer retains ~60 samples.
3. `performanceProfile: low` throttles sampling to 15s or disables it.
4. No retained buffers for removed factories.

Total estimate: 6–9 dev-days depending on polish and UI interactions.

## Files to change / add

- Modify: `memory/designs/DES031-factory-metrics.md` (keep design in sync)
- Add: `src/state/metrics/buffers.ts`
- Add: `src/state/metrics/index.ts`
- Modify: `src/state/types.ts`
- Modify: `src/state/slices/settingsSlice.ts`
- Modify: `src/state/slices/factorySlice.ts`
- Modify: `src/state/store.ts`
- Modify: `src/state/processing/gameProcessing.ts`
- Modify: `src/state/processing/logisticsProcessing.ts`
- Add: `src/ui/FactoryMetricsTab.tsx`
- Add: `src/ui/FactoryMetricsInline.tsx`
- Modify: `src/ui/FactoryManager/index.tsx`
- Add: `tests/unit/metricsBuffer.spec.ts`
- Add: `tests/unit/metricsSampling.spec.ts`

## Progress Log

2025-10-29: Task created and moved to In Progress. Design and task files added to memory.
2025-10-29: Updated design DES031 with architecture, interfaces, error handling matrix, and unit testing strategy; added RQ-063–RQ-066 requirements.
2025-10-29: Implemented runtime metrics plumbing — types, buffer helpers, metrics slice wiring, factory sampling, and logistics throughput accumulation with passing Vitest suite.
