# Feature Specification: Trip Reconstruction (retrospective journeys)

**Feature Branch**: `019-trip-reconstruction`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Add a new page in Travel to recreate trips you've already
taken, quickly, from the airports (and railway stations, if we can) you passed through —
so you can say 'here's what I did, and roughly how many kilometres' without precisely
re-entering the journey. Not a planner — a fast, vague sketch of a past trip. A trip is an
ordered sequence of STEPS linking places (airport → city → airport → …); the app sums the
great-circle distance. Also fix: clicking an airport in Travel and pressing back closes the
whole screen instead of returning to the list. And today airports aren't linked into
anything — the 'step' is what links airports, cities, … into a journey."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rebuild a past trip as an ordered chain of stops (Priority: P1)

Today the Travel screen can only record a trip as a **single leg** (one "from → to" hop);
a real journey — Paris → Tokyo → Osaka → home — has to be entered as several disconnected
legs that only loosely share a name. A traveller who wants to remember a whole journey opens
a **dedicated trip page** and assembles it as an **ordered sequence of stops**: they search
and pick the places they passed through (the airports and cities they've been to), drop them
in order, give the trip a name and a rough date, and the app shows the journey as one thing
with its total distance. It is deliberately fast and approximate — the goal is "ok, that's
what I did," not an exact itinerary.

**Why this priority**: This is the core of the feature and delivers value on its own — one
journey, assembled in seconds, with its shape and scale — even without the distance readout
polish, the navigation fix, or stations. Everything else builds on the multi-stop trip
existing.

**Independent Test**: On the Travel page, create a trip, add three or more stops in order
(picked from reference places), name it, set a rough date, and save; confirm it appears in
the Travel list as one multi-stop journey and reopening it shows the same ordered stops —
all offline.

**Acceptance Scenarios**:

1. **Given** the Travel screen, **When** the user starts a new trip, **Then** a page/flow
   opens where they can add an ordered list of stops.
2. **Given** the new-trip flow, **When** the user searches for and picks a place, **Then** it
   is appended as the next stop in the journey; repeating builds the ordered chain.
3. **Given** a trip with several stops, **When** the user reorders or removes a stop, **Then**
   the journey order updates immediately and consistently.
4. **Given** a trip with a name and a rough date, **When** the user saves, **Then** the trip
   is stored locally and shown in the Travel list as one multi-stop journey.
5. **Given** an existing reconstructed trip, **When** the user reopens it to edit, **Then**
   the same stops, name, and date are restored and can be changed and re-saved.

---

### User Story 2 - See how far you went (Priority: P2)

The point of reconstructing a trip is the retrospective payoff: **how far did I go?** For a
trip's ordered stops, the app sums the **great-circle distance** between each consecutive
pair and shows the **total kilometres** for the journey, updating live as stops are added,
removed, or reordered. The Travel totals (trip count, total distance) reflect reconstructed
trips too, so the screen answers "here's what I've done" at a glance.

**Why this priority**: The distance is the reason to reconstruct rather than just list places,
but the trip is still useful as a record without it, so it follows the builder.

**Independent Test**: Build a trip with known stops and confirm the shown total matches the
sum of great-circle leg distances (within a small tolerance); add/remove/reorder a stop and
confirm the total changes immediately; confirm the Travel totals include the trip's distance.

**Acceptance Scenarios**:

1. **Given** a trip with two or more coordinate-bearing stops, **When** it is viewed, **Then**
   the total great-circle distance in kilometres is shown.
2. **Given** a trip being edited, **When** the user adds, removes, or reorders a stop, **Then**
   the total distance recomputes immediately.
3. **Given** several reconstructed trips, **When** the user views the Travel totals, **Then**
   the trip count and total distance include them.
4. **Given** a stop that has no usable coordinate, **When** distance is computed, **Then** that
   leg contributes nothing but the rest of the total is still shown (no error, no zeroed total).

---

### User Story 3 - Back from a place returns to the Travel list (Priority: P2)

When the user taps a place shown in the Travel screen (e.g. an airport in the most-visited
roll-up) and then presses Back/Escape, they must land **back in the Travel list where they
were** — not have the Travel screen "close" and leave them stranded elsewhere. Today tapping
an airport jumps to the map and opens a card; the first Back only dismisses the card, so the
user is left on the map, reading as "Back closed my Travel screen."

**Why this priority**: A concrete, reported navigation defect that makes the Travel screen
feel broken; small and independent, but not the headline builder, so it rides alongside.

**Independent Test**: From the Travel screen, open a place (an airport row); press Back (and
separately Escape, and the Android back gesture); confirm a single Back returns to the Travel
list at the position the user left, with no dead-end on the map and without the app exiting.

**Acceptance Scenarios**:

1. **Given** the Travel screen, **When** the user opens a place from it and then presses Back
   once, **Then** they are returned to the Travel list they came from.
2. **Given** the same, **When** the user presses Escape or uses the platform Back gesture
   instead, **Then** the outcome is identical — back to the Travel list.
3. **Given** the user is returned to the Travel list, **When** they look at it, **Then** it is
   the same list/scroll context they left, not a reset or a different screen.

---

### User Story 4 - Railway stations as stops (Priority: P3, dataset-gated)

Some journeys are by rail, so a stop should be able to be a **railway station**, not only an
airport or city. Because the app invents no reference data, stations can only appear once a
named, openly-licensed **station dataset** is available; until then the feature works with
airports and cities and simply doesn't offer stations. The stop model is **place-kind-agnostic**
so stations slot in without reworking trips when the dataset lands.

**Why this priority**: A natural extension for rail travellers, but it depends on sourcing a
dataset that does not exist today, so it must not block the airport/city MVP.

**Independent Test**: With a station dataset present, confirm a station can be picked as a stop
and contributes to distance like any other place; with no station dataset, confirm the builder
works with airports + cities and shows no broken "stations" affordance.

**Acceptance Scenarios**:

1. **Given** no station dataset, **When** the user builds a trip, **Then** they can still pick
   airports and cities as stops with no error and no empty stations option.
2. **Given** a station dataset is present, **When** the user searches for a station, **Then** it
   can be added as a stop and behaves like any other coordinate-bearing stop.

---

### Edge Cases

- **Stop without coordinates**: a country-only reference or a custom point lacking a coordinate
  contributes no distance to its leg; the total still displays for the resolvable legs, clearly,
  with no crash and no misleading zero.
- **Zero or one stop**: a trip with fewer than two stops shows no distance and gently prompts to
  add more; it is never a dead end.
- **Duplicate / consecutive same stop**: a zero-length leg is allowed and simply adds nothing.
- **Many stops**: a long journey (e.g. 20+ stops) stays responsive and the total stays correct.
- **The Travel back bug (US3)**: opening a place from Travel and pressing Back returns to the
  list in one action; it never exits the app or strands the user on the map.
- **Editing an existing trip**: reopening restores stops/name/date; saving updates in place.
- **Approximate dates**: trips with only a rough month or year sort and group sensibly alongside
  precisely dated ones; an undated trip is allowed.
- **Backward compatibility**: existing single-leg trips and boarding-pass-imported trips remain
  valid and visible after the schema evolves; older exported files still load.
- **Stations requested but absent**: no dataset ⇒ airports + cities only, silently.
- **Offline**: the entire flow (build, search stops, distance, save) works with no network.

## Clarifications

### Session 2026-07-21

- Q: Are railway stations in scope for the MVP? → A: **Deferred.** No station dataset ships today;
  the MVP builds on airports + cities, and the stop model is kept place-kind-agnostic so a future
  named, openly-licensed station dataset slots in without reworking trips (US4, FR-011).
- Q: What kinds of places can be a stop? → A: **Airports and cities** for the MVP (the natural
  travel waypoints); other coordinate-bearing kinds may be added later (FR-002).
- Q: Which places can the picker choose from? → A: **The whole reference gazetteer** — not limited
  to already-logged places, since journeys pass through layovers/places never logged; logged places
  may be surfaced first for speed (FR-007).
- Q: Does building a trip change visit records? → A: **No — pure summary.** A trip references
  reference places and never adds or changes visits (FR-008).
- Q: What date granularity for the "vague" date? → A: **Month (YYYY-MM) or year (YYYY), both
  optional**; no exact calendar day required, undated allowed (FR-006).

### Session 2026-07-22 (fast-reconstruction refinement)

The reconstruction flow must be **extremely easy and fast**. Refinements (supersede the earlier
"whole gazetteer" pool decision for the reconstruct composer):

- Q: Where do stops come from in the reconstruct composer? → A: **Only places you've already been**
  — the user's visited places (visit records) plus places already used in their trips — shown with
  **country flags**, tap to add. No gazetteer typing. (Revises FR-007 for the composer; the quick
  single-leg form keeps full search.)
- Q: How do you pick a stop? → A: **Choice of List or Map** — a tappable list of your places, or a
  lightweight offline map of your places (tap a pin). One tap adds a stop.
- Q: Is a date required? → A: **No — add it later.** The composer saves with no date; the date is a
  deferred, optional control (you can set it on the trip afterwards).
- Q: Any default trip/folder name? → A: **No default name** — never prefill or suggest "Japan 2024"
  (or any name); the name field is empty and optional.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Travel screen MUST provide a clear entry point to create and edit a trip as an
  **ordered sequence of stops** (a multi-stop journey), distinct from the current single-leg
  entry.
- **FR-002**: A stop MUST reference a place the user passed through — an **airport** or a **city**
  for the MVP — resolved from existing reference data with a coordinate. The stop model MUST stay
  place-kind-agnostic so other coordinate-bearing kinds (stations, monuments, custom pins) can be
  added later without reworking trips. (Resolved: airports + cities for the MVP.)
- **FR-003**: Users MUST be able to add, remove, and reorder stops, and the journey MUST preserve
  the order.
- **FR-004**: The app MUST compute and display the trip's **total distance in kilometres** as the
  sum of great-circle distances between consecutive stops, computed on-device and offline.
- **FR-005**: The distance total MUST update immediately when stops are added, removed, or
  reordered.
- **FR-006**: A trip MUST carry a **name** and an **approximate date**. The date is deliberately
  coarse: the user may set a **month (YYYY-MM)** or a **year (YYYY)** — no exact calendar day is
  required — and the date is **optional** (a trip may be undated). (Resolved: month or year, both
  optional.)
- **FR-007**: The stop picker MUST let the user quickly find any place in the **whole reference
  gazetteer** (not limited to already-logged places, because journeys pass through layovers and
  places the user never logged separately); it MAY surface already-logged places first for speed,
  and MUST be keyboard-operable. (Resolved: whole gazetteer.)
- **FR-008**: Building or saving a trip MUST be a **pure summary** over reference places: it MUST
  NOT add, remove, or change the user's visit records (a layover the user passed through does not
  become "visited"). (Resolved: pure summary, visits untouched.)
- **FR-009**: The Travel totals (trip count, total distance, and any per-mode breakdown) MUST
  reflect reconstructed multi-stop trips so the screen answers "what I've done."
- **FR-010**: Opening a place from the Travel screen and then invoking Back, Escape, or the
  platform back gesture MUST return the user to the Travel list they came from in a **single**
  action — never closing the Travel screen, exiting the app, or leaving the user stranded on
  another screen.
- **FR-011**: The app MUST NOT invent station (or any) reference data; **railway stations** MUST
  come only from a named, openly-licensed dataset with recorded provenance. Absent such a
  dataset, the feature MUST work with airports + cities and degrade gracefully with no broken
  stations affordance. The stop model MUST be place-kind-agnostic so stations slot in later.
- **FR-012**: All trip reconstruction — search, distance, save — MUST work fully offline with
  **zero** network egress; no maps, routing, or geocoding service is used.
- **FR-013**: A stop that cannot be resolved to a coordinate MUST contribute no distance for its
  leg without breaking the total or the interface, and the situation MUST be legible to the user.
- **FR-014**: Reconstructed trips MUST be stored in the user's single portable, human-readable
  file using a documented, **versioned, additive** schema; **existing single-leg trips and
  previously exported files MUST remain valid** and visible.
- **FR-015**: The feature MUST NOT introduce telemetry or any egress of user content; trips leave
  the device only via the existing explicit export.
- **FR-016**: All new user-visible strings MUST exist in every supported locale (en, fr, ko) with
  compile-time key parity, and all interactive elements (add/remove/reorder stops, pick a place,
  save/cancel) MUST meet WCAG 2.1 AA and be fully keyboard-operable.

### Key Entities *(include if data involved)*

- **Reconstructed trip (multi-stop journey)**: a named journey the user assembles retrospectively
  — a name, an approximate date, and an **ordered list of stops**; its total distance is
  **derived** (summed great-circle legs), not stored. It extends the existing travel-log concept
  additively; existing single-leg trips remain a valid, simpler case.
- **Stop (step)**: one waypoint in a journey — a reference to a place (airport or city today;
  station when a dataset exists) whose coordinate is resolved from reference data. Ordered within
  its trip. Carries no invented data.
- **Visit (existing)**: the user's record that they were at a place. A trip's relationship to
  visits is defined by FR-008 (clarification pending).
- **Reference place (existing)**: airports, cities (and later stations) from named, openly-licensed
  datasets — the only source of a stop's identity and coordinate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can reconstruct a multi-stop past trip (three or more stops), name it, set a
  rough date, and see its total distance — entirely offline — in under 90 seconds.
- **SC-002**: The displayed total equals the sum of the great-circle leg distances for all
  resolvable consecutive stops, within a small, documented tolerance.
- **SC-003**: 100% of "open a place from the Travel screen, then Back" flows return the user to
  the Travel list in a single Back/Escape/back-gesture action, with the app never exiting.
- **SC-004**: Adding, removing, or reordering a stop updates the total distance with no
  perceptible delay.
- **SC-005**: With the network fully disabled, the entire flow (open, build, search stops,
  distance, save, reopen) works and a network monitor records zero outbound requests attributable
  to the feature.
- **SC-006**: 100% of portable files created before this feature still load, and every existing
  single-leg / boarding-pass trip still displays correctly.
- **SC-007**: The trip builder passes automated accessibility checks (WCAG 2.1 AA) and is fully
  operable by keyboard, and the build fails if any en/fr/ko translation key is missing.

## Assumptions

- This feature **extends the existing Travel trips log** (the `trips` concept already in the
  portable file) rather than introducing a parallel, unrelated store; existing single-leg trips
  and boarding-pass imports remain first-class. Whether the multi-stop journey is a new entity or
  an evolution of the existing single-leg trip is an implementation decision for planning, bound
  by the additive-schema and backward-compatibility requirements (FR-014).
- "Vague date" means the user is not required to pin an exact calendar day; a rough month (YYYY-MM)
  or year (YYYY) — or nothing — is acceptable (FR-006).
- **Railway stations are deferred** for the MVP because no station reference dataset ships today;
  they become available only via a future named, openly-licensed dataset (a separate shareable
  dataset, per the constitution), and the stop model is designed to accommodate them without
  rework (FR-011, US4).
- Distance uses a **great-circle (haversine)** approximation — straight-line "as the crow flies,"
  not routed rail/road/air distance — matching the "rough sketch" intent; the existing on-device
  distance helper is reused.
- The stop picker reuses the app's existing aggregator-only place search (reference places only);
  any need for custom/station points with coordinates is bounded by FR-011 and the clarifications.
- Supported locales are en/fr/ko; keyboard and assistive-technology users are first-class.
- The feature adds no server, account, or network dependency of any kind (Constitution II/III).
