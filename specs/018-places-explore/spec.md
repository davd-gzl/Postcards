# Feature Specification: Places Explore & Track

**Feature Branch**: `018-places-explore`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "Places → Explore & Track redesign. Make the Places screen ONE unified hub to both DISCOVER places and SEE what you've visited, across every place kind (cities, monuments/UNESCO heritage sites, airports, countries) — blending the whole-world reference data with the user's personal records (visited, wishlist, favorites) in one simple, consistent surface. Kill duplicated concepts between controls; browse the whole world with filters; search across everything including by country; monument category tags; always show all countries; a simple unified way to see all information in all its forms."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One surface, two clean axes: what kind × which places (Priority: P1)

Today the Places screen mixes two different ideas in two rows of controls: a
status/collection row (Visited / Favorites / Wishlist / **Monuments** / Countries)
and a kind row (All / Cities / **Monuments** / Airports). "Monuments" lives in
both, so the same concept is reachable two ways and it reads as clutter. The
redesign separates the two independent axes once and for all:

- **Kind** — *what* you are looking at: Cities, Monuments, Airports, Countries.
- **Status/scope** — *which* of them: everything, only your Visited, your
  Wishlist, your Favorites, or the ones you have **not** been to yet.

A traveller picks a kind, then narrows by status; the same place reads the same
whether it is one of theirs or one they have never seen. No concept appears in two
different controls, and the header title/label never depends on a hidden mode.

**Why this priority**: This is the structural backbone. Every other story (world
browse, search, tags) hangs off having one coherent list driven by a *kind* axis
and a *status* axis instead of overlapping tabs. It delivers value on its own — a
calmer, non-duplicated Places screen — even before world-browse ships.

**Independent Test**: Open Places, confirm exactly one control selects the kind
(cities/monuments/airports/countries) and a separate control selects the status
(all/visited/wishlist/favorites/not-visited), that "Monuments" appears in only one
of them, and that switching kind keeps the chosen status and vice-versa.

**Acceptance Scenarios**:

1. **Given** the Places screen, **When** the user looks at the controls, **Then** "Monuments" (and every other place kind) appears in exactly ONE control (the kind axis), never duplicated in a status/collection row.
2. **Given** a chosen kind and a chosen status, **When** the user changes the kind, **Then** the status selection is preserved (and vice-versa), so the two axes compose instead of resetting each other.
3. **Given** any kind + status combination, **When** the list renders, **Then** each row reads consistently (same layout for a visited and a not-visited place of that kind), with the personal status shown on the row rather than implied by which tab you are on.
4. **Given** the redesigned screen, **When** the user counts the top-level controls, **Then** they are fewer and clearer than before, with no control whose only job duplicates another.

---

### User Story 2 - Browse the whole world, not just your visits (Priority: P2)

The point of the app is remembering where you have been — but to plan and dream
you also want to *see what exists*. Within any kind, the user can browse the whole
world from the shipped reference data: **all** cities, **all** monuments, **all**
airports — not only the ones they have logged. Within the browse, visited places
are clearly marked as visited and the rest read as "not yet", and the same
filters (status, country, and kind-specific filters) narrow the world down. Because
the full gazetteer is very large, world-browse stays instant by working from a
capped/searched working set rather than trying to show every place at once.

**Why this priority**: Discovery is the headline new capability — "so you can
discover a place, see what you've visited". It builds directly on US1's kind ×
status axes (browsing the world is simply status = all / not-visited over reference
data) and is the reason the redesign exists beyond de-duplication.

**Independent Test**: Choose Cities + "not visited", confirm the list shows
reference cities you have never logged (not an empty "you've been everywhere"
state); choose Monuments + all, confirm every world heritage site is reachable;
mark one visited and confirm it moves to/reads as visited without leaving the
browse.

**Acceptance Scenarios**:

1. **Given** the Cities kind with status "all" (or "not visited"), **When** the list renders, **Then** it includes reference cities the user has never logged, each marked as not-yet-visited, drawn from the on-device gazetteer.
2. **Given** the Monuments kind with status "all", **When** the list renders, **Then** every UNESCO/heritage site in the shipped dataset is reachable (via scroll/paging/search), each marked visited or not.
3. **Given** the Airports kind with status "all", **When** the list renders, **Then** every airport in the shipped dataset is reachable, each marked visited or not.
4. **Given** a not-visited place in the browse, **When** the user marks it visited (or wishlist/favorite) from its row, **Then** its status updates in place and it now reads as visited, with no full-screen navigation required.
5. **Given** the very large city gazetteer, **When** the user browses "all cities", **Then** the screen stays responsive (results appear within a short, consistent time and scrolling never stalls), because the list draws a bounded working set rather than every city at once.
6. **Given** the network is fully disabled, **When** the user browses/filters any kind, **Then** it works entirely from on-device reference data with zero outbound requests.

---

### User Story 3 - Find anything by name or by country (Priority: P3)

One search box finds anything in the app's world — cities, monuments, airports,
countries — from a single query. Crucially, monuments and airports are findable by
their **country**, not only by their own name or code: typing a country surfaces
its monuments and its airports, so "show me France's UNESCO sites" or "airports in
Japan" is one query. Search spans both what the user has logged and the wider
reference data, and everything works offline.

**Why this priority**: Search is how a large world becomes usable — it is what
makes "see all info in all its forms" practical once US2 exposes the whole
dataset. It depends on the browse surface existing but is separable from it.

**Independent Test**: Search a country name and confirm its monuments and airports
appear (not only the country); search a monument name and an airport code and
confirm each resolves; run each with the network off.

**Acceptance Scenarios**:

1. **Given** the search, **When** the user types a country's name, **Then** results include that country's monuments and airports (by country), alongside its cities and the country itself.
2. **Given** the Monuments kind, **When** the user filters/searches by a country, **Then** only that country's monuments are shown.
3. **Given** the Airports kind, **When** the user searches by a country (in addition to name / IATA code / city), **Then** that country's airports are shown.
4. **Given** any search, **When** results appear, **Then** each result shows its kind and its personal status (visited / wishlist / not-yet) so the user can act on it directly.
5. **Given** the network is disabled, **When** the user searches, **Then** results come only from on-device reference data with no outbound requests.

---

### User Story 4 - Monuments carry their category as a tag (Priority: P4)

The heritage dataset already classifies each site as **cultural**, **natural**, or
**mixed**. Surface that classification as a tag on every monument row (matching the
map's per-category markers), and let the user filter the monuments list by
category. Tags are read straight from the dataset — never invented.

**Why this priority**: A focused enhancement that makes the (now browsable) monument
list scannable and filterable, but the browse is fully usable without it, so it
ships after the core surface and search.

**Independent Test**: Open Monuments, confirm each row shows its category tag
(cultural/natural/mixed) consistent with the map marker; filter to one category and
confirm only that category remains.

**Acceptance Scenarios**:

1. **Given** the Monuments list, **When** a monument row renders, **Then** it shows the site's dataset category (cultural / natural / mixed) as a tag, consistent with the map's category markers.
2. **Given** the Monuments list, **When** the user selects a category filter, **Then** only monuments of that category remain, and clearing it restores all.
3. **Given** a monument whose dataset record has no category, **When** its row renders, **Then** it falls back gracefully (no invented category, no broken tag).

---

### User Story 5 - The country checklist shows every country at once (Priority: P5)

There are only ~193–250 countries, so the country list never needs a "load more".
The full checklist is shown at once (still searchable/filterable), so a user can
scan their whole-world country coverage without paging.

**Why this priority**: A small, self-contained fix that removes friction from the
country view; independent of the rest.

**Independent Test**: Open Countries, confirm all countries render at once (no
"show more" pager), and that name search still narrows them.

**Acceptance Scenarios**:

1. **Given** the Countries kind, **When** the list renders, **Then** every country in scope is shown at once with no pagination/"load more" control.
2. **Given** the full country list, **When** the user types in the country search, **Then** it narrows live without needing to expand a truncated list first.

---

### Edge Cases

- **Empty personal data**: A brand-new user with nothing logged still sees a full world to browse (all cities/monuments/airports/countries) — the screen is never an empty dead-end; "not visited" is the natural default content, not a blank state.
- **Huge result sets**: Browsing "all cities" (~135k) or a broad search must never freeze — it draws a bounded, most-relevant working set and invites narrowing (search/filter/country) rather than rendering everything.
- **Status × kind that is empty**: A combination with no matches (e.g., Favorites + Airports when none are starred) shows a clear, named empty message with a one-tap way to widen (clear the status), not a blank void.
- **Marking status inside browse**: Toggling visited/wishlist/favorite on a browsed reference place must update the row in place and stay in the current browse (no jump to a detail page).
- **Offline**: With no network, every browse/search/filter works against on-device reference data; anything that would need the network (e.g. a place photo) simply degrades and never blocks the list.
- **Country with no reference rows of a kind**: A country that has no monuments (or no airports) in the dataset shows an honest "none in the data" message for that kind, never a fabricated entry.
- **Consistency with the map**: The kind and status axes here are the same shared concepts the map uses, so filtering in Places and on the map never disagree.

## Clarifications

### Session 2026-07-20

- Q: How should "discover the whole world" and "see my visits" relate on the Places screen? → A: ONE surface — a single list where a status/scope control (All world / Visited / Wishlist / Favorites / Not-visited) chooses *which* places and the kind control chooses *what*; discover and track are the same list, with no separate modes to switch between.
- Q: With ~135k world cities, how is "all cities" reached so it stays instant? → A: Scope-first — the cities browse shows a bounded, most-relevant working set (most-populous / near you) and the user narrows by typing a search or picking a country/region; never an unbounded full-gazetteer scroll.
- Q: Where do Favorites and Wishlist live in the two-axis model? → A: They are values of the STATUS axis (All / Visited / Wishlist / Favorites / Not-visited), not their own tabs — this is what removes the tab/kind duplication.
- Q: Where do Moments, Photos and Passport go? → A: They stay as separate cross-cutting collections reachable from Places, NOT folded into the kind × status browse (a photo wall / moments / passport is not a place kind).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Places screen MUST organise around two independent axes — **kind** (cities, monuments, airports, countries) and **status/scope** (all, visited, wishlist, favorites, not-visited) — and MUST NOT expose the same concept in two different top-level controls (e.g. "Monuments" must live only on the kind axis).
- **FR-002**: The kind and status selections MUST compose independently: changing one MUST preserve the other, so any kind × status combination is reachable.
- **FR-003**: Within any kind, the user MUST be able to browse the whole world from the shipped on-device reference data — all cities, all monuments, all airports — not only places they have logged.
- **FR-004**: Every browsed row MUST clearly show the place's personal status (visited / wishlist / favorite / not-yet) and MUST allow changing that status directly from the row, updating in place without leaving the browse.
- **FR-005**: World-browse and search MUST remain responsive on the full gazetteer (~135k cities) by drawing a bounded, most-relevant working set (cap/paging/search-first) rather than rendering every place at once.
- **FR-006**: A single search MUST span all reference kinds (cities, monuments, airports, countries) and return results labelled with their kind and personal status.
- **FR-007**: Monuments MUST be searchable and filterable **by country**; airports MUST be searchable **by country** in addition to name, IATA code and city.
- **FR-008**: Monument rows MUST display the site's dataset category (cultural / natural / mixed) as a tag consistent with the map's category markers, and the monuments list MUST be filterable by category; a record with no category MUST degrade gracefully with nothing invented.
- **FR-009**: The country checklist MUST display all countries in scope at once (no pagination / "load more"), while remaining searchable and filterable.
- **FR-010**: All reference facts (place names, coordinates, populations, categories, country membership) MUST come from the datasets already shipped; the feature MUST NOT invent or mint any reference data.
- **FR-011**: All browse, search and filter functionality MUST work fully offline against on-device reference data, with zero outbound network requests attributable to this feature and no telemetry.
- **FR-012**: The kind and status axes MUST reuse the app's single shared filter concepts so that Places and the map never disagree on what is shown.
- **FR-013**: The feature MUST reuse the existing visit / wishlist / favorite data model and reference datasets unchanged — it changes the browsing/searching/organising surface, not the stored data shape.
- **FR-014**: Every new user-visible string MUST exist in all supported locales (en, fr, ko) with compile-time key parity, and all interactive controls MUST meet WCAG 2.1 AA (labels, focus order, target size, full keyboard operability).
- **FR-015**: Empty and very-large states MUST be handled explicitly: an empty kind × status combination shows a named message with a one-tap widen, and a large browse invites narrowing rather than freezing.

### Key Entities *(include if data involved)*

- **Place (reference, existing)**: A real-world city, monument/heritage site, airport, or country from the shipped datasets — its name, coordinates, country, and kind-specific attributes (population for cities, category for monuments, IATA code for airports). Read-only reference data; the app never authors it.
- **Personal record (existing)**: The user's own visit / wishlist / favorite against a place. Unchanged by this feature; it is what colours a browsed reference place as visited/wishlist/not-yet.
- **Kind (axis)**: The place type being viewed — cities, monuments, airports, countries — the app's shared "mode" concept.
- **Status/scope (axis)**: Which subset of a kind is shown — all, visited, wishlist, favorites, not-visited — the app's shared status concept, extended so "all/not-visited" reveals reference places, not only logged ones.
- **Search query (transient)**: A single string matched across all kinds and, for monuments/airports, against country as well as own name/code; purely ephemeral input.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No place-kind concept appears in more than one top-level control on the Places screen (each of cities/monuments/airports/countries is selectable in exactly one place).
- **SC-002**: From a fresh install with nothing logged, a user can browse a non-empty world for every kind (cities, monuments, airports, countries) and every place reads as "not visited" rather than showing an empty state.
- **SC-003**: A user can go from opening Places to seeing a specific not-yet-visited place they were curious about (via kind + status + search/country) and mark it visited in under 20 seconds.
- **SC-004**: Browsing "all cities" and typing a search each surface relevant results within ~1 second on the full gazetteer, and scrolling never stalls.
- **SC-005**: Searching a country's name surfaces that country's monuments and airports (not only the country), and both monuments and airports can be narrowed to a single country.
- **SC-006**: Every monument row shows a category tag matching the map's markers, and filtering monuments by category yields only that category.
- **SC-007**: The country list shows all countries at once with no pagination control.
- **SC-008**: With the network fully disabled, the entire flow (browse, search, filter, mark status) works and a network monitor records zero outbound requests attributable to this feature.
- **SC-009**: The Places screen and the map agree: the same kind + status selection yields a consistent set of places in both.
- **SC-010**: The build fails if any en/fr/ko translation key is missing, and the redesigned screen passes automated WCAG 2.1 AA checks.

## Assumptions

- **One surface, two filter axes** (confirmed): the redesign is a single Places surface where a *kind* selector and a *status/scope* selector compose; "discover the world" is simply status = all/not-visited over reference data — there are no separate "discover" vs "my visits" modes.
- **Favorites and Wishlist are status values** (confirmed), not top-level tabs, since they are personal *statuses* of a place, not place *kinds* — this is what removes the tab/kind duplication.
- **Moments, Photos and Passport remain distinct collections** (confirmed) reachable from Places but not folded into the kind × status browse (they are cross-cutting views, not a place kind). Out of scope to redesign here beyond keeping them reachable.
- **World-city browse is scope-first** (confirmed): because ~135k cities cannot all render, browsing "all cities" leans on a bounded most-relevant working set (most-populous / near you — the same capped in-view approach the map already uses) plus search and country/region narrowing, rather than an unbounded scroll.
- **Reference datasets already shipped** (Natural Earth admin, GeoNames-class gazetteer, UNESCO/heritage with categories, airports) are sufficient — no new dataset is introduced (Constitution I); monument categories and country membership already exist in them.
- The existing per-place detail page, marking flows (visit/wishlist/favorite), and the shared filter store are reused; this feature changes the Places browsing/searching surface, not the data model or the map.
- Supported locales are en/fr/ko; desktop keyboard users are first-class.
- **Out of scope (separate specs)**: the Stats country-coverage card redesign, and the Wikivoyage guide reader readability.
