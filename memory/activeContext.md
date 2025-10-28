# Active Context

## Current Work

🚧 **TASK038 – Factory Metrics & Mini-Charts** is in progress.

- Runtime metrics infrastructure landed: metrics settings schema, buffer helpers, store slice wiring, factory sampling, and logistics throughput accumulation now operational.
- Metrics sampling honors performance profile gating (`low` stretches to ≥15s) and clears state on reset/import. Logistics now emits per-factory throughput totals consumed by the metrics slice.
- Upcoming focus: build Metrics tab UI, inline sparklines, and expose settings controls before polishing validation coverage.

🔭 **Open follow-ups**

- Implement `FactoryMetricsTab` UI and inline sparkline components with lightweight SVG rendering.
- Surface metrics enable/interval controls in Settings, including low-profile messaging.
- Expand Vitest coverage for buffer helpers and sampling cadence; add UI tests post-component implementation.

**Design Reference:** `/memory/designs/DES031-factory-metrics.md`

---

## Recent Completions

✅ **Completed: TASK037 – Hauler Ship Visuals** (for historical context)

- Animated hauler ships replaced transfer lines with instanced meshes, cubic Bezier motion, and hover tooltips.
- Persistent `showHaulerShips` toggle delivered across settings, serialization, and migrations with regression coverage.
- FX system now records `departedAt` timestamps for transfers to drive motion and metrics.

## Next Steps

1. Build Metrics UI surfaces (factory tab + inline sparkline) and wire selectors.
2. Add settings controls for metrics enable/interval with low-profile messaging.
3. Expand automated coverage for buffer helpers, sampling cadence, and throughput accumulation edge cases.
