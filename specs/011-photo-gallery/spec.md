# Feature Specification: Photos & Extra Place Types

**Feature Directory**: `specs/011-photo-gallery`

**Created**: 2026-07-14

**Status**: Retro-specified — describes shipped behavior

**Input**: User description: "Beyond cities and countries, let me remember a place with my own
photos — postcards, the monument, the view — each with a caption, kept on my device and only ever
leaving inside my export. Let me also log the kinds of places that matter to a traveller: airports
I've flown through and the monuments / UNESCO World Heritage sites I've seen, drawn from named open
datasets. And when a place isn't in any dataset — a hamlet, a viewpoint, grandma's village — let me
add it myself as my own place with a name and optional coordinates, clearly marked as mine, never
pretending it's reference data. All of it private, inert, and keyboard-accessible."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remember a place with my own photos (Priority: P1)

From a place in their list (a city, a country, a monument, an airport, or one of their own places),
the user attaches one or more photos — a postcard, the monument, the view — captured or picked on
the device. Each photo can carry a short caption. The images are downscaled on-device, stored
locally with the visit, and never leave the device except inside an explicit export.

**Why this priority**: Photos are the emotional payoff of "remembering where I've been" and the
headline addition beyond the bare visited-places log. They deliver value on their own the moment a
single photo is attached, and everything else in this feature (captions, browsing, the gallery cap)
layers on top of this capture step.

**Independent Test**: Open a logged place with no network, tap Photos, pick two images from the
library, confirm a thumbnail with a count badge appears, reopen the app, and confirm both photos are
still there.

**Acceptance Scenarios**:

1. **Given** a logged place with no photos, **When** the user taps the "📷 Photos" control and picks
   one or more images, **Then** each image is downscaled on-device to a bounded inline image and
   stored with that visit, and the row shows a thumbnail (with a count badge when more than one).
2. **Given** a place with photos, **When** the user opens the gallery, **Then** a lightbox shows the
   current photo full-size and lets them page through the others.
3. **Given** the gallery is open, **When** the user types a caption and confirms (blur or Enter),
   **Then** the caption is saved with that photo and shown when the photo is viewed.
4. **Given** the user picks more images than the gallery can still hold, **When** the pick is
   processed, **Then** only enough to reach the cap are added and the user is told the gallery is now
   full — no photo is silently lost beyond the stated cap.
5. **Given** a fresh install with no network, **When** the user reopens a place that had photos,
   **Then** the photos render from local storage with no download and no request off the device.

---

### User Story 2 - Log airports and monuments I've been to (Priority: P1)

The user searches for and logs place types beyond cities and countries: airports (by IATA code or
name) they have flown through, and monuments / UNESCO World Heritage sites / famous landmarks they
have visited. These come from named, openly-licensed datasets bundled with the app; the app invents
none of them. Logged airports and monuments appear on the map in their own styling and count toward
per-country coverage.

**Why this priority**: Extra place types are the other half of "remember the places you've been" for
a traveller — the airports and monuments are as memorable as the cities. They reuse the existing
visit/record machinery, so they ship as new named datasets behind the same seam rather than new
concepts, and each is independently useful.

**Independent Test**: Type an uppercase 3-letter IATA code (e.g. "CDG"), confirm the matching
airport is offered first, log it, switch the map to Airports mode, and confirm the airport shows as
visited; separately search a monument name, log it, and confirm it counts under its country.

**Acceptance Scenarios**:

1. **Given** the reference datasets are loaded, **When** the user types an uppercase 3-letter IATA
   code that exists, **Then** the matching airport is surfaced ahead of like-named places, and can be
   marked visited.
2. **Given** a query that matches an airport by name or by code prefix, **When** results are shown,
   **Then** airports are labelled as such (name plus IATA code) with their home city and country.
3. **Given** a query matching a monument / heritage site, **When** results are shown, **Then** the
   heritage site is offered with its country and can be marked visited.
4. **Given** logged airports and monuments, **When** the user opens the map in Airports or Monuments
   mode, **Then** each is drawn with its own marker (airports distinct from city markers) and the
   header shows how many in view are visited out of the total in view.
5. **Given** a logged monument in a country, **When** the user views that country, **Then** the
   monument contributes to that country's recorded coverage, and its dataset provenance (source,
   license, version) is discoverable.

---

### User Story 3 - Add a place the datasets don't know (Priority: P2)

When a place the user wants to remember is absent from every bundled dataset — a hamlet, a viewpoint,
grandma's village, a spot in the open ocean — the search reports it isn't in the loaded data and
offers to add it as the user's own place: a name, a country (or explicitly no country), and optional
coordinates. It is saved as personal data, clearly marked "your own place", and shown on the map when
coordinates are given. The app never files it as reference data.

**Why this priority**: This closes the gap left by an aggregator-only design (the app can't invent
reference facts) without violating it — the user, not the app, authors these points. It builds on the
search/empty-state and visit machinery, so it comes after the core capture stories.

**Independent Test**: Search a made-up place name, confirm the "isn't in the loaded data" message and
the add form, fill in a name, pick a country, enter coordinates like "48.85, 2.35", save, and confirm
a custom point appears on the map at that location and persists after reload.

**Acceptance Scenarios**:

1. **Given** a search that matches nothing in any dataset, **When** results are empty, **Then** the
   app states the place isn't in the loaded data and offers to add it as the user's own place
   (pre-filled with the typed name).
2. **Given** the add form, **When** the user enters a name and selects a country (including an
   explicit "no country / open ocean" option), **Then** the place can be saved even with no
   coordinates.
3. **Given** the add form with coordinates entered, **When** the text isn't a valid "lat, lon" pair
   within range, **Then** saving is blocked and the expected format is shown; when valid, the map
   flies to the point on save.
4. **Given** a saved custom place with coordinates, **When** the user opens the map, **Then** the
   point is drawn as their own place and is included in an export, distinctly from reference data.
5. **Given** a name that sanitizes to empty (e.g. only formula-prefix characters), **When** the user
   tries to save, **Then** saving is refused so the export always round-trips.

---

### User Story 4 - Manage, keep private, and operate by keyboard (Priority: P2)

The user browses, re-captions, and removes photos entirely by keyboard, with an undo for the
otherwise-unrecoverable delete, and the whole feature stays private and inert: photos live only on
the device, are never executed, and only ever leave inside an explicit export.

**Why this priority**: Manageability, safety-nets, and accessibility are explicit product values, but
they layer on the capture core rather than blocking it.

**Independent Test**: Open a gallery, page with the arrow keys, edit a caption, remove a photo,
confirm the undo restores it, and complete the whole flow using only the keyboard while passing an
automated accessibility audit.

**Acceptance Scenarios**:

1. **Given** an open gallery, **When** the user presses Escape or the arrow keys, **Then** the
   lightbox closes / pages between photos, focus is trapped within the dialog while open, and returns
   to the row control on close.
2. **Given** a photo the user removes, **When** the delete happens, **Then** a toast offers an undo
   that restores the removed photo (and its caption) exactly.
3. **Given** any photo or caption, **When** it is stored or exported, **Then** the image is an inline
   downscaled data URL rendered only as an image (never executed) and the caption is length-bounded
   and sanitized.
4. **Given** the device is offline for the entire session, **When** the user captures, captions,
   browses, and removes photos, **Then** every action works with zero network requests.

---

### Edge Cases

- The gallery is at its cap and the user tries to add more → the Add control is disabled with a
  "gallery is full (N)" hint, and any over-cap file pick is truncated with a clear message.
- An unreadable or undecodable image file is picked → the user is told the image couldn't be read;
  no partial or corrupt photo is stored.
- A very large source image is picked → it is downscaled (longest side bounded) to a bounded JPEG
  before storage, so one photo can't bloat the portable file past its per-photo limit.
- A caption is only whitespace or formula-like characters → it is sanitized on save (never executed).
- An imported file carries a photo whose data URL isn't an inline image, or exceeds the size bound →
  it is rejected by the schema, never fetched or executed.
- A file written by a newer app build uses a place kind (or gallery/custom feature) an older build
  doesn't know → the older build fails that record closed and shows the graceful "update the app"
  prompt rather than silently dropping or mis-reading data.
- A legacy file with a single per-visit photo (older schema) is opened → it is migrated into the
  gallery as the first photo, losslessly and idempotently.
- A custom place is saved with no coordinates → it is kept as personal data but omitted from the map
  (nothing invented); with coordinates it is placed exactly where given.
- An airport is searched by an uppercase 3-letter code vs a lowercase/mixed prefix → the uppercase
  code is treated as an IATA code and the airport is surfaced first; mixed-case prefixes rank
  prominent places first with the airport still listed.
- A monument or airport whose dataset row has no usable coordinates (0,0) → it is excluded from the
  in-view map lists rather than pinned at null island.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to attach one or more photos to a logged place (of any place kind),
  captured or picked from the device's camera/library.
- **FR-002**: Each photo added MUST be downscaled entirely on-device (longest side bounded to 1000 px,
  JPEG at quality ~0.72, respecting the image's EXIF orientation) into a single inline image data URL
  before it is stored.
- **FR-003**: Each photo MAY carry an optional caption; captions MUST be length-bounded (≤ 300
  characters) and sanitized before storage or export.
- **FR-004**: A place's gallery MUST be capped (≤ 48 photos per visit); when a pick would exceed the
  cap, the system MUST add only up to the cap and clearly tell the user the gallery is full, never
  silently discarding beyond the stated limit.
- **FR-005**: Users MUST be able to browse a gallery (page between photos), edit a photo's caption,
  add more photos, and remove a photo, from within a single lightbox view.
- **FR-006**: Removing a photo MUST offer an undo that restores the removed photo and its caption
  exactly (photos exist nowhere but on the device, so the delete must be recoverable).
- **FR-007**: Photos MUST be stored only on the device and MUST NOT leave it except inside an
  explicit, user-initiated export; the system MUST make zero network requests to display or manage
  photos.
- **FR-008**: A stored photo MUST be an inline image data URL (never an external link), bounded in
  size (≤ 6,000,000 characters), rendered only as an image and NEVER executed or evaluated; on
  import it MUST be validated against the schema and rejected if it is not a bounded inline image.
- **FR-009**: The system MUST support additional place kinds beyond city and country — at minimum
  `airport`, `heritage` (monuments / World Heritage sites / landmarks), and `custom` — each usable
  wherever a place reference is used (search, map, per-country coverage, export).
- **FR-010**: Airports MUST come from a named, openly-licensed dataset, keyed by globally-unique IATA
  code, and be searchable by both IATA code and name; an uppercase 3-letter code that matches an
  airport MUST be surfaced ahead of like-named places.
- **FR-011**: Monuments/heritage sites MUST come from named, openly-licensed datasets (UNESCO World
  Heritage List plus a famous-landmarks set), merged behind one seam, searchable by name, and
  attributable to each country for coverage.
- **FR-012**: Logged airports and monuments MUST be displayable on the map in their own styling
  (airports visually distinct from city markers), with in-view visited-vs-total counts.
- **FR-013**: All airport, heritage, and landmark reference data MUST originate from named,
  openly-licensed external datasets with recorded provenance (source, license, version), displayed to
  the user; the app MUST NOT author or invent any of these facts.
- **FR-014**: When a searched place is present in no dataset, the system MUST let the user add it as
  their own `custom` place — a name plus a country (or an explicit "no country") plus optional
  coordinates — clearly marked as user-authored personal data, never as reference data.
- **FR-015**: A custom place MUST validate its name (bounded, sanitized, non-empty after
  sanitization) and, when coordinates are supplied, require a valid latitude (−90..90) and longitude
  (−180..180); an invalid coordinate string MUST block saving with a shown expected format.
- **FR-016**: A custom place with coordinates MUST be shown on the map at those coordinates and
  distinguished from reference points; one without coordinates MUST still be savable but omitted from
  the map (nothing invented).
- **FR-017**: The portable file schema MUST carry photos, extra place kinds, and custom places
  additively and version them, so older files import unchanged and a newer file opened in an older
  build fails closed with a graceful "update the app" prompt rather than a cryptic error.
- **FR-018**: On load/import, a legacy single per-visit photo MUST be migrated losslessly and
  idempotently into the gallery as its first photo.
- **FR-019**: The entire feature (gallery lightbox, capture, captioning, removal, and the add-a-place
  form) MUST be fully keyboard-operable with a modal focus contract (focus trapped while open, focus
  restored to the triggering control on close) and meet WCAG 2.1 AA.

### Key Entities *(include if feature involves data)*

- **Photo**: A user-authored image attached to a place. Attributes: `src` (a bounded, inline,
  downscaled image data URL), optional `caption` (bounded, sanitized). Inert personal data — rendered
  only as an image, never executed; lives on the device and in the user's export only.
- **Visit (extended)**: The existing per-place record, now carrying an ordered `photos` gallery
  (bounded to 48) in addition to date/note/status/favorite. Retains a legacy single-photo field for
  backward-compatible import, migrated into the gallery on load.
- **PlaceRef (extended)**: A reference to a place, now with kind ∈ {country, city, airport, heritage,
  custom}. For `custom`, the record itself carries the name, country, and optional lat/lon (there is
  no reference-data entry to resolve). User-authored `custom` places are personal data; all other
  kinds point at read-only reference data.
- **Airport**: A reference entity from a named open dataset. Attributes: IATA code (id), name, home
  city, country, coordinates. Read-only aggregate data.
- **Heritage Site / Monument / Landmark**: A reference entity from named open datasets (UNESCO World
  Heritage List; famous-landmarks set) sharing one shape. Attributes: stable id, name, country,
  coordinates, optional category. Denominator for per-country monument coverage. Read-only aggregate
  data.
- **Custom Place**: A user-authored point for a place absent from all datasets. Attributes: minted
  local id, sanitized name, country (or explicit "no country"), optional coordinates. Personal data,
  never reference data.
- **Reference Dataset**: A named external dataset (source, license, version, url) supplying airports,
  heritage sites, and landmarks, recorded in provenance and shown to the user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can attach a photo to a place and see it as a thumbnail in under 5 seconds from
  tapping the Photos control (pick → downscale → stored), fully offline.
- **SC-002**: 100% of photo actions — capture/pick, caption, browse, remove, undo — work with no
  network connection and issue zero outbound requests carrying user data.
- **SC-003**: Every stored photo is a bounded inline image data URL (≤ 6,000,000 characters, longest
  side ≤ 1000 px); no photo references an external URL, in 100% of cases.
- **SC-004**: No gallery ever exceeds 48 photos, and no photo is lost without the user being told the
  gallery is full, in 100% of over-cap picks.
- **SC-005**: Removing a photo is always reversible via the offered undo, restoring the image and its
  caption identically, in 100% of removals within the undo window.
- **SC-006**: An airport searched by its uppercase IATA code appears as the first result whenever
  that code exists in the dataset, in 100% of such queries.
- **SC-007**: Exporting and re-importing a file with photos, airports, monuments, and custom places
  restores an identical state (full data equivalence, including legacy single-photo migration) in
  100% of cases.
- **SC-008**: A malformed photo (non-image or oversized data URL) or an unknown place kind in an
  imported file is never executed and is always rejected or failed closed, in 100% of adversarial
  import test cases.
- **SC-009**: Every action in the gallery and the add-a-place form is reachable by keyboard alone
  with visible focus and correct focus restoration, and the feature passes an automated WCAG 2.1 AA
  audit with zero critical violations.

## Assumptions

- "Photo" means a raster image the user captures or picks; it is downscaled to a bounded JPEG data
  URL on-device (longest side 1000 px, quality ~0.72). Original full-resolution files are never
  stored — the goal is a "postcard" small enough to live in the portable JSON file.
- Photos attach to a **visit** (a logged place of any kind), not to reference data; the same photo
  machinery (bounded inline data URLs, captions) is reused by the Journal's stories with its own
  smaller cap. This spec covers per-place galleries.
- The per-visit gallery cap is 48 photos and per-photo size bound is 6,000,000 characters of data
  URL; captions are bounded at 300 characters. These bound the portable file's size.
- Airports are the OpenFlights IATA-coded set (aggregated from OurAirports); monuments are the UNESCO
  World Heritage List plus a famous-landmarks seed (expandable via a Wikidata build script) — all
  bundled read-only with recorded provenance, consistent with the aggregator-only constitution.
- "Custom" places are unambiguously personal data authored by the user (labelled "your own place"),
  are stored only in the user's file, and never merge into or masquerade as reference data. Country
  may be an explicit "no country / open ocean" sentinel.
- Coverage counts (monuments/airports visited vs. in view / per country) are derived at read time
  from the user's records and the reference datasets; nothing is precomputed or invented.
- Schema versioning is additive: the shipped file schema adds the `photos` gallery, the extra place
  kinds, and the `custom` kind across successive versions; older files import unchanged, and a newer
  file opened by an older build fails closed with a graceful update prompt.

## Out of Scope

- Video, audio, or non-image attachments; cloud photo backup or sync; any server-side photo storage.
- Automatic geotagging of photos, on-device face/scene recognition, or any analysis of image content.
- Editing images in-app (crop, filters, rotation beyond the automatic EXIF-orientation draw).
- Additional reference place types beyond airports and monuments/heritage/landmarks (museums,
  national parks, train/subway stations, hiking spots) — drop-in datasets of the same shape are a
  future addition, not this feature.
- Community-contributed or downloadable custom datasets, and promoting a user's `custom` place into
  shared reference data.
- Per-photo maps, photo-driven timelines, or slideshow/export-as-album experiences beyond the
  single-file JSON/Markdown export already provided.
- Deduplicating or clustering monuments/airports across overlapping datasets beyond the existing
  by-id merge.
