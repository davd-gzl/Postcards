# Feature Specification: Coherent & Efficient Postcards

**Feature Branch**: `015-coherent-efficient`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: a coherence & efficiency redesign so Postcards becomes a fast, offline-first, non-technical "pocket atlas of where you've been" — log a place in a tap, browse/show it to friends, journal like Polarsteps, and publish a shareable website — with strictly no backend, no accounts, and no GAFAM dependencies.

## Product North Star

**A pocket atlas of where you've been — mark a place in a tap, offline; browse and show it off; turn it into a shareable travel blog. No accounts, no GAFAM, no lock-in.** In spirit it is *"Been"* (simple, local, note the cities you've been) **plus** a *Polarsteps*-style journal **plus** one-button publish — and it must stay that simple to feel.

**Primary user**: a non-technical traveller, frequently offline or on a weak/metered connection, using the app on the go (a train, a hotel, a bar) to show a friend "that's where I've been" and tell the story behind it.

**Three core jobs (in priority order)**:
1. **Log fast** — mark a place visited in one tap, offline, on the move.
2. **Browse & show a friend** — pull up "my places / favorites / this trip / near me" in one tap; tap a place anywhere and it appears on the map *and* is selected in the list, with its photo visible.
3. **Journal & publish** — one tap from home to write a story with photos, and one button to publish a self-contained website to send to family.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One clean Online/Offline mode (Priority: P1)

The traveller wants a single, obvious switch between a fully self-contained **Offline** experience and a richer **Online** one — because they are often on a weak or metered connection and must trust that "offline" means *nothing* leaves the device. Today a "Detailed map" control keeps reappearing on the map surface and online settings are scattered, which erodes that trust and clutters the map.

**Why this priority**: It is foundational — every other theme (photos, guides, packs, publishing) depends on a coherent egress model, and it directly removes the recurring annoyance the user cited. Small, high-trust, unblocks the rest.

**Independent Test**: Toggle the top-bar Online/Offline chip; confirm that in Offline mode no optional network request is made anywhere in the app (map tiles, place photos, guides, packs) and that the map surface no longer carries a separate "detailed map" toggle. Confirm every online-related control is reachable from Settings.

**Acceptance Scenarios**:

1. **Given** the app is in Offline mode, **When** the user opens the map, a place, a guide, or Settings, **Then** no optional network request is issued and each surface shows a clear, self-contained state.
2. **Given** the map is open, **When** the user looks at the map controls, **Then** there is no per-map "Detailed map" toggle; the online map is governed only by the global mode.
3. **Given** the user wants to change anything online-related (detailed map, photos, guides, packs, downloads), **When** they open Settings, **Then** all such controls are grouped and easy to find in one place.
4. **Given** the user switches from Online to Offline while viewing online content, **When** the mode flips, **Then** the app immediately stops any optional fetching and falls back to the offline equivalent without error.

---

### User Story 2 - Fast "show-a-friend" navigation (Priority: P2)

In a bar, the traveller wants to open the app and, in one tap, show "my favorite cities" or "this trip" or "monuments near me," then tap a place and have it fly on the map *and* highlight in the list so they can talk through it. Today filtering/sorting can't express what they want, some lists lack search, and tapping a place doesn't reliably link the map and the list.

**Why this priority**: This is the emotional core of the product — the moment of showing someone. It is the most-used browsing path and where the current UX feels least efficient.

**Independent Test**: From a cold open, reach each of Favorites, Wishlist, Monuments-near-me, and a single trip in one tap each; tap a place from any list/search and confirm the map flies to it and the list selects it; confirm every place list has a working search bar and the sort/filter options cover trip, folder, date, favorite, country, and place type.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user taps a single control for "Favorites" (or Wishlist, or Monuments-near-me, or a specific trip), **Then** that view appears immediately, pre-filtered, without further steps.
2. **Given** any place list or search result, **When** the user taps a place, **Then** the map flies to it and the same place becomes the selected/highlighted row in the list.
3. **Given** a place list, **When** the user looks for a search bar, **Then** one is present and filters the list as they type.
4. **Given** a set of visited places, **When** the user sorts or filters, **Then** they can do so by trip, folder, date, favorite, country, and place type, alone or combined.
5. **Given** the user recalls a place they visited long ago, **When** they search for it and mark it visited, **Then** it is added without being forced through a "current trip" flow.

---

### User Story 3 - Journal like Polarsteps (Priority: P3)

Back home (or still travelling), the traveller wants one tap to start writing about a place, attach photos, and later find and re-read entries easily — a lightweight travel blog, not a form-heavy tool.

**Why this priority**: Journaling is the second reason people keep the app (after logging), and it feeds the publish flow. It must feel as effortless as the reference app.

**Independent Test**: From the journal home, start a new entry in one tap; add a title, text, and photos; save; then find that entry via search and via sort/filter (by trip, date, place, folder).

**Acceptance Scenarios**:

1. **Given** the journal is open, **When** the user taps one clearly-primary control, **Then** the composer opens ready to write (no empty form occupying the page before that).
2. **Given** an entry with a place, title, text, and photos, **When** the user saves, **Then** it appears in the feed and is included in exports/publishing.
3. **Given** many entries, **When** the user searches or sorts/filters, **Then** they can find entries by city, trip, folder, and date.
4. **Given** the user is offline, **When** they write and save an entry with photos, **Then** everything is stored locally with no network use.

---

### User Story 4 - Effortless sharing, GitHub demoted (Priority: P4)

The traveller wants to (a) move their data to another device with no account, and (b) send family a real website of their trip — both without touching anything technical or risky. The current GitHub-token path feels complex and unsafe to them.

**Why this priority**: Sharing is a primary reason to journal at all, but it depends on the data and journal themes being solid first. Demoting GitHub removes the biggest source of confusion and perceived risk.

**Independent Test**: Transfer data to a second device via a QR code / one portable file with no login; publish the self-contained website with one button and load it from a zero-login static host; confirm GitHub sync is present but clearly an advanced, optional path — never required.

**Acceptance Scenarios**:

1. **Given** two devices, **When** the user chooses "share/transfer," **Then** they can move their data via a QR code or a single portable file, with no account and nothing secret to leak.
2. **Given** a journal with entries, **When** the user taps "Publish," **Then** they get a self-contained website file (or bundle) they can put on a zero-login static host and share the link with family.
3. **Given** the Settings screen, **When** a non-technical user reads the sharing options, **Then** QR/file transfer and one-button publish are the prominent paths and GitHub sync is clearly labeled as advanced/optional.
4. **Given** the user never configures GitHub, **When** they use the app fully (log, browse, journal, publish, transfer), **Then** nothing is blocked or degraded.

---

### User Story 5 - No-blabla onboarding (Priority: P5)

On first launch, the traveller wants a terse, efficient orientation: what can be downloaded, what to enable, and what to leave off — tuned to whether they'll use it online or offline. No marketing prose.

**Why this priority**: First-run clarity multiplies the value of every other theme, but only makes sense once those themes are coherent.

**Independent Test**: Launch as a first-time user; confirm the intro states, in a scannable, prose-light form, the available downloads and the online/offline choices, and that each choice is actionable on the spot or clearly deferred to Settings.

**Acceptance Scenarios**:

1. **Given** a first launch, **When** the intro appears, **Then** it presents the online/offline choice and the optional downloads concisely (no filler), each with a clear action or skip.
2. **Given** the user picks Offline, **When** the intro adapts, **Then** it hides or de-emphasizes online-only options and emphasizes what makes the app self-contained.
3. **Given** the user finishes or skips onboarding, **When** they later want those choices, **Then** the same controls are found in Settings.

---

### User Story 6 - Speed & mobile polish (Priority: P6, cross-cutting)

Across every screen, the app must feel fast and light on both phone and laptop, even with the full world gazetteer loaded, and the place-detail photo must always be visible on mobile.

**Why this priority**: It is a constraint on every theme rather than a separate feature, but it is called out so it is verified, not assumed.

**Independent Test**: On a mid-range phone and a laptop, measure that primary interactions (open app, switch view, tap a place, open the composer, pan/zoom the map with the full gazetteer) feel immediate; confirm the city-detail photo is visible without scrolling on a small screen.

**Acceptance Scenarios**:

1. **Given** the full gazetteer is loaded, **When** the user pans/zooms the map or switches modes, **Then** interaction stays smooth with no noticeable stall.
2. **Given** a phone screen, **When** the user opens a city's detail, **Then** its photo is visible without scrolling.
3. **Given** any primary navigation (view switch, composer open, place tap), **When** the user performs it, **Then** it responds immediately.

### Edge Cases

- Device goes offline mid-session while in Online mode → the app degrades gracefully to offline equivalents; nothing errors or hangs.
- A place has no photo → detail and list show a clean placeholder, never a broken image.
- Publishing with zero entries but some visited places → the site still renders a coherent map/overview.
- QR transfer of a large library → handled via the portable file when a single QR is impractical; the user is guided, not blocked.
- Full gazetteer not downloaded → search/browse still works over the bundled core set, with a clear, one-tap path to the full set.
- A published website opened offline by the recipient → it is fully self-contained and renders with no network.

## Requirements *(mandatory)*

### Functional Requirements

**Online/Offline mode (P1)**
- **FR-001**: The app MUST provide a single global Online/Offline mode that governs ALL optional network egress (map tiles, place photos, guides, data-pack fetches, and any update checks the user has not explicitly requested).
- **FR-002**: In Offline mode the app MUST make no optional network request from any surface and MUST present a coherent self-contained state everywhere.
- **FR-003**: The map surface MUST NOT carry its own "detailed map" toggle; the online basemap MUST be governed solely by the global mode (plus a Settings control).
- **FR-004**: All online-related controls MUST be grouped and discoverable within Settings.
- **FR-005**: The top-bar chip MUST toggle the global mode and reflect the current mode at a glance.

**Show-a-friend navigation (P2)**
- **FR-006**: Users MUST be able to reach Favorites, Wishlist, Monuments-near-me, and a specific trip each in a single tap from the primary navigation.
- **FR-007**: Tapping a place in any list, search result, journal reference, or friend-facing view MUST fly the map to it AND select/highlight it in the in-view list.
- **FR-008**: Every place list MUST provide a search bar that filters as the user types.
- **FR-009**: Users MUST be able to sort and filter places by trip, folder, date, favorite, country, and place type, individually and in combination.
- **FR-010**: Users MUST be able to mark a place visited without being forced through a current-trip flow (support logging past visits).

**Journal (P3)**
- **FR-011**: The journal page MUST NOT present an always-open empty composer; the composer MUST open on an explicit one-tap action (and reopen a recovered draft).
- **FR-012**: Users MUST be able to attach photos and write a titled story per place, stored locally.
- **FR-013**: Users MUST be able to search journal entries and sort/filter them by city, trip, folder, and date.

**Sharing & publish (P4)**
- **FR-014**: Users MUST be able to transfer their data to another device via a QR code and/or a single portable file, with no account and no secret credential involved.
- **FR-015**: Users MUST be able to publish their journal/trip as a self-contained website with a single action, suitable for a zero-login static host, and share its link.
- **FR-016**: The published website MUST be fully self-contained and render offline for the recipient (no external requests).
- **FR-017**: GitHub sync MUST be an optional, clearly-advanced path; the core product (log, browse, journal, publish, transfer) MUST be fully usable without ever configuring it.
- **FR-018**: The app MUST NOT require any OAuth or backend/proxy for sharing or publishing.

**Onboarding (P5)**
- **FR-019**: First-run onboarding MUST present, in a terse prose-light form, the online/offline choice and the optional downloads, each with a clear action or skip.
- **FR-020**: Onboarding MUST adapt to the chosen mode (de-emphasize online-only options when Offline is chosen) and defer the same choices to Settings.

**Speed & mobile (P6, cross-cutting)**
- **FR-021**: Primary interactions (app open, view switch, place tap, composer open, map pan/zoom with the full gazetteer) MUST respond without a noticeable stall on a mid-range phone and a laptop.
- **FR-022**: On mobile, a place's detail photo MUST be visible without scrolling.

**Cross-cutting constraints**
- **FR-023**: The app MUST remain fully functional offline for all non-optional features.
- **FR-024**: The app MUST NOT introduce any backend, server, account system, or GAFAM/proprietary dependency.
- **FR-025**: Data MUST remain in one portable, human-readable file; imports MUST be validated and sanitized and never executed.
- **FR-026**: The app MUST meet WCAG 2.1 AA and remain keyboard-first; every interactive control carries a title (and an aria-label when icon-only).
- **FR-027**: Reference data MUST remain aggregator-only with recorded provenance; the app invents no world facts.

### Key Entities *(include if feature involves data)*

- **Place**: a location the user relates to (city, monument, airport, custom), with status (visited / wishlist / favorite), optional coordinates and photo, and provenance for any reference-sourced fields.
- **Trip**: a named grouping of visits/steps over a period, used as a first-class filter across map, lists, and journal.
- **Journal entry (Story)**: a dated, titled note about a place with text and photos; the unit of the feed and of the published site.
- **Portable data file**: the single human-readable file that is the source of truth and the transfer/backup unit (also the payload behind QR/file sharing).
- **Published site**: a self-contained website generated from the user's data for sharing; carries no secrets and no external requests.
- **App mode / settings**: the global Online/Offline mode plus the grouped online-related preferences and optional-download states.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In Offline mode, zero optional network requests are observed across all surfaces during a full session (map, place, guide, packs, publish preview).
- **SC-002**: A returning user can go from cold app-open to any of Favorites / a specific trip / Monuments-near-me in a single tap.
- **SC-003**: Tapping a place from a list or search moves the map to it and selects it in the list 100% of the time.
- **SC-004**: A user can start writing a journal entry within one tap of the journal home, and find any past entry by city/trip/date search.
- **SC-005**: A non-technical user can transfer their data to a second device with no account and no secret, and publish a shareable website with a single action, without touching GitHub.
- **SC-006**: A published site loads and renders fully with no network connection for the recipient.
- **SC-007**: On a mid-range phone with the full gazetteer loaded, primary interactions have no perceptible stall, and the city-detail photo is visible without scrolling.
- **SC-008**: First-time users can understand and set their online/offline + download choices from the intro in under 30 seconds, with no prose beyond what is needed to decide.
- **SC-009**: The app remains 100% usable (log, browse, journal, publish, transfer) with GitHub never configured.

## Assumptions

- The existing constitution (no backend, offline-first, privacy-by-default, one portable file, aggregator-only data, WCAG 2.1 AA, web-first PWA + Capacitor) stays authoritative; this feature refines UX and information architecture, it does not relax those rules.
- "Netlify Drop or similar" stands for any zero-login static host; the app does not integrate with a specific provider, it just produces a droppable self-contained site and instructions.
- QR transfer covers small-to-moderate libraries directly; larger libraries fall back to the single portable file, presented as the same "share your data" action.
- The bundled reference set (top cities, countries, airports, heritage, landmarks, moments) plus the optional full city list is sufficient; no new datasets are introduced here.
- "Monuments near me" uses on-device location only, requested on an explicit action, never stored (consistent with the current privacy model).
- Existing features (trips, folders, photo gallery, moments, guides) remain; this feature reorganizes access to them rather than removing them.

## Out of Scope

- Any backend service, server, or account system.
- GitHub OAuth or a hosted token-exchange/proxy of any kind.
- Native-only capabilities beyond the current Capacitor wrap.
- New reference datasets beyond what already ships (community packs remain user-supplied by URL/file).
