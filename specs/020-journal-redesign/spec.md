# Feature Specification: Journal Redesign — minimal, focused entry authoring

**Feature Branch**: `020-journal-redesign`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Journal redesign — make writing a journal entry as simple as 'put a date and fill it in', no blabla. An entry is just a DATE plus free CONTENT (text and/or photos); place becomes OPTIONAL. Move the composer into its own focused full-screen page (superseding the never-implemented draft spec 017). A clear primary write entry point; keep the hidden long-press only as an optional accelerator. Everything except date + content is an optional extra, tucked away: place (still chosen from places you've been, or left blank), folder, photo captions. Auto-attempt location on open to suggest a place. Honor the constitution: local-first, no telemetry, inert data, aggregator-not-author, WCAG 2.1 AA keyboard-first, i18n en/fr/ko. Requires a schema-version bump making Story.place optional; existing stories keep their place. Out of scope: the read side (Feed / By place / Timeline / Map / Calendar) and Publish mode."

## User Scenarios & Testing *(mandatory)*

This redesign supersedes the never-implemented draft **spec 017 (Journal Compose Flow)** and folds its focused-page, one-gesture, and "near you" ideas into a single delivered redesign — while adding the change that actually removes the friction: **an entry no longer requires a place.**

### User Story 1 - Write an entry with just a date and content (Priority: P1)

Today a person cannot write a journal entry without first choosing a place they have
already visited — the Place field is required and its options come only from logged
visits, so a brand-new user, or anyone who just wants to jot "today was a good day,"
hits a dead end. In the redesign, **the only things an entry needs are a date and some
content** — free text, one or more photos, or both. The date defaults to today. The
person types (or adds a photo) and saves. **Place is optional**: they may attach one of
the places they've been, or leave it blank. Nothing else is required.

**Why this priority**: This is the heart of the redesign and the single biggest
friction removed. It delivers value on its own — a journal you can actually write in
freely — even before the page-layer, the one-gesture shortcut, or location suggestions.
Everything else refines *how* this entry is authored.

**Independent Test**: With no visited places logged at all, open the composer, type some
text (no place chosen), and save; confirm the entry is stored and appears in the feed
with its date and no place. Separately, add only a photo (no text, no place) and confirm
it saves; and confirm an entry with neither text nor a photo cannot be saved.

**Acceptance Scenarios**:

1. **Given** a user with no visited places, **When** they open the composer, type a note, and Save, **Then** the entry is stored locally and appears in the feed, dated, with no place attached.
2. **Given** the composer with the date pre-set to today, **When** the user adds only a photo (no text, no place) and Saves, **Then** the entry is stored and shown.
3. **Given** the composer with an empty note and no photos and no place, **When** the user tries to Save, **Then** Save is unavailable and the reason (needs some content) is clear — an entry must carry text and/or at least one photo.
4. **Given** the composer, **When** the user optionally attaches one of the places they've been, **Then** the entry records that place; leaving it blank records no place.
5. **Given** a blank place, **When** the entry is saved, **Then** no new reference place is created or invented anywhere (a place-less entry is simply place-less).

---

### User Story 2 - A focused, full-screen page that shows only date + content by default (Priority: P2)

The composer is a form stacked at the bottom of the feed, surfacing six inputs at once
(place, date, "near me", title, story, folder, photos), so writing competes with the
list and reads as a wall of fields. In the redesign the composer is **its own
full-screen page** (a peer of the city/country detail pages, with its own Back/Escape
and a return target). By default it shows only what matters: **the date and a place to
write.** Everything optional — attaching a place, a folder, a title, per-photo captions
— is **tucked away** behind a clearly-labelled "add details" affordance, present but not
in the way. Cancel or Back/Escape returns exactly to where the user came from with
nothing half-saved, and an in-progress draft is never silently lost.

**Why this priority**: A calmer, faster authoring surface that makes the P1 minimal
entry feel effortless. It depends only on P1's simpler model and delivers a clear
standalone improvement over the inline form.

**Independent Test**: Open the composer from the Journal; confirm it takes over the
screen as its own page (its own Back/Escape) and shows date + a content field with the
optional fields collapsed; write and save; confirm it appears in the feed. Separately,
enter text, press Back/Escape/Cancel, and confirm nothing was saved and you returned to
the previous screen with the draft preserved for next time.

**Acceptance Scenarios**:

1. **Given** the Journal, **When** the user taps the primary "write" control, **Then** a full-screen composer page opens over the current screen showing, by default, the date and a place to write — with place, folder, title, and captions collapsed under an "add details" affordance.
2. **Given** the composer page with content entered, **When** the user taps Save, **Then** the entry is stored locally, the page closes, and the new entry is visible in the feed.
3. **Given** the composer opened from a city's page ("write about this place"), **When** the user saves or cancels, **Then** they return to that city's page (not the feed), and the place is pre-attached.
4. **Given** the composer page with text entered, **When** the user presses Back or Escape (or taps Cancel), **Then** the page closes without saving, returns to the launching screen, and the typed content is preserved as a resumable draft rather than dropped.
5. **Given** the "add details" section is collapsed, **When** the user expands it, **Then** they can attach a place (from places they've been, or leave blank), set a folder, add a title, and caption photos — all optional.

---

### User Story 3 - Start today's entry in one gesture (Priority: P3)

Someone who journals daily wants the shortest path from "I want to write about today" to
a ready-to-type page. A **short tap** on the Journal bottom-nav button opens the Journal
feed as usual; a **long-press** on that same button opens the composer page directly,
pre-set to today's date. Because a long-press is neither discoverable nor operable for
everyone, an **accessible, keyboard-operable equivalent** reaches the same "write today"
action, and the visible primary "write" control (US2) remains the discoverable path.

**Why this priority**: A meaningful speed-up for the most engaged users, but the page
(P2) must exist first and daily writing works without it, so it ships after.

**Independent Test**: Short-tap the Journal nav button and confirm the feed opens;
long-press it and confirm the composer opens with today's date pre-filled; trigger the
accessible equivalent (keyboard/AT) and confirm it opens the same "write today" composer.

**Acceptance Scenarios**:

1. **Given** any screen, **When** the user briefly taps the Journal nav button, **Then** the Journal feed opens (unchanged).
2. **Given** any screen, **When** the user presses and holds the Journal nav button past a short threshold, **Then** the composer opens with the date set to today and focus ready for writing, and the brief-tap navigation does NOT also fire.
3. **Given** a keyboard or assistive-technology user, **When** they invoke the documented "write today" action, **Then** the same today-composer opens — the long-press is never the only way to reach it.

---

### User Story 4 - Suggest where you are, without asking for it (Priority: P4)

Attaching a place is optional, but when someone *does* want it, they shouldn't have to
search. When the composer opens, the app **automatically attempts** to read the device's
current location and, if available, surfaces a short list of **places near you** to
attach in one tap. Location use is opt-in and permission-gated: if permission is absent,
denied, offline, or the fix fails, the composer works normally (place stays optional,
manual search available) with no error noise. Coordinates are used only on-device to rank
nearby reference places and never touch the saved entry or leave the device.

**Why this priority**: A convenience that removes typing in the "writing from where I am"
case, but entirely optional — place itself is optional now — so it ships last.

**Independent Test**: Open the composer with location granted and a known position;
confirm nearby places appear and one tap attaches a place. Open it with permission
denied/unavailable; confirm the composer works with no error, place stays blank/optional,
and manual search is available.

**Acceptance Scenarios**:

1. **Given** location permission is granted and a position is available, **When** the composer opens, **Then** a "near you" list of the closest reference places appears within a couple of seconds, and tapping one attaches that place.
2. **Given** permission is undecided, **When** the composer opens, **Then** the app requests it in context (tied to this explicit action) and, whatever the answer, the composer remains fully usable with place optional.
3. **Given** permission is denied, the device is offline, or the fix fails/times out, **When** the composer opens, **Then** no error is surfaced, no list blocks the form, and manual place search is available immediately.
4. **Given** a location was obtained, **When** the entry is saved, **Then** the raw coordinates are not stored on the entry and are not transmitted — they only suggested nearby named places.

---

### Edge Cases

- **Place-less entries in the read side (out-of-scope views must not break)**: The read side (Feed / By place / Timeline / Map / Calendar) is unchanged by this spec, but entries with no place must degrade gracefully there — the Feed shows them dated with no place link; place-grouped and map views (which key on place) group them under a clear "No place" bucket or omit them from the map rather than crashing or inventing a place.
- **Empty entry**: An entry with no text AND no photos cannot be saved, regardless of whether a place is attached — content is what an entry is.
- **Unsaved draft on leave**: Leaving the composer (Back/Escape/Cancel, tab switch, phone Back) with typed content must not silently lose it — the draft is auto-preserved and restored on reopen, with no discard prompt.
- **No visited places yet**: A brand-new user can write immediately; the optional place picker never dead-ends (it simply offers nothing to attach, plus "near you"/search if used).
- **Long-press vs scroll/tap ambiguity**: Press-and-hold on the nav button must not also trigger tap navigation; a normal tap must not trigger the composer; a drag/scroll starting on the button cancels the long-press.
- **Location denied earlier**: If the user previously denied location, the composer must not nag on every open; it silently falls back to optional/manual place.
- **Slow or offline location**: A slow fix times out gracefully and never blocks the form; "near you" works offline against on-device reference data or is simply absent.
- **Editing an existing story**: Editing reuses the same page and returns correctly; auto-location does not overwrite an already-attached place; an existing story that already has a place keeps it.
- **Existing data migration**: Every story authored before this change keeps its (previously required) place unchanged; the model change only makes place *optional going forward*, never strips or alters stored places.

## Requirements *(mandatory)*

### Functional Requirements

#### Minimal entry (place optional)

- **FR-001**: A journal entry MUST be saveable with only a date and content (text and/or at least one photo); no other field may be required.
- **FR-002**: Place MUST be optional on a journal entry — a person can save an entry with no place attached.
- **FR-003**: When a place is attached, it MUST be one of the places the user has been (the existing constraint); the composer MUST NOT let the user mint a new reference place, and a blank place MUST create nothing (aggregator-not-author).
- **FR-004**: An entry MUST still require content: saving MUST be prevented when there is neither text nor any photo, and the reason MUST be conveyed clearly.
- **FR-005**: The date MUST default to today and remain editable; it is the one always-present required field besides content.
- **FR-006**: Existing stories that already carry a place MUST be preserved unchanged by this change; making place optional MUST NOT remove, alter, or require re-entry of any stored place.

#### Focused composer page

- **FR-007**: The composer MUST be presented as its own full-screen page layer (peer to the city/country detail pages), taking over the content area rather than an inline form beneath the feed.
- **FR-008**: By default the composer page MUST surface only the date and a content field; all optional inputs (attach a place, folder, title, per-photo captions) MUST be tucked away behind a clearly-labelled, keyboard-reachable "add details" affordance while remaining available.
- **FR-009**: The composer page MUST offer an explicit Save and an explicit Cancel; Save persists the entry locally and returns to the launching screen; Cancel returns without saving.
- **FR-010**: Back and Escape MUST close the composer page and return to the screen it was opened from (feed, a city page, the long-press shortcut), consistent with the app's existing page-layer behavior.
- **FR-011**: The Journal MUST expose a clear, discoverable primary "write" entry point that opens the composer page.
- **FR-012**: Leaving the composer with unsaved, non-empty content MUST auto-preserve it as a resumable local draft and restore it when the composer next opens for the same context; no discard-confirmation modal is shown. The cached draft is transient on-device state only — never written as reference/shared data, never transmitted — and is cleared once the entry is saved or the draft is explicitly discarded.
- **FR-013**: Editing an existing entry MUST reuse the composer page and return to the launching screen on save/cancel.

#### One-gesture "write today"

- **FR-014**: A short tap on the Journal bottom-nav button MUST open the Journal feed (unchanged), and a long-press on that same button MUST open the composer page pre-set to today's date.
- **FR-015**: The long-press MUST NOT also trigger the normal tap navigation, a normal tap MUST NOT open the composer, and a scroll/drag beginning on the button cancels the long-press.
- **FR-016**: There MUST be an accessible, keyboard-operable equivalent for "start today's entry" so the long-press is never the only path to it.

#### "Near you" place suggestion

- **FR-017**: When the composer opens for a NEW entry, the app MUST automatically attempt to obtain the device's current location to *suggest* nearby places to attach — on open, with no separate "find nearby" tap — subject to permission (fetch silently if already granted; request in context if undecided).
- **FR-018**: Location access MUST be opt-in and permission-gated; the app MUST NOT block the composer waiting for a result and MUST time out gracefully.
- **FR-019**: If location permission is absent/denied, the device is offline, or the fix fails/times out, the composer MUST remain fully usable (place optional, manual search available) and MUST NOT surface an error or blocking state.
- **FR-020**: Device coordinates MUST be used only on-device to rank nearby reference places; they MUST NOT be written onto the saved entry and MUST NOT be transmitted off the device.
- **FR-021**: "Near you" suggestions and manual place search MUST work offline against on-device reference data; auto-location MUST NOT overwrite a place already attached to the entry being edited.

#### Cross-cutting (constitution)

- **FR-022**: The feature MUST NOT introduce telemetry or any egress of user content or location; all new behavior MUST work with zero network connectivity.
- **FR-023**: Imported/restored entries with an optional/absent place MUST be validated and remain inert (no execution, no reference-data creation); the portable file format and its documented, versioned schema MUST be updated so a place-optional entry round-trips through export/import.
- **FR-024**: All new user-visible strings MUST exist in every supported locale (en, fr, ko) with compile-time key parity, and all interactive elements MUST meet WCAG 2.1 AA (labels, focus order, target size, keyboard operability).

### Key Entities *(include if feature involves data)*

- **Story (changed)**: A journal entry the user authored. Its date remains required and it must still carry content (text and/or ≥1 photo). **Its place reference becomes optional** (previously required). Title, story text, folder, and photo captions remain optional as today. This is the one persisted-shape change; it requires a portable-file schema-version bump, with existing entries retaining their place. No coordinates are ever stored on a Story.
- **Composer session (transient)**: The in-progress draft while the composer page is open — date, content (text/photos), the optionally-attached place, folder, title, captions — plus its "return target" (the screen to go back to). Not persisted as reference/shared data; at most a locally-cached resumable draft, cleared on save/discard.
- **Nearby suggestion (transient, derived)**: A short, ranked list of reference places closest to the current device position, computed on-device from existing reference data and the non-persisted coordinates. Ephemeral input to the optional place picker only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A brand-new user with zero visited places can write and save their first journal entry (a dated note) in under 30 seconds, without attaching any place.
- **SC-002**: An entry can be saved with any one of: text only, photo only, or text + photo — and cannot be saved with neither — independent of whether a place is attached.
- **SC-003**: 100% of journal entries authored before the change keep their original place after the change (no data loss or alteration), verified by export/import round-trip.
- **SC-004**: On opening the composer, only the date and a content field are visible by default; attaching a place, folder, title, or caption each takes exactly one action to reveal.
- **SC-005**: 100% of composer exits via Back, Escape, or Cancel return the user to the exact screen they launched from, with no entry saved and the typed draft preserved for reopen.
- **SC-006**: A long-press on the Journal nav button opens today's composer in a single gesture while a short tap still opens the feed — two distinct, reliable outcomes; and the same "write today" is reachable using only the keyboard.
- **SC-007**: With location available, a relevant "near you" place can be attached in one tap within 2 seconds of opening the composer; with location denied/offline, the composer is fully usable with zero errors and no added wait, and place stays optional.
- **SC-008**: With the network fully disabled, the entire flow (open, write, near-you suggestions, save, export, re-import) works, and a network monitor records zero outbound requests attributable to this feature.
- **SC-009**: The composer page passes automated accessibility checks (WCAG 2.1 AA), and the build fails if any en/fr/ko translation key is missing.

## Assumptions

- The composer reuses the app's existing page-layer navigation model (the same open/close + Back/Escape mechanism the city/country detail pages use), so "return to where you were" follows established behavior. This is the page layer draft spec 017 proposed but never shipped; spec 020 delivers it.
- The read side (Feed / By place / Timeline / Map / Calendar), search, filters, Markdown export, and Publish mode are **out of scope** and remain as they are, except for the minimal, non-breaking accommodation that place-less entries need a graceful home in place-keyed views (see Edge Cases).
- "Near you" ranks places from the existing on-device reference gazetteer already shipped with the app; no new reference dataset is introduced (Constitution: aggregator, never an author).
- Photo capture/downscale/sanitization, story storage in the portable file, and feed rendering already exist and are reused; the only stored-shape change is making place optional.
- "Today" means the user's local calendar date at the moment of writing.
- A long-press threshold in the typical mobile range (~half a second) distinguishes hold from tap; the exact value is tuned for feel.
- Supported locales are en/fr/ko; desktop keyboard users are first-class, and the long-press is an enhancement, never the sole path.
- Making `Story.place` optional is a backward-compatible schema evolution: older files (place always present) still validate; new files may omit it. The schema version is bumped and the change documented.
