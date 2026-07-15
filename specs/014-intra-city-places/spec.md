# Feature Specification: Intra-city Places

**Feature Directory**: `specs/014-intra-city-places`

**Created**: 2026-07-15

**Status**: Draft — designed with the maintainer

**Input**: User description: "Let me remember places at a finer grain than the city — the metro and
rail stations I passed through, the districts and neighbourhoods I wandered, the parks and the
landmarks inside a city — extending the hierarchy country → city → sub-place. Adapt to each city
honestly: offer exactly the sub-place types for which real, openly-licensed data exists (OpenStreetMap
stations and admin districts, Wikidata, each with recorded provenance) and invent nothing — a city
rich in open data offers many types, a city with none offers only the places I add myself. Load a
city's sub-places only when I open it, the way the world gazetteer streams in behind the map. Visiting
a station or a district still counts its city and its country. Keep it offline, inert, local-first,
and private."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log a place within a city (Priority: P1)

From a city they have opened, the user browses the finer-grained places inside it — subway/metro and
rail stations, districts/neighbourhoods, parks, landmarks — and marks one as visited, optionally with
a date and a note. The record is saved on the device, offline, and points at named reference data by a
stable id, exactly like a city or a monument.

**Why this priority**: Logging a sub-place is the whole point of the feature and the smallest slice
that already delivers value — a traveller who remembers "the metro station by my hotel" or "that
neighbourhood" gets a record they could not keep before. Everything else (per-city adaptation, roll-up,
stats) builds on this capture step.

**Independent Test**: Open a city known to have sub-place data (e.g. Paris) with no network, browse its
stations, mark one visited, close and reopen the app, and confirm the sub-place is still recorded under
that city. Delivers value on its own as a finer-grained visited-places log.

**Acceptance Scenarios**:

1. **Given** an opened city whose sub-place data is available, **When** the user browses its sub-places
   and marks one visited and confirms, **Then** the sub-place is recorded as visited, points at the
   reference row by stable id, and appears in the user's list under its parent city.
2. **Given** a sub-place is being logged, **When** the user optionally adds a date and a note, **Then**
   both are stored with the visit and shown when it is viewed, using the same record shape as any other
   visit.
3. **Given** a sub-place already marked visited, **When** the user selects it again, **Then** no
   duplicate is created and the app clearly indicates it is already visited.
4. **Given** a sub-place row in the reference data, **When** the user views it, **Then** its subtype
   (station / district / park / landmark), parent city, country, and dataset provenance are shown, and
   the app never presents an invented sub-place.

---

### User Story 2 - The app adapts per city to whatever real data exists (Priority: P1)

What the app offers inside a city is driven entirely by which openly-licensed data actually exists for
that city. A city rich in open data (many stations, named districts, parks, landmarks) offers all of
those sub-place types; a city with only station data offers only stations; a city with none offers no
reference sub-places at all — only the user's own custom points. The app invents nothing to fill the
gaps.

**Why this priority**: Honest per-city adaptation is the constitutional heart of the feature
(Constitution I: aggregator, never an author). Getting it wrong — showing empty categories, or worse,
fabricating stations — would violate the core promise, so it ships with the capture step, not after.

**Independent Test**: Open one city with rich sub-place data and confirm several subtypes are offered
with real entries; open a city with no sub-place data and confirm no reference sub-place types are
offered (only "add your own place"), with no fabricated entries and no empty-category noise.

**Acceptance Scenarios**:

1. **Given** a city with data for multiple subtypes, **When** the user opens it, **Then** exactly those
   subtypes that have real entries are offered, each labelled and attributable to its dataset.
2. **Given** a city with data for only one subtype (e.g. stations), **When** the user opens it, **Then**
   only that subtype is offered and no empty categories are shown.
3. **Given** a city with no sub-place data at all, **When** the user opens it, **Then** the app offers
   no reference sub-places and instead points to adding the user's own place (the existing custom-place
   path), never inventing a sub-place.
4. **Given** a city whose sub-place data is missing from the app, **When** the user looks for it,
   **Then** the app states the data is not present and points to contributing it to the external,
   shareable dataset — it does not author the data in-app.

---

### User Story 3 - Sub-places roll up into city and country coverage (Priority: P2)

Visiting a sub-place counts its parent city and that city's country, so coverage stays derived: the
user does not have to also log the city separately. On the map and in statistics, a visited station or
district appears in place, contributes to its city being counted, and — for a city with sub-place data —
the user can see how much of that city's known sub-places they have covered.

**Why this priority**: Roll-up is what makes sub-places part of one coherent hierarchy rather than a
disconnected list, and it depends on Story 1 producing records first, so it layers on top of the
capture core.

**Independent Test**: In a city not otherwise logged, mark a sub-place visited, then open statistics and
the map and confirm the parent city and its country now count as covered (derived, with no separate city
record), and the city shows a sub-place coverage figure.

**Acceptance Scenarios**:

1. **Given** a visited sub-place in a city with no separate city visit, **When** the user opens
   statistics, **Then** the parent city and its country are counted as covered by derivation, with no
   fabricated standalone city or country record.
2. **Given** visited sub-places, **When** the user opens the map, **Then** each is drawn in place with
   styling for its subtype, and the header shows how many in view are visited out of the total in view.
3. **Given** a city with sub-place data and some sub-places visited, **When** the user views that city,
   **Then** the share of that city's known sub-places visited (overall and/or per subtype) is shown,
   using the reference data as the denominator.
4. **Given** the user adds or removes a sub-place visit, **When** they return to statistics or the map,
   **Then** the derived city/country coverage and the per-city sub-place figures reflect the change.

---

### User Story 4 - Offline, inert, private, and keyboard-accessible (Priority: P2)

A city's sub-place data loads only when the user opens that city — streamed in on demand, like the world
gazetteer, never blocking the app — and once cached it works fully offline. All of it is inert reference
data, no user data leaves the device, provenance is discoverable, and every action is reachable by
keyboard.

**Why this priority**: These are explicit product values (local-first, privacy, accessibility,
performance) that must hold for the feature, but they layer on the functional core rather than blocking
it.

**Independent Test**: Open a city online once so its sub-places cache, go offline, reopen the app, and
confirm that city's sub-places still browse, log, map, and count with zero network requests and full
keyboard operation, passing an automated accessibility audit.

**Acceptance Scenarios**:

1. **Given** a city the user has not opened before, **When** they open it, **Then** its sub-place data
   is fetched lazily for that city only, without blocking first paint or the map, and app startup time
   is unaffected whether or not sub-place data exists.
2. **Given** a city whose sub-place data has been loaded once, **When** the user is offline, **Then**
   browsing, logging, mapping, and counting that city's sub-places all work with zero network requests.
3. **Given** any sub-place reference row, **When** it is loaded and rendered, **Then** it is treated as
   inert data — displayed only, never executed — and its dataset source, license, and version are
   discoverable.
4. **Given** the sub-place browse, log, and per-city coverage views, **When** the user navigates by
   keyboard alone, **Then** every action is reachable with visible focus and the views meet WCAG 2.1 AA.

---

### Edge Cases

- A city has no sub-place data → no reference subtypes are offered and nothing is invented; the user is
  offered the existing "add your own place" (custom) path instead.
- A city has data for some subtypes but not others → only the populated subtypes appear; empty
  categories are never shown.
- A sub-place's reference row has no usable coordinates → it can still be listed and logged but is
  omitted from the map (nothing is pinned at null island / invented).
- A sub-place is visited but its parent city was never logged separately → the city and its country
  still count as covered by derivation, with no fabricated standalone record.
- The same sub-place is logged twice → no duplicate is created; the app indicates it is already visited.
- A sub-place dataset is missing entirely from the app → the app reports "not in the loaded data" and
  points to the external, shareable dataset; it never authors the sub-place in app code.
- An imported file carries a sub-place whose subtype or parent-city reference is unknown to the build →
  the record fails closed with the graceful "update the app" prompt rather than being silently dropped
  or mis-read.
- A sub-place row's parent city is itself absent from the gazetteer → the roll-up still counts the
  country (carried on the record) and the sub-place is shown, but it is not attributed to a city that
  does not exist in reference data.
- The device is offline and the user opens a city whose sub-places were never cached → the app shows
  that the finer data is unavailable offline for now and still lets the user log their own custom point.
- Two sub-places in different cities share a name (e.g. "Central Park", "Chinatown") → each is
  disambiguated by its parent city and country before logging.
- A very large city (thousands of sub-places) is opened → its list and map remain responsive because
  only that city's shard is loaded, not the whole world's sub-places.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST extend the place hierarchy with a sub-place level below city
  (country → city → sub-place), so a user can mark a place *within* a city as visited using the same
  visit record machinery as cities, countries, airports, and monuments.
- **FR-002**: A sub-place MUST carry a subtype drawn from a closed, additive set — at minimum
  `station` (metro/subway/rail), `district` (neighbourhood/administrative district), `park`, and
  `landmark` — and MUST record which subtype it is.
- **FR-003**: Every reference sub-place MUST originate from a named, openly-licensed external dataset
  (e.g. OpenStreetMap stations and admin districts, Wikidata) with recorded provenance (source,
  license, version, url). The system MUST NOT author or invent any sub-place.
- **FR-004**: What the app offers inside a given city MUST be driven by which sub-place data actually
  exists for that city: only subtypes with real entries are offered, and a city with no sub-place data
  offers no reference sub-places (graceful degradation), never fabricated placeholders or empty
  categories.
- **FR-005**: For a city with no reference sub-place data, the system MUST fall back to the existing
  user-authored custom-place path, clearly marked as the user's own place and never presented as
  reference data.
- **FR-006**: Visiting a sub-place MUST count its parent city and that city's country as covered by
  derivation, without requiring or fabricating a separate city or country record (coverage stays
  derived, consistent with the country-coverage rule).
- **FR-007**: A visited sub-place MUST be displayable on the map in styling for its subtype, with the
  same in-view "visited out of total in view" counting the other place types use; a sub-place with no
  usable coordinates MUST be omitted from the map rather than pinned at (0,0).
- **FR-008**: For a city that has sub-place data, the system MUST be able to show that city's sub-place
  coverage — the share of its known sub-places visited (overall and/or per subtype) — using the
  reference dataset as the denominator, derived at read time.
- **FR-009**: Sub-place reference data MUST be loaded lazily, per city, on demand when a city is opened
  — mirroring the two-stage gazetteer's off-thread, idle-time streaming — so it never blocks first
  paint, the map spinning up, or app startup, whether or not data exists for that city.
- **FR-010**: The system MUST expose sub-place reference data through a single pluggable seam (a
  "sub-place source"), so its backing dataset(s) are replaceable and the rest of the app does not depend
  on where or how sub-places are physically stored.
- **FR-011**: The system MUST provide a lightweight availability index (which cities have sub-place data
  and which subtypes) that can be consulted cheaply without loading any city's full sub-place shard, so
  the UI can decide what to offer before fetching detail.
- **FR-012**: Reference sub-place data MUST be kept strictly separate from personal data and MUST NOT be
  written into the user's portable file except by reference (the visit points at a sub-place by stable
  id); the user's file MUST remain portable without bundling reference datasets.
- **FR-013**: A sub-place visit record MUST carry enough denormalized, inert data (parent city id,
  country, name, coordinates) to display, map, and roll up the visit even when that city's reference
  shard is not currently loaded, so offline round-trips never depend on the dataset being present.
- **FR-014**: Once a city's sub-place data has been loaded, all sub-place actions for that city
  (browse, log, map, count) MUST work fully offline with zero network requests.
- **FR-015**: The system MUST prevent duplicate sub-place visits for the same reference sub-place and
  clearly indicate when one is already marked visited.
- **FR-016**: When a city's or a sub-place's data is absent from the app, the system MUST inform the
  user and point them to contributing it to the external, shareable dataset, rather than creating it
  in-app; missing reference data becomes a separate dataset, never app code.
- **FR-017**: The portable file schema MUST carry sub-place visits additively and version them, so
  older files import unchanged and a newer file opened by an older build fails closed with a graceful
  "update the app" prompt rather than a cryptic error or silent data loss.
- **FR-018**: On import, sub-place records MUST be validated against the published, versioned schema and
  rejected or sanitized if malformed; the system MUST NEVER execute, evaluate, or act on content in a
  sub-place record or dataset.
- **FR-019**: All sub-place actions (browse, log, per-city coverage, map view) MUST be fully
  keyboard-operable with visible focus and meet WCAG 2.1 AA.
- **FR-020**: The system MUST display the provenance (source, license, version) of each sub-place
  dataset in use, alongside the app's other reference-data provenance.
- **FR-021**: Sub-place datasets SHOULD be sharded per city (or per small group of cities) so opening a
  city fetches only that city's sub-places, keeping the per-open payload small and the whole-world set
  off the startup path.

### Key Entities *(include if feature involves data)*

- **Sub-place (reference)**: A finer-grained place within a city, aggregated from a named open dataset.
  Attributes: stable id (e.g. Wikidata QID or OSM type/id), subtype (station / district / park /
  landmark), parent city id (the roll-up join key), country, name, coordinates, and dataset provenance.
  Read-only aggregate data — never authored by the app.
- **Sub-place PlaceRef (extended)**: A place reference of a new sub-place kind, added additively to the
  existing kinds. Beyond the common fields it records the parent city id, subtype, country, name, and
  coordinates (denormalized and inert) so a visit can be shown, mapped, and rolled up without the city's
  reference shard being loaded.
- **Visit (reused)**: The existing per-place record, now able to point at a sub-place. Carries the same
  optional date, note, status, favorite, and photos — sub-places gain nothing bespoke, they reuse the
  visit machinery.
- **City sub-place shard**: The unit of lazy loading — one city's (or a small group's) sub-places,
  fetched on demand when the city is opened, with recorded provenance. Cacheable for offline use.
- **Availability index**: A small manifest listing which cities have sub-place data and which subtypes,
  consulted cheaply to decide what the UI offers before any shard is fetched.
- **Sub-place Source**: The pluggable seam that resolves sub-places for a city — availability, then the
  city's shard — independent of the underlying dataset(s) and where they are stored.
- **Reference Dataset**: A named external dataset (source, license, version, url) supplying sub-places,
  recorded in provenance and shown to the user; missing coverage is a separate shareable dataset, not
  app code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open a city with sub-place data and mark a sub-place visited in under 5 seconds
  (open city → browse → select → confirm), fully offline once that city's data is cached.
- **SC-002**: In 100% of cities, the subtypes offered exactly match the subtypes for which real
  reference entries exist — no empty categories, and zero fabricated sub-places.
- **SC-003**: Visiting a sub-place counts its parent city and country as covered by derivation in 100%
  of cases, with no separate standalone city or country record created.
- **SC-004**: App startup time is unchanged whether or not sub-place data exists, and opening a city
  fetches only that city's sub-place shard (never the whole-world set), verifiable by network
  inspection.
- **SC-005**: Once a city's sub-places are cached, 100% of that city's sub-place actions — browse, log,
  remove, map, count — work with no network connection and issue zero outbound requests carrying user
  data.
- **SC-006**: Exporting and re-importing a file containing sub-place visits restores an identical state
  (full data equivalence) in 100% of cases.
- **SC-007**: A malformed or hostile sub-place record or dataset is never executed and is always
  rejected, sanitized, or failed closed, in 100% of adversarial import test cases.
- **SC-008**: Per-city sub-place coverage figures update within 1 second of adding or removing a
  sub-place visit on a history of at least 10,000 visits.
- **SC-009**: Every sub-place action is reachable by keyboard alone with visible focus, and the
  sub-place views pass an automated WCAG 2.1 AA audit with zero critical violations.

## Assumptions

- "Sub-place" means a place strictly within a city — a station, a district/neighbourhood, a park, or a
  landmark — one level below city in the hierarchy country → city → sub-place. The subtype set is closed
  and additive; a build only offers subtypes it knows and only where real data exists.
- Sub-place reference data is aggregated from named, openly-licensed datasets (OpenStreetMap stations
  and administrative districts, Wikidata, and comparable open sources), each with recorded provenance,
  bundled or fetched read-only. Curating and building those datasets is out of scope here (see Out of
  Scope); this feature specifies the schema, provenance fields, and loading seam they plug into.
- Availability is per city: coverage is inherently uneven, so the UI adapts to each city's real data.
  This is a feature, not a defect — a city with no open sub-place data simply offers only user-authored
  custom points.
- Loading follows the existing two-stage gazetteer pattern: a cheap availability index is consulted to
  decide what to offer, and a city's full sub-place shard is fetched lazily and off the startup path
  (idle-time, off-thread where possible) when the city is opened, then cached for offline use.
- Roll-up is derived, consistent with the existing rule that visiting a city counts its country with no
  separate per-country record: visiting a sub-place counts its parent city and country the same way,
  and a per-city "% of sub-places visited" is derived from the reference denominator at read time.
- Sub-place visits reuse the existing Visit record and PlaceRef machinery (date, note, status, favorite,
  photos), adding a sub-place kind additively to the schema; the portable file continues to reference
  reference data by stable id and never inlines the datasets.
- A sub-place visit carries denormalized, inert copies of its parent city id, country, name, and
  coordinates so it displays, maps, and rolls up even when the city's reference shard is not loaded —
  the same approach custom places already use to carry their own coordinates.

## Dependencies

- One or more named, openly-licensed sub-place datasets (OpenStreetMap stations and admin districts,
  Wikidata, and comparable sources), each with recorded source, license, version, and url, sharded per
  city and accompanied by a lightweight availability index.
- The existing reference-data pipeline and lazy two-stage gazetteer loader, which the sub-place source
  seam mirrors and extends.
- The existing visit/record, map, and per-place coverage machinery, which sub-places reuse rather than
  duplicate.
- The existing custom-place path, which is the graceful-degradation fallback for cities without
  reference sub-place data.

## Out of Scope

- Authoring, curating, or building the sub-place datasets themselves (the OSM/Wikidata extraction,
  cleaning, sharding, and provenance capture) — that is a separate dataset effort, never app code; this
  feature only specifies the schema, provenance fields, and loading seam they plug into.
- Levels finer than a single sub-place (individual platforms, shops, room-level points, exact street
  addresses) and arbitrary user-drawn areas or routes within a city.
- Auto-detecting or inferring visited sub-places from location history, transit taps, or photo geotags
  (no tracking; nothing invented).
- Downloadable per-city sub-place packs and the device-global shared Offline Map Store — sub-place data
  is loaded through the same lazy seam, but bulk offline pack management is a separate feature.
- Routing, directions, transit schedules, or any trip-planning use of stations — Postcards remembers
  places, it is not a planner.
- Promoting a user's custom point into shared reference data, and community submission/moderation flows
  for sub-place datasets.
- Comparisons/leaderboards across users at the sub-place level.
