# Tasks: Unified Filter Panel

**Feature**: `specs/016-filter-panel/` · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

**Branch**: `claude/monument-display-optimize-x1j6le` (developed in-place)

Tests are included — this repo enforces a verify-before-claim discipline (AGENTS.md):
unit tests for pure logic, Playwright + axe for UI/a11y.

Paths are under `apps/postcards/`. `[P]` = parallelizable (different file, no incomplete dep).

---

## Phase 1: Setup

- [X] T001 Create the shared filter module folder and a typed skeleton in `src/lib/filter/types.ts` (FilterState type, `DEFAULT_FILTERS`, `FilterStatus`/`SortOrder`/`MapMode` unions) per data-model.md
- [X] T002 [P] Add i18n key stubs for the panel (`filter.title`, `filter.status.*`, `filter.people.*`, `filter.date.*`, `filter.folder`, `filter.sort.*`, `filter.mode.*`, `filter.clearAll`, `filter.removeAria`, `filter.summaryAria`, `filter.emptyFiltered`) to `src/lib/i18n/en.ts`, `fr.ts`, `ko.ts` (compile-time parity — add to all three)

## Phase 2: Foundational (blocking — all stories depend on this)

- [X] T003 Implement `isDefault`, `clearField`, `clearAll`, and per-field default helpers in `src/lib/filter/types.ts`
- [X] T004 Implement pure predicates in `src/lib/filter/applyFilters.ts`: `cityPasses(city, visitedSets, state)`, `placeMatches(visit, ref, state)`, `sortPlaces(list, state)` — population gates cities only (D4)
- [X] T005 Implement `activeChips(state, t)` deriving one `ActiveFilterChip` per non-default dimension in `src/lib/filter/applyFilters.ts`
- [X] T006 Create the shared store `src/lib/store/useFilters.ts` (state = FilterState, `set`, `clearField`, `clearAll`), hydrating/persisting preference dimensions (`status`, `minPop`, `sort`) to the existing localStorage keys; session dimensions in-memory
- [X] T007 [P] Unit test the predicates in `tests/unit/applyFilters.spec.ts` (status/pop/date/folder/growth truth table; D4 non-city pass-through; sort order)
- [X] T008 [P] Unit test `types`/store helpers in `tests/unit/filterState.spec.ts` (defaults, isDefault, clearField/clearAll, activeChips labels)

**Checkpoint**: shared filter state + predicates exist and are unit-green before any screen wiring.

## Phase 3: User Story 1 — One place to slice the map (P1) 🎯 MVP

**Goal**: A single Filter button on the map opens one panel with every dimension; the map markers, in-view list and counters read the shared store; inline status/population/sort controls are removed.

**Independent test**: Open Map → Filter, set status=Want list + People=1M+ + year=2024, close; list + counters match; no inline status/population/sort controls remain.

- [X] T009 [US1] Build `src/ui/FilterPanel.tsx` — a focus-trapped `role="dialog"` sheet rendering sections for status, People (population), date (any/year/range/undated), folder, sort, and map mode; reads/writes `useFilters`; Escape + scrim close; focus restore (contracts/panel-a11y.md)
- [X] T010 [US1] Add panel styles to `src/styles.css` (`.filter-panel`, sections, segmented reuse, scrim) — theme-aware, mobile one-hand reachable
- [ ] T011 [US1] In `src/features/map/MapScreen.tsx`, replace the local `cityFilter`/`minPop`/`sortAZ` state and the inline status segmented + People row + A–Z button with a single **Filter** button that opens `FilterPanel`; read all values from `useFilters`
- [ ] T012 [US1] Point the map date/folder + mode controls at `useFilters` (fold the existing date/folder popover contents into the panel) in `src/features/map/MapScreen.tsx`
- [ ] T013 [US1] Ensure `MapView`/`viewport.ts` receive filter values from the shared store (adapt existing `cityFilter`/`minPop` props to `useFilters.getState()`), so markers + list + counters agree
- [ ] T014 [US1] E2E `tests/e2e/filter-panel.spec.ts`: open panel on map, apply status+pop+year, assert list/counters match and inline controls are gone; reopen shows applied values

**Checkpoint**: the map is fully driven by the one panel; MVP demoable.

## Phase 4: User Story 2 — See what's active, clear in one tap (P2)

**Goal**: A compact active-filter chip summary near the Filter button; per-chip remove; Clear all.

**Independent test**: apply three filters → three chips; ✕ a chip resets just it; Clear all resets everything and hides the summary.

- [ ] T015 [US2] Build `src/ui/FilterSummary.tsx` rendering `activeChips(state, t)` as removable chips + a Clear all control (hidden when `isDefault`)
- [ ] T016 [US2] Add summary styles to `src/styles.css` (`.filter-summary`, chip, remove ✕)
- [ ] T017 [US2] Render `FilterSummary` beside the Filter button on the map in `src/features/map/MapScreen.tsx`; wire remove → `clearField`, Clear all → `clearAll`
- [ ] T018 [US2] Give the Filter button an active-state hint (dot/badge + `aria` "N filters active") in `src/features/map/MapScreen.tsx`
- [ ] T019 [US2] Extend `tests/e2e/filter-panel.spec.ts`: assert chips appear, per-chip remove resets one dimension, Clear all resets all

## Phase 5: User Story 3 — The same filter everywhere (P2)

**Goal**: Places lists read the same shared state; population non-city rule identical to the map.

**Independent test**: set filters on the map; open Places → Visited; same Filter reflects them; list agrees; population hides only cities below threshold.

- [ ] T020 [US3] In `src/features/visits/PlacesScreen.tsx`, add the same **Filter** button + `FilterPanel` + `FilterSummary`; filter the Visited/Want-list rows via `placeMatches(...)` from the shared store (keep the name search box as-is)
- [ ] T021 [US3] Apply `sortPlaces` and the D4 population rule in `PlacesScreen.tsx` so non-city places pass the population gate exactly as on the map
- [ ] T022 [US3] E2E: set filters on map, navigate to Places, assert the panel + list reflect the same state and non-city places are unaffected by a population threshold

## Phase 6: User Story 4 — Room to grow (P3)

**Goal**: Add growth dimensions inside the one panel: favorites-only, has-photo, has-note, continent.

**Independent test**: enable Favorites only → both screens narrow to favourites, combinable, no new header button.

- [ ] T023 [US4] Extend predicates in `src/lib/filter/applyFilters.ts` for `favoritesOnly`, `hasPhoto`, `hasNote`, `continent` (unit test additions in `tests/unit/applyFilters.spec.ts`)
- [ ] T024 [US4] Add the growth sections (toggles + continent select) to `src/ui/FilterPanel.tsx` and their chips to `activeChips`; add i18n keys to en/fr/ko
- [ ] T025 [US4] E2E: enable Favorites only, assert both map + Places narrow and the chip appears; enable continent, assert narrowing + chip

## Phase 7: Polish & Cross-Cutting

- [ ] T026 [P] Labelled empty state when the combined filter matches nothing (names active filters + Clear all) on both map list and Places (`MapScreen.tsx`, `PlacesScreen.tsx`) + i18n
- [ ] T027 [P] Extend `tests/e2e/a11y.spec.ts` to open the Filter panel and assert no serious axe violations (WCAG 2.1 AA); verify keyboard trap/Escape/focus-restore
- [ ] T028 [P] Perf sanity: confirm toggling any dimension re-filters the in-view/list set with no perceptible lag (memoise on `(state, list)`) — note in quickstart
- [ ] T029 [P] Update `docs/USER-STORIES.md` (new "Filter panel" epic → done) and `BACKLOG.md`; confirm i18n key parity (en/fr/ko equal)
- [ ] T030 Run full verify (`tsc` + `vitest` + `playwright`) and screenshot the panel + summary; commit and deploy to both branches; confirm CI Tests + Pages green

---

## Dependencies & order

- **Setup (T001–T002)** → **Foundational (T003–T008)** block everything.
- **US1 (T009–T014)** depends only on Foundational → **MVP**.
- **US2 (T015–T019)** depends on US1 (needs the panel + store).
- **US3 (T020–T022)** depends on Foundational + the panel/summary components (US1/US2); independent of US4.
- **US4 (T023–T025)** depends on Foundational; layers onto the panel.
- **Polish (T026–T030)** last.

## Parallel opportunities

- T002 ∥ T001; T007 ∥ T008 (different test files); within Polish, T026/T027/T028/T029 touch different files and can run in parallel before the final T030 verify+deploy.

## Implementation strategy

- **MVP = Phase 1 + 2 + US1.** Ship the consolidated map filter first (delivers the core "one place, no scattered buttons" value), then layer US2 (summary), US3 (Places parity), US4 (growth), then Polish.
- Ship each phase as its own verified commit to both branches; keep this `tasks.md` as the single source of task truth and check items off as they land.
