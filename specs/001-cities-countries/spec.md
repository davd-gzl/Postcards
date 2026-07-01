# Feature Specification: Cities & Countries Core (MVP)

**Feature Directory**: `specs/001-cities-countries`

**Created**: 2026-07-01

**Status**: Draft

**Input**: User description: "Remember the places I've been. For the first slice: log
visited cities and countries, see them on a map that works offline, get fast coverage
statistics (how many countries, what % of the world, what % of a given country), and keep
everything in one portable file I can back up and restore. Fully local, no Google, privacy
first, data is inert, accessible and keyboard-friendly. The offline map must be reusable by
a wider ecosystem of my Capacitor apps (device-global, not app-private)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log a place as visited (Priority: P1)

A person opens the app, searches for a city or a country they have been to, and marks it as
visited. They can optionally record when they went and a short personal note. The record is
saved immediately on the device, with no account and no network.

**Why this priority**: Capturing visits is the foundation of the entire product. Without it,
nothing else has data to display. It is the smallest slice that already delivers value (a
personal record of where you have been).

**Independent Test**: Launch the app offline, search for "Lisbon", mark it visited, close and
reopen the app, and confirm the visit is still there. Delivers value on its own as a
persistent visited-places log.

**Acceptance Scenarios**:

1. **Given** the app is open with no network, **When** the user searches a known city and
   selects it and confirms, **Then** the city is recorded as visited and appears in their list.
2. **Given** a city is being logged, **When** the user optionally adds a date and a note,
   **Then** both are stored with the visit and shown when the visit is viewed.
3. **Given** a place has already been marked visited, **When** the user selects it again,
   **Then** the app does not create a duplicate and clearly indicates it is already visited.
4. **Given** the user searches a name not present in the reference data, **When** no match is
   found, **Then** the app states the place is not in the dataset and points to how to
   contribute it to the external dataset (the app does not invent the place).

---

### User Story 2 - See visited places on an offline map (Priority: P1)

The user views a map showing the places they have visited — visited cities as points and
visited countries visually distinguished — and can pan and zoom the whole world. The map works
with no network connection because a world-overview base map ships with the app.

**Why this priority**: The map is the primary, at-a-glance payoff ("see where I've been") and
must be usable offline to honor the local-first promise.

**Independent Test**: With the device in airplane mode on a fresh install, open the map and
confirm a usable world map renders and previously-logged visits are shown, with no downloads.

**Acceptance Scenarios**:

1. **Given** a fresh install with no network, **When** the user opens the map, **Then** a
   usable world base map renders without any additional download.
2. **Given** several visited cities and countries, **When** the user opens the map, **Then**
   visited cities appear as points and visited countries are visually distinguished.
3. **Given** the map is open, **When** the user pans and zoom to any region of the world,
   **Then** the base map remains available offline at overview detail.

---

### User Story 3 - Back up and restore everything as one file (Priority: P1)

The user exports all of their data to a single portable file they can store on a drive, in a
git repository, or anywhere else. Later — on the same device, a new device, or the website —
they import that file and everything is restored exactly. A Markdown export is also available
for sharing a readable summary/map with a friend.

**Why this priority**: Data ownership and portability are core promises. A visited-places log
the user cannot back up or move is a trap, not a tool.

**Independent Test**: Export the data file, wipe/reinstall the app, import the file, and
confirm the restored state matches the original exactly.

**Acceptance Scenarios**:

1. **Given** recorded visits, **When** the user exports, **Then** a single human-readable file
   containing all of their data is produced.
2. **Given** an exported file, **When** the user imports it into a fresh install, **Then** all
   visits, dates, and notes are restored identically with no loss.
3. **Given** an exported file, **When** it is opened in a text editor, **Then** its contents are
   human-readable and understandable without the app.
4. **Given** the user wants to share, **When** they choose Markdown export, **Then** a readable
   Markdown summary of their visited places is produced.

---

### User Story 4 - See coverage statistics (Priority: P2)

The user opens a statistics view and instantly sees how many countries they have visited, what
percentage of the world's countries that is, how many cities they have visited, and — for a
selected country — both what percentage of its cities and what percentage of its regions
(first-level subdivisions) they have covered.

**Why this priority**: The "how much of the world have I seen" numbers are a major draw, but
they depend on Stories 1 and 3 existing first, so they come after the capture/persist core.

**Independent Test**: With a known set of logged visits, open statistics and verify the counts
and percentages match the expected values for that set and reference data.

**Acceptance Scenarios**:

1. **Given** a set of visited countries, **When** the user opens statistics, **Then** the
   number of countries visited and the percentage of the world's countries are shown.
2. **Given** visited cities, **When** the user opens statistics, **Then** the count of cities
   visited is shown.
3. **Given** a selected country with recorded visits, **When** the user views that country,
   **Then** both the percentage of that country's cities visited and the percentage of its
   first-level subdivisions with at least one visit are shown.
4. **Given** the user adds or removes a visit, **When** they return to statistics, **Then** the
   figures reflect the change.

---

### User Story 5 - Fast, keyboard-driven, accessible use (Priority: P2)

A power user records visits and navigates the app primarily with the keyboard, using shortcuts
for the most common actions, and the app is fully operable with assistive technology.

**Why this priority**: Speed, shortcuts, and accessibility are explicit product values, but
they layer on top of the functional core rather than blocking it.

**Independent Test**: Complete the full flow — search, log a visit, open the map, open stats —
using only the keyboard, and pass an automated accessibility audit.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user invokes the quick-add shortcut, **Then** they
   can search and log a visit without using a pointer.
2. **Given** any primary screen, **When** the user navigates with the keyboard alone, **Then**
   every primary action is reachable and focus is clearly visible.
3. **Given** a screen reader is active, **When** the user moves through the interface, **Then**
   controls and content are announced with meaningful labels.

---

### Edge Cases

- A searched place is absent from the reference data → the app reports "not in dataset" and
  points to the external dataset; it never fabricates the place.
- The same place is logged twice → no duplicate is created; the app indicates it is already
  visited.
- An imported file is malformed, truncated, or hostile (e.g. contains script-like or
  formula-like content) → it is rejected or sanitized, never executed, and the user is told why.
- An imported file uses an older schema version → it is migrated where possible, preserving data.
- Two places share a name (e.g. "Springfield") → the user can disambiguate by parent
  country/region before logging.
- The device has no network and the user zooms to a region → the bundled overview base map
  still renders (detailed street-level packs are a later feature).
- A country and its self-governed/dependent territories → represented as the reference dataset
  defines them; the app neither merges nor invents them.
- A very large history (tens of thousands of visits) → statistics and the map remain responsive.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to mark a city or a country as visited, selected from reference
  data.
- **FR-002**: Users MUST be able to optionally attach a visit date and a personal note to a visit.
- **FR-003**: The system MUST persist all user records entirely on the device, with no account
  and no network dependency.
- **FR-004**: The system MUST display visited places on an interactive map that works fully
  offline (visited cities as points; visited countries visually distinguished).
- **FR-005**: The system MUST ship a bundled world-overview base map so the map is usable
  offline immediately on a fresh install, with no additional download.
- **FR-006**: The base map MUST be consumed through a pluggable "map source" mechanism and MUST
  NOT assume map data is confined to app-private storage, so its backing can later be a
  device-global, cross-app shared map store without changing app behavior.
- **FR-007**: The system MUST compute and display coverage statistics: number of countries
  visited, percentage of the world's countries visited, and number of cities visited. For a
  selected country, the system MUST display BOTH (a) the percentage of that country's cities
  the user has visited AND (b) the percentage of that country's first-level subdivisions
  (regions) with at least one recorded visit.
- **FR-008**: All reference data (country list, subdivisions, city gazetteer, boundaries) MUST
  originate from named, openly-licensed external datasets with recorded provenance (source,
  license, version). The system MUST NOT author or invent reference facts.
- **FR-009**: Users MUST be able to export all of their data to a single, portable,
  human-readable file.
- **FR-010**: Users MUST be able to import that file and fully restore their data with no loss,
  including on a different device or on the website.
- **FR-011**: The system MUST provide a Markdown export suitable for sharing a readable summary
  or map with another person.
- **FR-012**: On import, the system MUST validate data against a published, versioned schema and
  reject or sanitize anything malformed or unexpected; it MUST NEVER execute, evaluate, or
  otherwise act on content contained in a data file.
- **FR-013**: The system MUST NOT transmit user data anywhere; user data MUST leave the device
  only through an explicit, user-initiated export or share action.
- **FR-014**: The interface MUST be fully operable by keyboard, provide shortcuts for the most
  common actions, and meet WCAG 2.1 AA.
- **FR-015**: The system MUST prevent duplicate visits for the same place and clearly indicate
  when a place is already marked visited.
- **FR-016**: When a searched place is not present in reference data, the system MUST inform the
  user and direct them to contribute it to the external dataset, rather than creating it in-app.
- **FR-017**: The same portable data file MUST be usable across the user's surfaces (phone and
  website) so records move with the user, not the app instance.
- **FR-018**: The system MUST clearly display the provenance (source, license, version) of the
  reference datasets in use.

### Key Entities *(include if feature involves data)*

- **Visit**: A user record that a place was visited. Attributes: reference to a Place, optional
  date, optional note, timestamp added. This is user-authored data.
- **Place**: An entry in reference data. Attributes: type (country or city), canonical name,
  stable identifier(s), coordinates, parent country/subdivision, provenance. Read-only aggregate
  data — never authored by the app.
- **Country**: A reference entity representing a country or self-governed/dependent territory as
  defined by the dataset; the full set provides the denominator for "percentage of the world",
  and each country's associated cities and subdivisions provide the denominators for its two
  per-country metrics.
- **Subdivision**: A first-level administrative division of a country (region); the set of a
  country's subdivisions provides the denominator for that country's "% of subdivisions" metric.
- **Reference Dataset**: A named external dataset (source, license, version) supplying Places,
  Countries, Subdivisions, and boundaries.
- **Data File**: The single portable, human-readable document holding all of the user's Visits
  plus metadata and a schema version. The unit of backup, restore, and cross-device transfer.
- **Map Source**: The pluggable provider of offline base-map tiles that the map consumes,
  independent of where the tiles are physically stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from opening the app to a place marked visited in under 5 seconds
  (search → select → confirm).
- **SC-002**: With no network connection, 100% of core actions work — open the app, view the
  map, log/remove visits, and view statistics.
- **SC-003**: Exporting and then re-importing the data file restores an identical state (full
  data equivalence) in 100% of cases.
- **SC-004**: Coverage statistics update within 1 second of adding or removing a visit on a
  history of at least 10,000 visits.
- **SC-005**: Every primary action is reachable using the keyboard alone, and the app passes an
  automated WCAG 2.1 AA audit with zero critical violations.
- **SC-006**: During normal use, zero outbound network requests carry user data (verifiable by
  network inspection).
- **SC-007**: A fresh install renders a usable world map with zero additional downloads.
- **SC-008**: A malformed or hostile import file is never executed and is always either rejected
  with a clear reason or safely sanitized (100% of adversarial import test cases).

## Assumptions

- The canonical data file format is JSON (per the constitution), with a separate Markdown export
  for human sharing; "human-readable file" refers to this JSON document.
- "Percentage of a country" is reported as TWO complementary metrics, both shown: (a) the share
  of that country's cities (from the gazetteer) the user has visited, and (b) the share of that
  country's first-level administrative subdivisions (regions) in which the user has at least one
  recorded visit. Both use openly-licensed datasets; exact granularity follows each dataset.
  (Resolved decision — keep both, not one.)
- MVP reference datasets are: world countries and territories, first-level subdivisions, a city
  gazetteer, and country boundaries — all openly licensed (e.g. Natural Earth / GeoNames-class),
  bundled read-only with recorded provenance.
- "Cities" for MVP means populated places present in the chosen gazetteer; the specific
  gazetteer scope (all populated places vs. a curated list) is fixed when the dataset is chosen
  during planning.
- The bundled world-overview base map is small (overview zoom levels). Detailed regional map
  packs and the device-global shared Offline Map Store are a separate follow-up feature; the MVP
  only requires the pluggable map-source seam so that later work needs no app-facing changes.
- Reference data and personal data are stored separately so the user can back up their own
  records independently of bundled datasets.

## Dependencies

- Openly-licensed reference datasets (countries + territories, first-level subdivisions, city
  gazetteer, country boundaries), each with recorded source, license, and version.
- A world-overview base map file (OpenStreetMap-derived, openly licensed) bundled for offline use.
- (Follow-up) A shared "Offline Map Store" Capacitor plugin/SDK enabling device-global,
  cross-app reuse of downloaded maps across the user's ecosystem.

## Out of Scope (MVP)

- Additional place types (UNESCO sites, national parks, airports/train/subway stations, museums,
  hiking spots, custom/community datasets).
- Ticket logs (plane/bus/train) and their statistics.
- Wikivoyage integration and per-city information panels (population, etc.).
- Downloadable regional map packs and the device-global shared Offline Map Store implementation.
- Comparisons/leaderboards ("who visited the most"), flag walls, and cross-user data comparison.
- Background location tracking and AI destination suggestions (openclaw / MAX-Finder).
- Peer-to-peer synchronization between devices.
- A dedicated shareable-map viewer: rendered image export for chats, plus a static read-only web
  viewer that renders a map from data passed privately in the URL fragment or from a user-hosted
  file. (The MVP includes single-file JSON and Markdown export; the image/viewer share experience
  is a planned follow-up.)
