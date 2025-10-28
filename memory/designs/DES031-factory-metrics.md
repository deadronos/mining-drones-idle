---

id: DES031
title: Factory Metrics (Factory Dashboards & Mini-Charts)
status: Draft
added: 2025-10-29
authors:

- agent

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

## Sampling & computation

- At each sampling tick (driven by existing game loop / UI tick):
  - Capture a snapshot per factory: current `resources.ore`, `resources.bars`, `haulersAssigned`, `activeRefines.length`, `energy`.
  - Compute delta from previous snapshot for oreIn (negative if ore removed), barsProduced (delta bars), haulerThroughput (sum of completed pendingTransfers for factory since last sample or track number of hauler pickups/drops).
  - Append sample to buffer; if buffer length exceeds capacity, drop oldest.

Where to hook:

- Lightweight sampling can be done in UI render loop (React effect with interval) or in `gameProcessing` which already runs per dt. Prefer to compute deltas in `gameProcessing` and push to metrics buffers to avoid missing fast changes.

## UI: Components & placement

- `src/ui/FactoryMetrics.tsx` — new component rendering 3 sparklines and a small legend and last sample numeric values. Minimal dependency: use plain SVG or lightweight sparkline helper; avoid heavy chart libs.
- `src/ui/FactoryPanel.tsx` — add a `Metrics` tab. Use existing tab infrastructure (if present) or add a new tab button. Metrics tab shows:
  - Row of 3 sparklines (ore-in, bars-produced, hauler throughput).
  - Small numeric summary: avg/min/max over window.
  - Optional toggles: sampling interval dropdown (5s/10s/30s) and a "pause metrics" toggle.
- Inline sparklines:
  - Add compact `FactoryMetricsInline.tsx` to be used in factory list rows/cards; single-line sparkline for barsProduced (or oreIn), with tooltip on hover.

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
- Add settings toggle in `src/state/slices/settingsSlice.ts` to expose `metrics.samplingInterval` and `metrics.enabled`.
- Add tests:
  - Unit test for buffer logic (`src/state/processing/metricsProcessing.test.ts`).
  - Integration test for sample deltas in `gameProcessing.test.ts`.
- Ensure cleanup: when factory removed, clear its buffer.
- Performance checks: add guard to skip sampling when `performanceProfile === 'low'` (or use larger intervals).
- Documentation: update `memory/designs/_index.md` and `memory/progress.md` when implemented.

## Files to change / add

- Add: `memory/designs/DES025-factory-metrics.md` (this file)
- Add: `src/ui/FactoryMetrics.tsx` (new)
- Add: `src/ui/FactoryMetricsInline.tsx` (new)
- Modify: `src/ui/FactoryPanel.tsx` (add tab)
- Modify: `src/state/types.ts` (Metric types)
- Modify: `src/state/processing/gameProcessing.ts` (hook sampling call) OR add new `src/state/processing/metricsProcessing.ts`
- Modify: `src/state/slices/settingsSlice.ts` (metrics settings)
- Add tests: `src/state/processing/metricsProcessing.test.ts`

## Acceptance Criteria

1. Metrics tab visible for a factory and shows 3 sparklines with recent data.
2. Sampling interval and retention default to 5s/5min and produce visible pattern during play.
3. Low performance profile disables or throttles sampling.
4. No memory leaks when adding/removing factories.

## Rollout plan

- Phase 1 (fast): Implement in-memory sampling + sparklines + inline sparkline; no settings, default 5s/5min.
- Phase 2 (polish): Add settings, performance-profile gating, tests, and tooltips.
- Phase 3 (optional): Add persisted historical charts and aggregated dashboards.
