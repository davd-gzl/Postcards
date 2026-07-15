# Feature Specification: Passport & World Poster

**Feature Directory**: `specs/009-passport-poster`

**Created**: 2026-07-14

**Status**: Retro-specified — describes shipped behavior

**Input**: Retro-specification of the shipped "Passport & World Poster" feature: a
collection of flags — one per visited country, derived from the places logged inside
each country — arranged like the pages of a real passport, grouped by continent with
per-continent progress; a downloadable, on-device PNG "world poster" that stamps a flag
on every visited country (falling back to the user's own recorded coordinates where the
basemap lacks a country's geometry); and a checklist of the flags still to collect. All
rendered from bundled openly-licensed geometry with no network and no server; the
UN-member-vs-territory country scope preference is respected throughout.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collect a flag for every country you've been to (Priority: P1)

A person who has logged cities, monuments, or other places opens their Passport and sees
a flag for each country those visits imply — one flag per country — laid out in continent
sections, each section showing how many of that continent's countries they've collected.
The count is derived entirely from their existing visits: there is no separate "mark a
country visited" action. Tapping a flag opens that country's page.

**Why this priority**: The passport is the emotional payoff of the whole app — "look how
much of the world I've collected." It turns the flat visit log into a keepsake and is the
first thing the feature must deliver. It works the moment a single place is logged.

**Independent Test**: Log a city in a country not yet collected, open the Passport, and
confirm exactly one flag for that country appears under the correct continent, the
continent's "N of M" progress increments by one, and the header total increments by one.

**Acceptance Scenarios**:

1. **Given** a visited city in France and no other French place logged, **When** the user
   opens the Passport, **Then** exactly one 🇫🇷 flag appears under "Europe" and no
   duplicate is created by additional French cities.
2. **Given** several visited countries across continents, **When** the user opens the
   Passport, **Then** flags are grouped into continent sections, each headed by the
   continent name and its own "collected of total" progress, and only continents with at
   least one collected flag are shown.
3. **Given** a collected flag, **When** the user activates it (click or keyboard), **Then**
   that country's page opens.
4. **Given** an airport is the only place logged in a country (a layover), **When** the
   user opens the Passport, **Then** no flag is collected for that country.
5. **Given** no places have been visited, **When** the user opens the Passport, **Then** an
   empty state explains that visiting a city makes its country's flag land here.

---

### User Story 2 - Download a poster of your world (Priority: P1)

The user taps "World poster" and the app draws, entirely on the device, a world map with
every country they have visited coloured by continent and stamped with its flag, plus a
caption summarising their totals. The poster is shown first as a preview; downloading it as
a PNG is a deliberate second step. Nothing is uploaded and no file is dropped silently.

**Why this priority**: A shareable image of "my world" is the feature's headline artifact —
the thing users actually post and print. It must be generated locally to honour the privacy
and local-first promises, and it depends only on the visit data Story 1 already surfaces.

**Independent Test**: With a handful of visited countries, tap "World poster", confirm a
preview image appears with a flag on each visited country and a "N countries · M cities"
caption, then download it and confirm a PNG file named `postcards-world.png` is saved — all
with the network disabled.

**Acceptance Scenarios**:

1. **Given** visited countries, **When** the user taps "World poster", **Then** a poster is
   rendered on-device and shown in a preview overlay before any download occurs.
2. **Given** the poster preview is open, **When** the user chooses download, **Then** a PNG
   named `postcards-world.png` is produced; **When** the user presses Escape, clicks the
   backdrop, or presses Close, **Then** the preview closes and the rendered image is released.
3. **Given** a visited country the bundled map has no polygon for (e.g. Kosovo, a small
   territory), **When** the poster renders, **Then** its flag is still stamped, positioned at
   the coordinates of a place the user actually recorded in that country.
4. **Given** the device is offline, **When** the user renders the poster, **Then** it draws
   from bundled geometry with no network request; **And** if that geometry cannot be read,
   **Then** a friendly message is shown and the app does not crash.
5. **Given** a rendered poster, **When** the user inspects it, **Then** it carries the caption
   "My world — Postcards", the totals line, and the "Boundaries © Natural Earth" attribution.

---

### User Story 3 - See what's still to collect, at the scope you count by (Priority: P2)

The user reveals a checklist of the countries they have not yet visited (shown as locked
flags) to see what is left, and chooses whether their passport counts only UN member states
or also includes dependent territories. Both the flag grid and the poster respect that choice.

**Why this priority**: The "what's left" list drives the collect-them-all motivation and the
scope toggle makes the numbers honest for different users, but both layer on top of the core
collection and poster rather than blocking them.

**Independent Test**: Toggle the missing checklist open and confirm the remaining in-scope
countries appear as locked flags, paged in batches; switch the scope between "all" and "UN
members" and confirm the header total, the continent progress, the checklist, and the poster
all change consistently.

**Acceptance Scenarios**:

1. **Given** uncollected countries, **When** the user opens the "still to collect" list,
   **Then** the remaining in-scope countries are shown as locked flags, revealed in batches
   with a control to load more.
2. **Given** the scope is set to "UN members", **When** the user views the passport, **Then**
   dependent territories are excluded from the count, the checklist, and the poster; **When**
   set to "all", **Then** territories are included in all three.
3. **Given** a locked (uncollected) flag in the checklist, **When** the user activates it,
   **Then** that country's page opens, just like a collected flag.

---

### Edge Cases

- A country is visited only via an airport (a layover) → no flag is collected; airports do
  not imply visiting the country.
- A place recorded outside any country (open ocean / "world moment", country code `ZZ`) →
  collects no flag and shows a pin glyph rather than a flag anywhere it is referenced.
- The same country is visited many times or via many places → exactly one flag, deduplicated.
- A visited country has no polygon in the bundled basemap, or an unjoinable geometry id (e.g.
  Kosovo's numeric `-99`) → it is stamped at a fallback anchor taken from the user's own
  recorded place there; if no usable coordinate exists, the flag is simply not drawn (the
  count is never inflated with an invented location).
- Wishlist entries → never counted as collected, never stamped.
- The bundled map geometry file cannot be fetched/parsed → a toast explains the poster could
  not be rendered; the passport itself remains usable.
- A country with no continent classification → grouped under an "Elsewhere" section.
- A shape that crosses the antimeridian (Russia, Fiji) → drawn without smearing a fill band
  across the map, appearing on both edges as needed.
- Many uncollected countries → the checklist pages them in fixed batches rather than
  rendering all at once.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Passport MUST display collected flags derived from the user's visits — one
  flag per visited country — and MUST NOT provide any standalone "mark this country visited"
  control; country coverage is derived from the places logged inside each country.
- **FR-002**: A country's flag MUST be collected when the user has a non-wishlist visit to a
  city, monument, or custom place in that country. Airport visits MUST NOT collect a flag, and
  places whose country is `ZZ` (outside any country) MUST NOT collect a flag.
- **FR-003**: The same country MUST yield at most one flag regardless of how many places or
  repeat visits it contains (deduplicated by country).
- **FR-004**: The Passport MUST show a header total of the form "collected of total flags
  collected", with both numbers localized, reflecting only in-scope countries.
- **FR-005**: Collected flags MUST be grouped into continent sections, each showing its own
  "collected of total" progress computed over that continent's in-scope countries; only
  continents with at least one collected flag are shown, sorted by collected count descending
  then by continent name; countries lacking a continent fall under "Elsewhere".
- **FR-006**: Each flag (collected or locked) MUST be a keyboard-focusable control that opens
  that country's page, and MUST render as a Unicode regional-indicator flag emoji (no image
  assets, works offline) that degrades to the ISO letter pair where no flag font is present.
- **FR-007**: The Passport MUST offer a toggle to show or hide the countries still to collect,
  presented as locked flags; the still-to-collect list MUST be revealed in batches (initially
  60, loading 60 more at a time) with an accessible expand/collapse state.
- **FR-008**: When nothing has been collected, the Passport MUST show an empty state that
  tells the user visiting a city will land its country's flag here.
- **FR-009**: The user MUST be able to render a downloadable "world poster" of their visited
  countries entirely on the device, with no server and no network dependency beyond the
  bundled geometry asset.
- **FR-010**: The poster MUST draw an equirectangular world map in which each visited,
  in-scope country is filled by its continent colour and stamped with its flag, with unvisited
  land and ocean rendered in visually distinct fills.
- **FR-011**: The poster MUST stamp exactly the in-scope visited countries, so the flags on
  the map match both the flag grid and the caption's country count.
- **FR-012**: For a visited country whose bundled geometry is missing or unjoinable, the poster
  MUST stamp its flag at a fallback anchor derived from the coordinates of a place the user
  actually recorded in that country (gazetteer city, monument, or airport coordinates, or a
  custom place's own coordinates); it MUST NOT invent a location, and if no usable coordinate
  exists it MUST omit that flag rather than place it arbitrarily.
- **FR-013**: The poster geometry MUST come from bundled, openly-licensed Natural Earth country
  boundaries loaded as a local asset, and the rendered poster MUST display the boundary
  attribution ("Boundaries © Natural Earth").
- **FR-014**: The poster MUST include a caption identifying it ("My world — Postcards") and a
  totals line stating the number of countries and cities visited.
- **FR-015**: The rendered poster MUST be shown to the user as a preview first; saving it as a
  PNG MUST be a separate, explicit user action (a download named `postcards-world.png`), never
  a silent file drop.
- **FR-016**: The in-memory image resource backing the poster preview MUST be released when the
  preview is closed, replaced, or the screen is left, so no rendered image leaks; no user data
  may leave the device except through the explicit PNG download.
- **FR-017**: If the poster cannot be rendered (e.g. geometry unavailable), the system MUST
  surface a clear, non-technical message and MUST NOT crash or leave the passport unusable.
- **FR-018**: The poster preview MUST be an accessible modal dialog — labelled, marked as a
  modal, dismissible with Escape, with focus placed on a control inside it, and with a
  descriptive alternative text on the rendered image — meeting WCAG 2.1 AA.
- **FR-019**: The country scope preference (all countries and territories vs. UN member states
  only) MUST be applied consistently to the flag grid, the header and continent totals, the
  still-to-collect checklist, and the poster stamps.
- **FR-020**: All passport and poster reference data (country list, sovereignty tier,
  continent, boundaries) MUST originate from named, openly-licensed external datasets; the
  feature MUST NOT author or invent any country, flag, or boundary.

### Key Entities *(include if feature involves data)*

- **Collected Flag**: A derived, per-country marker that at least one qualifying place has been
  visited in that country. Not stored independently — recomputed from Visits. Carries the
  country's identity, name, continent, and flag emoji.
- **Country (reference)**: A read-only reference entity with ISO alpha-2/numeric identifiers,
  name, continent, sovereignty tier (UN member vs. territory), and per-country city/subdivision
  counts. Supplies the denominators for header, continent, and checklist totals.
- **Country Scope (preference)**: The user's choice of what counts as a country — "all"
  (UN members plus dependent territories) or "un" (members only). Filters every passport and
  poster figure.
- **Fallback Anchor**: A (longitude, latitude) derived from a place the user recorded in a
  country, used to position that country's flag on the poster when the basemap lacks its
  geometry. Sourced from the user's own records/gazetteer; never invented.
- **World Poster**: An on-device raster (PNG) image composed of the world map, per-country
  flag stamps, a caption with totals, and dataset attribution. A transient artifact produced on
  demand, previewed, and optionally downloaded.
- **Boundary Dataset**: The bundled Natural Earth country geometry (as TopoJSON) joined to the
  country reference by numeric id, providing the poster's land shapes with recorded provenance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Logging a qualifying place in a not-yet-collected country adds exactly one flag
  for that country to the passport, and further places in the same country add none.
- **SC-002**: The header's collected count equals the number of distinct in-scope visited
  countries and equals the number of flags stamped on the poster (for every country with an
  available polygon or fallback anchor), in 100% of cases.
- **SC-003**: The world poster renders successfully with the network fully disabled, using only
  the bundled geometry asset (zero outbound requests during rendering).
- **SC-004**: Every counted country that has either a basemap polygon or a fallback anchor from
  the user's own records shows a flag on the poster; no flag is ever placed at an invented
  location.
- **SC-005**: Switching the country scope between "all" and "UN members" changes the header
  total, the continent progress, the checklist contents, and the poster stamps consistently, so
  the four never disagree.
- **SC-006**: The poster PNG is produced only by an explicit user download action, and the
  rendered image resource is released on close/replace/leave, verifiable by the absence of any
  leaked object URL and of any outbound request carrying user data.
- **SC-007**: The "still to collect" checklist can reveal every remaining in-scope country,
  loading in fixed batches of 60 until all are shown.
- **SC-008**: The Passport screen and the poster preview are fully operable by keyboard alone
  and pass an automated WCAG 2.1 AA audit with zero critical violations (dialog semantics,
  focus management, labelled controls and image).

## Assumptions

- Country coverage is strictly derived: visiting a place inside a country collects that
  country's flag, and there is no per-country visit record. Airports are intentionally excluded
  because changing planes is not visiting the country.
- The default country scope includes both UN members and dependent territories ("all"); users
  who prefer a strict members-only count switch to "UN members". The sovereignty classification
  comes from the openly-licensed world-countries dataset, not from the app.
- Continent grouping and the poster's per-country colours use the reference dataset's continent
  ("region") field; a country with no continent is grouped as "Elsewhere".
- The poster is a fixed-size equirectangular raster drawn from bundled Natural Earth 50m country
  boundaries; flag stamps use platform Unicode emoji, so exact glyph rendering depends on the
  device's emoji font, and the poster's visual proportions are fixed by the app.
- Flags are Unicode regional-indicator pairs rather than image files, keeping the feature fully
  offline and asset-free; on platforms without a flag font the two-letter code remains legible.
- "Cities" in the poster caption is the count of distinct visited gazetteer cities, consistent
  with the app's coverage statistics.

## Out of Scope

- Any standalone "mark a country as visited" action independent of visiting a place inside it.
- Counting airports (or other transit) toward country collection.
- Customising the poster (size, projection, colours, title, which places to include) or
  exporting it in formats other than the on-device PNG.
- Interactive/zoomable poster rendering or per-country detail on the poster itself (the poster
  is a static image; the interactive map is a separate feature).
- Server-side, cloud, or network-assisted poster generation or sharing; the app only produces a
  local PNG that the user chooses to share.
- Comparisons, leaderboards, or multi-user flag walls ("who collected the most").
- Adding missing countries, flags, or boundaries in-app; gaps in reference data are addressed by
  the external datasets, not by the application.
