# Tasks: Trip Reconstruction (retrospective journeys)

**Feature**: `specs/019-trip-reconstruction/` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Tests are included: this repo gates on Vitest (core logic) + Playwright/axe (a11y), and the
constitution requires automated coverage of core logic (distance, schema, import/export).

**Paths** are relative to `apps/postcards/`.

## Phase 1: Setup

- [x] T001 Add en/fr/ko i18n keys for the trip composer, approximate date, and any new nav strings
  (`trip.compose.*` — title/newTrip/addStop/removeStop/moveUp/moveDown/name/date/save/cancel/
  distance/unmeasuredLegs; `trip.date.*` — year/month/placeholder; `trip.list.*` — stops count)
  with compile-time parity across `src/lib/i18n/{en,fr,ko}.ts`.

## Phase 2: Foundational (blocking prerequisites)

- [x] T002 [P] Extend `TripSchema` in `src/lib/schema/models.ts` with optional ordered
  `stops: z.array(PlaceRefSchema).min(2).max(200).optional()` (transform-before-optional so the key
  is never injected on parse), and widen `date` regex to `^\d{4}(-\d{2}(-\d{2})?)?$` (still
  nullable/optional); bump `SCHEMA_VERSION` 10 → 11 in `src/lib/schema/helpers.ts` with a v11
  changelog entry (per data-model.md).
- [x] T003 [P] Create `src/features/travel/tripStops.ts` — pure `addStop`/`removeStop`/`moveStop`
  (immutable, clamped)/`endpoints(stops)` per `contracts/trip-reconstruction.md`.
- [x] T004 [P] Create `src/features/travel/tripDate.ts` — pure `parseTripDate`/`formatTripDate`/
  `compareTripDate`/`isValidTripDate` for `YYYY | YYYY-MM | YYYY-MM-DD | null`.
- [x] T005 Extend `src/features/travel/distance.ts` — add `tripPathKm(stops, ref): { km,
  unresolvedLegs }`; make `tripDistanceKm(trip, ref)` sum the `stops` path when present (else
  legacy `from → to`); make `travelTotals` stops-aware.
- [x] T006 Add the composer page-layer state to `src/lib/store/useUi.ts` — `tripEditId: string |
  null` on state + `NavState`, `openTripComposer(id)` (pushHistory), `closeTripComposer()` (prefer
  `goBack`), and include `tripEditId` in `pushHistory`/`goBack`/`closePages` snapshots.

**Checkpoint**: schema, pure helpers, distance, and nav plumbing exist — every story builds on these.

- [x] T007 [P] Unit `tests/unit/tripStops.spec.ts`: add/remove/reorder immutability + clamping;
  `endpoints` returns null for <2 stops, first/last otherwise.
- [x] T008 [P] Unit `tests/unit/tripDate.spec.ts`: parse/format/compare/validate for year-only,
  month, full-day, and null; undated sorts last.
- [x] T009 [P] Unit `tests/unit/tripPathKm.spec.ts`: multi-stop sum equals Σ haversine legs; an
  unresolvable stop skips its two legs and increments `unresolvedLegs`; <2 stops → 0.
- [x] T010 [P] Unit (extend `tests/unit/` schema/backup round-trip): a v11 multi-stop trip
  validates; a v10 file (no `stops`, full date) still validates and round-trips byte-identically
  (no `stops` key injected); a `YYYY`/`YYYY-MM` date validates.

## Phase 3: User Story 1 — Build a multi-stop trip (P1) 🎯 MVP

**Goal**: A dedicated composer page assembles a trip as an ordered chain of stops (airports +
cities), with a name and a rough date, saved to the file.

**Independent test**: Create a trip, add ≥3 ordered stops, name it, set a rough date, save; it
appears as one multi-stop journey and reopening restores it — all offline.

- [x] T011 [US1] Create `src/features/travel/TripComposer.tsx` — the page: an ordered stops list
  (each row a `PlacePicker` restricted to `kind ∈ {airport, city}` via `searchPlaces`), add-stop,
  remove, reorder (keyboard up/down buttons), a name field, an approximate-date field (year +
  optional month), and Save/Cancel; Escape/Back handled by the page layer.
- [x] T012 [US1] Render `<TripComposer/>` in `src/app/App.tsx` when `tripEditId` is set (alongside
  `cityPageId`/`countryPageId`); close via `closeTripComposer`, and ensure `closePages` clears
  `tripEditId`.
- [x] T013 [US1] Wire entry points in `src/features/travel/TravelScreen.tsx`: a clear "New trip"
  control opens `openTripComposer("new")`; editing an existing trip opens `openTripComposer(tripId)`.
- [x] T014 [P] [US1] Style the composer + stop rows in `src/styles.css` (≥44px targets, keyboard
  reorder buttons, wrap on mobile, clear focus/active states).
- [x] T015 [US1] Save path in `TripComposer.tsx`: build `Trip { tripId, name, stops, from:
  stops[0], to: stops[last], mode, date }` → `useTrips.addTrip`/`updateTrip`; **no visit records
  written** (FR-008); Cancel/Back discards.
- [x] T016 [US1] E2E `tests/e2e/trip-reconstruction.spec.ts`: open composer, add ≥3 stops, reorder
  and remove, save, confirm it lists as one multi-stop journey, reopen restores stops/name/date.

## Phase 4: User Story 2 — See how far you went (P2)

**Goal**: The trip shows its total great-circle km live; the Travel totals include it.

**Independent test**: Total equals Σ great-circle legs (within tolerance); editing a stop updates
it immediately; Travel totals include the trip.

- [x] T017 [US2] In `TripComposer.tsx`, show the running **total km** (`tripPathKm`) and, when any
  leg is unmeasured, a clear "some legs unmeasured" note; recompute on every add/remove/reorder.
- [x] T018 [US2] In `TravelScreen.tsx`, render each multi-stop trip's distance + stop count in the
  list row, and confirm the totals strip (via stops-aware `travelTotals`, T005) includes them.
- [x] T019 [US2] E2E in `trip-reconstruction.spec.ts`: distance updates live on add/remove/reorder;
  Travel totals reflect the reconstructed trip; a stop with no coordinate doesn't zero the total.

## Phase 5: User Story 3 — Back from a place returns to the Travel list (P2)

**Goal**: Opening a place from Travel and pressing Back once returns to the Travel list, never
stranding on the map or exiting.

**Independent test**: From Travel, open an airport; one Back/Escape/Android-back returns to the list.

- [x] T020 [US3] In `src/features/travel/TravelScreen.tsx`, change the most-visited-airports row
  `onClick` from `selectPlace(lon, lat, …)` to `useUi.getState().openCity(airport.id)` (row →
  detail page layer; `CityScreen` already serves airport ids).
- [x] T021 [US3] Audit other place-opening clicks reachable from the Travel screen for the same
  row→details rule; confirm `closePages` (App.tsx / useUi) also leaves the composer page layer.
- [x] T022 [US3] E2E in `trip-reconstruction.spec.ts` (or `escape-subviews.spec.ts`): open an
  airport from Travel; assert a single Back, a single Escape, and the Android back path each return
  to the Travel list, and the app never exits.

## Phase 6: User Story 4 — Railway stations as stops (P3, deferred)

**Goal**: Keep the stop model station-ready without inventing data.

**Independent test**: No station dataset ⇒ builder works with airports + cities and shows no broken
stations affordance; the stop model (PlaceRef) would accept a `"station"` kind unchanged.

- [x] T023 [US4] Confirm the stop model stays place-kind-agnostic (stops are `PlaceRef`; `coordsOf`
  keys on kind) and document the station deferral (a short note in `src/features/travel/` and/or
  `public/reference/PROVENANCE.md`) — stations require a future named, openly-licensed dataset; no
  invented data, no broken UI when absent.

## Phase 7: Polish & Cross-Cutting

- [x] T024 [P] Verify en/fr/ko key parity (tsc) for every new string; no missing keys.
- [x] T025 [P] a11y: extend `tests/e2e/a11y.spec.ts` to cover the composer (axe WCAG 2.1 AA) + full
  keyboard traversal (add/reorder/remove stops, date, save/cancel).
- [ ] T026 [P] (Optional nice-to-have, DEFERRED) In `src/features/map/MapScreen.tsx`/`MapView.tsx`,
  draw each **leg** of a multi-stop trip's arc (not only `from → to`), reusing `tripArcs`. Left for a
  follow-up — the map still draws the endpoint arc for multi-stop trips, so nothing is broken.
- [x] T027 Full gate: `pnpm typecheck && pnpm test && pnpm test:e2e trip-reconstruction a11y smoke`
  green; then deploy (main + feature branch + Pages mirror).

## Dependencies & order

- **Setup (T001)** → **Foundational (T002–T010)** blocks the stories.
- **US1 (T011–T016)** is the MVP; **US2 (T017–T019)** depends on US1 + distance (T005).
- **US3 (T020–T022)** is independent of the composer — a small standalone nav fix; can land first.
- **US4 (T023)** is deferred/documentation-only.
- **Polish (T024–T027)** last.

## Parallel opportunities

- T002 ∥ T003 ∥ T004 (different files); their tests T007 ∥ T008 ∥ T009 ∥ T010.
- Within US1: T014 (styles) ∥ T016 (e2e authoring).
- US2, US3 can proceed in parallel once Foundational lands (US3 needs nothing from US1).

## MVP scope

**US1 (T001–T016)** — the multi-stop composer that saves a reconstructed trip — is a shippable MVP.
**US2** (distance readout) is the headline follow-on; **US3** (back-nav fix) is a small independent
win that can ship first.

## Format validation

All tasks use `- [ ] [TaskID] [P?] [Story?] description + file path`; Setup/Foundational/Polish
carry no story label; US phases carry `[US#]`.
