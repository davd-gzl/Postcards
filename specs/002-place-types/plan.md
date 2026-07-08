# Implementation Plan: More Place Types — Airports

**Feature Directory**: `specs/002-place-types` · **Spec**: [`spec.md`](spec.md)

## Summary

Generalize Postcards's place model beyond `city`/`country` by adding an `airport` kind, and ship
airports as a bundled, openly-licensed reference gazetteer. Reuse every existing seam: the
Zod-validated portable schema, the `ReferenceData` interface, the Been/Want/Favorite store
actions, search, the MapLibre marker layers, and the totals strip. No new runtime network.

## Constitution Check

| Principle | How this plan complies |
| --- | --- |
| **Aggregator, never an author** | Airports come from OpenFlights (aggregated from OurAirports, public-domain source), reshaped by a build script. No airport is invented; unresolved ones are dropped, not guessed. |
| **Local-first & decentralized** | The airports gazetteer is a bundled static asset (`public/reference/airports.json`), SW-cached and loaded offline. No server, no account. |
| **Privacy by default** | No new telemetry or network at runtime; the asset is fetched from the app's own origin like `cities.json`. |
| **One portable, human-readable file** | The `airport` kind is an additive enum value in the versioned Zod schema; airport visits serialize into the same JSON file and round-trip losslessly. Old files import unchanged. |
| **Zero lock-in** | Data source is openly licensed (ODbL/public-domain); build uses the same npm-only toolchain. No Google/proprietary deps. |
| **Security — data is inert** | Airport reference data is parsed, never executed; imported airport visits pass the same Zod validation + text sanitization as cities. |
| **Efficient, accessible, keyboard-first** | Airports reuse the existing keyboard-operable search and the accessible Been/Want/Fav control; the gazetteer is filtered to IATA airports to stay lean. |
| **Interoperable & AI-friendly** | Stable IATA ids and an additive, documented schema change; provenance recorded in `provenance.json`. |

**Verdict**: PASS — no deviations. This is a data-shape extension that rides existing seams.

## Approach

1. **Dataset** (`scripts/build-reference.mjs`): read `airport-data` (bundled OpenFlights JSON),
   keep entries with a 3-letter IATA code and finite coords, map the OpenFlights country name to
   ISO 3166-1 alpha-2 via `i18n-iso-countries` (+ a small override map for known name mismatches),
   drop unresolved, dedupe by IATA, and write `public/reference/airports.json`
   `{ id, name, city, countryIso2, lat, lon }`.
2. **Schema** (`lib/schema/models.ts`): add `"airport"` to `PlaceRefSchema.kind`. Additive;
   `SCHEMA_VERSION` unchanged (old files never used the new value; forward-compat note added).
3. **Reference** (`lib/reference/types.ts` + `referenceData.ts`): add `Airport` type and
   `allAirports()` / `airportById()` / `searchAirports()`; fetch `airports.json` in
   `initReferenceData()` (parallel with cities/subdivisions); extend the sync loader + test setup.
4. **Search** (`features/visits/search.ts`, `PlaceSearch.tsx`): include airports (match name +
   IATA), labelled "Airport · <country>".
5. **Map** (`features/map/visitedLayers.ts`, `MapView.tsx`): airport point layers with a distinct
   marker (a plane pill with the IATA code), collision-safe; add to the country-tap hit-test
   exclusion.
6. **Totals** (`features/stats/StatStrip.tsx`, `computeStats.ts`): an `airportsVisited` count;
   coverage math already excludes non-city kinds from % of cities/regions.
7. **Places lists** (`features/visits/PlacesScreen.tsx`): label airport rows and fly to their
   coordinates.
8. **Provenance / README**: airports dataset row.

## Testing

- Unit: airports load, IATA search hit, all included airports have a valid ISO2 + coords, logging
  an airport leaves a country's % of cities unchanged, backward-compatible import.
- Existing Vitest + Playwright suites must stay green (privacy/offline/a11y/keyboard unchanged).

## Risks & mitigations

- **Country-name → ISO2 gaps**: a handful of OpenFlights names differ from ISO English names →
  override map + drop-if-unresolved (never guess). Assert coverage in a unit test.
- **Marker clutter**: only the user's own airports render (not all IATA airports), so the map
  stays clean; airports are discovered via search, not a viewport list.
