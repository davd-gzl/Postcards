# Phase 0 Research: Trip Reconstruction

All questions below were resolvable from the existing codebase (two code-trace passes) and the
constitution — no external research needed. No new runtime dependency is introduced.

## D1 — Multi-stop shape: extend `Trip` additively vs. a new entity

**Decision**: Extend the existing `TripSchema` with an **optional `stops: PlaceRef[]`** array, and
keep the existing **required `from`/`to`** populated as the **first/last stop** for a multi-stop
trip.

**Rationale**:
- Additive & backward-compatible (Constitution IV/VIII): older files validate unchanged; an older
  app build reading a new multi-stop trip still sees a coherent `from → to` leg (graceful
  degradation) and can draw its arc / count it — it just misses the intermediate stops.
- Zero API break: `useTrips`, `tripsDb`, `travelTotals`, `tripArcs`, `TravelScreen` keep working;
  `from`/`to` remain the endpoints they already rely on.
- A single concept ("a trip") instead of two parallel ones ("trip" vs "journey") — matches the
  user's mental model ("a trip is a sequence of steps") and keeps the Travel list unified.

**Alternatives considered**:
- *New `Journey` entity + `journeys[]` array*: cleaner separation but forks the Travel list into
  two concepts, doubles store/UI/schema surface, and orphans the existing single-leg trips. Rejected.
- *Make `from`/`to` optional when `stops` present*: risks older builds failing to read a trip with
  no endpoints. Rejected — mirroring first/last keeps old readers happy.

**Consequence**: `stops` is present ⇒ trip is multi-stop (distance = summed path); absent ⇒ legacy
single-leg (distance = `from → to`, unchanged). A reconstructed trip requires **≥2 stops** so
`from`/`to` are always well-defined.

## D2 — Approximate ("vague") date encoding

**Decision**: **Widen** the existing `Trip.date` string from strict `^\d{4}-\d{2}-\d{2}$` to also
accept **`YYYY`** and **`YYYY-MM`** (i.e. `^\d{4}(-\d{2}(-\d{2})?)?$`), still `nullable`/optional.

**Rationale**: A relaxation is backward-compatible — every existing full-date value still validates;
only new partial-date values need v11. Reuses one field (no new date field), keeps the map's
period filter (`tripYear`/`tripMonth`) working: a `YYYY` trip has a known year and unknown month; a
`YYYY-MM` trip has both. A tiny `tripDate.ts` helper centralizes parse/format/compare so partial and
full dates sort and group consistently.

**Alternatives considered**: a separate `{year, month}` structure (more fields, migration noise);
free-text date (violates inert/validated data). Rejected.

## D3 — Distance model

**Decision**: Total distance = **sum of `haversineKm` over consecutive resolvable stops**. A stop
whose coordinate can't be resolved (`coordsOf` → null, e.g. a country or a coord-less custom point)
**breaks its two adjacent legs** — those legs contribute nothing, the rest still sum, and the UI
flags that some legs are unmeasured.

**Rationale**: Reuses the audited `haversineKm`/`coordsOf` in `features/travel/distance.ts`
(already used by `tripDistanceKm`, `CityScreen`). Great-circle "as the crow flies" matches the
"rough sketch" intent (Constitution scope: not a routing planner). Pure & offline.

**New pure fn**: `tripPathKm(stops, ref): { km: number; unresolved: number }` (or the trip-level
`tripDistanceKm` gains a stops-aware path). `travelTotals` uses the stops path when `stops` present,
else the existing `from → to`.

## D4 — Navigation fix (US3): airport row Back should return to Travel

**Root cause (confirmed)**: `TravelScreen` airport roll-up rows call
`useUi.getState().selectPlace(lon, lat, place)`, which switches the tab **trips → map** and opens a
MapLibre popup card. The popup matches `DIALOG_LAYER_SELECTOR`, so the first Back/Escape only
dismisses the card (never `goBack`), leaving the user on the map — read as "Back closed Travel."

**Decision**: Re-route the Travel airport row to open the **airport detail page layer** via
`useUi.getState().openCity(airport.id)` (rows open details; "Show on map" would open the card — the
app's established rule). `CityScreen` **already resolves airport ids** (`ref.airportById(cityId)`,
CityScreen.tsx:88), so `openCity(<IATA>)` renders a proper airport detail page over the Trips tab;
`openCity` pushes the `{tab:"trips"}` snapshot, and Back/Escape → `closeCity()`/`closePages()` →
`goBack()` restores it — **one Back returns to the Travel list**. No new page type needed for the fix.

**Rationale**: Minimal, uses the established page-layer + `history`/`goBack` model, removes the
dialog-layer double-consume, and aligns Travel with how city/country rows already behave. Preserves
the map-card affordance for an explicit "show on map" control if desired later.

**Alternatives considered**: making the cross-tab popup's dismissal also `goBack` (fragile — the
dialog-layer path runs before escape interceptors); a bespoke airport page (unnecessary — CityScreen
already serves airports). Rejected.

## D5 — The composer is a page layer

**Decision**: Host the multi-stop builder in a **new page-layer** driven by `useUi.tripEditId`
(`"new"` or an existing `tripId`), rendered in `App.tsx` alongside `cityPageId`/`countryPageId`,
with the same `pushHistory`/`closePages`/`goBack` open/close semantics.

**Rationale**: Delivers the requested "dedicated page," inherits correct Back/Escape/Android-back
for free, and keeps the composer off the scrolling Travel list. Consistent with the app's page model.

**Alternatives**: inline expand (like the current single-leg `TripForm`) — smaller but not a "page,"
and reordering/running-total UX is cramped inline. Rejected for the multi-stop builder (the simple
single-leg `TripForm` stays as-is for quick single legs).

## D6 — Railway stations: deferred, model kept kind-agnostic

**Decision**: **Defer.** Confirmed there is **no station/railway dataset** anywhere in `public/reference/`
or the reference types — only the `"train"` travel *mode*. Per Constitution I, a station dataset must
be a separate, named, openly-licensed, shareable artifact — out of scope to invent here. A stop is a
`PlaceRef`, which is kind-agnostic, so a future `"station"`-kind reference (Airport-shaped: id + name
+ city + countryIso2 + lat/lon) slots into the picker and `coordsOf` without reworking trips.

**Rationale**: Honors the aggregator principle; unblocks the airport+city MVP now.

## D7 — Stop picker pool & visit-linking (from clarifications)

**Decision**: The picker searches the **whole reference gazetteer** via the existing aggregator-only
`searchPlaces` (reused by `PlacePicker`), limited to **airport + city** results for the MVP;
building a trip is a **pure summary** and never writes visit records. No new search path needed
beyond filtering `searchPlaces` results to airports/cities.

**Rationale**: Matches the resolved clarifications (whole gazetteer, pure summary) and reuses the
existing keyboard-operable, aggregator-only picker. Keeps "visited" meaning a deliberate log, not a
layover.

## D8 — Dependencies

**Decision**: **None added.** Reuse Zustand, Zod, the distance helpers, `searchPlaces`/`PlacePicker`,
`useTrips`/`tripsDb`, the page-layer/nav model, and axe/vitest/playwright. Schema bump only:
`SCHEMA_VERSION 10 → 11` with a v11 changelog entry.
