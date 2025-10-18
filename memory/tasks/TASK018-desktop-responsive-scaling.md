# TASK018 — Desktop Responsive HUD & Panels

**Status:** In Progress
**Added:** 2025-10-22
**Updated:** 2025-10-22

## Summary

Scale the HUD, inspector, and upgrade/factory panels with viewport size so the desktop layout remains legible and free of overflow across common monitor widths.

## Goals

- Satisfy requirements RQ-029, RQ-030, and RQ-031.
- Keep the 3D canvas unobstructed while UI elements resize smoothly.
- Ensure sidebar content remains reachable when viewport height is constrained.

## Non-Goals

- Implement a dedicated mobile/touch UI.
- Introduce new UI interactions beyond layout scaling.
- Modify store logic or React component structure.

## Design Reference

- `memory/designs/DES017-desktop-responsive-scaling.md`

## Implementation Plan (6-Phase Loop)

### Phase 1 — Analyze

- [x] Capture requirements RQ-029 through RQ-031.
- [x] Draft DES017 covering responsive layout adjustments and future considerations.

### Phase 2 — Design

- [x] Define CSS custom properties for fluid typography, spacing, and container widths.
- [x] Plan breakpoint adjustments for widths below 1280px and heights below 900px.

### Phase 3 — Implement

1. Update `src/styles.css` with responsive variables, clamped widths, and sidebar/inspector constraints.
2. Refresh `src/ui/FactoryManager.css` to consume the shared font sizing and spacing rules.
3. Verify other UI elements inherit the new scale and adjust any outliers.

### Phase 4 — Validate

- Manually resize the browser (960px–1920px width, 720px height) verifying no overflow and accessible controls.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` to ensure code health.

### Phase 5 — Reflect

- Capture follow-up ideas (e.g., dedicated mobile tabs) in `docs/more-ideas.md` for future work.

### Phase 6 — Handoff

- Summarize responsive changes and testing evidence in the PR message referencing DES017 and TASK018.

## Dependencies

- Existing HUD and panel components styled via `src/styles.css` and feature-specific CSS modules.

## Risks & Mitigations

- **Scrollbar overlap:** Provide padding and custom scrollbar styling to keep content readable when overflow occurs.
- **Font scaling too aggressive:** Tune `clamp()` bounds after manual verification on narrow/wide monitors.

## Status Log

- 2025-10-22 — Task initialized with responsive requirements, design draft, and implementation plan.
