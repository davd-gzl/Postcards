# Feature Specification: More Place Types — Airports

**Feature Directory**: `specs/002-place-types`

**Created**: 2026-07-05

**Status**: Draft

**Input**: Maintainer request: "More place types" — extend Postcards beyond cities and
countries so a traveler can also check off other kinds of places they've been. First increment:
**airports** (matching the airport counter in the original Places Been app), sourced from an
openly-licensed, bundled dataset. This increment also generalizes the data model so later place
types (UNESCO World Heritage sites, national parks, train stations) are drop-in datasets rather
than new code.

## Clarifications

### Session 2026-07-05

- Q: Which place type ships first? → A: **Airports**, because a global, openly-licensed,
  fully-bundled dataset exists (OpenFlights/OurAirports) and it needs no build-time network. It
  matches the original app's airport tally.
- Q: Why not UNESCO sites or parks first? → A: The UNESCO World Heritage list is only available
  from a UNESCO feed that this build environment's network policy blocks, and no npm package
  bundles it statically. Per the constitution (missing data → a separate shareable dataset, not
  invented app data), those types wait for their dataset to be vendored; the architecture built
  here makes adding them a data-only change.
- Q: Which airports? → A: Only airports with a valid 3-letter **IATA** code — the commercial
  airports a traveler recognizes and would check off (CDG, JFK, NRT). Airfields without an IATA
  code are omitted to keep the set lean and recognizable.
- Q: Does a visited airport count toward country/city coverage? → A: It counts toward
  **country** coverage (landing in a country means you've been to it) but never toward the
  **% of cities** or **% of regions** metrics, which remain city-only so numerators can't exceed
  their gazetteer denominators.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log an airport you've been through (Priority: P1)

A traveler searches for an airport by name or IATA code (e.g. "CDG" or "Charles de Gaulle"),
and marks it as somewhere they've been — or adds it to their wishlist, or stars it — using the
same one-tap Been / Want / Favorite control used for cities and countries. The record is saved
immediately, offline, with no account.

**Why this priority**: Adding a new place type is only worth anything if you can actually log
one. This is the smallest slice that delivers the feature's value.

**Independent Test**: Offline, search "JFK", mark it Been, reload the app, confirm it persists
and that the United States now shows as a visited country.

**Acceptance Scenarios**:

1. **Given** the app is open offline, **When** the user searches a 3-letter IATA code, **Then**
   the matching airport appears in results labelled as an airport with its city and country.
2. **Given** an airport in results, **When** the user marks it Been, **Then** it is recorded and
   its country is included in country coverage.
3. **Given** an airport already logged, **When** the user selects it again, **Then** no duplicate
   is created (one record per airport, same as cities).
4. **Given** a search term with no airport match, **When** nothing is found, **Then** the app
   states the place isn't in the loaded data and never invents one.

### User Story 2 - See your airports on the map and in your totals (Priority: P2)

Airports the user has logged appear on the map as distinct markers (not confused with city
pills), and a counter shows how many airports they've been to alongside the countries/cities
counters.

**Why this priority**: Seeing the new type reflected on the map and in the totals is the payoff,
but it depends on being able to log one first (US1).

**Independent Test**: Log two airports, open the map, confirm two airport markers render and the
counter strip shows "2 airports".

**Acceptance Scenarios**:

1. **Given** logged airports, **When** the map renders, **Then** each visited airport shows as an
   airport marker and each wishlisted airport as a distinct wish marker.
2. **Given** logged airports, **When** the totals strip renders, **Then** it shows the count of
   airports the user has been to.
3. **Given** airports and cities both logged near each other, **When** markers collide, **Then**
   they remain distinguishable by shape/label (airport marker is not a city flag-pill).

### User Story 3 - Airports stay aggregator-sourced and portable (Priority: P3)

Every airport comes from a named, openly-licensed dataset with recorded provenance; the airport
list is a bundled reference asset (like cities), and logged airports round-trip losslessly
through the portable JSON backup file.

**Independent Test**: Export the backup with an airport logged, re-import on a fresh store,
confirm the airport visit is restored; confirm the airports dataset appears in the in-app
provenance list.

**Acceptance Scenarios**:

1. **Given** an airport visit, **When** the user exports and re-imports the JSON file, **Then**
   the airport visit is restored unchanged.
2. **Given** the reference data, **When** the user views provenance, **Then** the airports
   dataset is listed with its license and source.
3. **Given** an older backup file with no airports, **When** it is imported, **Then** it imports
   unchanged (backward compatible; the `airport` place kind is additive).

## Requirements *(mandatory)*

- **FR-020**: The reference data MUST include an airports gazetteer built only from named,
  openly-licensed external datasets, with provenance recorded and shown in-app.
- **FR-021**: The airports gazetteer MUST be a bundled static asset loadable offline, built with
  no network beyond the package registry (mirrors the cities gazetteer).
- **FR-022**: Only airports with a valid 3-letter IATA code are included; each has a stable id
  (its IATA code), display name, home city (if known), ISO 3166-1 alpha-2 country, and
  coordinates.
- **FR-023**: Airport country MUST be resolved to a valid ISO 3166-1 alpha-2 code; airports whose
  country cannot be resolved to a code are omitted (never guessed).
- **FR-024**: A place of kind `airport` MUST be loggable as Been, Wishlist, and Favorite via the
  same controls and dedupe (one record per `(kind, id)`) as cities and countries.
- **FR-025**: Airports MUST be findable in search by display name and by IATA code.
- **FR-026**: Visited/wishlisted airports MUST render on the map as markers visually distinct
  from city flag-pills; visited airports contribute to country coverage but NOT to the % of
  cities or % of regions metrics.
- **FR-027**: The totals strip MUST show a count of airports the user has been to.
- **FR-028**: The `airport` place kind MUST be additive and backward compatible: older backup
  files (cities/countries only) import unchanged, and airport visits round-trip losslessly.

## Success Criteria *(mandatory)*

- **SC-001**: A traveler can find and log a well-known airport by IATA code in ≤ 2 actions.
- **SC-002**: The bundled airports asset covers every country that has at least one IATA airport,
  with 100% of included airports carrying a resolvable ISO country code and coordinates.
- **SC-003**: Logging an airport never changes a country's % of cities or % of regions.
- **SC-004**: All existing tests stay green and the offline/privacy guarantees are unchanged (the
  airports asset is bundled and SW-cached; no new network at runtime).

## Out of Scope (this increment)

- UNESCO World Heritage sites, national parks, train stations (await their vendored datasets).
- Per-airport metadata beyond id/name/city/country/coords (no terminals, runways, airlines).
- An airports "in view" browse list on the map (airports are search-driven this increment).
- Distance/flight logs or routes (that's the separate travel-ticket-log feature).
