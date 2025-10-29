# Active Context

## Current Work

- 🚧 **TASK038 – Factory Metrics & Mini-Charts** is in progress.
  - Factory Metrics tab now renders four sparklines with summary stats, sampling banner, and pause control.
  - Inline sparkline component ships on factory cards and hides when sampling disabled or empty.
  - Settings panel exposes metrics toggle, interval, and retention inputs; metrics helpers covered by new unit tests.
  - Sparklines now include descriptive titles/ARIA wiring and inline component gains narrated labels with dedicated Vitest coverage.
  - Metrics banner now surfaces the most recent sampling time so players can relate charts to gameplay moments.

🔭 **Open follow-ups**

- Extend coverage to integration/e2e flows and ensure throttled profile messaging surfaces in low-profile runs.
- Profile rendering cost of sparklines under large factory counts; add guardrails if necessary.
- Evaluate whether to surface sampling status/recency cues beyond the inspector (e.g., HUD toast) for better visibility.

**Design Reference:** `/memory/designs/DES031-factory-metrics.md`

---

## Recent Completions

✅ **Completed: TASK037 – Hauler Ship Visuals** (for historical context)

- Animated hauler ships replaced transfer lines with instanced meshes, cubic Bezier motion, and hover tooltips.
- Persistent `showHaulerShips` toggle delivered across settings, serialization, and migrations with regression coverage.
- FX system now records `departedAt` timestamps for transfers to drive motion and metrics.

## Next Steps

1. Validate sparkline rendering performance under stress scenarios and document thresholds.
2. Explore contextual data (aggregate deltas, projected throughput) to complement visual trends.
3. Plan Playwright coverage once metrics UI stabilizes and evaluate throttled-profile acceptance.
