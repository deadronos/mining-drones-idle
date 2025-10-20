# DES022 — Settings Panel Responsive Layout

**Status:** Draft  
**Date Created:** 2025-10-24  
**Linked Requirements:** RQ-041, RQ-042, RQ-043

## Problem Statement

The Settings drawer currently renders its sections in a single flex column with fixed width and padding. On medium displays (≤ 1440px tall) the card exceeds the viewport height, forcing the browser window to scroll underneath the modal. On ultra-wide monitors, the single column wastes horizontal space and retains a narrow 420px column that makes dense settings feel cramped.

## Goals & Non-Goals

- Provide an adaptive column layout that expands horizontally on wide screens (2–3 columns) while preserving semantic order.
- Clamp the modal height to the viewport and expose an internal scrollbar only when content genuinely exceeds available space.
- Respect existing typography scales and maintain readability down to tablet-width desktops.
- Avoid JavaScript-driven layout calculations; rely on CSS Grid + clamps.

Non-goals:

- Do not introduce new settings, tabs, or search UX.
- Do not rework confirmation modal logic (fixed-position dialog remains).

## Layout Architecture

1. Keep `.settings-panel` as a flex column with header, scrollable body, and optional confirmation overlay.
2. Introduce a new `.settings-content` wrapper inside the panel whose children are all existing `<section>` blocks.
3. Convert `.settings-content` to a CSS grid using `repeat(auto-fit, minmax(260px, 1fr))` so column count expands to fill width while respecting minimum column width.
4. Mark copy-heavy sections (primer block) with modifier `settings-section--wide` that spans all columns.
5. Increase the panel width clamp to ~min(960px, 92vw) to create room for multiple columns, while maintaining a narrow clamp on small screens.

## Styling & Interfaces

| File                  | Change                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/ui/Settings.tsx` | Wrap existing sections in a `div.settings-content`; add `settings-section settings-section--wide` to the primer section; leave header and confirmation markup intact.                                                                                   |
| `src/styles.css`      | Update `.settings-panel` width, padding clamps, `max-height`, and `overflow-y`. Add the new grid styles (`.settings-content`, `.settings-section--wide`), responsive breakpoints around 1024px / 1600px, and scrollbar styling for overflowing content. |

### Responsive Behavior

- ≥ 1600px: grid auto-fit should typically yield three columns without exceeding 320px per column; gap set via existing `--panel-gap`.
- 1280px–1599px: grid fits two columns.
- < 1024px: force a single column by swapping to `grid-template-columns: 1fr` and tightening panel padding/margins.
- Panel max height: `max-height: min(94dvh, calc(100dvh - clamp(2.5rem, 8vh, 5rem)))` with `overflow-y: auto`.

## Accessibility & Error Handling

- Maintain DOM order so assistive tech reads content in the same sequence; `order` is not altered.
- Ensure `aria-labelledby`, `aria-modal`, and `role="dialog"` remain unchanged.
- When scrollbar appears, provide padding via `scrollbar-gutter: stable both-edges;` to prevent layout shift.
- Confirmation overlay (`.settings-confirm-backdrop`) already uses `position: fixed`; it will remain above the dimmed backdrop even though panel now scrolls.

## Testing Strategy

1. Manual resize tests at 900px, 1280px, 1440px, and 1920px widths verifying column count and absence of horizontal scrollbars (RQ-041 & RQ-043).
2. Manual height test at 720px tall ensuring modal scrollbars appear (RQ-042).
3. Regression sweep of reset confirmation overlay to ensure it still covers panel.

## Implementation Tasks

1. Update `Settings.tsx` markup to introduce `.settings-content` wrapper and modifier class on primer section.
2. Revise `.settings-panel` styling (width clamps, padding, max-height, scrollbar gutters).
3. Add CSS grid rules for `.settings-content`, `.settings-section`, and breakpoint adjustments.
4. Manually validate layout at the widths/heights listed above.
