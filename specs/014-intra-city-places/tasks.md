# Tasks — 014 Intra-city places (stations, districts, …)

Dependency-ordered breakdown. STRICT constitution: adapt per city to REAL,
openly-licensed data with provenance — invent nothing. Missing reference data
becomes a separate shareable dataset, never app-authored points.

## Phase A — model & hierarchy
- [ ] T001 Extend `PlaceRef.kind` with the sub-place kinds (closed set): `station`, `district`
      (and optionally `park`, `landmark` if data exists) in `src/lib/schema/models.ts`.
      Additive + fail-closed for unknown kinds, like the existing airport/heritage kinds.
- [ ] T002 Sub-places roll up: visiting a station/district still counts its city and country
      (coverage stays DERIVED). Confirm `computeStats` and country/city coverage treat sub-places
      as belonging to their parent city (no double-count, no standalone country tick).

## Phase B — dataset & provenance (aggregated, cited)
- [ ] T003 Define the sub-place dataset schema: `{ id, name, kind, lat, lon, cityId, countryIso2,
      sources[] }` with per-record provenance (OSM metro/rail stations ODbL; admin districts;
      Wikidata QIDs). Document in `PROVENANCE.md` + `provenance.json`.
- [ ] T004 A per-city AVAILABILITY index (which cities have which sub-place types) so the UI only
      offers what real data supports — graceful degradation to user-authored custom points otherwise.
- [ ] T005 Per-city shards, loaded LAZILY (mirror the two-stage gazetteer): fetch a city's sub-places
      only when its page/section opens; cache. No blanket 135k-style upfront load.
- [ ] T006 A build step to produce the shards + availability index from the source datasets (kept as
      canonical human-readable source-of-truth per constitution; shards are derived artifacts).

## Phase C — loading seam
- [ ] T007 `src/lib/reference/subPlaces.ts` — a seam: `subPlacesForCity(cityId)` → `Promise<SubPlace[]>`
      using the availability index + shard fetch; returns [] when a city has none.
- [ ] T008 Merge into the reference pipeline like landmarks/heritage already merge; provenance intact.

## Phase D — UI
- [ ] T009 On the city page, a "Places within {city}" section listing available sub-places grouped by
      kind (Stations / Districts / …), each with Been/Want/Favorite toggles (reuse StateToggles).
- [ ] T010 Map: a sub-place layer when zoomed into a city (reuse the capped marker pipeline).
- [ ] T011 "Add your own" fallback for cities/kinds with no data (reuse AddPlaceForm seeded with the
      city + a sub-place kind).

## Phase E — tests
- [ ] T012 Schema accepts the new kinds; roll-up keeps coverage derived; availability gating; shard
      loader returns [] for unknown cities; every shipped sub-place has sourced provenance.

Constitution: aggregator-only with provenance, local-first, offline, inert, WCAG AA, keyboard-first.
