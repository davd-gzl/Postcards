# Feature Specification: Journal (travel blog)

**Feature Directory**: `specs/007-journal`

**Created**: 2026-07-14

**Status**: Retro-specified — describes shipped behavior

**Input**: Maintainer description: "A mini travel blog inside Postcards. Let me write dated,
titled stories about places I've been, each with its own little photo gallery. Greet me ready to
write — the composer open, today's date filled in. Never lose my writing if I leave the page.
Near midnight, ask which day the story is really about. Let me pick a place from where I am right
now, but only when I ask and without ever storing my location. Give me a feed I can filter by
place and year, and let me export the whole thing as a readable Markdown file to share. Personal
data only, on-device, private, inert — same portable file as everything else."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Write a dated story about a place you've been (Priority: P1)

The user opens the Journal and is immediately ready to write: the composer is already open with
today's date filled in. They pick a place from their own visited list, give the day a title, tell
the story in free text, and optionally attach a few photos with captions. The entry is saved on the
device with no account and no network. Near a day boundary the app first asks which day the story is
about, and the user can let the app suggest a nearby place from where they are right now.

**Why this priority**: Writing a story is the entire point of the feature. Everything else (feed,
filters, export) only has meaning once stories exist. It is the smallest slice that already delivers
value — a dated, illustrated personal record of a place.

**Independent Test**: Open the Journal offline, pick a visited place, type a title and a few
sentences, add a photo, and save. Confirm the story appears in the feed and survives closing and
reopening the app.

**Acceptance Scenarios**:

1. **Given** the Journal opens, **When** the user looks at the screen, **Then** the composer is
   already open with the date defaulted to today and no button press is needed to start writing.
2. **Given** the composer is open, **When** the user opens the Place picker, **Then** it lists only
   places the user has marked visited, sorted by name, and offers no way to invent a new place.
3. **Given** a place, a date, and a non-empty title, **When** the user saves, **Then** the story is
   recorded, appears in the feed, and an undo is offered.
4. **Given** the user attaches photos, **When** they save, **Then** each photo is stored inline with
   its optional caption, up to the per-story cap.
5. **Given** it is late evening or the small hours, **When** the user taps "Today's story", **Then**
   the app first asks which of the two candidate days the story is for before opening the entry.
6. **Given** the user taps "Near me" and grants location, **When** suggestions appear and one is
   chosen, **Then** it only fills the Place field and nothing is marked visited.

---

### User Story 2 - Never lose the writing (Priority: P1)

The user is part-way through a story when they switch tabs, background the app, or the device
reclaims the page. When they come back to the Journal, the in-progress place, date, title, and text
are still there, exactly as left. Writing is never silently discarded by leaving.

**Why this priority**: A journal the user cannot trust to keep their words is worse than useless —
one lost paragraph teaches them never to write a long entry again. Crash-safety is a first-class
promise of the feature, on par with saving itself.

**Independent Test**: Type a title and several sentences without saving, switch away from the
Journal (tab change or background), return, and confirm the writing is intact.

**Acceptance Scenarios**:

1. **Given** the composer has content, **When** the user leaves the Journal without saving, **Then**
   the place, date, title, and text are cached locally and restored on the next visit.
2. **Given** a restored draft that was editing an existing story, **When** it comes back, **Then**
   the story's photos are rehydrated from storage so saving does not wipe the gallery.
3. **Given** a saved story, **When** the save completes, **Then** the draft cache is cleared so it
   does not reopen stale writing later.
4. **Given** a blank composer, **When** the user opens "New story", **Then** nothing is cached and a
   previously kept draft is not clobbered.

---

### User Story 3 - Browse, filter, edit, and remove stories (Priority: P2)

The user reads back their journal as a newest-first feed, narrows it by destination (country or a
specific place) and by year, opens a story's photos in a lightbox, jumps from a story to that
place's page, and edits or removes any entry — with an undo for mistakes.

**Why this priority**: Reading and curating the journal is the payoff of having written it, but it
depends on Story 1 producing entries first, so it layers on top of the capture core.

**Independent Test**: With several stories across different places and years, filter the feed by one
country and by one year, confirm only matching stories show, then edit one story and remove another
and undo the removal.

**Acceptance Scenarios**:

1. **Given** multiple stories, **When** the user opens the feed, **Then** stories are ordered
   newest story-date first and shown a page at a time with a "show more" control.
2. **Given** more than one story, **When** the user filters by a country, place, or year, **Then**
   only matching stories are shown and the page count resets.
3. **Given** a story about a city-type place, **When** the user activates its place name, **Then**
   the app opens that place's page.
4. **Given** a story, **When** the user edits it and saves, or removes it, **Then** the change takes
   effect and an undo restoring the prior state is offered.
5. **Given** a story with photos, **When** the user opens a thumbnail, **Then** a read-only lightbox
   opens where arrows page and Escape closes, returning focus to the thumbnail.

---

### User Story 4 - Export the journal as shareable Markdown (Priority: P2)

The user exports the whole journal to a single readable Markdown file they can send to a friend or
keep as a plain-text record. It carries each story's date, place, title, and text — no photos — and
is safe to share: nothing in it renders as HTML, code, or a tracking link.

**Why this priority**: Sharing a readable trip log is a real want, but it is secondary to writing
and reading, and the canonical backup already lives in the portable data file.

**Independent Test**: With several stories, export the journal and open the resulting `journal.md`
in a text editor; confirm every story's date, place, title, and text appear and that no photo data
or active markup is present.

**Acceptance Scenarios**:

1. **Given** at least one story, **When** the user exports the journal, **Then** a single Markdown
   file (`journal.md`) with all stories' dates, places, titles, and text is produced.
2. **Given** the export, **When** it is opened, **Then** it contains no photos and is clearly marked
   as a non-authoritative export.
3. **Given** a story whose title or text contains angle brackets, backticks, or link/image syntax,
   **When** it is exported, **Then** those characters are neutralized so the shared file stays inert.
4. **Given** no stories exist, **When** the user looks at the toolbar, **Then** the export action is
   not offered.

---

### Edge Cases

- A title that is only formula-prefix or control characters (e.g. `===`) sanitizes to empty → the
  Save control stays disabled; such a title can never be stored.
- Local storage is unavailable (private mode throws) → the draft simply is not crash-cached; no
  error is shown and the composer stays fully usable.
- A cached draft was editing a story that has since been deleted → the writing is kept as a new
  story rather than lost (the edit target is dropped).
- Location is denied, unavailable, or the device has no geolocation → a status message is shown, no
  suggestions appear, and the user can still pick a place from their visited list.
- A sparse area returns no cities in the initial search box → the box widens once before the app
  reports that none are nearby.
- A place tagged on a story is later un-visited → it is kept as a selectable option so the picker
  never shows a phantom value, though it no longer appears fresh in the visited list.
- A story has no body text → the feed shows just the date, place, title, and any photos, and the
  Markdown export omits the empty body.
- A story's country is unknown/placeholder → it is excluded from the by-country filter.
- Near a midnight boundary the "current day" is ambiguous → the app offers both candidate days; if
  writing is already in progress, choosing a day only sets the date and keeps the text.
- Attempting to add photos beyond the per-story cap → the extra photos are refused and the user is
  told the story is full.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Journal MUST let the user create a story that is a dated (required), titled
  (required), place-tagged entry about a place they've been, with optional free text and an optional
  photo gallery. A story is personal data only — the app MUST NOT author or invent world facts in it.
- **FR-002**: The place a story is tagged with MUST be chosen from the user's own visited places
  (status "visited"), listed sorted by name; the Journal MUST NOT let the user mint a new reference
  place. A prefilled or edited place no longer in the visited list MUST remain selectable so the
  picker never shows a phantom value.
- **FR-003**: The composer MUST be open by default when the Journal opens (ready to write with no
  prior button press) and MUST default the story date to the current local day.
- **FR-004**: The story title MUST be required and bounded to 200 characters; the story text MUST be
  optional and bounded to 8000 characters. Both MUST be sanitized to inert text before storage, and
  a title that sanitizes to empty MUST be rejected (Save disabled).
- **FR-005**: A story MUST accept up to 24 photos, each downscaled on capture and stored as an
  inline image data URL with an optional caption bounded to 300 characters; the system MUST prevent
  adding beyond the cap and inform the user when the story is full.
- **FR-006**: "Today's story" MUST take the user straight into today's entry, and near a day
  boundary (21:00 or later, or before 05:00 local time) MUST first ask which of the two candidate
  days the story is for. If writing is already in progress, choosing the day MUST only set the date
  and keep the writing.
- **FR-007**: The composer MUST offer opt-in "Near me" suggestions: only on an explicit tap may it
  request the device position, and it MUST use that position once to rank the nearest gazetteer
  cities (up to 8) and MUST NOT store it. Picking a suggestion MUST only fill the Place field and
  MUST NOT mark anything visited.
- **FR-008**: While the composer holds content, its text fields (place, date, title, text) MUST be
  mirrored to a local draft cache so leaving the page mid-writing does not lose the writing, and the
  draft MUST be restored on the next visit.
- **FR-009**: The draft cache MUST exclude photos; when a restored draft was editing an existing
  story, that story's photos MUST be rehydrated from storage so saving cannot silently wipe the
  gallery.
- **FR-010**: The draft write MUST be debounced and MUST be flushed when the app is backgrounded or
  closed or the screen unmounts, so a mid-burst exit still keeps the last keystrokes. A blank
  composer MUST NOT be cached, and a successful save MUST clear the draft.
- **FR-011**: The feed MUST list stories newest story-date first (ties broken by most recently
  added), paginated 20 at a time with a control to show more.
- **FR-012**: When more than one story exists, the feed MUST offer filters by destination (country
  or a specific place) and by year (including a "no date" bucket), and changing a filter MUST reset
  pagination.
- **FR-013**: A story whose place is a city-page kind (city, heritage, or custom) MUST link its
  place name to that place's page; other kinds MUST render the place name as plain text.
- **FR-014**: The user MUST be able to edit and remove any story, and adding, editing, and removing
  MUST each offer an undo that restores the prior state.
- **FR-015**: The user MUST be able to export the whole journal as a single human-readable Markdown
  file (`journal.md`) containing each story's date, place, title, and text but no photos; the export
  MUST be offered only when at least one story exists.
- **FR-016**: The Markdown export MUST neutralize free-text content so a shared file stays inert —
  angle brackets, backticks, and link/image bracket syntax MUST be escaped so story content cannot
  form raw HTML, a code span, or a link/image. The export is non-authoritative and not re-importable.
- **FR-017**: Stories MUST be stored entirely on-device and carried in the same single portable data
  file as the rest of the user's data (schema version 5, an additive optional `stories` array), so
  backup and restore include the journal with no loss.
- **FR-018**: Story data MUST leave the device only through an explicit user-initiated export or
  share; the Journal MUST make no network request of its own. The sole location access is the opt-in
  one-shot geolocation of FR-007, whose result is used once and never stored.
- **FR-019**: The composer and the photo lightbox MUST be keyboard operable and accessible (WCAG 2.1
  AA): Escape closes the composer only when there is content to close, arrows page the lightbox,
  focus moves into a dialog on open and returns to the triggering control on close, and controls
  carry meaningful labels.
- **FR-020**: On save, the story's title and text MUST be stored in the same sanitized form the
  portable-file schema enforces, so a saved story round-trips through export and import unchanged.

### Key Entities *(include if feature involves data)*

- **Story**: A user-authored journal entry. Attributes: stable id, a place reference, a required day
  (`YYYY-MM-DD`), a required sanitized title (≤ 200 chars, non-empty after sanitization), optional
  sanitized text (≤ 8000 chars), an optional photo gallery, and an added-at timestamp. Personal data
  only.
- **Story Place Reference**: The place a story is about (kind, id, name, country, and coordinates
  for custom points). Chosen from the user's visited places — never invented within the Journal.
- **Photo**: One gallery image: an inline image data URL (bounded size) plus an optional short
  caption (≤ 300 chars). Inert and on-device; only ever rendered, never executed.
- **Composer Draft**: A transient local cache of the in-progress text fields (place, date, title,
  text — never photos) held under a fixed local-storage key, used purely for crash recovery.
- **Nearby Suggestion**: A ranked nearest-city candidate derived once from a just-requested device
  position; ephemeral, never persisted, and only ever used to fill the Place field.
- **Journal File Section**: The optional `stories` array within the single portable data file
  (schema version 5), the unit of backup, restore, and cross-device transfer for the journal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open the Journal and immediately begin typing a titled story about a
  visited place with no button press first, with the date already set to today.
- **SC-002**: Leaving the Journal mid-writing (tab switch, background, or close) and returning
  restores the in-progress place, date, title, and text in 100% of cases where the composer held
  content.
- **SC-003**: A story can hold up to 24 photos; any attempt to add more is prevented and the user is
  told the story is full.
- **SC-004**: Exporting and then re-importing the portable data file restores every story — date,
  place, title, text, and photos — identically (full data equivalence).
- **SC-005**: The "Near me" position is requested only on the explicit tap, used once to rank
  suggestions, and never persisted (zero stored-location writes, verifiable by inspection).
- **SC-006**: The Markdown export contains no photo data and no story content that renders as HTML,
  a code span, or a link/image (100% of story titles and text escaped).
- **SC-007**: The feed shows stories newest-first and pages 20 at a time; filtering by a country,
  place, or year narrows the feed to exactly the matching stories.
- **SC-008**: Every composer and lightbox action is reachable by keyboard alone with visible focus,
  and focus returns to the triggering control when a dialog closes.
- **SC-009**: A title that is empty after sanitization (e.g. "===") cannot be saved — the Save
  control stays disabled.

## Assumptions

- The composer's default story date and the "boundary day" candidates are computed from the device's
  local clock; "today" means the local calendar day.
- The draft cache lives in the browser's local storage under a single fixed key and holds only the
  text fields; photos are deliberately excluded because inline image data URLs would exhaust the
  local-storage quota, and an edit's photos are rehydrated from the store instead.
- "Near me" relies on the platform geolocation permission; suggestions are drawn from the bundled
  openly-licensed city gazetteer, ranked by great-circle distance after a cheap bounding-box
  prefilter, and the position is discarded immediately after ranking.
- The Markdown file is a one-way, human-readable share artifact — non-authoritative and not designed
  to be re-imported; the portable JSON data file remains the canonical backup that round-trips.
- Photos are stored as already-downscaled inline data URLs (the same photo pipeline the rest of the
  app uses); the per-story cap of 24 bounds the size a single story adds to the portable file.
- Stories are additive to the portable file (schema version 5); files predating the journal import
  unchanged, and an older app build opening a newer file shows the graceful "update the app" prompt
  rather than failing cryptically.

## Out of Scope

- A shareable website/rendered-image export of the journal (planned follow-up); the shipped export
  is Markdown text only, without photos.
- Re-importing a Markdown journal back into the app (the Markdown file is one-way).
- Rich-text or Markdown formatting inside a story body; story text is stored and shown as plain,
  sanitized prose.
- Authoring or editing reference places from the Journal; a story can only be tagged to a place the
  user has already marked visited.
- Automatic or background location capture, geotagging photos, or storing the user's position; the
  only location use is the opt-in, one-shot "Near me" ranking.
- Marking a place visited from the Journal; picking a nearby suggestion only fills the Place field.
- Per-story sharing links, comments, reactions, or any multi-user/social features.
