# DES002 - Spec Refresh for Current Implementation

**Status:** Completed
**Updated:** 2025-02-15

## Goal

Align `spec/spec-full-idea.md` with the shipped MVP and the recent persistence/offline utilities so that the spec acts as an accurate source of truth while still charting the roadmap.

## Scope

- Document the present ECS systems, highlighting behaviors implemented today (fleet, asteroid recycling, travel, mining, unload, power) and noting placeholders (refinery, energy throttle).
- Capture the persistence manager API and offline simulation utilities that exist in code, including storage key, autosave scheduling, and cap-hour handling.
- Update UI/UX expectations to reflect the HUD + upgrade/prestige panel currently rendered while deferring settings/offline recap to roadmap.
- Revise requirements, data model, acceptance tests, and roadmap tables to differentiate between implemented features and planned work.

## Artifacts & Sections to Touch

| Section | Action |
| --- | --- |
| Overview & Goals | Summarize current MVP scope, list constraints that are actually enforced, move stretch goals to roadmap |
| Requirements | Keep deterministic/tick/drone/asteroid requirements, rewrite energy/UI requirements to match code, add new doc-specific requirements (RQ-006, RQ-007) |
| Data Model | Reflect Zustand store shape (resources/modules/prestige/save + actions) and note absence of settings/persistence slices |
| Systems | Provide per-system bullets of implemented behaviors, tag refinery and energy throttle as TODO |
| Persistence & Offline | Describe `createPersistenceManager`, storage key, offline simulation flow, outstanding integration tasks |
| Determinism & RNG | Note seeded RNG helper exists for world generation but seed persistence still TODO |
| UI/UX | Detail HUD + UpgradePanel, highlight missing settings/prestige recap as roadmap |
| Acceptance Criteria | Reference existing Vitest and Playwright coverage; flag desired future tests |
| Roadmap | Reshuffle priorities to focus on integrating persistence manager, completing refinery system, implementing settings/offline recap, RNG persistence |
| Changelog | Add entry for this refresh |

## Open Questions

- Whether to formalize energy throttle behavior or keep as future improvement (document as roadmap item).
- Integration timing for persistence manager (document as outstanding task since bootstrap does not wire it yet).

## Validation Plan

- Cross-check spec statements against code references (store, ECS systems, persistence, offline tests).
- Ensure requirements RQ-006 and RQ-007 acceptance criteria are satisfied in the updated spec.
