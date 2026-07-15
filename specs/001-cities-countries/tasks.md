# Tasks: Cities & Countries Core (MVP)

**Input**: Design documents from `specs/001-cities-countries/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED. The constitution (Development Workflow & Quality Gates) mandates automated
tests for core logic and security-focused tests for import/sanitization, so test tasks are part of
each relevant story.

**Organization**: Tasks are grouped by user story so each can be built and tested independently.

> **Implementation status (upgrade pass, 2026-07-02)** — see [`REVIEW-NOTES.md`](../../REVIEW-NOTES.md).
> A runnable MVP exists with all user stories built. **T018 city gazetteer: DONE** — 24,323
> GeoNames cities (pop ≥ 15k, CC BY 4.0) with real GeoNames ids, all French cities mapped to ISO
> regions. **T047/T048/T052: DONE** — axe WCAG 2.1 AA, keyboard-only, and zero-external-request
> privacy e2e tests all pass (6 e2e + 50 unit tests). Beyond the task list: continent-colored map,
> tap-a-country to toggle, toast + undo, country checklist, keyboard combobox, continent stats +
> drill-down. **Still open**: full Natural Earth Admin-1 (regions beyond France), T033 (PMTiles
> street basemap — currently country polygons), Capacitor native wiring, CI (T057).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 (from spec.md); Setup/Foundational/Polish carry no story label
- Paths follow the workspace layout in plan.md (`apps/postcards/...`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling.

- [ ] T001 Create pnpm workspace + repo structure per plan.md (root `package.json`, `pnpm-workspace.yaml`, `apps/postcards/`, reserved `packages/`)
- [ ] T002 Scaffold `apps/postcards` with Vite + React + TypeScript
- [ ] T003 [P] Configure strict TypeScript in `apps/postcards/tsconfig.json`
- [ ] T004 [P] Configure ESLint + Prettier in `apps/postcards/`
- [ ] T005 [P] Configure Vitest (unit) in `apps/postcards/vitest.config.ts`
- [ ] T006 [P] Configure Playwright + `@axe-core/playwright` (use preinstalled Chromium at `/opt/pw-browsers/chromium`) in `apps/postcards/playwright.config.ts`
- [ ] T007 [P] Configure `vite-plugin-pwa` (offline app-shell manifest + service worker) in `apps/postcards/vite.config.ts`
- [ ] T008 Add Capacitor (config + iOS/Android platforms) with Filesystem + Share plugins in `apps/postcards/capacitor.config.ts`
- [ ] T009 [P] Add runtime deps (`maplibre-gl`, `pmtiles`, `idb`, `zod`, `zustand`, `zod-to-json-schema`) to `apps/postcards/package.json`
- [ ] T010 [P] Create bundled-asset dirs `apps/postcards/public/basemap/` and `apps/postcards/public/reference/` each with a `PROVENANCE.md` stub

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T011 Define Zod models (PlaceRef, Visit, PostcardsFile, ReferenceSource) in `apps/postcards/src/lib/schema/models.ts` (per data-model.md)
- [ ] T012 Generate the published JSON Schema from Zod (build step) to `apps/postcards/src/lib/schema/portable-file.schema.json` (must match `contracts/portable-data-file.md`)
- [ ] T013 [P] Implement inert-data sanitization (length caps, control-char strip, leading `= + - @` neutralization) in `apps/postcards/src/lib/schema/sanitize.ts`
- [ ] T014 Implement IndexedDB persistence for visits (`idb`) in `apps/postcards/src/lib/db/visitsDb.ts`
- [ ] T015 Implement Zustand store (load/add/remove/dedupe over the DB) in `apps/postcards/src/lib/store/useVisits.ts` (depends T011, T014)
- [ ] T016 [P] Define ReferenceData loader interface + types in `apps/postcards/src/lib/reference/types.ts` (per `contracts/reference-data.md`)
- [ ] T017 Implement bundled reference loaders (countries, subdivisions, cities) in `apps/postcards/src/lib/reference/referenceData.ts` (depends T016)
- [ ] T018 [P] Vendor + document reference datasets into `apps/postcards/public/reference/` (Natural Earth Admin 0/1; GeoNames population-thresholded subset) with a build script precomputing `cityCount`/`subdivisionCount` and a filled `PROVENANCE.md`
- [ ] T019 [P] Define `MapSource` interface in `apps/postcards/src/lib/map-source/types.ts` (per `contracts/map-source.md`)
- [ ] T020 [P] Implement Intl-based number/percent/date formatting in `apps/postcards/src/lib/format/format.ts`
- [ ] T021 Build app shell + routing/pages (Map, Add, Visits, Stats, Backup) in `apps/postcards/src/app/`
- [ ] T022 [P] Build shared UI + a11y/keyboard primitives (visible focus, skip links, quick-add trigger) in `apps/postcards/src/ui/`
- [ ] T023 [P] Build reference-data provenance/attribution component in `apps/postcards/src/ui/Attribution.tsx`

**Checkpoint**: Foundation ready — user stories can now proceed.

---

## Phase 3: User Story 1 - Log a place as visited (Priority: P1) 🎯 MVP

**Goal**: Search for a city/country and mark it visited (optional date + note), persisted locally.

**Independent Test**: Offline, search "Lisbon" → log → reload → visit persists.

### Tests for User Story 1

- [ ] T024 [P] [US1] Unit test: add/update + dedupe logic in `apps/postcards/tests/unit/visits.spec.ts`
- [ ] T025 [P] [US1] E2E test: search → log → persist across reload (offline) in `apps/postcards/tests/e2e/log-visit.spec.ts`

### Implementation for User Story 1

- [ ] T026 [US1] Implement bounded city/country search over reference data in `apps/postcards/src/features/visits/search.ts` (depends T017)
- [ ] T027 [US1] Implement log-visit flow UI (search, select, optional date + note, confirm) in `apps/postcards/src/features/visits/AddVisit.tsx` (depends T015, T026)
- [ ] T028 [US1] Handle "not in dataset" with a pointer to contribute to the external dataset (FR-016) in `apps/postcards/src/features/visits/AddVisit.tsx`
- [ ] T029 [P] [US1] Implement visits list view in `apps/postcards/src/features/visits/VisitsList.tsx`
- [ ] T030 [US1] Enforce dedupe + "already visited" indication (FR-015) in `apps/postcards/src/features/visits/AddVisit.tsx`

**Checkpoint**: US1 fully functional and independently testable (walking-skeleton MVP).

---

## Phase 4: User Story 2 - See visited places on an offline map (Priority: P1)

**Goal**: Interactive, fully-offline map with visited cities as points and visited countries distinguished.

**Independent Test**: Fresh install in airplane mode → world map renders with no downloads; visits shown.

### Tests for User Story 2

- [ ] T031 [P] [US2] E2E test: fresh-install offline renders world map + visited layers in `apps/postcards/tests/e2e/offline-map.spec.ts`

### Implementation for User Story 2

- [ ] T032 [US2] Implement `BundledPmtilesMapSource` in `apps/postcards/src/lib/map-source/bundledPmtiles.ts` (depends T019)
- [ ] T033 [US2] Build + bundle world-overview `.pmtiles` + MapLibre style + glyphs/sprites into `apps/postcards/public/basemap/` (OSM/ODbL provenance)
- [ ] T034 [US2] Implement `MapView` (MapLibre + `pmtiles` protocol, offline) in `apps/postcards/src/features/map/MapView.tsx` (depends T032)
- [ ] T035 [US2] Render visited layers: city points + visited-country choropleth in `apps/postcards/src/features/map/visitedLayers.ts` (depends T034, T015)
- [ ] T036 [US2] Display map attribution returned by `MapSource` in `apps/postcards/src/features/map/MapView.tsx`

**Checkpoint**: US1 + US2 both work independently.

---

## Phase 5: User Story 3 - Back up and restore as one file (Priority: P1)

**Goal**: Export all data to one portable JSON file; import restores it exactly; Markdown export for sharing.

**Independent Test**: Export → wipe → import → state identical; adversarial imports rejected/sanitized.

### Tests for User Story 3

- [ ] T037 [P] [US3] Unit test: export→import round-trip fidelity in `apps/postcards/tests/unit/backup-roundtrip.spec.ts`
- [ ] T038 [P] [US3] Security E2E test: adversarial import fixtures (malformed, unknown keys, newer `schemaVersion`, oversized/formula/control-char fields) rejected or sanitized, never executed, in `apps/postcards/tests/e2e/import-security.spec.ts`

### Implementation for User Story 3

- [ ] T039 [US3] Implement JSON export (`PostcardsFile`) in `apps/postcards/src/features/backup/exportJson.ts` (depends T011)
- [ ] T040 [US3] Implement validated import + version migration + sanitization in `apps/postcards/src/features/backup/importJson.ts` (depends T011, T012, T013)
- [ ] T041 [P] [US3] Implement Markdown export (FR-011) in `apps/postcards/src/features/backup/exportMarkdown.ts`
- [ ] T042 [US3] Backup/restore UI wired to Capacitor Filesystem/Share (native) and File System Access/download (web) in `apps/postcards/src/features/backup/Backup.tsx`

**Checkpoint**: All P1 stories (US1–US3) complete — a demo-able, backup-safe MVP.

---

## Phase 6: User Story 4 - See coverage statistics (Priority: P2)

**Goal**: Countries visited, % of world, cities visited, and per country BOTH % of cities and % of regions.

**Independent Test**: Known visit set → figures match; both per-country metrics shown; update <1s.

### Tests for User Story 4

- [ ] T043 [P] [US4] Unit test: stats math — countries, %world, cities, %cities, %regions in `apps/postcards/tests/unit/stats.spec.ts`

### Implementation for User Story 4

- [ ] T044 [US4] Implement stats computation (both per-country metrics, from reference denominators) in `apps/postcards/src/features/stats/computeStats.ts` (depends T015, T017)
- [ ] T045 [US4] Build stats view UI (counts + %world + per-country %cities & %regions) in `apps/postcards/src/features/stats/StatsView.tsx` (depends T044)
- [ ] T046 [US4] Verify recompute <1s at ≥10k visits (SC-004); optimize/precompute denominators if needed in `apps/postcards/src/features/stats/computeStats.ts`

**Checkpoint**: US1–US4 independently functional.

---

## Phase 7: User Story 5 - Fast, keyboard-driven, accessible use (Priority: P2)

**Goal**: Core flows fully keyboard-operable with shortcuts; WCAG 2.1 AA; regional adaptivity.

**Independent Test**: Complete search→log→map→stats keyboard-only; axe-core passes with zero critical issues.

### Tests for User Story 5

- [ ] T047 [P] [US5] a11y test: axe-core WCAG 2.1 AA across primary screens in `apps/postcards/tests/e2e/a11y.spec.ts`
- [ ] T048 [P] [US5] E2E test: full flow keyboard-only in `apps/postcards/tests/e2e/keyboard.spec.ts`

### Implementation for User Story 5

- [ ] T049 [US5] Implement global keyboard shortcuts + quick-add/command palette in `apps/postcards/src/ui/shortcuts.ts`
- [ ] T050 [US5] Audit + fix focus management, ARIA labels, contrast, reduced-motion across all screens
- [ ] T051 [US5] Apply regional adaptivity (Intl dates/numbers/percents) across views via `apps/postcards/src/lib/format/format.ts`

**Checkpoint**: All user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T052 [P] Privacy test: assert zero outbound requests carrying user data during core flows (SC-006) in `apps/postcards/tests/e2e/privacy.spec.ts`
- [ ] T053 [P] Docs: app `README.md`, finalize `public/**/PROVENANCE.md`, link `contracts/` in `apps/postcards/`
- [ ] T054 Run full `quickstart.md` V1–V8 validation end-to-end
- [ ] T055 [P] Performance pass on map + stats interactions
- [ ] T056 Security hardening review of the import path (Constitution VI) in `apps/postcards/src/features/backup/importJson.ts`
- [ ] T057 CI: run unit + e2e + a11y in the pipeline

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → no deps.
- **Foundational (P2)** → depends on Setup; **blocks all user stories**.
- **User Stories (P3–P7)** → all depend on Foundational; then independent of each other.
- **Polish (P8)** → depends on the desired stories being complete.

### Story Dependencies

- **US1 (P1)** — after Foundational; no story deps (walking-skeleton MVP).
- **US2 (P1)** — after Foundational; reads visits from the store (US1's data) but is independently testable with seeded data.
- **US3 (P1)** — after Foundational; independent (operates on the store + schema).
- **US4 (P2)** — after Foundational; reads the store + reference data; independent.
- **US5 (P2)** — after Foundational; cross-cuts UI but adds no new data deps.

### Within Each Story

- Tests written to fail first → models/data → services → UI → integration.

### Parallel Opportunities

- Setup: T003–T007, T009, T010 in parallel.
- Foundational: T013, T016, T018, T019, T020, T022, T023 in parallel (distinct files).
- Once Foundational completes, US1/US2/US3 can be staffed in parallel.
- Within a story, `[P]` tests and distinct-file tasks run in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together:
Task: "Unit test: add/update + dedupe logic in apps/postcards/tests/unit/visits.spec.ts"
Task: "E2E test: search → log → persist offline in apps/postcards/tests/e2e/log-visit.spec.ts"

# Independent-file implementation together:
Task: "Visits list view in apps/postcards/src/features/visits/VisitsList.tsx"
Task: "Bounded search in apps/postcards/src/features/visits/search.ts"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → 2. Phase 2 Foundational (critical) → 3. Phase 3 US1 → **STOP & validate** (log + persist offline).

### Incremental Delivery (recommended demo path)

- Foundational → **US1** (log) → **US2** (offline map) → **US3** (backup/restore) = the true P1 MVP, demo-able and data-safe.
- Then **US4** (stats incl. both per-country metrics) → **US5** (keyboard + a11y) → Polish.

### Parallel Team Strategy

- Build Setup + Foundational together; then split US1/US2/US3 across contributors; US4/US5 follow.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- Every user story is independently completable and testable.
- Tests fail before implementing; commit after each task or logical group.
- Never read map tiles by hard-coded app-private paths — always go through `MapSource` (Constitution: Ecosystem & shared offline maps).
- All reference facts come from provenanced external datasets; the app authors none (Constitution I).
- Data files are inert: parse and validate, never execute (Constitution VI).

---

## Phase 9: Convergence

> Appended by `/speckit-converge` (2026-07-12): present-state assessment of the code against
> spec.md / plan.md / tasks.md. Notes: the 2026-07-02 status note above is partly stale —
> T018 Admin-1 subdivisions are now vendored for 242 countries (3,865 regions), and the e2e
> suite has grown to 16 specs (a11y, keyboard, privacy, smoke, airports, trips…), all passing.

- [x] T058 Add UI to attach and edit a visit's optional date and note (fields exist on the model and render in `VisitRow`/`CityScreen`, but nothing in the app ever sets them) per FR-002 / US1-AC2 (partial)
- [x] T059 Generate and publish the portable-file JSON Schema from the Zod models as a build step, matching `contracts/portable-data-file.md`, in `apps/postcards/src/lib/schema/` per T012 / Constitution VIII (missing)
- [x] T060 Add a CI workflow running unit + e2e + a11y suites on push (only the Pages deploy workflow exists) per T057 / Constitution Development Workflow & Quality Gates (missing)
- [x] T061 Add the adversarial-import security e2e (hostile fixtures — malformed, unknown keys, newer schemaVersion, oversized/formula/control-char fields — through the real import UI; unit-level coverage exists in `sanitize.spec.ts`/`backup.spec.ts`) per T038 / SC-008 / Constitution VI (partial)
- [x] T062 Add offline e2e coverage: fresh-install airplane-mode world map render (US2-AC1 / SC-007) and offline log → reload persistence (US1 / SC-002), using Playwright's offline context per T025 / T031 (missing)
- [x] T063 Decide and implement the bundled world-overview basemap: either bundle the planned `.pmtiles` + style into `public/basemap/` per plan (T033), or formally amend the plan to bless the current design (online OSM raster default with the bundled `countries-50m.json` vector fallback as the offline guarantee) per plan: basemap decision / FR-005 (partial)
- [x] T064 Complete Capacitor native wiring: add the iOS platform (only `android/` exists) and wire Backup export/import to native Filesystem/Share per T008 / T042 / plan: target platforms (partial)
- [x] T065 Add `public/reference/PROVENANCE.md` documenting source, license, and version for every vendored dataset (basemap has one; the reference dir does not — in-app Attribution already shows provenance) per T010 / T018 / FR-008 (partial)
- [x] T066 Make visited-country shading satisfy US2-AC2 by default: the choropleth exists but ships OFF behind Layers ▸ "My countries" — default it on for users with visits, or record the product decision to keep it opt-in per FR-004 / US2-AC2 (partial)
- [x] T067 Verify stats recompute stays under 1s with ≥10,000 visits (add a perf assertion or benchmark note) per T046 / SC-004 (partial)
- [x] T068 Retro-specify the shipped beyond-MVP features (trips & boarding passes, journal, moments, passport/poster, guides, photo gallery, airports & monuments datasets) via `/speckit-specify`, or record a workflow exception in the constitution docs — they are documented in CLAUDE.md but have no spec under `specs/` per Constitution: Development Workflow (unrequested)  — done: specs/007-011 (journal, moments, passport, guides, photos); airports/travel/boarding-pass already at specs/002-006
