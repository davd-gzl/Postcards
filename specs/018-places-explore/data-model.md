# Data Model: Places Explore & Track

No **persisted** data changes. This feature reads existing reference data and the
existing personal records, and adds transient UI/filter state only. The canonical
portable JSON file and its schema are unchanged.

## Reference entities (read-only, from shipped datasets — existing)

- **City**: `id`, `name`, `countryIso2`, `subdivisionId?`, `population?`, `lat`, `lon`.
  Source: GeoNames-class gazetteer (~135k).
- **HeritageSite (monument)**: `id`, `name`, `countryIso2`, `category?`
  (`cultural` | `natural` | `mixed`), `lat`, `lon`. Source: UNESCO/heritage dataset.
- **Airport**: `id` (IATA), `name`, `city?`, `countryIso2`, `lat`, `lon`. Source:
  airports dataset (~7k).
- **Country**: `iso2`, `iso3`, `numeric`, `name`, `continent`, `cityCount`,
  `bigCityCount`, `subdivisionCount`, `sovereignty`. Source: Natural Earth + counts
  precomputed from the gazetteer. (~250.)

All read-only; the app never mutates or invents these.

## Personal entity (existing — unchanged)

- **Visit**: `visitId`, `place` (a `PlaceRef`: `kind` ∈ city|heritage|airport|custom|
  country, `id`, `name`, `countryId`), `status` (`visited` | `wishlist`), `favorite`,
  `date?`, `folder?`, `note?`, `photos?`. Indexed by `placeKey(place)` via the
  existing `visitIndex(visits)` map for O(1) status overlay.

No fields added or changed.

## Transient / filter state

### FilterState (shared store `useFilters`) — ONE new dimension

Existing fields reused: `status: FilterStatus[]` (`visited`|`wishlist`|`unvisited`),
`favoritesOnly`, `minPop`, `date`, `folder`, `sort`, `mode` (the **kind** axis:
`all`|`cities`|`monuments`|`airports`), `hasPhoto`, `hasNote`, `continent`.

**Added**:

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `category` | `"" \| "cultural" \| "natural" \| "mixed"` | `""` | Monument category filter (kind = monuments only). `""` = all. Session-scoped like `date`/`folder`. |

The **kind** axis extends conceptually to include `countries` in the Places UI (the
country checklist), even though the map's `mode` enum stays cities/monuments/airports;
Places treats "countries" as a fourth kind selection without changing the shared enum
(countries are handled by the existing countries view path, selected by the kind
control). *Design note for tasks: either widen the shared `mode` type to include
`"countries"` or keep a thin Places-local mapping — decided at implement time; the
map ignores an unknown value defensively.*

The **status axis** (UI-only presentation) maps to store fields per research D3:
`All` → clear; `Visited`/`Wishlist` → `status=[that]`; `Favorites` → `favoritesOnly`;
`Not-visited` → `status=['unvisited']`.

### BrowseRow (transient, derived — new)

Produced by `browseList` for rendering: `{ kind, id, name, sub, countryIso2,
lat?, lon?, place: PlaceRef, status: 'visited'|'wishlist'|'none', favorite: boolean,
categoryTag?: 'cultural'|'natural'|'mixed' }`. Purely ephemeral; never persisted.

### SearchQuery (transient — existing, extended)

A single string matched across kinds; for monuments/airports it additionally matches
`countryIso2` and the country's name (research D5).

## Validation / invariants

- A browsed reference place's status is derived from the visit index — never stored
  on the reference entity.
- `browseList` output is bounded (cities: population-ranked cap + paging); the full
  gazetteer is never returned in one array (FR-005).
- Category filter only applies when kind = monuments; ignored otherwise.
- Numerator never exceeds denominator: personal-status overlay only marks reference
  places that exist in the shipped datasets (imported off-dataset places don't inflate).
