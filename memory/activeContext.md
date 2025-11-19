# Active Context

## Current Work

- 🚧 **TASK040 – Rust Simulation Core** underway.
  - Recorded RQ-067–RQ-070 and DES033 to govern Rust/WASM migration and typed-array contracts.
  - Scaffolding `/rust-engine` crate completed with RNG parity tests, snapshot import/export, layout planner, and data buffer.
  - Implemented TS bridge (`wasmSimBridge`) matching `wasm-bindgen` class structure for future integration.
  - Verified `wasm-pack` build pipeline and added `useRustSim` feature flag to store settings.
  - **Next**: Execute DES034 to port core systems (Refinery, Movement, Mining) to Rust.

- 🚧 **TASK038 – Factory Metrics & Mini-Charts** remains in progress.
  - Factory Metrics tab now renders four sparklines with summary stats, sampling banner, and pause control.
  - Inline sparkline component ships on factory cards and hides when sampling disabled or empty.
  - Settings panel exposes metrics toggle, interval, and retention inputs; metrics helpers covered by new unit tests.
  - Sparklines now include descriptive titles/ARIA wiring and inline component gains narrated labels with dedicated Vitest coverage.
  - Metrics banner now surfaces the most recent sampling time so players can relate charts to gameplay moments.

- ✅ **TASK039 – Hotpath Instancing & Pooling** completed.
  - Logistics transfer lines now render from a pooled visual buffer via instanced shafts/heads with hover-safe colors/tooltips.
  - Hauler ships reuse a pooled visual/color map and expose sliceable views for rendering and tests.
  - Drone AI tick reuses a hoisted Map of flights instead of re-allocating per frame.

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

1. Finalize Rust crate scaffolding, wasm-bindgen surface, and feature-flag plan before integrating with the store.
2. Validate sparkline rendering performance under stress scenarios and document thresholds.
3. Explore contextual data (aggregate deltas, projected throughput) to complement visual trends.
4. Plan Playwright coverage once metrics UI stabilizes and evaluate throttled-profile acceptance.
