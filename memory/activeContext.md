# Active Context

## Current Work

- 🚧 **TASK038 – Factory Metrics & Mini-Charts** is in progress.
  - Factory Metrics tab now renders four sparklines with summary stats, sampling banner, and pause control.
  - Inline sparkline component ships on factory cards and hides when sampling disabled or empty.
  - Settings panel exposes metrics toggle, interval, and retention inputs; metrics helpers covered by new unit tests.

🔭 **Open follow-ups**

- Add hover tooltips / accessibility copy for sparkline data points if needed.
- Extend coverage to integration/e2e flows and ensure throttled profile messaging surfaces in low-profile runs.
- Profile rendering cost of sparklines under large factory counts; add guardrails if necessary.

**Design Reference:** `/memory/designs/DES031-factory-metrics.md`

---

## Recent Completions

✅ **Completed: TASK037 – Hauler Ship Visuals** (for historical context)

- Animated hauler ships replaced transfer lines with instanced meshes, cubic Bezier motion, and hover tooltips.
- Persistent `showHaulerShips` toggle delivered across settings, serialization, and migrations with regression coverage.
- FX system now records `departedAt` timestamps for transfers to drive motion and metrics.

## Next Steps

1. Validate sparkline rendering performance under stress scenarios and document thresholds.
2. Layer in UX polish (tooltips, aria descriptions) for metrics surfaces.
3. Plan Playwright coverage once metrics UI stabilizes and evaluate throttled-profile acceptance.
