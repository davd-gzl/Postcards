# Research: Places Explore & Track

Phase 0 decisions. The `/speckit-clarify` session resolved the top UX questions; this
records the technical approach for each, with rationale and alternatives.

## D1 — Unified browse builder (reference places + personal-status overlay)

**Decision**: Add one pure builder, `browseList(kind, filterState, refData, visitIndex,
query)`, that starts from the reference set for the chosen kind (`ref.allCities()`,
`ref.allHeritage()`, `ref.allAirports()`, `ref.countries`), overlays each place's
personal status from the existing visit index (`visitIndex(visits)` keyed by
`placeKey`), applies the status axis + kind-specific filters + search, and returns a
bounded, ordered row list. Personal-only statuses (visited/wishlist/favorites) filter
the overlay; "not-visited" excludes anything with a record; "all" shows everything.

**Rationale**: The Monuments and Countries tabs already iterate reference data and
overlay status — this generalises that proven pattern to every kind, in one testable
place, instead of the current split between visit-iterating lists (Visited/Favorites/
Wishlist) and reference-iterating lists (Monuments/Countries). Keeps map & Places
consistent because both read the same reference sets and shared filter.

**Alternatives**: (a) Keep visit-iterating lists and only add reference browse for
cities/airports — rejected: perpetuates two code paths and the duplication we're
removing. (b) Precompute a merged "all places" array — rejected: 135k+ rows, wasteful
and defeats the capped working set.

## D2 — City working set at world scale (~135k)

**Decision**: Cities are **scope-first**. The browse never materialises all 135k rows:
it ranks by population (most-populous first — the most-recognisable/relevant) and caps
to a paged working set, and narrows by search and by country/region. Reuse the map's
existing capped ranking helper (`features/map/viewport.ts` `markerCitiesInView` /
population presort) rather than inventing a second ranking. When a country is chosen,
list that country's cities (bounded by `country.cityCount`, already small enough).

**Rationale**: Matches the clarified "scope-first" answer and Constitution VII
(instant on a typical dataset). The map already proves population-ranked capping is
fast and legible; sharing it keeps behaviour consistent.

**Alternatives**: Virtualised full-list scroll — rejected: heavier, still needs a cap
for the worker/serialisation cost, and encourages endless scrolling over the long
tail instead of searching. Alphabetical full list — rejected: buries big cities.

## D3 — Status axis modeling in the shared filter

**Decision**: Represent the status axis as a single selected value in the UI
(All / Visited / Wishlist / Favorites / Not-visited) mapping onto the existing
`useFilters` fields: `status: FilterStatus[]` (`visited` | `wishlist` | `unvisited`)
plus `favoritesOnly`. "Favorites" sets `favoritesOnly=true`; "Not-visited" sets
`status=['unvisited']`; "Visited"/"Wishlist" set the matching single status; "All"
clears both. This keeps the store shape stable and map-compatible; the Places UI just
presents these as one segmented control instead of separate multi-select + tabs.

**Rationale**: No store migration; the map already understands these fields, so
Places and map stay in lock-step (FR-012). Favorites is genuinely a *status* of a
place, so folding it into the status axis (not a tab) removes the duplication (FR-001).

**Alternatives**: Add a dedicated `scope` enum — rejected: redundant with `status`
and would need map plumbing. Keep multi-select status — rejected: the spec/clarify
chose a single simpler status picker for Places (map keeps its own multi-select).

## D4 — Monument category tag + filter

**Decision**: Read `heritage.category` (cultural | natural | mixed) from the dataset;
render it as a row tag via the existing `heritageGlyph()` + a text label, matching the
map markers. Add a `category` dimension to `FilterState` (`"" | "cultural" | "natural"
| "mixed"`) used only when kind = monuments; `browseList` filters on it. A record with
no category renders no tag and is excluded only by an explicit category filter.

**Rationale**: Category already exists in the reference data (aggregator-safe); the map
already styles by it, so tags stay consistent. A shared filter dimension keeps it in
the one filter concept.

**Alternatives**: Local-only category state in `PlacesScreen` — rejected: breaks the
single-shared-filter principle and can't be reflected in the active-filter summary.

## D5 — Search by country for monuments & airports

**Decision**: Extend `searchPlaces` (and the monument/airport search paths) so a query
also matches a place's **country** (name and ISO2) for monuments and airports, in
addition to their own name / IATA code / city. When the Monuments or Airports kind is
active, a country query filters the list to that country; in global search, a country
query surfaces that country's monuments and airports alongside its cities.

**Rationale**: Directly satisfies FR-007 and SC-005; the search index already resolves
country names, so this is a matcher extension, not new data.

**Alternatives**: A separate "country" dropdown only — rejected: the user asked to
*search* by country (typing), though a country filter chip may complement it later.

## D6 — Countries shown in full

**Decision**: Remove the pager/`ListPager` from the countries view; render all
in-scope countries at once (still name-searchable + scope toggle). ~250 rows is cheap.

**Rationale**: FR-009 / SC-007; there is no volume reason to paginate ~250 rows, and
the pager added friction. Reference count is fixed and tiny.

**Alternatives**: Keep pager with a high page size — rejected: still shows a "load
more" control the user explicitly doesn't want.

## D7 — Collections stay separate

**Decision**: Moments, Photos, Passport remain their own views reachable from a
secondary control on Places (unchanged), not folded into the kind × status browse.

**Rationale**: Clarified answer; they are cross-cutting collections, not a place kind.
Folding them in would pollute the two clean axes.
