# DES017 — Desktop Responsive HUD & Panels

**Status:** Draft
**Date Created:** 2025-10-22
**Date Last Updated:** 2025-10-22

## Design Overview

Deliver a responsive-only-for-desktop refresh that scales HUD text, panels, and inspector widths with the viewport so information never overflows while retaining the current desktop layout. The work targets requirements RQ-029 through RQ-031 by introducing fluid typography, clamped widths, and scrollable panel regions. Mobile/touch-specific layouts remain out of scope but we document switchable-tab concepts for future design.

## Goals & Non-Goals

- Maintain three-surface layout (HUD left, inspector bottom-left, upgrades/factories on right) for viewport widths ≥960px.
- Use CSS-only adjustments whenever possible; avoid structural React changes unless required for accessibility.
- Preserve existing visual hierarchy (blurred cards, neon highlights) while making scale adjustments subtle.
- Document future mobile exploration (tabbed UI) without implementing it now.

Non-goals:

- Implement mobile portrait/landscape breakpoints.
- Rebalance component data or add new interactive elements.
- Modify 3D canvas sizing logic beyond existing 100dvh canvas container.

## Requirements Mapping

- **RQ-029:** Fluid typography variables for HUD + inspector to prevent clipping and maintain readability across 960–1920px widths.
- **RQ-030:** Scroll-capable sidebar container with max-height constraints, ensuring buttons stay reachable under shorter viewports.
- **RQ-031:** Clamped widths for sidebar and inspector plus breakpoint adjustments around 1280px to avoid overlap.

## Layout & Styling Strategy

1. Introduce CSS custom properties on `:root` representing fluid font scales, spacings, and card widths using `clamp()`.
2. Update `.app` spacing to rely on custom properties and allow a safe padding gutter that shrinks on narrow viewports.
3. Convert HUD, sidebar, and inspector card dimensions to use the shared variables and add `max-width`/`min()` wrappers to avoid overflow.
4. Apply `max-height` and `overflow: auto` to `.sidebar` with styled scrollbars for discoverability; ensure internal panels inherit fluid font sizing.
5. Adjust component-specific styles (`FactoryManager.css`, button styles) to reference the global typography scale so text shrinks gracefully.
6. Add breakpoint-specific tweaks (e.g., `<1280px`) to slightly reposition the inspector and tighten gaps.

## Data Flow / Component Interactions

No JavaScript data flow changes expected. UI components continue reading from Zustand store. Styling updates happen via global CSS plus component-level CSS modules imported in React components.

## Interfaces & Contracts

- `src/styles.css`: define new CSS variables, responsive clamps, and container rules.
- `src/ui/FactoryManager.css`: consume the variables and ensure child elements respect new font sizes and spacing.
- Additional component styles (buttons, inspector) inherit global adjustments automatically.

## Error Handling & Edge Cases

- Safeguard against scrollbars overlapping panel content by adding right padding when overflow-y is active.
- Ensure `clamp()` minimums keep text legible on very wide monitors; test at 4K to verify maximum values do not over-expand.
- Confirm that inspector and sidebar stacking contexts still allow pointer interaction after adding overflow.

## Testing Strategy

1. Manual resize validation at 960px, 1180px, 1440px, and 1920px to confirm zero overflow and reachable controls.
2. Quick React Testing Library snapshot (optional) is not required since DOM structure unchanged; rely on manual verification per requirements.
3. Run automated linting, type check, and Vitest suite to ensure no regressions from styling imports.

## Future Considerations

- Explore dedicated mobile layout using tabbed navigation stacking HUD, upgrades, and inspector (candidate for DES018) once touch interaction requirements are gathered.
- Consider hooking into `ResizeObserver` for dynamic layout hints if future features need JS-based adjustments.
