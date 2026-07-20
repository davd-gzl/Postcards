# Contract: Places Explore & Track

This is a UI feature; its "contract" is (a) the pure browse/filter/search functions
(unit-testable, no DOM) and (b) the Places screen behavior. No network/API surface.

## Pure function: `browseList`

`browseList(kind, filter, ref, visits, query) → BrowseRow[]`

- **Inputs**: `kind` (`cities`|`monuments`|`airports`|`countries`); `filter`
  (`FilterState`, incl. status fields, `minPop`, `category`, `continent`, `sort`);
  `ref` (reference singleton); `visits` (personal records → status overlay); `query`
  (search string).
- **Behavior**:
  - Source rows from the reference set for `kind`.
  - Overlay each row's `status`/`favorite` from `visitIndex(visits)`.
  - Apply the status axis: `all` → all; `visited`/`wishlist` → only those; `favorites`
    → only favorited; `not-visited` → only rows with no record.
  - Apply kind-specific filters: `minPop` (cities), `category` (monuments),
    `continent` (all), and `query` (name; + country for monuments/airports).
  - **Cities**: rank by population and return a bounded/paged working set (never all
    135k); when a country is selected, scope to that country's cities.
  - Order per `filter.sort` (population / A–Z), favourites-first where applicable.
- **Guarantees**: deterministic for a given input; offline (reads on-device data only);
  returns a bounded array; invents nothing (rows come only from `ref`).

## Pure function: `placeMatches` / `searchPlaces` extensions

- `placeMatches(visit, ref, filter)`: honors `category` when the visit is a monument
  (already honors `mode`/status/minPop/etc.).
- `searchPlaces(ref, query)` and monument/airport search: a `query` also matches
  `countryIso2` and country name for monuments and airports (in addition to own
  name / IATA / city). City search unchanged.

## UI contract — Places screen

1. **Kind control** (single-select): Cities · Monuments · Airports · Countries. The
   only control that selects a place kind (no kind appears elsewhere).
2. **Status control** (single-select): All · Visited · Wishlist · Favorites ·
   Not-visited. Composes independently with kind (changing one preserves the other).
3. **Search** box: matches across the active kind (and by country for monuments/
   airports); a global search spans all kinds when no kind constraint applies.
4. **Kind-specific filters**: population (cities), category tag filter (monuments),
   plus the shared Filter panel (date/folder/continent/sort) as today.
5. **Row**: shows the place, its personal status (visited/wishlist/none) and, for
   monuments, a category tag; per-row toggles (visit/wishlist/favorite) update the
   status in place without leaving the browse.
6. **Countries**: all countries rendered at once (no pager), name-searchable.
7. **Collections** (Moments/Photos/Passport): reachable via a secondary control,
   not part of the kind × status browse.
8. **Empty state**: an empty kind × status shows a named message + one-tap widen.
9. **A11y**: every control keyboard-operable, labelled, ≥44px target; WCAG 2.1 AA.
10. **Offline**: all of the above works with zero network; en/fr/ko parity.

## Acceptance mapping

| Contract item | Spec requirement / success criterion |
|---------------|----------------------------------------|
| Kind single-source | FR-001, SC-001 |
| Kind × status compose | FR-002 |
| browseList reference + overlay | FR-003, FR-004, SC-002 |
| Cities bounded working set | FR-005, SC-004 |
| Global + by-country search | FR-006, FR-007, SC-005 |
| Monument category tag + filter | FR-008, SC-006 |
| Countries all-at-once | FR-009, SC-007 |
| Offline, no egress | FR-011, SC-008 |
| Map/Places agree | FR-012, SC-009 |
| A11y + i18n parity | FR-014, SC-010 |
