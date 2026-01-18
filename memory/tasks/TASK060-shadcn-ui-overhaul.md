## TASK060 - Shadcn UI Overhaul

**Status:** In Progress  
**Added:** 2026-01-18  
**Updated:** 2026-01-18

### Original Request

Redo the UI to use shadcn blocks/components with collapsible nested sidebars and keep the R3F canvas as the main content.

### Thought Process

We need a new layout shell that wraps existing gameplay panels in shadcn-inspired containers without rewriting their internal logic. The core work is layout and styling, plus a reusable collapsible section component to build nested sidebar groups. The design should preserve current panel functionality and keep the canvas central.

### Implementation Plan

1. Create a reusable `SidebarSection` component to render collapsible sections.
2. Restructure `App` to render left/right sidebars with nested groups and a central scene header + canvas.
3. Update global styles to implement the new shell, sidebar, and collapsible styling.
4. Capture a UI screenshot and run required checks.

### Progress Tracking

**Overall Status:** In Progress - 80%

#### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Add sidebar section component | Complete | 2026-01-18 | Implemented reusable `SidebarSection`. |
| 1.2 | Rebuild app shell layout | Complete | 2026-01-18 | Added nested sidebar groups and scene header. |
| 1.3 | Update shell styling | Complete | 2026-01-18 | Shell styles updated for shadcn layout. |
| 1.4 | Validate UI with screenshot and checks | In Progress | 2026-01-18 | Tests and screenshot attempted; WASM/browser issues remain. |

### Progress Log

#### 2026-01-18

- Added a reusable sidebar section component and restructured the app shell with collapsible nested sidebars.
- Updated global styles for the shadcn-inspired layout and scene header.
- Ran required checks; typecheck/lint/tests failed due to missing `src/gen/rust_engine` artifacts and existing lint warnings.
- Attempted to capture a UI screenshot; Vite and Playwright failed because the WASM module was missing and the browser crashed.
