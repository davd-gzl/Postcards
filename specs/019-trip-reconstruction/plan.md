# Implementation Plan: Trip Reconstruction (retrospective journeys)

**Branch**: `019-trip-reconstruction` (developed on `claude/journal-redesign-spec-kit-ku0l3d`) | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-trip-reconstruction/spec.md`

## Summary

Evolve the Travel screen's trip log so a user can **reconstruct a past journey as an ordered
chain of stops** (airports + cities), see its **total great-circle distance** live, and have it
count toward the Travel totals — a fast, approximate "here's what I did," never a planner. The
existing single-leg `Trip` gains an **additive, optional `stops` array** (first/last stop mirror
the existing required `from`/`to`, so old app builds still read new trips as a simple leg), plus a
looser **approximate date** (month or year). A dedicated **composer page layer** hosts the builder
(add/remove/reorder stops, name, rough date, running km). Separately, fix the **Travel back bug**:
tapping an airport in the roll-up jumps to the map and opens a popup card, so the first Back only
dismisses the card and strands the user on the map — re-route the row to the airport's **detail
page layer** (row → details, per the app's own rule) so a single Back returns to the Travel list.
Reuses the existing `haversineKm`/`coordsOf` helpers, `searchPlaces`/`PlacePicker`, `useTrips`
store + `tripsDb`, and the `cityPageId`/`countryPageId` page-layer + `history`/`goBack` model.

## Technical Context

**Language/Version**: TypeScript 5 + React 19 (Vite), PWA + Capacitor (iOS/Android).

**Primary Dependencies**: Zustand (stores), Zod (schema → JSON Schema), MapLibre GL (map only —
not used for distance), existing `features/travel/distance.ts` (`haversineKm`, `coordsOf`,
`travelTotals`, `tripArcs`). No new runtime dependency.

**Storage**: IndexedDB working store (`lib/db/tripsDb`, via `useTrips`); canonical portable
**JSON** file validated by `lib/schema/models.ts` (`PostcardsFileSchema`, current
`SCHEMA_VERSION = 10`). Trips already persist in the `trips` array (additive since schema v2).

**Testing**: Vitest (pure logic: distance, date parsing, stops validation, schema round-trip) +
Playwright/axe (composer flow, offline zero-egress, back-navigation, WCAG 2.1 AA). Existing gate:
`pnpm typecheck && pnpm test && pnpm test:e2e`.

**Target Platform**: Web (self-hostable PWA) + native iOS/Android via Capacitor. Offline-first.

**Project Type**: Single web app (`apps/postcards/`), feature-foldered.

**Performance Goals**: Composer interactions feel instantaneous; distance recompute on
add/remove/reorder is O(stops) haversine calls — trivially <16ms for realistic trips.

**Constraints**: Fully offline; zero network egress; no maps/routing/geocoding service (distance
is pure haversine on-device); aggregator-only (no invented reference data); additive schema
(older files + existing single-leg trips stay valid); WCAG 2.1 AA + keyboard-first; i18n parity
en/fr/ko enforced at compile time.

**Scale/Scope**: One new page-layer composer + a store/schema evolution + a small nav fix. Trips
per file bounded by the existing `.max(200_000)`; stops per trip bounded (e.g. ≤200).

## Constitution Check

*GATE: must pass before Phase 0 and re-checked after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Aggregator, never an author** | ✅ Stops reference existing reference places (airports/cities) resolved from named datasets; the app invents no coordinates or place facts. Railway stations are **deferred** precisely because no openly-licensed dataset ships — they will arrive as a separate shareable dataset, never hard-wired. |
| **II. Local-first & decentralized** | ✅ No server, account, or network. Trips live on-device (IndexedDB) + the portable file. |
| **III. Privacy by default** | ✅ No telemetry, no egress. Trips leave the device only via the existing explicit export. Distance is computed locally. |
| **IV. One portable, human-readable file** | ✅ Trips stay in the single JSON file; the multi-stop shape is **additive + versioned** (schema bump), export/re-import lossless, Markdown export unaffected. |
| **V. Zero lock-in** | ✅ No new proprietary/cloud dependency; no new runtime dep at all. Great-circle math is local. |
| **VI. Security — data is inert** | ✅ Stops are inert `PlaceRef`s validated by Zod on import; no executable content; sanitized name/date; strict schema rejects unknown fields. |
| **VII. Efficient, accessible, keyboard-first** | ✅ Composer is keyboard-operable (add/remove/**reorder via buttons**, not drag-only), WCAG 2.1 AA, tooltips/aria on controls, reduced-motion respected; the nav fix removes a dead-end. |
| **VIII. Interoperable & AI-friendly** | ✅ Additive versioned schema; new `stops` documented; old readers still parse new trips as a `from→to` leg (graceful degradation). |
| **Scope discipline (NON-NEGOTIABLE)** | ✅ **This is retrospective reconstruction — remembering a journey already taken — NOT trip planning.** No routing, no future itineraries, no booking, no suggestions of where to go. It records "what I did + how far," squarely inside "store data and display it well." Framed and named to avoid any planner drift. |

**Gate result: PASS.** No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/019-trip-reconstruction/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (schema shape, date encoding, nav fix, stations)
├── data-model.md        # Phase 1 — Trip.stops, approximate date, derived distance, versioning
├── contracts/
│   └── trip-reconstruction.md   # Phase 1 — pure fns + store + nav contract
├── quickstart.md        # Phase 1 — how to validate end-to-end
├── checklists/
│   └── requirements.md  # (from /speckit-specify)
└── tasks.md             # Phase 2 — /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
apps/postcards/
├── src/
│   ├── features/
│   │   └── travel/
│   │       ├── TravelScreen.tsx        # + entry point to the composer; roll-up row → details (nav fix)
│   │       ├── TripComposer.tsx        # NEW — full-page multi-stop builder (page layer)
│   │       ├── TripForm.tsx            # existing single-leg add/edit (kept; may share PlacePicker)
│   │       ├── PlacePicker.tsx         # reused for each stop (aggregator-only search)
│   │       ├── distance.ts             # + tripPathKm(stops, ref); travelTotals honors stops
│   │       ├── tripDate.ts             # NEW — parse/format/compare approximate dates (YYYY | YYYY-MM | YYYY-MM-DD)
│   │       └── tripStops.ts            # NEW — pure helpers: reorder/add/remove, endpoints, validation
│   │   └── map/
│   │       └── MapScreen.tsx / MapView.tsx  # optional: tripArcs draws each leg (nice-to-have)
│   ├── lib/
│   │   ├── schema/models.ts            # TripSchema += optional stops[]; date regex widened; SCHEMA_VERSION → 11
│   │   ├── schema/helpers.ts           # SCHEMA_VERSION bump + changelog entry
│   │   ├── store/useTrips.ts           # unchanged shape (stores richer Trip); no API break
│   │   ├── store/useUi.ts              # + tripEditId page-layer state (open/close, pushes history)
│   │   └── i18n/{en,fr,ko}.ts          # new composer/date/nav strings, parity
│   └── styles.css                      # composer + stop-row styles (≥44px targets)
└── tests/
    ├── unit/
    │   ├── tripPathKm.spec.ts          # NEW — multi-stop distance, unresolved-stop skip
    │   ├── tripDate.spec.ts            # NEW — approximate date parse/format/sort
    │   ├── tripStops.spec.ts           # NEW — reorder/add/remove/endpoints
    │   └── schema round-trip           # extend: new trip validates; old file still valid
    └── e2e/
        └── trip-reconstruction.spec.ts # NEW — build multi-stop trip, live km, back-from-airport, offline, a11y
```

**Structure Decision**: Single web app, feature-foldered under `apps/postcards/src/features/travel/`.
The composer is a **page layer** (new `useUi.tripEditId`) rendered over the Trips tab in
`App.tsx`, mirroring `cityPageId`/`countryPageId` so Back/Escape/`goBack` behavior is inherited and
consistent — this both delivers the "dedicated page" and underpins the US3 navigation fix.

## Phase notes

- **Phase 0 (research.md)** resolves: (a) multi-stop schema shape — additive `stops[]` with
  `from`/`to` mirrored to first/last for backward-compat vs. a new entity (chosen: additive
  `stops[]`); (b) approximate-date encoding (widen the existing `date` string to accept
  `YYYY`/`YYYY-MM`/`YYYY-MM-DD`); (c) distance model (great-circle sum, unresolved-stop skip);
  (d) the US3 nav-fix approach (row → airport **detail page layer**, not the map popup) and how
  the airport detail page is reached (`openCity` with the IATA id / the intra-city-places path
  from feature 014) — verified during implementation; (e) confirming **no station dataset** exists
  and the deferral is documented; (f) no new dependencies.
- **Phase 1** emits `data-model.md` (the `Trip.stops` shape, approximate date, derived distance,
  `SCHEMA_VERSION` bump + backward-compat rules), `contracts/trip-reconstruction.md` (the pure
  functions `tripPathKm`/`tripStops`/`tripDate`, the `useUi.tripEditId` nav contract, and the
  composer↔store contract), and `quickstart.md` (end-to-end validation incl. offline + back-nav).

## Complexity Tracking

No constitutional violations; no deviations from ratified tech defaults. Section intentionally empty.
