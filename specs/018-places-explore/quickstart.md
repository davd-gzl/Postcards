# Quickstart / Validation: Places Explore & Track

How to prove the feature works end-to-end. Run from `apps/postcards/`.

## Prerequisites

- `pnpm install` (workspace root).
- Reference datasets already bundled (no download).

## Gates (must pass)

```bash
pnpm typecheck        # tsc --noEmit — incl. en/fr/ko key parity
pnpm test             # vitest — browseList, applyFilters (status+category), search-by-country
pnpm test:e2e places-explore a11y   # Playwright browse/search/tags/countries + WCAG gate
```

## Automated coverage to add (tasks phase)

- **Unit**: `browseList` — reference rows + status overlay for each kind; status axis
  (all/visited/wishlist/favorites/not-visited); cities bounded/ranked working set;
  monument `category` filter; `searchPlaces` matching monuments/airports by country.
- **e2e** (`places-explore.spec.ts`): pick each kind; confirm world browse shows
  not-visited reference places from a fresh state; mark one visited in place; filter
  monuments by category and see the tag; search a country and see its monuments &
  airports; countries render with no pager. Offline run asserts zero network requests.
- **a11y**: the redesigned Places screen passes the axe WCAG 2.1 AA gate; full
  keyboard traversal of kind/status/search/rows.

## Manual walkthrough

1. `pnpm dev`, open Places. Confirm exactly one **kind** control (Cities · Monuments ·
   Airports · Countries) and one **status** control (All · Visited · Wishlist ·
   Favorites · Not-visited); "Monuments" appears only in the kind control.
2. Fresh profile: Cities + "Not-visited" → a non-empty world of cities you haven't
   logged; Monuments + All → every heritage site reachable; Airports + All → every
   airport. Mark one visited from its row → it updates in place.
3. Type a country name in search → its monuments and airports appear (not only the
   country). Switch to Monuments, search a country → only that country's monuments.
4. Monuments: each row shows a category tag (cultural/natural/mixed); filter to one
   category → only those remain.
5. Countries: all countries shown at once, no "load more"; search narrows live.
6. Toggle map ↔ Places with the same kind/status → the two agree.
7. Disable network (Offline mode) → browse/search/filter/mark all still work.

## Expected outcomes

- Maps to Success Criteria SC-001…SC-010 in [spec.md](../spec.md).
- No new persisted fields; export/import unchanged.
- No outbound requests attributable to the feature.
