# Implementation Plan: Unified Filter Panel

**Branch**: `claude/monument-display-optimize-x1j6le` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-filter-panel/spec.md`

## Summary

Consolidate every place/list filter now scattered across the Map and Places screens
into ONE panel opened from a single "Filter" control, backed by ONE shared filter
state that the map (markers + in-view list + counters) and the Places lists all read.
Remove the inline map controls (status segmented, population row, sort toggle). Show a
compact active-filter chip summary with per-chip remove + Clear all. Keep it a
pure client-side operation over already-loaded data (offline, no egress, <150 ms),
WCAG 2.1 AA and keyboard-first, and structured so new dimensions (favorites-only,
has-photo, has-note, continent) drop into the one panel.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19 (Vite)

**Primary Dependencies**: React, Zustand (state), MapLibre GL JS (map) — **no new dependencies**.

**Storage**: `localStorage` for filter *preferences* (reusing existing keys where they
exist: `postcards-city-filter`, `postcards-city-minpop`, …) + existing in-session map
date/folder state. Personal data (visits) stays in IndexedDB, unchanged. No new storage,
no schema change to the portable file.

**Testing**: Vitest (pure filter logic), Playwright + axe-core (panel interaction, a11y gate).

**Target Platform**: Self-hostable PWA + Capacitor iOS/Android from one codebase; evergreen browsers.

**Project Type**: Single-codebase web/mobile app (`apps/postcards`).

**Performance Goals**: Filter apply/clear updates the visible list in <150 ms on a
mid-range phone with the full ~135k-city gazetteer in memory; map stays at 60 fps.

**Constraints**: Fully offline; zero app-initiated network on filter; WCAG 2.1 AA;
keyboard-first (focus trap, Escape, focus restore); no filter state leaves the device.

**Scale/Scope**: Two primary screens (Map, Places) + a shared store and one panel
component; the filter runs client-side over data already loaded for the current view.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Aggregator, never author | PASS | Filtering only *reads* existing reference + personal data; invents no world data. |
| II. Local-first & decentralized | PASS | Pure client-side; no server; works fully offline. |
| III. Privacy by default | PASS | No telemetry, no egress; filter state is on-device only. |
| IV. One portable, human-readable file | N/A | Filters are UI/session preferences, not part of the portable data file; no schema change. |
| V. Zero lock-in | PASS | No new dependencies; reuses React/Zustand/MapLibre already in the app. |
| VI. Security — data is inert | N/A | No import/parse/eval; operates over already-validated in-memory data. |
| VII. Efficient, accessible, keyboard-first | ADVANCES | The feature's whole point: less clutter, one place, <150 ms, WCAG 2.1 AA, keyboard-first. |
| VIII. Interoperable & AI-friendly | N/A | No data-format or export change. |
| Ecosystem / offline-map constraints | N/A | No map-tile or offline-store change. |

**Result**: All gates pass. No violations → Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/016-filter-panel/
├── plan.md              # This file
├── research.md          # Phase 0 — key design decisions
├── data-model.md        # Phase 1 — FilterState + summary entities
├── quickstart.md        # Phase 1 — runnable validation scenarios
├── contracts/           # Phase 1 — filter-state + panel a11y contracts
│   ├── filter-state.md
│   └── panel-a11y.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/postcards/src/
├── lib/
│   ├── store/
│   │   ├── useFilters.ts      # NEW — single shared filter store (status, population,
│   │   │                      #        date, folder, sort, mode, growth flags) + persistence
│   │   └── useSettings.ts     # existing — marker cap / optimize live here (unchanged)
│   └── filter/
│       ├── types.ts           # NEW — FilterState type + defaults + isDefault/diff helpers
│       └── applyFilters.ts    # NEW — pure predicates (place ↔ FilterState) reused by map + Places
├── features/
│   ├── map/
│   │   ├── MapScreen.tsx      # remove inline status/population/sort; add single Filter button + summary
│   │   ├── MapView.tsx        # read shared filter (already takes cityFilter/minPop as props)
│   │   └── viewport.ts        # markerCitiesInView already accepts filter + minPopulation
│   └── visits/
│       └── PlacesScreen.tsx   # add the same Filter button + honour shared status/pop/date/folder
└── ui/
    ├── FilterPanel.tsx        # NEW — the one panel (all dimensions, focus-trapped, keyboard-first)
    └── FilterSummary.tsx      # NEW — active-filter chips + Clear all

apps/postcards/tests/
├── unit/                      # applyFilters predicates, useFilters defaults/diff, summary derivation
└── e2e/                       # filter-panel.spec.ts (open/apply/clear, shared state), a11y gate
```

**Structure Decision**: Single project (`apps/postcards`). Introduce a small shared
filter layer (`lib/filter` + `lib/store/useFilters`) so both the Map and Places screens,
and any future screen, read one state through one set of pure predicates — the concrete
anti-"buttons everywhere" mechanism. The panel and summary are presentational components
in `ui/`. `viewport.ts` already supports the `CityFilter` + `minPopulation` inputs, so the
map wiring is largely re-pointing existing props at the shared store.

## Complexity Tracking

> No Constitution violations — no entries.
