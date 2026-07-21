# Phase 1 Data Model: Trip Reconstruction

Extends the existing `Trip` (Travel Log) additively. Source of truth: `apps/postcards/src/lib/
schema/models.ts` (Zod → TS types + published JSON Schema). Schema version: **10 → 11**.

## Entity: Trip (extended)

The existing single-leg `Trip` gains an optional ordered `stops` array and a wider `date`. Fields
unchanged unless noted.

| Field | Type | Notes |
|-------|------|-------|
| `tripId` | `idString` (1–100 chars) | unchanged |
| `name` | `string ≤80`, sanitized, optional | unchanged (folder label / trip title) |
| `from` | `PlaceRef` (required) | **For a multi-stop trip = `stops[0]`.** Kept required for backward-compat: old readers still see a leg. |
| `to` | `PlaceRef` (required) | **For a multi-stop trip = `stops[last]`.** |
| `stops` | `PlaceRef[]`, optional, **min 2 when present, max 200** | **NEW.** The ordered chain of waypoints. Present ⇒ multi-stop journey; absent ⇒ legacy single-leg. `from`/`to` MUST equal first/last stop when present. |
| `mode` | `TravelMode` enum, default `"flight"` | unchanged |
| `date` | `string \| null`, optional | **WIDENED** regex `^\d{4}(-\d{2}(-\d{2})?)?$` — accepts `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. Still nullable/optional (undated allowed). |
| `carrier` | `string ≤120 \| null` | unchanged |
| `note` | `string ≤2000 \| null` | unchanged |
| `addedAt` | ISO datetime | unchanged |
| `updatedAt` | ISO datetime, optional | unchanged (sync stamp) |

**Validation rules**:
- `stops`, when present: length ∈ [2, 200]; every element a valid `PlaceRef`; `from` deep-equals
  `stops[0]` and `to` deep-equals `stops[last]` (enforced by the writer, not a cross-field Zod
  refine unless cheap — the composer guarantees it; import validates shape only, inert).
- `stops` uses `.optional()` with the transform-before-optional idiom (as `name` does) so the key
  is **never injected on parse** — v1–v10 files round-trip byte-identically and don't gain a `stops`
  key.
- `date`: the widened regex is a **relaxation** — every previously-valid value still validates.

**Stop = `PlaceRef`** (reused, `models.ts:27`): `{ kind, id, name, countryId, lat?, lon?, population? }`.
MVP stops are `kind: "airport" | "city"`; coordinates are **resolved from reference data** at
compute time (`coordsOf`), not stored (airports/cities have no need). The kind-agnostic `PlaceRef`
lets a future `"station"` kind slot in (D6).

## Derived (never stored)

- **Total distance (km)**: `tripPathKm(stops, ref)` = Σ `haversineKm(coordsOf(stops[i]),
  coordsOf(stops[i+1]))` over consecutive **resolvable** pairs; returns `{ km, unresolvedLegs }`.
  A leg touching an unresolvable stop contributes 0 and increments `unresolvedLegs`. For a legacy
  trip (no `stops`), distance stays `tripDistanceKm(from, to)`.
- **Endpoints for display/map**: `from`/`to` (already the first/last stop).

## Top-level file (`PostcardsFileSchema`) — unchanged shape

`trips: z.array(TripSchema).max(200_000).optional().default([])` already exists (v2). No new
top-level array. Only `TripSchema` grows and `SCHEMA_VERSION` bumps.

## Versioning

`SCHEMA_VERSION: 10 → 11`. New changelog entry in `helpers.ts`:

> v11 adds an optional ordered `stops` array on a trip (multi-stop journey reconstruction) and
> widens a trip's `date` to accept a year (`YYYY`) or month (`YYYY-MM`), not only a full day.
> Both are additive/relaxing: v1–v10 files validate and round-trip unchanged (`stops` is never
> injected on parse; the date regex only accepts *more*). `from`/`to` mirror the first/last stop,
> so an older build reading a v11 multi-stop trip still sees a valid `from → to` leg.

**Backward/forward compatibility**:
- Old file → new app: no `stops`, full `date` ⇒ legacy single-leg trip (unchanged behavior). ✅
- New file → old app: unknown behavior guarded by the version bump's "update the app" prompt; if
  parsed leniently, the trip still reads as `from → to` (endpoints present). ✅
- Round-trip: files without `stops` never gain the key. ✅

## State transitions (composer session, transient)

`draft` (in the composer) → add/remove/reorder stops → on **Save**: build `Trip` with `stops`,
`from = stops[0]`, `to = stops[last]`, `name`, `date`, `mode`, stamps → `useTrips.addTrip` /
`updateTrip` (writes IndexedDB + tombstone rules unchanged). **Cancel/Back** discards the draft.
No visit records are created or changed (FR-008, pure summary).
