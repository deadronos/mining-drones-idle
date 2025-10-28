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

High-level phases (small, testable commits):

1. Types & buffer helper (1 day)

- Add `MetricSample` and `MetricBuffer` types to `src/state/types.ts`.
- Implement a circular buffer helper `src/state/metrics.ts` with `push`, `toArray`, `clear`.
- Add a minimal `factoryMetrics` slice shape in the store (ephemeral map keyed by factoryId).

2. Sampling integration (1-2 days)

- Implement `collectFactoryMetrics(state, dt)` in `src/state/processing/metricsProcessing.ts`.
- Call `collectFactoryMetrics` from `src/state/processing/gameProcessing.ts` after factory processing; batch updates to store.
- Respect `settings.performanceProfile` (5s default, 15s low) and only sample when enabled.

3. UI components (2-3 days)

- Create `src/ui/FactoryMetrics.tsx` (interactive mini-charts using SVG). Use `resourceColors` for palette.
- Add `src/ui/FactoryMetricsInline.tsx` for compact sparklines in factory lists.
- Modify `src/ui/FactoryPanel.tsx` to add a lazy-mounted `Metrics` tab (ARIA-compliant tabs).

4. Inline wiring & cleanup (1 day)

- Ensure `factorySlice.removeFactory` calls `clearMetrics(factoryId)`.
- Add settings toggles (sampling interval or pause) in `settingsSlice` if time.

5. Tests & docs (1-2 days)

- Unit tests: circular buffer behavior.
- Integration test: simulated ticks produce expected delta samples (Vitest).
- Update `memory/designs/DES031-factory-metrics.md` and task index (done).

Total estimate: 6–9 dev-days depending on polish and UI interactions.

## Acceptance Criteria

1. Metrics tab visible for a factory and shows 4 interactive sparklines.
2. Sampling occurs at 5s intervals by default; buffer retains ~60 samples.
3. `performanceProfile: low` throttles sampling to 15s or disables it.
4. No retained buffers for removed factories.

## Files to change / add

- Add: `src/state/metrics.ts` (circular buffer + slice helpers).
- Modify: `src/state/types.ts` (metric types).
- Modify: `src/state/processing/gameProcessing.ts` (call `collectFactoryMetrics`).
- Add: `src/state/processing/metricsProcessing.ts` (sampling logic).
- Add: `src/ui/FactoryMetrics.tsx`, `src/ui/FactoryMetricsInline.tsx`.
- Modify: `src/ui/FactoryPanel.tsx` (add Metrics tab).
- Modify: `src/state/slices/settingsSlice.ts` (optional sampling settings).
- Tests: `tests/unit/circularBuffer.spec.ts`, `tests/unit/metricsSampling.spec.ts`.

## Progress Log

2025-10-29: Task created and moved to In Progress. Design and task files added to memory.
