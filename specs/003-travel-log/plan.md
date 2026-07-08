# Implementation Plan: Travel Log (past journeys)

**Feature Directory**: `specs/003-travel-log` · **Spec**: [`spec.md`](spec.md)

## Summary

Add a log of journeys already taken, stored in the same portable file. A `Trip` references two
places (reused `PlaceRef`), a mode, and optional date/carrier/note. Distance is derived
(haversine) from the endpoints' reference coordinates. A new Trips screen adds/lists trips and
shows totals. No external data, no new runtime network.

## Constitution Check

| Principle | How this plan complies |
| --- | --- |
| **Aggregator, never an author** | Trips are user-authored personal records (like visits), not world facts. Distance is *derived* from openly-licensed coordinates already in the app, never invented; no-coordinate trips simply have no distance. |
| **Local-first & decentralized** | Trips persist in IndexedDB; no server, no account; works offline. |
| **Privacy by default** | No telemetry; trips leave the device only via explicit export. |
| **One portable, human-readable file** | `trips` is an additive, optional array in the versioned Zod schema; old files import unchanged; trips round-trip losslessly + appear in Markdown export. |
| **Zero lock-in** | No new deps; pure TS + existing stack. |
| **Security — data is inert** | Imported trips pass the same Zod validation + text sanitization as visits; parsed, never executed. |
| **Efficient, accessible, keyboard-first** | Reuses the accessible search/pick pattern; the Trips form is keyboard-operable and labelled. |
| **Interoperable & AI-friendly** | Documented additive schema; stable ids; derived distance is transparent (haversine of recorded coordinates). |
| **Not a trip planner** | Explicitly a log of *past* journeys — no itineraries, prices, or bookings. |

**Verdict**: PASS — additive, user-authored data on existing seams; stays within Postcards's
"remember where you've been" identity.

## Approach

1. **Schema** (`lib/schema/models.ts`): `TravelModeSchema` enum + `TripSchema` (tripId, from, to,
   mode, date?, carrier?, note?, addedAt) with sanitized free-text; add optional
   `trips: TripSchema[]` (default `[]`) to `PostcardsFileSchema`. `SCHEMA_VERSION` unchanged.
2. **Persistence** (`lib/db`): bump the IndexedDB version to 2, add a `trips` object store;
   `tripsDb` CRUD reusing the shared DB handle.
3. **Store** (`lib/store/useTrips.ts`): `trips`, `load`, `addTrip`, `removeTrip`, `setAll` —
   mirrors `useVisits`.
4. **Distance** (`features/travel/distance.ts`): `coordsOf(place, ref)` (city/airport → lon/lat),
   `haversineKm`, `tripDistanceKm`, and `travelTotals(trips, ref)` (count, totalKm, per-mode).
5. **UI**:
   - `PlacePicker` — a small keyboard-operable autocomplete over `searchPlaces` returning a
     `PlaceRef` (factored so both endpoints reuse it).
   - `TravelScreen` — add-trip form (from/to pickers, mode select, date, carrier, note), a totals
     summary, and a trips list (mode icon, "From → To", date, distance) with Undo on remove.
   - Add a 4th nav tab **Trips** (`useUi` Tab union + `App` tabs + icon + `1..4`/`t` shortcut).
6. **Backup** (`features/backup`): include `trips` in export/build/import (return + apply trips);
   Markdown gets a Trips section.
7. **Docs**: README feature bullet + roadmap update; no new provenance (user data).

## Testing

- Unit: haversine correctness (known CDG→JFK ≈ 5,830 km ± tolerance), totals sum + per-mode,
  no-coordinate trip excluded from distance, schema round-trip + backward-compatible import,
  store dedupe/add/remove.
- e2e: log a trip via the form, see it listed with a distance and reflected in totals.
- Existing Vitest + Playwright suites stay green (privacy/offline/a11y/keyboard).

## Risks & mitigations

- **DB migration**: version bump must keep the existing `visits` store — upgrade creates stores
  idempotently (`contains` guard). Verified by loading pre-existing visits after the bump.
- **Endpoint without coordinates** (country refs): `tripDistanceKm` returns null; totals skip it,
  UI shows "—". Covered by a unit test.
- **Nav crowding** (4 tabs): compact bottom-nav already scales to four on mobile.
