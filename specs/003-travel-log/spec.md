# Feature Specification: Travel Log (past journeys)

**Feature Directory**: `specs/003-travel-log`

**Created**: 2026-07-05

**Status**: Draft

**Input**: Maintainer request: "Travel-ticket log" — record the journeys you've actually taken
(flights, trains, buses, ferries, drives) as a log of past trips, with per-trip distance and
totals. A *log of where you've been*, consistent with Place'Been's identity — **not** a trip
planner or a ticket-booking tool.

## Clarifications

### Session 2026-07-05

- Q: Is this future trip planning? → A: **No.** It's a log of journeys already taken — same
  "remember where you've been" spirit as visits. No itineraries, prices, or bookings.
- Q: What is a trip made of? → A: a **from** place, a **to** place, a **mode** (flight / train /
  bus / ferry / car / other), an optional **date**, optional **carrier** and **note**.
- Q: Where does distance come from? → A: the great-circle (haversine) distance between the two
  endpoints' coordinates, resolved from the existing reference data (cities and airports have
  coordinates). It's a derived fact from openly-licensed coordinates, not an invented figure; if
  an endpoint has no coordinate (e.g. a whole country), that trip simply has no distance.
- Q: Does logging a trip also mark its endpoints visited? → A: **No** — trips are their own log,
  kept independent so undo/coverage stay predictable. You mark places separately.
- Q: Where is it stored? → A: in the same one portable JSON file, as an additive `trips` array;
  old files (no trips) import unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log a journey you took (Priority: P1)

A traveler records a trip: they pick where they went **from** and **to** (a city or airport),
choose the **mode**, and optionally add the date, carrier, and a note. It's saved immediately,
offline, on the device.

**Why this priority**: Recording a journey is the whole feature; nothing else has data without it.

**Independent Test**: Offline, log a flight from CDG to JFK, reload the app, confirm the trip
persists with its computed distance.

**Acceptance Scenarios**:

1. **Given** the app is open offline, **When** the user picks a from-place, a to-place, and a
   mode and saves, **Then** the trip is recorded and appears in the trips list.
2. **Given** both endpoints have coordinates, **When** the trip is saved, **Then** its
   great-circle distance is shown.
3. **Given** a trip is being logged, **When** the user adds a date/carrier/note, **Then** they
   are stored and shown with the trip.
4. **Given** a saved trip, **When** the user removes it, **Then** it is deleted with one-tap Undo.

### User Story 2 - See your travel totals (Priority: P2)

The traveler sees totals across all logged trips: number of trips, total distance travelled, and
a breakdown by mode.

**Why this priority**: The payoff of a log is the aggregate ("I've flown 90,000 km"), but it
depends on being able to log trips first.

**Independent Test**: Log two flights, confirm the totals show 2 trips and the summed distance.

**Acceptance Scenarios**:

1. **Given** logged trips, **When** the totals render, **Then** they show the trip count and the
   summed great-circle distance.
2. **Given** trips of different modes, **When** the totals render, **Then** distance/count is
   broken down by mode.
3. **Given** a trip whose endpoint has no coordinate, **When** totals are summed, **Then** that
   trip contributes to the count but not to the distance (never a fabricated distance).

### User Story 3 - Trips are portable and inert (Priority: P3)

Trips live in the same portable JSON file as visits, round-trip losslessly, and are validated +
sanitized on import (parsed, never executed). A Markdown export summarizes them.

**Independent Test**: Export with a trip logged, re-import on a fresh store, confirm the trip is
restored; export Markdown and confirm a trips summary.

**Acceptance Scenarios**:

1. **Given** a logged trip, **When** the user exports and re-imports the JSON, **Then** the trip
   is restored unchanged.
2. **Given** an older file with no `trips`, **When** it is imported, **Then** it imports unchanged
   (backward compatible).
3. **Given** an imported file, **When** parsed, **Then** trip free-text (carrier, note) is
   sanitized by the same schema transforms as visits.

## Requirements *(mandatory)*

- **FR-030**: A trip MUST consist of a from-place, a to-place (each a reference `PlaceRef`), a
  travel mode (flight/train/bus/ferry/car/other), and optional date, carrier, and note.
- **FR-031**: Trips MUST persist locally (IndexedDB) and be part of the one portable JSON file as
  an additive `trips` array; older files without it import unchanged.
- **FR-032**: Per-trip distance MUST be the great-circle distance between the endpoints'
  coordinates from reference data; if either endpoint lacks a coordinate, the trip has no
  distance and is excluded from distance totals (never fabricated).
- **FR-033**: The app MUST show travel totals: number of trips, total distance, and a per-mode
  breakdown.
- **FR-034**: Adding and removing a trip MUST each offer one-tap Undo, consistent with visits.
- **FR-035**: Imported trip free-text MUST be validated and sanitized by the schema (inert data).
- **FR-036**: Logging a trip MUST NOT implicitly change visit/country/city coverage (trips are an
  independent log).

## Success Criteria *(mandatory)*

- **SC-001**: A traveler can log a journey in ≤ 4 actions (pick from, pick to, pick mode, save).
- **SC-002**: Total distance equals the sum of each trip's great-circle distance for trips with
  two resolvable endpoints, and is unaffected by trips without coordinates.
- **SC-003**: A file exported with trips re-imports with identical trips; a file without trips
  still imports.
- **SC-004**: All existing tests stay green; offline/privacy/a11y guarantees unchanged.

## Out of Scope (this increment)

- Trip **planning**, itineraries, prices, bookings, seat/ticket details.
- Multi-leg trips as a single object (each leg is its own trip for now).
- Drawing trip routes/arcs on the map (totals + list this increment; arcs later).
- Auto-marking a trip's endpoints as visited.
