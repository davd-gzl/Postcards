# Research — Unified Filter Panel

Phase 0 decisions. No open `NEEDS CLARIFICATION` remained after the spec; the choices
below resolve the design questions using the existing codebase and the constitution.

## D1 — Panel form factor

**Decision**: An in-app **accessible sheet/dialog** (`role="dialog"`, `aria-modal`,
focus-trapped) that opens from the single "Filter" button and overlays the current
screen, keeping the map/list visible behind a scrim. Not a new top-level nav route.

**Rationale**: Local-first quick access with no navigation change; matches the app's
existing dockable-panel/lightbox patterns; closes on Escape / outside tap and restores
focus (Principle VII). A full-screen route would bury filters a tap deeper and lose the
"see the result behind" affordance.

**Alternatives considered**: (a) full-screen Filter tab — rejected, adds a nav
destination and hides the live result; (b) inline expanding accordion in the list header —
rejected, that is the "buttons everywhere" clutter we are removing.

## D2 — One shared store

**Decision**: A dedicated **`useFilters` Zustand store** becomes the single source of
truth, absorbing today's scattered state: `cityFilter` + `minPop` (MapScreen local
state), the map date/folder session state, sort order, and place-kind mode. Preference
dimensions (status, population, sort) persist to `localStorage` reusing existing keys
(`postcards-city-filter`, `postcards-city-minpop`); date/folder stay session-scoped as
today.

**Rationale**: The spec's core is "the map list, Places lists and counters read the SAME
state." One store read by every screen guarantees that; per-screen copies would drift.

**Alternatives considered**: extend `useUi`/`useSettings` — rejected, muddies unrelated
concerns; a React context — rejected, Zustand is already the app's state idiom and gives
external `.getState()` access the map's imperative painters use.

## D3 — Pure, composable predicates

**Decision**: A pure `applyFilters` module exposes one predicate per dimension plus a
`placeMatches(place, refData, state)` composition. The map filters its in-view city set
and the Places screen filters its visit list through the **same** predicates.

**Rationale**: Consistency (US3) and testability (Vitest over pure functions), and it
keeps filtering synchronous and cheap. `viewport.ts` already accepts `CityFilter` +
`minPopulation`; those become thin adapters over the shared predicates.

## D4 — Population vs non-city places (the documented rule, FR-006)

**Decision**: A population threshold constrains **cities only**. Non-city places
(airports, monuments, custom pins, countries) carry no population and are **not hidden**
by a population threshold — the threshold thins the city set, other kinds pass through.
Applied identically on the map (city list) and in Places.

**Rationale**: Population is a city attribute; hiding a logged airport because it has no
population would be surprising and inconsistent. One rule, both screens, no ambiguity.

## D5 — Performance

**Decision**: Filtering stays a synchronous pass over already-loaded, bounded arrays: the
map's in-view working set is already capped (`IN_VIEW_CAP = 2000`), and Places lists are
the user's own records. Predicates are O(n) with tiny constants; results are memoised on
`(filterState, sourceList)` so idle re-renders don't recompute.

**Rationale**: Meets SC-003 (<150 ms) without workers or indexing; no new network,
honouring offline/privacy (Principles II/III).

## D6 — Extensibility shape

**Decision**: `FilterState` is a flat record; each new dimension is `field + default +
predicate + one panel section + one summary-chip label`. Growth flags (`favoritesOnly`,
`hasPhoto`, `hasNote`, `continent`) are already typed in the model as optional/off so US4
is additive, never a header button.

**Rationale**: Directly satisfies "dig to extend it a maximum" without re-introducing
scattered controls.
