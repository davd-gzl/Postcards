# Tasks: Places Explore & Track

**Feature**: `specs/018-places-explore/` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Tests are included: this repo gates on Vitest (core logic) + Playwright/axe (a11y),
and the constitution requires automated coverage of core logic.

**Paths** are relative to `apps/postcards/`.

## Phase 1: Setup

- [ ] T001 Add en/fr/ko i18n keys for the new Places controls (kind labels reuse `filter.mode.*`; add status-axis labels `places.status.{all,visited,wishlist,favorites,notVisited}`, `places.browse.*` empty/aria strings, `filter.category.{all,cultural,natural,mixed}`) with parity across `src/lib/i18n/{en,fr,ko}.ts`.
- [ ] T002 [P] Create stub `src/features/visits/browseList.ts` exporting `browseList(...)` and its `BrowseRow` type per `contracts/places-explore.md` (empty impl returning `[]`), so downstream files can import it.

## Phase 2: Foundational (blocking prerequisites)

- [ ] T003 Extend `FilterState` in `src/lib/store/useFilters.ts` with `category: "" | "cultural" | "natural" | "mixed"` (default `""`, session-scoped, added to `DEFAULT_FILTERS`, `currentFilters`, `isDefault`, `withFieldCleared`).
- [ ] T004 [P] Add a status-axis helper in `src/lib/store/useFilters.ts` (or a small `placesStatus.ts`) mapping the single UI status value (`all|visited|wishlist|favorites|notVisited`) ↔ the existing `status`/`favoritesOnly` fields per research D3; unit-cover the mapping.
- [ ] T005 Extend `placeMatches` in `src/features/filter/applyFilters.ts` to honor `filter.category` when the place is a monument (heritage); no-op for other kinds; keep existing `mode`/status/minPop behavior.
- [ ] T006 Implement `browseList(kind, filter, ref, visits, query)` in `src/features/visits/browseList.ts`: source reference rows for the kind (`ref.allCities()/allHeritage()/allAirports()/countries`), overlay status/favorite via `visitIndex(visits)`, apply status axis + `minPop`/`category`/`continent` + `query`, order per `sort`; for cities rank by population and return a bounded/paged working set (reuse `features/map/viewport.ts` ranking) — never all 135k.
- [ ] T007 [P] Extend search to match monuments & airports by country in `src/features/visits/search.ts` (and heritage/airport search paths): a query also matches `countryIso2` + country name for those kinds, alongside name/IATA/city.

**Checkpoint**: shared filter, browse builder, predicates, and search-by-country exist and are unit-tested — every story below builds on these.

## Phase 3: User Story 1 — Clean kind × status axes, no duplication (P1) 🎯 MVP

**Goal**: One kind control (Cities/Monuments/Airports/Countries) + one status control (All/Visited/Wishlist/Favorites/Not-visited); no concept duplicated; the two compose.

**Independent test**: "Monuments" appears in exactly one control; changing kind preserves status and vice-versa.

- [ ] T008 [US1] Replace the status tabs + kind pill in `src/features/visits/PlacesScreen.tsx` with the two segmented axes — kind (single-select, drives `mode`, adds `countries`) and status (single-select via the T004 mapping); remove the duplicated Monuments/Favorites/Wishlist tabs.
- [ ] T009 [US1] Route the collections (Moments/Photos/Passport) to a secondary control in `PlacesScreen.tsx`, kept separate from the kind × status browse (per clarify D7); ensure the single header title (from feature 018 baseline) still names the current view.
- [ ] T010 [P] [US1] Style the two axes in `src/styles.css` (reuse `segmented`; ensure ≥44px targets, wrap on mobile, clear active state) and confirm `aria-pressed`/`role="group"`/labels.
- [ ] T011 [US1] E2E `tests/e2e/places-explore.spec.ts`: assert each place kind is selectable in exactly one control, and kind↔status selections compose without resetting each other.

## Phase 4: User Story 2 — Browse the whole world (P2)

**Goal**: Within any kind, browse all reference places (not just visits), status-marked, mark-in-place; instant at world scale.

**Independent test**: Cities + Not-visited shows unlogged reference cities; mark one visited in place; all offline.

- [ ] T012 [US2] Wire `PlacesScreen.tsx` list rendering to `browseList(kind, filter, ref, visits, query)` for cities/monuments/airports (replace the visit-iterating Visited/Favorites/Wishlist paths with the reference+overlay browse driven by the status axis).
- [ ] T013 [US2] Render a `BrowseRow` with per-row status + `StateToggles` (visit/wishlist/favorite) that update in place without navigating, in `PlacesScreen.tsx`; keep the existing row-click → details behavior.
- [ ] T014 [P] [US2] Ensure the city browse stays bounded/instant: cap + population-rank + `ListPager`, and scope to a country's cities when a country is chosen (in `browseList.ts` + `PlacesScreen.tsx`).
- [ ] T015 [P] [US2] Named empty states for empty kind × status (with one-tap "widen"/clear) in `PlacesScreen.tsx`.
- [ ] T016 [US2] Unit `tests/unit/browseList.spec.ts`: reference+overlay per kind; status axis (all/visited/wishlist/favorites/not-visited); cities bounded & population-ranked; offline (no network in the pure fn).
- [ ] T017 [US2] E2E in `places-explore.spec.ts`: fresh profile browses non-empty world per kind; mark-in-place; Offline-mode run asserts zero outbound requests.

## Phase 5: User Story 3 — Search anything, incl. by country (P3)

**Goal**: One search over all kinds; monuments & airports findable by country.

**Independent test**: search a country → its monuments & airports appear; search a monument name / airport code resolves; offline.

- [ ] T018 [US3] Wire the Places search box to filter `browseList` by `query` for the active kind, and confirm the global top-bar search (`search.ts`) surfaces monuments/airports by country, in `PlacesScreen.tsx`.
- [ ] T019 [P] [US3] Unit `tests/unit/search.spec.ts` additions: monuments & airports match by country name + ISO2; cities unaffected.
- [ ] T020 [US3] E2E in `places-explore.spec.ts`: Monuments kind + country query → only that country's monuments; Airports kind + country query → that country's airports.

## Phase 6: User Story 4 — Monument category tags + filter (P4)

**Goal**: Category tag on monument rows; filter monuments by category.

**Independent test**: monument rows show cultural/natural/mixed tags matching the map; filtering to one category narrows correctly.

- [ ] T021 [US4] Show the dataset category as a row tag (via `heritageGlyph()` + label) on monument `BrowseRow`s in `PlacesScreen.tsx`; graceful when a record has no category.
- [ ] T022 [US4] Add a category filter control (All/Cultural/Natural/Mixed) shown only for the Monuments kind, driving `filter.category`, in `PlacesScreen.tsx`.
- [ ] T023 [P] [US4] Unit `tests/unit/applyFilters.spec.ts` (or browseList): category filter narrows monuments; no-category record excluded only by an explicit filter.
- [ ] T024 [US4] E2E in `places-explore.spec.ts`: category tag visible + category filter narrows.

## Phase 7: User Story 5 — All countries at once (P5)

**Goal**: Country list shows every country, no pager, still searchable.

**Independent test**: countries render with no "load more"; name search narrows live.

- [ ] T025 [US5] Remove `ListPager` from the countries view in `PlacesScreen.tsx`; render all in-scope countries at once (keep scope toggle + name search).
- [ ] T026 [US5] E2E in `places-explore.spec.ts`: no pager control on Countries; search narrows.

## Phase 8: Polish & Cross-Cutting

- [ ] T027 [P] Verify en/fr/ko key parity (tsc) for every new string; no missing keys.
- [ ] T028 [P] a11y: extend `tests/e2e/a11y.spec.ts` to cover the redesigned Places (axe WCAG 2.1 AA) + full keyboard traversal of kind/status/search/rows.
- [ ] T029 [P] Remove now-dead code paths (old tab logic, redundant kind pill, `hideTitle` remnants) in `PlacesScreen.tsx`; confirm map ↔ Places agreement (FR-012).
- [ ] T030 Full gate: `pnpm typecheck && pnpm test && pnpm test:e2e places-explore a11y smoke filter-panel` green; then deploy (main + feature + Pages mirror).

## Dependencies & order

- **Setup (T001–T002)** → **Foundational (T003–T007)** blocks everything.
- **US1 (T008–T011)** is the MVP structural slice; **US2 (T012–T017)** depends on Foundational + US1 controls; **US3/US4/US5** depend on US2's browse list but are independent of each other.
- **Polish (T027–T030)** last.

## Parallel opportunities

- T002 ∥ (after T001); T004 ∥ T005 ∥ T007 within Foundational (different files).
- Within a story, `[P]` tasks touch different files (e.g., T010 styles ∥ T011 e2e; T014 ∥ T015).
- US3, US4, US5 can proceed in parallel once US2 lands.

## MVP scope

**US1 (T001–T011)** — the clean two-axis Places screen with no duplication — is a
shippable MVP on its own. **US2** (browse the world) is the headline follow-on.

## Format validation

All tasks use `- [ ] [TaskID] [P?] [Story?] description + file path`; Setup/Foundational/Polish carry no story label; US phases carry `[US#]`.
