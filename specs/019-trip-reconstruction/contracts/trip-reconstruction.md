# Contract: Trip Reconstruction

Interfaces this feature exposes/changes. All pure functions are offline, deterministic, and
side-effect-free; UI/store contracts follow the app's existing seams.

## 1. Pure logic (unit-tested)

### `features/travel/tripStops.ts` (NEW)
```ts
// Ordered-stops helpers — immutable, no I/O.
export function addStop(stops: PlaceRef[], place: PlaceRef): PlaceRef[];
export function removeStop(stops: PlaceRef[], index: number): PlaceRef[];
export function moveStop(stops: PlaceRef[], from: number, to: number): PlaceRef[]; // reorder (clamped)
export function endpoints(stops: PlaceRef[]): { from: PlaceRef; to: PlaceRef } | null; // null if <2
```
- `moveStop` clamps indices; a no-op move returns an equal-length array.
- Never mutates the input array.

### `features/travel/distance.ts` (EXTEND)
```ts
export function tripPathKm(
  stops: PlaceRef[],
  ref: ReferenceData,
): { km: number; unresolvedLegs: number };
// Σ haversineKm over consecutive resolvable stops; a leg touching an unresolvable
// stop adds 0 and increments unresolvedLegs. <2 stops → { km: 0, unresolvedLegs: 0 }.

// tripDistanceKm(trip, ref): if trip.stops?.length >= 2 → tripPathKm(trip.stops).km,
// else the existing from→to distance (unchanged for legacy trips).
// travelTotals: uses the stops path when present.
```

### `features/travel/tripDate.ts` (NEW)
```ts
export type TripDate = string | null; // "YYYY" | "YYYY-MM" | "YYYY-MM-DD" | null
export function parseTripDate(s: TripDate): { year: number; month: number | null; day: number | null } | null;
export function formatTripDate(s: TripDate, locale: string): string; // "2024", "Aug 2024", "12 Aug 2024", ""
export function compareTripDate(a: TripDate, b: TripDate): number; // undated sorts last; year-only orders within its year
export function isValidTripDate(s: string): boolean; // matches ^\d{4}(-\d{2}(-\d{2})?)?$ with real month/day
```

## 2. Schema (`lib/schema/models.ts` + `helpers.ts`)

- `TripSchema` gains `stops: z.array(PlaceRefSchema).min(2).max(200).optional()` using the
  transform-before-optional idiom (never injected on parse).
- `TripSchema.date` regex widened to `^\d{4}(-\d{2}(-\d{2})?)?$` (still `.nullable().optional()`).
- `SCHEMA_VERSION` 10 → 11 with the v11 changelog entry (see data-model.md).
- **Contract test**: a v11 multi-stop trip validates; a v10 file (no `stops`, full date) still
  validates and round-trips byte-identically (no `stops` key injected).

## 3. Navigation (`lib/store/useUi.ts` + `App.tsx`)

### Composer page layer (NEW)
```ts
// useUi additions (mirror cityPageId/countryPageId):
tripEditId: string | null;                 // "new" | <tripId> | null
openTripComposer: (id: string | "new") => void; // pushHistory(); set tripEditId
closeTripComposer: () => void;             // prefer goBack(); else clear tripEditId
```
- `App.tsx` renders `<TripComposer/>` when `tripEditId` is set (alongside city/country pages), and
  `closePages()` also clears `tripEditId` so Escape from the composer leaves the page layer.
- Opening pushes the `{tab, cityPageId, countryPageId, tripEditId}` snapshot; Back/Escape/Android
  back close it and return to the launching screen (the Trips tab). *(NavState gains `tripEditId`.)*

### US3 back-navigation fix (CHANGE)
```ts
// TravelScreen airport roll-up row onClick:
//   BEFORE: useUi.getState().selectPlace(lon, lat, { kind:"airport", ... })
//   AFTER:  useUi.getState().openCity(airport.id)   // row → airport detail page layer
```
- **Contract**: opening a place from the Travel screen and pressing Back/Escape/Android-back
  **once** returns to the Travel list (no map dead-end, no app exit). Verified by e2e.

## 4. Composer ↔ store (`TripComposer.tsx` ↔ `useTrips`)

- On Save: construct `Trip { tripId, name, stops, from: stops[0], to: stops[last], mode, date,
  addedAt/updatedAt }` → `useTrips.addTrip(trip)` (new) or `updateTrip(id, patch)` (edit). No visit
  writes (FR-008).
- On Cancel/Back: discard; nothing persisted.
- Stop picker: reuse `PlacePicker` / `searchPlaces(ref, q)` filtered to `kind ∈ {airport, city}`.

## 5. i18n

New keys under `trip.*` / `trip.compose.*` / `trip.date.*` in `en/fr/ko.ts` with compile-time
parity (en is the source of the `MessageKey` type). All composer controls carry `aria-label`/
`title`; reorder controls are keyboard-operable buttons (not drag-only).

## 6. Invariants / edge behavior

- `stops.length < 2` ⇒ not savable as a reconstructed trip (from/to undefined); composer disables Save.
- Unresolvable stop ⇒ its legs are skipped in the total; the composer shows "some legs unmeasured".
- Legacy single-leg trips (no `stops`) render and total exactly as before.
- Everything offline: no network call in any of the above (e2e asserts zero outbound requests).
