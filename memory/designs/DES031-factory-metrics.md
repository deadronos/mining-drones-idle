---

id: DES031
title: Factory Metrics (Factory Dashboards & Mini-Charts)
status: In Progress
added: 2025-10-29
authors:

- agent

# Factory Metrics (Factory Dashboards & Mini-Charts)

## Summary

Add lightweight per-factory visual analytics: interactive mini-charts that display
ore-in (per-minute), bars-produced (per-minute), energy usage (energy/sec), and
hauler throughput (items/min). Expose as a dedicated "Metrics" tab on the factory
detail panel and as compact sparklines inline on factory list cards. Metrics are
short-lived client-side time-series for debugging and player visibility to quickly
identify bottlenecks.

## Motivation

Players currently have limited visibility into short-term factory behavior. Small
charts help diagnose bottlenecks (storage full, idle energy, transport gaps) and
improve satisfaction by providing actionable data without heavy UI or
performance costs.

## Requirements (EARS-style)

- WHEN the player opens a factory's details, THE SYSTEM SHALL display a Metrics tab
  with sparklines for configured metrics (Acceptance: open factory -> metrics tab shows 3 lines).
- WHEN the game runs, THE SYSTEM SHALL sample selected factory metrics at the configured
  interval and store up to the configured retention window in memory (Acceptance: sampling at 5s produces ~60 samples for 5min).
- WHEN the player toggles performanceProfile to 'low', THE SYSTEM MAY reduce sampling frequency or hide metrics to preserve CPU (Acceptance: low profile -> sampling interval >=15s).
- WHEN a factory is removed, THE SYSTEM SHALL free its metric buffers to avoid leaks (Acceptance: no retained memory for removed factories).

## Scope & Out-of-scope

In-scope:

- Ore-in rate (delta ore stored per interval), bars-produced per interval, hauler transfers (items moved per interval), energy usage sample.
- UI components: `src/ui/FactoryMetrics.tsx`, metrics tab in `src/ui/FactoryPanel.tsx`, inline sparklines in factory list cards.
- Short-lived in-memory time-series, stored within store or in a derived in-memory cache.

Out-of-scope:

- Long-term historical analytics, persisted time-series, heavy chart libraries with interactive zoom (can be future work).
- Market/trending analytics or cross-factory aggregated dashboards (future feature).

## Data model

- MetricSample: { ts: number, value: number }
- Per-factory Buffer: Circular buffer / fixed-length array of MetricSample with capacity = ceil(retentionSeconds / samplingInterval).
- Default samplingInterval: 5 seconds (configurable in settings).
- Default retentionSeconds: 300 (5 minutes).

Storage options:

- Option A (recommended): Keep buffers in an in-memory Map keyed by factoryId within a new `metrics` field in the running Store (not persisted). This allows components to subscribe to store and render.
- Option B: Keep buffers outside persistent store in a transient in-memory cache (module-level Map) and expose read methods. Slightly simpler for save/load.

Recommendation: Option A with `store.settings.performanceProfile` gating to disable or throttle sampling.

## Architecture Overview

- **Metrics runtime slice** — non-serialized store segment `{ buffers: Record<FactoryId, MetricsBuffer>, lastSnapshots: Record<FactoryId, FactorySnapshotLite>, config: { intervalMs, retentionMs, enabled } }`. Clears on reset/import.
- **Sampling driver** — `collectFactoryMetrics(state, dt)` orchestrated from `processFactories` tick and a `metricsAccumulator` timer. Tracks elapsed time and samples once `intervalMs` is reached (respecting performance profile overrides).
- **Logistics integration** — `recordHaulerThroughput(factoryId, delta)` invoked from logistics arrival handling to accumulate per-interval transfer counts consumed by the next sample.
- **UI consumption** — selector hooks (`useFactoryMetrics(factoryId)`) feed `FactoryMetricsTab` and inline sparkline components. Rendering uses lightweight SVG paths (no third-party chart libs).
- **Settings bridge** — extends `StoreSettings` with `metrics: { enabled: boolean; intervalSeconds: number; retentionSeconds: number }`, normalized with defaults and performance-profile gating.

## Data Flow

1. `tick(dt)` adds to a metrics accumulator. If metrics disabled, accumulator resets and no buffers mutate.
2. When accumulator ≥ active interval, `collectFactoryMetrics` iterates factories:
   - Pulls latest factory state (ore, bars, energy, active refines, haulers).
   - Diffs against `lastSnapshots` to compute ore delta, bar delta, energy delta, and consumes any pending `haulerDelta` recorded since previous sample.
   - Pushes structured sample into the per-factory circular buffer, trimming overflow.
   - Stores current snapshot for next iteration.
3. Logistics processing calls `metrics.recordHaulerTransfer(factoryId, amount)` whenever a factory completes an inbound/outbound transfer. The metrics module aggregates totals until the next sampling tick, then resets the accumulator.
4. UI components subscribe to `buffers[factoryId]` and re-render sparklines via memoized selectors. Last value, average, and extrema are derived on read to keep buffers write-only.
5. When factories are removed/reset, metrics slice deletes the associated buffer and snapshot entries; imports/reset clear entire slice.

## Interfaces & Contracts

```ts
interface MetricSample {
  ts: number; // epoch ms
  value: number;
}

interface MetricsSeries {
  id: 'oreIn' | 'barsOut' | 'energy' | 'hauler';
  unit: 'ore/min' | 'bars/min' | 'energy/sec' | 'items/min';
  buffer: MetricSample[];
}

interface FactoryMetricsState {
  buffers: Record<string, Record<MetricsSeries['id'], MetricSample[]>>;
  lastSnapshots: Record<
    string,
    {
      ore: number;
      bars: number;
      energy: number;
      timestamp: number;
    }
  >;
  pendingHauler: Record<string, number>;
  accumulatorMs: number;
  intervalMs: number;
  retentionMs: number;
  enabled: boolean;
}

type MetricsMode = 'enabled' | 'throttled' | 'disabled';

function collectFactoryMetrics(
  state: StoreState,
  dt: number,
): FactoryMetricsState;
function recordHaulerTransfer(
  factoryId: string,
  amount: number,
  direction: 'in' | 'out',
): void;
function clearFactoryMetrics(factoryId: string): void;
```

## Error Handling Matrix

| Scenario                                     | Detection                               | Mitigation                                                                              |
| -------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Metrics disabled via settings                | `enabled === false`                     | Skip sampling, reset accumulator, zero pending hauler deltas                            |
| Performance profile set to low               | `settings.performanceProfile === 'low'` | Force `intervalMs = max(intervalMs, 15000)` and reduce retention to 60s to bound memory |
| Factory removed mid-sampling                 | Buffer lookup returns undefined         | Treat as no-op; ensure `clearFactoryMetrics` invoked by slice before next sample        |
| Hauler transfer recorded for unknown factory | Metrics map lacks entry                 | Lazily initialize pending counter but skip buffer write until factory exists            |
| Import/reset applied                         | `applySnapshot` or `resetGame` invoked  | Recreate metrics state defaults and drop all buffers to release memory                  |

## Unit Testing Strategy

- **Buffer helper tests**: Validate that pushes respect capacity, oldest samples rotate out, and timestamps remain monotonic.
- **Sampling cadence test**: Stub store state, advance time across multiple intervals, and ensure ore/bar/energy deltas reflect simulated changes; verify accumulator resets exactly once per interval.
- **Performance profile gate test**: Flip settings to `low` and confirm sampling occurs at ≥15s cadence and buffers stop growing when metrics disabled.
- **Hauler throughput accumulation test**: Simulate logistics completions calling `recordHaulerTransfer`, then run sampling and assert items/min computed from aggregated amount and interval duration.
- **Lifecycle cleanup test**: Remove a factory and ensure buffers/pending counters clear; run `resetGame` to verify metrics state returns to defaults with empty maps.

## Sampling & computation

- At each sampling tick (driven by existing game loop / UI tick):
  - Capture a snapshot per factory: current `resources.ore`, `resources.bars`, `haulersAssigned`, `activeRefines.length`, `energy`.
  - Compute delta from previous snapshot for oreIn (negative if ore removed), barsProduced (delta bars), haulerThroughput (sum of completed pendingTransfers for factory since last sample or track number of hauler pickups/drops).
  - Append sample to buffer; if buffer length exceeds capacity, drop oldest.

Where to hook:

- Lightweight sampling can be done in UI render loop (React effect with interval) or in `gameProcessing` which already runs per dt. Prefer to compute deltas in `gameProcessing` and push to metrics buffers to avoid missing fast changes.

## UI: Components & placement

- `src/ui/FactoryMetricsTab.tsx` — renders four sparklines (ore intake, bars output, energy usage, hauler throughput) with summary stats, sampling banner, and pause toggle. Uses plain SVG helpers to avoid heavy chart libs.
- `src/ui/FactoryManager/index.tsx` — wires the tab into the factory manager tabset; metrics tab is enabled when settings permit sampling.
- Inline sparklines:
  - `src/ui/FactoryMetricsInline.tsx` renders a compact bars-output sparkline embedded within factory cards and hides automatically when metrics disabled or empty.
- Settings panel (`src/ui/Settings.tsx`) exposes metrics enable toggle plus interval and retention numeric inputs so players can tune sampling cost without opening the factory panel.

Colors and theme:

- Use existing `src/r3f/resourceColors.ts` mapping for ore/bars/energy color hints.

Accessibility:

- Provide aria labels for each chart and numeric values; keyboard focus shows tooltip with last N samples.

## Implementation steps (high-level todo)

- Decide storage approach: in-store `metrics` vs external Map. (Prefer in-store with minimal payload.)
- Add types for MetricSample and MetricsBuffer in `src/state/types.ts`.
- Implement sampling logic:
  - Option 1: extend `tick` in `src/state/processing/gameProcessing.ts` to call `collectFactoryMetrics(state, dt)` and update store metrics.
  - Option 2: create new `src/state/processing/metricsProcessing.ts` and hook from `tick`.
- Implement buffer management utility in `src/state/utils.ts` (circular buffer helper).
- Add UI components:
  - `src/ui/FactoryMetrics.tsx` (main tab)
  - `src/ui/FactoryMetricsInline.tsx` (compact sparkline)
  - Hook components into `src/ui/FactoryPanel.tsx` by adding new tab and rendering the component.
- Add settings toggle in `src/state/slices/settingsSlice.ts` to expose `metrics.samplingInterval` and `metrics.enabled`. ✅ Implemented via Settings panel controls and settings normalization.
- Add tests:
  - Unit tests for buffer logic (`tests/unit/metricsBuffer.spec.ts`) and sampling cadence (`tests/unit/metricsSampling.spec.ts`).
  - UI test verifying banner actions and card rendering (`tests/unit/FactoryMetricsTab.spec.tsx`).
- Ensure cleanup: when factory removed, clear its buffer.
- Performance checks: add guard to skip sampling when `performanceProfile === 'low'` (or use larger intervals).
- Documentation: update `memory/designs/_index.md` and `memory/progress.md` when implemented.

## Files to change / add

- Modify: `memory/designs/DES031-factory-metrics.md` (this document)
- Add: `src/state/metrics/buffers.ts` (circular buffer helpers and helpers)
- Add: `src/state/metrics/index.ts` (exports + recordHaulerTransfer/collectFactoryMetrics API)
- Modify: `src/state/types.ts` (Metric types + settings extension)
- Modify: `src/state/slices/settingsSlice.ts` (metrics defaults & toggles)
- Modify: `src/state/slices/factorySlice.ts` (clear metrics on remove)
- Modify: `src/state/store.ts` (wire metrics slice defaults + reset/import cleanup)
- Modify: `src/state/processing/gameProcessing.ts` (invoke metrics sampler)
- Modify: `src/state/processing/logisticsProcessing.ts` (emit throughput deltas)
- Add: `src/ui/FactoryMetricsTab.tsx` (new main tab component)
- Add: `src/ui/FactoryMetricsInline.tsx` (inline sparkline component)
- Modify: `src/ui/FactoryManager/index.tsx` (add Metrics tab + inline sparkline usage)
- Add: `tests/unit/metricsBuffer.spec.ts` (buffer tests)
- Add: `tests/unit/metricsSampling.spec.ts` (sampling cadence / cleanup)

## Acceptance Criteria

1. Metrics tab visible for a factory and shows 3 sparklines with recent data.
2. Sampling interval and retention default to 5s/5min and produce visible pattern during play.
3. Low performance profile disables or throttles sampling.
4. No memory leaks when adding/removing factories.

## Rollout plan

- Phase 1 (fast): Implement in-memory sampling + sparklines + inline sparkline; no settings, default 5s/5min.
- Phase 2 (polish): Add settings, performance-profile gating, tests, and tooltips.
- Phase 3 (optional): Add persisted historical charts and aggregated dashboards.
