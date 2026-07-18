# Feature Specification: Unified Filter Panel

**Feature Branch**: `claude/monument-display-optimize-x1j6le` (developed in-place; spec dir `016-filter-panel`)

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "A unified Filter panel that consolidates every place/list filter now scattered across the Map and Places screens into one coherent, extensible surface opened from a single 'Filter' control … instead of sprinkling filter buttons across screen headers … the map's in-view list, the Places lists, and the counters all read the SAME shared filter state so they never disagree. Efficient, offline, privacy-preserving, WCAG 2.1 AA, keyboard-first."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — One place to slice the map (Priority: P1)

Today the map screen carries filter controls sprinkled across its header and list: a personal-status segmented control (All / Visited / Want list / Not visited), a "People" population row (Any / 10k+ / 100k+ / 1M+), a sort toggle (most people / A–Z), and a separate "Filter" button that opens a date/folder popover. A traveller wanting to answer "show me the big cities I still want to visit, from my 2024 trip" has to hunt across three different controls. This story replaces all of those scattered controls with a **single "Filter" button** that opens **one panel** holding every dimension, and the map's in-view list + the counter strip update live from that one shared state.

**Why this priority**: It is the core of the request — remove the scattered buttons and give the user one coherent place to slice their data. It is a viable MVP on its own: even with only the map wired up, the consolidation delivers the value.

**Independent Test**: Open the map, tap **Filter**, set status = Want list, People = 1M+, year = 2024; close the panel; the map's list and counters show exactly the cities matching all three, and the header no longer shows the old inline status/population/sort controls.

**Acceptance Scenarios**:

1. **Given** the map screen, **When** the user opens the Filter panel and sets status = Visited and People = 100k+, **Then** the in-view city list and the "N in view" counter show only visited cities of 100k+, and no separate inline status/population controls remain in the list header.
2. **Given** an open Filter panel, **When** the user changes the date window to a precise from–to range, **Then** the map markers, list and counters all narrow to that window together (they never disagree).
3. **Given** filters are applied, **When** the user reopens the panel, **Then** every control reflects the currently-applied values (the panel is the single source of truth).

---

### User Story 2 — See what's active, clear in one tap (Priority: P2)

When several filters are on, the user must be able to tell at a glance what is narrowing their view, and undo it instantly, without reopening the panel and resetting each control.

**Why this priority**: Without a visible summary and a one-tap Clear, a consolidated panel risks "hidden state" — the user forgets a filter is on and thinks data is missing. High value, but depends on US1 existing.

**Independent Test**: Apply three filters; a compact chip summary appears near the Filter button showing each active filter; tapping a chip's ✕ removes just that one; tapping **Clear all** resets every dimension to its default and the summary disappears.

**Acceptance Scenarios**:

1. **Given** status = Want list and People = 1M+ are applied, **When** the user looks at the map header, **Then** a compact summary shows two chips ("Want list", "1M+") and a Clear control.
2. **Given** active-filter chips are shown, **When** the user taps the ✕ on the "1M+" chip, **Then** only the population filter resets (status stays Want list) and the list updates.
3. **Given** any filters are active, **When** the user taps **Clear all**, **Then** all dimensions return to default (status = All, People = Any, date = Any, folder = All, sort = most people) and the summary is empty.

---

### User Story 3 — The same filter everywhere (Priority: P2)

The filters a user sets should mean the same thing and produce consistent results whether they are looking at the map's in-view list, the Places lists (Visited / Want list), or a count shown on another screen — one shared filter state, not per-screen copies that drift.

**Why this priority**: The user explicitly asked that "the map's in-view list, the Places lists, and the counters all read the SAME shared filter state so they never disagree." It multiplies the value of US1 but can ship after it.

**Independent Test**: Set status = Visited and People = 1M+ on the map's Filter panel; open Places → Visited; the same Filter button is available and pre-set to those values, and the Places list shows the same slice (its non-city places are handled per the population rule below).

**Acceptance Scenarios**:

1. **Given** filters set on the map, **When** the user navigates to Places, **Then** the Places Filter reflects the same status/population/date/folder values.
2. **Given** a population threshold is active, **When** the Places list contains non-city places (airports, monuments, custom pins), **Then** those are handled by a single documented rule (they carry no population, so the threshold hides only cities below it and leaves non-city places visible) consistently on both screens.

---

### User Story 4 — Room to grow (Priority: P3)

The panel is designed so new filter dimensions can be added in the one place instead of new buttons elsewhere: favorites-only, has-photo, has-note, and by continent/country.

**Why this priority**: The user asked to "dig to extend it a maximum." Valuable polish, but the consolidation (US1–US3) is the essential win; extensions layer on top.

**Independent Test**: Turn on "Favorites only"; the map list and Places show only favourited places, combinable with the other dimensions; the same panel hosts it with no new header button.

**Acceptance Scenarios**:

1. **Given** the Filter panel, **When** the user enables "Favorites only", **Then** only favourited places remain, combinable with status/population/date.
2. **Given** the Filter panel, **When** the user picks a continent, **Then** the view narrows to places on that continent, and the choice appears as a removable chip.

---

### Edge Cases

- **No matches**: When the combined filters match nothing in view, the list shows a clear, friendly empty state that names the active filters and offers Clear all — never a blank void.
- **Conflicting/period drift**: If a folder or year is selected and then the underlying data changes so it no longer exists (e.g. every trip in that year is deleted), the filter reconciles to a valid value instead of showing a phantom selection.
- **Non-applicable dimensions**: Population and sort-by-people apply only to cities; on a place-kind mode or list with no cities, those controls are shown disabled or hidden with a one-line reason, never silently ignored.
- **Panel dismissal**: Escape and an outside tap close the panel; focus returns to the Filter button; applied filters persist.
- **Small screens**: On a phone the panel is reachable one-handed and never covers the map's own critical controls permanently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single "Filter" control on the map (and Places) that opens one panel containing every filter dimension; the previously inline map controls (status segmented, population row, sort toggle) MUST no longer appear as separate header/list controls.
- **FR-002**: The panel MUST offer these dimensions in v1: personal status (all / visited / want-list / not-visited), population threshold (any / 10k+ / 100k+ / 1M+), date window (any / a whole year / a precise from–to range / undated only), folder-or-trip, and sort order (most people / A–Z). The map additionally exposes place-kind mode (cities / monuments / airports).
- **FR-003**: The map's markers, in-view list, and counter strip MUST all derive from one shared filter state, updating together so they never disagree.
- **FR-004**: The system MUST show a compact summary of active filters (one removable chip per non-default dimension) and a single "Clear all" action; removing a chip resets exactly that dimension.
- **FR-005**: Users MUST be able to open, adjust, and dismiss the panel by keyboard alone; the panel MUST trap focus while open, close on Escape, and restore focus to the Filter control on close (WCAG 2.1 AA).
- **FR-006**: The Places lists MUST honour the same shared filter state (status / population / date / folder), with a single documented rule for how a population threshold treats non-city places.
- **FR-007**: Applying or clearing filters MUST NOT introduce perceptible lag on a mid-range phone with the full gazetteer loaded; filtering remains a client-side operation over already-loaded data (no new network requests, honouring offline/privacy).
- **FR-008**: The panel MUST be built so a new dimension (e.g. favorites-only, has-photo, has-note, continent/country) can be added in the one panel without adding new controls to screen headers.
- **FR-009**: When the combined filters match nothing, the system MUST show an empty state that names the active filters and offers Clear all.
- **FR-010**: Filter choices that are session/device preferences (e.g. status, population, sort) MUST persist across app restarts the way today's equivalent controls do; no filter state ever leaves the device.

### Key Entities *(include if feature involves data)*

- **Filter State**: The single, shared description of how the user's places are currently sliced — status, population threshold, date window, folder/trip, sort order, place-kind mode, plus future flags (favorites-only, has-photo, has-note, continent/country). Read by the map (markers + list + counters) and the Places lists; persisted on-device for the dimensions that are preferences.
- **Active-Filter Summary**: The derived, human-readable list of non-default dimensions, each with a label and a "remove" affordance, plus a "clear all".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The map and Places list headers show **zero** standalone filter buttons other than the single "Filter" control (and the always-present search field) — every slicing dimension lives in the panel.
- **SC-002**: A user can set a three-dimension filter (status + population + year) in **under 15 seconds** from one panel, and the map list, counters, and Places list agree on the result.
- **SC-003**: With the full gazetteer loaded, applying or clearing any filter updates the visible list in **under 150 ms** on a mid-range phone (no perceptible lag).
- **SC-004**: 100% of the panel's controls are reachable and operable by keyboard, and the screen passes the automated WCAG 2.1 AA accessibility gate with no serious violations.
- **SC-005**: At least the five v1 dimensions plus one growth dimension (favorites-only) are hosted in the single panel, demonstrating the "one place, extensible" goal, with no filter state leaving the device.

## Assumptions

- The panel is an in-app overlay/sheet anchored to the existing "Filter" control, not a separate top-level navigation destination; this keeps the map visible behind it and matches the app's local-first, no-blabla feel.
- The always-present **search field** (top bar / Places) is a find-a-place affordance, not a "filter button", and stays where it is; only the *filter* controls are consolidated.
- Population and "sort by most people" are city attributes; non-city places (airports, monuments, custom pins, countries) are unaffected by a population threshold and retain a defined, consistent treatment across screens.
- Existing persisted preferences (city-filter, min-population, marker cap, etc.) and the existing map date/folder session state are reused as the backing store where possible; no new network egress is introduced.
- Reference data (gazetteer, continents) already loaded on device is sufficient for the growth dimensions (continent/country); nothing is fetched to filter.
