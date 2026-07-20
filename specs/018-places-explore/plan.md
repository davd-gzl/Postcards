# Implementation Plan: Places Explore & Track

**Branch**: `018-places-explore` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-places-explore/spec.md`

## Summary

Turn the Places screen into one unified surface with two independent axes — **kind**
(cities / monuments / airports / countries) × **status/scope** (all / visited /
wishlist / favorites / not-visited) — so the same list both *discovers* the whole
world (reference data) and *shows what you've visited* (personal records), with no
concept duplicated across controls. World-scale browse stays instant via a bounded,
most-relevant working set plus search & country narrowing; one search spans every
kind and matches monuments/airports by country; monuments carry their dataset
category as a filterable tag; the country checklist shows all countries at once.

Technical approach: reuse the existing reference datasets and the visit/wishlist/
favorite data model unchanged. Extend the ONE shared filter store (`useFilters`)
with the status axis and a monument-category dimension, and rebuild `PlacesScreen`
around a single **browse builder** that lists reference places of the chosen kind,
overlays personal status from the visit index, and applies the status + kind-specific
filters + search. Cities reuse the map's capped in-view ranking approach so ~135k
rows never render at once. No new dependencies, no new datasets, fully offline.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19 (Vite).

**Primary Dependencies**: Zustand (state), existing reference singleton
(`lib/reference/referenceData`), shared filter store (`lib/store/useFilters`), pure
filter predicates (`features/filter/applyFilters`), place search
(`features/visits/search`). No new runtime dependencies.

**Storage**: On-device IndexedDB working store for personal records (unchanged);
reference data loaded from bundled JSON (Natural Earth, GeoNames-class gazetteer,
UNESCO/heritage w/ category, airports). Canonical portable file unchanged — this
feature adds no persisted fields.

**Testing**: Vitest (unit — filter/browse predicates, search), Playwright +
axe-core (e2e — Places browse/search/tags/countries, a11y gate), i18n key-parity
compile check.

**Target Platform**: Self-hostable PWA + native iOS/Android via Capacitor; desktop
keyboard users first-class.

**Project Type**: Web-first single codebase (mobile app via Capacitor wrapper).

**Performance Goals**: World-browse and search surface relevant results in ≤ ~1s on
the full ~135k-city gazetteer; scrolling never stalls; interactions feel instant on
a typical device (Constitution VII).

**Constraints**: Fully offline — zero outbound requests for browse/search/filter; no
telemetry; WCAG 2.1 AA + keyboard-first; en/fr/ko key parity enforced at compile
time; reference data is inert (parsed, never executed); results drawn from a bounded
working set, never the full gazetteer at once.

**Scale/Scope**: ~135k reference cities, ~1.2k UNESCO sites, ~7k airports, ~250
countries. One screen (`PlacesScreen`) restructured; shared filter store + pure
predicates + search extended. Personal data volume: hundreds–thousands of visits.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Aggregator, never an author | All browsed places, categories, country membership come from the shipped datasets; nothing invented; a missing monument category degrades (no fabricated tag). | ✅ PASS |
| II. Local-first & decentralized | Browse/search/filter run entirely on-device against bundled reference + local records; no server, no account. | ✅ PASS |
| III. Privacy by default | No telemetry; no new egress; the feature adds no network calls (a place photo stays the existing opt-in online-only extra, gated + degrading). | ✅ PASS |
| IV. One portable, human-readable file | No new persisted fields; visit/wishlist/favorite data model unchanged; export/import untouched. | ✅ PASS |
| V. Zero lock-in | No new dependencies; reuses open datasets and existing components. | ✅ PASS |
| VI. Security — data is inert | Reference data is parsed and rendered only; no eval, no data-driven fetch. | ✅ PASS |
| VII. Efficient, accessible, keyboard-first | Bounded working set keeps it instant at world scale; every control keyboard-operable with labels/target size; WCAG 2.1 AA e2e gate. | ✅ PASS |
| VIII. Interoperable & AI-friendly | No format/schema change; the ONE shared filter keeps map & Places consistent. | ✅ PASS |

**Result**: PASS — no violations. No Complexity Tracking entries required.

Scope discipline: this is "store data and display it well" (browse/organise surface),
not trip-planning or a server feature — in scope. Stats coverage card and Wikivoyage
reader are explicitly deferred to their own specs.

## Project Structure

### Documentation (this feature)

```text
specs/018-places-explore/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── places-explore.md  # UI + pure-function behavior contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
apps/postcards/src/
├── features/
│   ├── visits/
│   │   ├── PlacesScreen.tsx      # RESTRUCTURED: kind × status axes + unified browse list
│   │   ├── search.ts            # EXTENDED: match monuments/airports by country
│   │   ├── StateToggles.tsx     # reused (per-row visit/wishlist/favorite)
│   │   ├── PhotoWall.tsx        # reused (Photos collection, unchanged)
│   │   └── browseList.ts        # NEW: pure builder — reference places + status overlay
│   ├── filter/
│   │   └── applyFilters.ts      # EXTENDED: status axis + monument category predicate
│   ├── experiences/ExperiencesScreen.tsx  # reused (Moments collection)
│   └── passport/PassportScreen.tsx        # reused (Passport collection)
├── lib/
│   ├── store/useFilters.ts      # EXTENDED: status axis values + `category` dimension
│   └── reference/
│       ├── referenceData.ts     # reused (allCities/allHeritage/allAirports/countries)
│       ├── heritageGlyph.ts     # reused (category → tag glyph)
│       └── types.ts             # reused (no new persisted fields)
└── features/map/viewport.ts     # reused/shared ranking for the capped city working set

apps/postcards/tests/
├── unit/                        # browseList, applyFilters (status+category), search-by-country
└── e2e/                         # places-explore browse/search/tags/countries + a11y gate
```

**Structure Decision**: Single web codebase (existing). The change is concentrated in
`PlacesScreen` plus the shared filter store, pure predicates, and search — the same
seams the map already reads, so Places and the map stay consistent (FR-012). A new
pure `browseList` builder isolates "reference places + personal-status overlay +
filters" so it's unit-testable without the DOM and reusable by any list view.

## Complexity Tracking

No constitution violations — section intentionally empty.
