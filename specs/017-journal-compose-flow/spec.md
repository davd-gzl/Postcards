# Feature Specification: Journal Compose Flow

**Feature Branch**: `017-journal-compose-flow`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "Journal redesign — a dedicated, focused story-writing flow. Make the composer its own full-screen page (a page layer like the city/country detail screens, with its own Back/Escape returning to where you were). Improve the flow: a clear primary write entry point, a single-purpose page (pick place → date → title → story → photos), clean save/cancel. The Journal bottom-nav button gets a long-press: short tap opens the Journal feed; long-press opens TODAY's new-story composer directly. When the composer opens, automatically attempt device location (opt-in, permission-gated, privacy-preserving — coordinates never leave the device, degrades silently if denied/offline) and surface the places NEAR YOU to pick in one tap. Honor the constitution: local-first, privacy by default, offline, WCAG 2.1 AA and keyboard-first (long-press has an accessible equivalent), i18n parity en/fr/ko."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Write a story on a focused, full-screen page (Priority: P1)

Today the story composer is an inline form stacked underneath the Journal feed, so
writing competes for attention with the list and the page scrolls awkwardly between the
two. A traveller who wants to capture a memory opens a **dedicated composer page** that
fills the screen and does one thing: write this story. They pick the place, set the
date, add a title and the story text, optionally attach photos, and Save. Cancel or
Back/Escape returns them exactly to where they were (the feed, or wherever they launched
it from) with nothing half-saved.

**Why this priority**: This is the core of the redesign and delivers value on its own —
a calmer, faster authoring surface — even without the long-press shortcut or location
suggestions. Everything else builds on this page existing.

**Independent Test**: Open the composer from the Journal, confirm it takes over the
screen as its own page (its own Back/Escape), write and save a story, and confirm it
appears in the feed; separately, open it, enter text, press Back/Escape/Cancel, and
confirm nothing was saved and you returned to the previous screen.

**Acceptance Scenarios**:

1. **Given** the Journal feed, **When** the user taps the primary "write" control, **Then** a full-screen composer page opens over the current screen with an empty draft.
2. **Given** the composer page with a place, date, title, and story filled in, **When** the user taps Save, **Then** the story is stored locally, the page closes, and the new story is visible in the feed.
3. **Given** the composer page with text entered, **When** the user presses Back or Escape (or taps Cancel), **Then** the page closes without saving and the user is returned to the screen they came from.
4. **Given** the composer was opened from a city's page ("write a story about this place"), **When** the user saves or cancels, **Then** they are returned to that city's page, not to the Journal feed.
5. **Given** an in-progress draft with unsaved text, **When** the user attempts to leave via Back/Escape, **Then** the app protects against accidental loss (either preserves the draft to resume, or confirms the discard) rather than silently dropping typed content.

---

### User Story 2 - Start today's story in one gesture (Priority: P2)

A user who journals daily wants the shortest path from "I want to write about today" to a
ready-to-type page. A **short tap** on the Journal bottom-nav button opens the Journal
feed as usual. A **long-press** (press-and-hold) on that same button opens the composer
page directly, pre-set to **today's** date, ready to write — skipping the feed and the
"new story" tap. Because a long-press is not discoverable or operable for every user, an
**accessible, keyboard-operable equivalent** reaches the same "write today" action.

**Why this priority**: A meaningful speed-up for the app's most engaged users, but the
composer page (P1) must exist first, and daily writing still works without the shortcut.

**Independent Test**: Short-tap the Journal nav button and confirm the feed opens;
long-press it and confirm the composer page opens with today's date pre-filled; trigger
the accessible equivalent (keyboard/AT path) and confirm it opens the same "write today"
composer.

**Acceptance Scenarios**:

1. **Given** any screen, **When** the user briefly taps the Journal nav button, **Then** the Journal feed opens (unchanged from today's behavior).
2. **Given** any screen, **When** the user presses and holds the Journal nav button past a short threshold, **Then** the composer page opens with the date set to today and focus ready for writing, and the brief-tap navigation does NOT also fire.
3. **Given** a keyboard or assistive-technology user, **When** they invoke the documented "write today" action (a keyboard shortcut and/or an explicit control), **Then** the same today-composer opens — the long-press is never the only way to reach it.

---

### User Story 3 - Pick where you are from "near you" (Priority: P3)

When the composer opens, the app **automatically attempts** to read the device's current
location and, if available, surfaces a short list of **places near you** so the user can
tap the one they're at instead of searching. Location use is opt-in and permission-gated:
if the user has not granted permission, or denies it, or is offline / the fix fails, the
composer still works normally (manual place search) and shows no error noise. The
coordinates are used only on-device to rank nearby reference places and never leave the
device.

**Why this priority**: A delightful convenience that removes typing in the common
"writing from where I am" case, but entirely optional — the composer is fully usable
without it, so it ships last.

**Independent Test**: Open the composer with location permission granted and a known
position, and confirm nearby places appear and one tap fills the Place field; open it
with permission denied/unavailable and confirm the composer works with no error and no
blocking, falling back to manual search.

**Acceptance Scenarios**:

1. **Given** location permission is granted and a position is available, **When** the composer page opens, **Then** a "near you" list of the closest reference places appears within a couple of seconds, and tapping one sets the Place field.
2. **Given** location permission has not yet been decided, **When** the composer opens, **Then** the app requests it in context (tied to this explicit action) and, whatever the answer, the composer remains fully usable.
3. **Given** permission is denied, or the device is offline, or the location fix fails or times out, **When** the composer opens, **Then** no error is surfaced, no "near you" list blocks the form, and manual place search is available immediately.
4. **Given** a location was obtained, **When** the story is saved, **Then** the raw device coordinates are not stored on the record or transmitted anywhere — they were used only to suggest nearby named places.

---

### Edge Cases

- **Unsaved draft on leave**: Leaving the composer (Back/Escape/Cancel, tab switch, phone Back) with typed content must not silently lose it — preserve a resumable draft or confirm discard.
- **No visited places yet**: A brand-new user with nothing logged can still write (place resolvable via search / "near you"); the place picker never dead-ends.
- **Long-press vs scroll/tap ambiguity**: Press-and-hold on the nav button must not also trigger the normal tap navigation, a normal tap must not trigger the long-press, and a drag/scroll starting on the button cancels the long-press.
- **Location denied earlier**: If the user previously denied location, the composer must not nag on every open; it silently falls back to manual search.
- **Slow location**: A fix that takes too long times out gracefully; the form is never blocked waiting for it.
- **Offline**: With no network, "near you" still works against on-device reference data (no map tiles or remote calls required); everything degrades to manual entry when it can't.
- **Return target**: Whatever screen launched the composer (feed, a city page, the long-press shortcut) is the screen returned to on save/cancel.
- **Editing an existing story**: Opening an existing story to edit uses the same page and returns correctly; auto-location does not overwrite an already-chosen place.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The story composer MUST be presented as its own full-screen page layer (peer to the city/country detail pages), taking over the content area rather than an inline form beneath the feed.
- **FR-002**: The composer page MUST support the full authoring flow in a single, clearly-ordered surface: choose a place, set the date, add a title, write the story text, and optionally attach photos.
- **FR-003**: The composer page MUST offer an explicit Save and an explicit Cancel; Save persists the story locally and returns to the launching screen; Cancel discards and returns.
- **FR-004**: Back and Escape MUST close the composer page and return to the screen it was opened from (the feed, a city page, etc.), consistent with the app's existing page-layer Back/Escape behavior, without leaving the user deeper than where they started.
- **FR-005**: The Journal MUST expose a clear primary "write a story" entry point that opens the composer page.
- **FR-006**: Leaving the composer with unsaved, non-empty content MUST NOT silently discard it — the app MUST either preserve a resumable draft or require an explicit discard confirmation.
- **FR-007**: A short tap on the Journal bottom-nav button MUST open the Journal feed (unchanged), and a long-press (press-and-hold beyond a short threshold) on that same button MUST open the composer page pre-set to today's date.
- **FR-008**: The long-press MUST NOT also trigger the normal tap navigation, and a normal tap MUST NOT trigger the composer; a scroll/drag beginning on the button cancels the long-press.
- **FR-009**: There MUST be an accessible, keyboard-operable equivalent for "start today's story" so the long-press is never the only path to it (e.g., a keyboard shortcut and/or a visible control).
- **FR-010**: When the composer page opens for a NEW story, the app MUST attempt to obtain the device's current location to suggest nearby places, subject to the user's permission.
- **FR-011**: Location access MUST be opt-in and permission-gated, requested in the context of this explicit action; the app MUST NOT block the composer waiting for a location result and MUST time out gracefully.
- **FR-012**: If location permission is absent/denied, the device is offline, or the fix fails/times out, the composer MUST remain fully usable with manual place search and MUST NOT surface an error or a blocking state.
- **FR-013**: Device coordinates MUST be used only on-device to rank nearby reference places; they MUST NOT be written onto the saved story record and MUST NOT be transmitted off the device.
- **FR-014**: "Near you" suggestions and manual place search MUST work offline against on-device reference data (no network required).
- **FR-015**: Selecting a "near you" suggestion MUST fill the Place field in one tap; the user MUST still be able to override it via search.
- **FR-016**: The feature MUST NOT introduce telemetry or any egress of user content or location; all new behavior MUST work with zero network connectivity.
- **FR-017**: All new user-visible strings MUST exist in every supported locale (en, fr, ko) with compile-time key parity, and all interactive elements MUST meet WCAG 2.1 AA (labels, focus order, target size, keyboard operability).
- **FR-018**: Editing an existing story MUST reuse the composer page and return to the launching screen on save/cancel; auto-location MUST NOT overwrite a place already set on an existing story.

### Key Entities *(include if feature involves data)*

- **Story (existing)**: A journal entry the user authored — its place reference, date, title, story text, optional photos, and folder. This feature changes how a Story is *composed and edited*, not its stored shape; no new persisted fields (notably, no stored coordinates).
- **Composer session (transient)**: The in-progress draft while the composer page is open — the chosen place, date, title, text, and attached photos — plus its "return target" (the screen to go back to). Not persisted as reference or shared data; at most a locally-cached resumable draft.
- **Nearby suggestion (transient, derived)**: A short, ranked list of reference places closest to the current device position, computed on-device from existing reference data and the (non-persisted) coordinates. Purely ephemeral input to the place picker.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the Journal feed, a user can open the composer, write a place + title + story, and save in under 30 seconds, with the composer occupying the full screen the entire time.
- **SC-002**: 100% of composer exits via Back, Escape, or Cancel return the user to the exact screen they launched from, with no story saved and no orphaned inline form left behind.
- **SC-003**: A long-press on the Journal nav button opens today's composer in a single gesture (no intermediate feed or "new story" tap), while a short tap still opens the feed — two distinct, reliable outcomes from the same control.
- **SC-004**: Every "write today" path is reachable without a pointer (keyboard/AT), verified by completing the flow using only the keyboard.
- **SC-005**: With location available, a relevant "near you" place can be selected in one tap within 2 seconds of opening the composer; with location denied/offline, the composer is fully usable with zero errors shown and no added wait.
- **SC-006**: No unsaved draft with typed content is ever lost without an explicit user choice (confirmed discard or auto-preserved draft), across Back, Escape, Cancel, and tab-switch.
- **SC-007**: With the network fully disabled, the entire flow (open, write, near-you suggestions, save) works, and a network monitor records zero outbound requests attributable to this feature.
- **SC-008**: The composer page passes automated accessibility checks (WCAG 2.1 AA), and the build fails if any en/fr/ko translation key is missing.

## Assumptions

- The composer reuses the app's existing page-layer navigation model (the same mechanism the city/country detail pages use for open/close and Back/Escape), so "return to where you were" follows established behavior.
- "Near you" ranks places from the existing on-device reference gazetteer/POI data already shipped with the app; no new reference dataset is introduced (Constitution I).
- Device location is obtained via the platform's standard permission-gated geolocation; the app already treats geolocation as device-local and never transmits it.
- Photo attachment, sanitization, story storage, and feed rendering already exist and are reused unchanged; this feature is about the *authoring surface and entry points*, not the data model.
- "Today" means the user's local calendar date at the moment the shortcut is used.
- A long-press threshold in the typical mobile range (~half a second) distinguishes hold from tap; the exact value is an implementation detail tuned for feel.
- Supported locales are en/fr/ko, matching the rest of the app; desktop keyboard users are first-class, and the long-press shortcut is an enhancement, not the sole path.
