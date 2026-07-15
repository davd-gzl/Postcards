# Feature Specification: Moments (World Experiences)

**Feature Directory**: `specs/008-moments`

**Created**: 2026-07-14

**Status**: Retro-specified — describes shipped behavior

**Input**: Shipped feature, reverse-specified from source. "A curated list of
once-in-a-lifetime world moments — see the northern lights, cross the equator, stand before the
Pyramids — that you can only live somewhere, not places you can own on a map. Check the ones you
have lived; flag the ones you dream of. Each moment links to a few real places where it happens, and
tapping one flies the map there. Moments are stored as neutral 'custom' records that ride along in
the same portable file but never count toward country statistics. V0 ships a small bundled starter
list; a community-maintained dataset can replace it later, same shape."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mark the world moments you have lived (Priority: P1)

A person opens the Moments list, scrolls a curated set of once-in-a-lifetime experiences (each with
an emoji, a name, and a one-line hint), and checks off the ones they have actually lived. A running
"X of Y lived" tally at the top updates as they go. Everything is saved on the device, no account,
no network.

**Why this priority**: Recording the experiences you have lived is the whole point of the feature —
it is the smallest slice that already delivers value (a personal bucket-list you can tick off) and
everything else builds on it.

**Independent Test**: Open the Moments list offline, mark "See the northern lights" as lived, close
and reopen the app, and confirm the moment is still checked and the "X of Y lived" tally reflects
it.

**Acceptance Scenarios**:

1. **Given** the Moments list is open with no network, **When** the user taps the ✓ (Been) control
   on a moment, **Then** the moment is recorded as lived and the "lived" tally increments.
2. **Given** a moment already marked lived, **When** the user taps ✓ again, **Then** the record is
   removed and the tally decrements.
3. **Given** the list is open, **When** it renders, **Then** each moment shows its emoji, name, and
   a one-line hint, and the header reads "<lived> of <total> lived".
4. **Given** several moments marked lived, **When** the user closes and reopens the app, **Then**
   the same moments remain checked with no loss.

---

### User Story 2 - Jump to a real place where a moment happens (Priority: P2)

Under most moments is a small row of place chips — real anchor places where the moment can be lived
(Tromsø, Fairbanks, Reykjavík for the aurora). Each chip shows a country flag and a name. Tapping a
chip flies the map to that place so the user can see where it is. Tapping never marks anything as
visited.

**Why this priority**: The place links turn an abstract bucket-list into something grounded on the
map, but they depend on the list existing first, so they layer on top of Story 1.

**Independent Test**: Open Moments, tap the "Tromsø" chip under "See the northern lights", and
confirm the map recenters on Tromsø and that no new visit record was created.

**Acceptance Scenarios**:

1. **Given** a moment with linked places, **When** the list renders, **Then** each linked place is a
   tappable chip showing its country flag (or a neutral pin when no country is given) and its name.
2. **Given** a place chip, **When** the user taps it, **Then** the map flies to that place's
   coordinates and no record is created or changed.
3. **Given** a moment with no linked places (e.g. a total solar eclipse, whose path moves each
   time), **When** the list renders, **Then** the moment still appears with its hint and status
   controls but shows no place chips.

---

### User Story 3 - Dream about moments not yet lived (Priority: P2)

For a moment the user has not yet lived, they can flag it as a dream (⚑ Want). Once a moment is
marked lived, the dream flag disappears (wishing for something you have already done is meaningless)
and a ♥ Favorite control becomes available to star the ones that meant the most.

**Why this priority**: Wishlist and favorite are meaningful extras on top of the core "lived" state
but are not required to get value from the feature.

**Acceptance Scenarios**:

1. **Given** a moment not marked lived, **When** the user taps ⚑, **Then** it is added to the
   wishlist; tapping ⚑ again removes it.
2. **Given** a moment on the wishlist, **When** the user then marks it lived, **Then** it becomes a
   lived record and the ⚑ control is no longer offered for it.
3. **Given** a moment marked lived, **When** the user taps ♥, **Then** it is favorited; the ♥
   control is offered only once a moment is lived (or while a favorite is already set, so it can be
   unset).

---

### User Story 4 - Moments never distort stats and travel in the backup (Priority: P2)

The user has ticked off a dozen moments. When they open coverage statistics, their country count is
unchanged — a moment is not a country. When they export their single portable file, the lived
moments are inside it and restore identically on another device.

**Why this priority**: Honoring the constitution (aggregator-only, neutral custom data, one portable
file) is essential to trust, but it is invisible plumbing beneath the visible Stories 1–3.

**Independent Test**: Note the "countries visited" figure, mark several moments as lived, reopen
statistics and confirm the figure is unchanged; then export and re-import and confirm the moments
survive.

**Acceptance Scenarios**:

1. **Given** any number of lived moments, **When** the user opens coverage statistics, **Then** the
   count of countries visited and percentage-of-world figures are unchanged by those moments.
2. **Given** lived moments, **When** the user exports the portable file and re-imports it on a fresh
   install, **Then** every lived moment is restored as the same record with no loss.
3. **Given** lived moments, **When** the user opens the map, **Then** the moment records themselves
   add no markers (they carry no coordinates); only their place chips move the map.

---

### Edge Cases

- The bundled experiences file is missing, unreachable, or returns a non-OK response → the list
  degrades gracefully to empty and the rest of the app keeps working; nothing is thrown.
- An entry in the file is malformed (no `xp-` id, or a non-string name) → it is dropped on load and
  never rendered or acted upon.
- A linked place is malformed (missing name, or non-numeric latitude/longitude) → that spot is
  dropped, but the moment itself still appears.
- A moment has no linked places at all → it renders with its hint and status controls and simply
  shows no place chips.
- A linked place has no country code → its chip shows a neutral 📍 pin instead of a flag.
- A moment is marked lived and then unmarked → the record is fully removed; the tally returns to its
  prior value.
- Two moments share a linked place (e.g. Rovaniemi appears under Santa, the Arctic Circle, and dog
  sledding) → each chip is independent and flies the map to its own coordinates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST present a curated list of world "moments" (once-in-a-lifetime
  experiences) loaded read-only from a bundled reference file
  (`public/reference/experiences.json`); the app MUST NOT author or invent moments outside that
  file.
- **FR-002**: Each moment MUST display an emoji, a name, and a one-line hint.
- **FR-003**: The system MUST show a running "<lived> of <total> lived" summary, where "lived"
  counts the moments whose stored record has status "visited".
- **FR-004**: Users MUST be able to mark a moment as lived (✓ Been) and to unmark it, one tap each,
  with no menus.
- **FR-005**: Users MUST be able to flag a not-yet-lived moment as a dream/wishlist item (⚑); this
  control MUST be offered only until the moment is marked lived.
- **FR-006**: Users MUST be able to favorite a moment (♥); this control MUST be offered only once
  the moment is lived, or while a favorite is already set so it can be unset.
- **FR-007**: A moment MAY list a few real anchor places where it can be lived; each place carries a
  name, latitude, longitude, and an optional country code, and the system MUST render each as a
  tappable chip.
- **FR-008**: Tapping a place chip MUST fly the map to that place's coordinates and MUST NOT create
  or modify any record.
- **FR-009**: Each place chip MUST show the country flag for its country code, or a neutral 📍 pin
  when no country code is present.
- **FR-010**: Each moment MUST be stored as an ordinary "custom" visit record carrying the neutral
  country code "ZZ", so it participates unchanged in the single portable file, backup/restore, and
  sharing used by every other record.
- **FR-011**: Moment records MUST NOT count toward any country-coverage statistic; the neutral "ZZ"
  code MUST be excluded from the set of visited countries.
- **FR-012**: Moment records MUST carry no coordinates of their own and therefore MUST NOT appear as
  map markers; only their linked place chips move the map.
- **FR-013**: On load the system MUST validate and sanitize the bundled list as inert data: it MUST
  drop any entry lacking a string id that begins with `xp-` or lacking a string name, and MUST drop
  any linked place lacking a string name or a numeric latitude and longitude.
- **FR-014**: On any load failure (fetch error or non-OK response) the system MUST degrade
  gracefully to an empty list without throwing.
- **FR-015**: The bundled dataset MUST record provenance — a dataset name, a version, and an open
  license (CC0-1.0) — consistent with the aggregator-only constitution.
- **FR-016**: The list MUST be operable by keyboard and assistive technology: the section is
  labeled, the moment emoji is decorative (aria-hidden), each place group carries a screen-reader
  label ("Places for <name>:"), each chip carries a descriptive title, and each status button
  exposes its pressed state and an accessible label — meeting WCAG 2.1 AA.
- **FR-017**: No moment interaction MUST transmit user data off the device; loading the list is a
  same-origin fetch of a bundled asset, and marking, wishing, or favoriting a moment persists only
  locally.
- **FR-018**: The Moments list MUST be reachable as a dedicated view within the Places screen and
  MUST be reusable standalone (via an embedded flag) without behavioral change.

### Key Entities *(include if feature involves data)*

- **Moment (Experience)**: A curated world experience. Attributes: stable id (prefixed `xp-`),
  emoji, name, one-line hint, and an optional list of linked places. Read-only reference data —
  never authored by the app.
- **Linked Place (Spot)**: A real anchor place where a moment can be lived. Attributes: name,
  latitude, longitude, optional ISO country code. Used only to fly the map; not itself a visit.
- **Moment Record**: The user's own record that a moment is lived, wished for, or favorited. Stored
  as a "custom" visit with a neutral "ZZ" country code and no coordinates, so it is portable and
  statistically inert. This is user-authored data.
- **Experiences Dataset**: The bundled reference file (name, version, CC0-1.0 license) supplying the
  moments. V0 seed, replaceable later by a community-maintained file of the same shape.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The bundled V0 list contains at least 75 curated moments (currently exactly 75), each
  with an emoji, a name, and a one-line hint.
- **SC-002**: With no network connection, 100% of moment interactions work — mark lived, unmark,
  wish, favorite, and fly to a linked place.
- **SC-003**: Marking or unmarking a moment updates the "<lived> of <total> lived" tally
  immediately, within the same render.
- **SC-004**: Adding any number of lived moments changes the count of countries visited and the
  percentage-of-world figures by exactly zero.
- **SC-005**: A moment marked lived survives export and re-import as an identical "custom" record
  with the neutral "ZZ" country code, in 100% of cases.
- **SC-006**: Tapping any linked place chip recenters the map on that place's coordinates in a
  single action and creates zero records.
- **SC-007**: A corrupted or unreachable experiences file yields an empty list and no crash; the
  rest of the app remains fully usable.
- **SC-008**: 100% of malformed list entries (bad or missing id, missing name, non-numeric linked
  coordinates) are dropped on load and are never rendered or acted upon.

## Assumptions

- "Moments" are deliberately distinct from places: they are things you can only *live* somewhere,
  not entities you visit and own on a map. This is why they are stored as neutral "ZZ" custom
  records rather than as countries, cities, or monuments.
- Storing each moment as a plain custom visit record means backup, restore, Markdown/CSV export, and
  cross-device transfer already work with no moment-specific code — the feature rides the existing
  portable-file machinery.
- The neutral "ZZ" country code is the single mechanism that keeps moments out of country
  statistics; the coverage computation excludes "ZZ" (and airports) from visited countries.
- Linked-place coordinates are approximate anchors for flying the map, not precise personal records;
  their only job is to answer "where does this happen".
- V0 ships a small bundled starter list under CC0-1.0; a fuller community-maintained dataset can
  replace the file later using the same shape and the same `xp-` ids, with no app changes.
- The list is small and static per build, so it is fetched once and cached in memory; a fresh build
  is the update mechanism.

## Out of Scope

- A per-moment detail page, photos, notes, or dates (moments are a lightweight checklist; rich
  per-place detail lives on real Place pages).
- The community-maintained / downloadable experiences dataset and any in-app editing or contribution
  flow (V0 is a bundled seed only).
- Automatic detection or verification that a moment was actually lived (e.g. from location history);
  marking is entirely manual and self-reported.
- Rendering moments as their own markers on the map, or drawing lines/paths between a moment and its
  places (only the place chips move the map).
- Counting moments toward any statistic, leaderboard, comparison, or coverage percentage.
- Per-moment reference facts beyond emoji/name/hint/anchor-places (the app aggregates the bundled
  file; it invents nothing further).
