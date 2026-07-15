# Feature Specification: Travel Guides (Wikivoyage / Wikipedia)

**Feature Directory**: `specs/010-guides-wikivoyage`

**Created**: 2026-07-14

**Status**: Retro-specified — describes shipped behavior

**Input**: User description: "When I open a place I've been, show me the travel guide for it —
a short overview and a photo up front, and let me read the whole article inside the app so I
don't have to leave for the website. Pull it from Wikivoyage, and fall back to Wikipedia when
Wikivoyage has nothing. Give me the focused links too: the city guide, the country guide, the
country's 'Understand' overview, and a phrasebook for each spoken language. A monument should
show a photo of the monument itself, not the country flag. Keep it opt-in and private — only
fetch when I open a place, never track me, treat everything you download as plain text, and
once I've loaded a guide keep it on the device so it still reads when I'm offline. The guide
code should be a clean, reusable seam I can lift into my other apps."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a place's guide overview with a photo (Priority: P1)

A person opens a place they have visited (a city, a country, or a monument). If they are online
and auto-load is enabled, a short travel-guide overview and a lead photo appear at the top of
the place's detail page — the Wikivoyage blurb when there is one, otherwise the Wikipedia one,
with the photo taken from Wikipedia. The overview is saved on the device so it reads again later
with no network.

**Why this priority**: The at-a-glance overview ("what is this place, in one card") is the core
payoff of the feature and the first thing a user sees; every other guide affordance layers on
top of it. Opening a place is itself the explicit, privacy-respecting trigger.

**Independent Test**: Open a visited city while online, confirm a short overview and a photo
appear in one card citing the source; go offline, reopen the same place, and confirm the same
overview still shows without any network request.

**Acceptance Scenarios**:

1. **Given** a visited place and an online device with auto-load on, **When** the user opens the
   place, **Then** a single overview card shows a short plain-text extract, a lead photo when one
   exists, and an attribution line linking back to the source labelled "CC BY-SA · saved offline".
2. **Given** Wikivoyage has an article for the place, **When** the overview loads, **Then** the
   Wikivoyage extract is preferred for the text and the Wikipedia lead image is used for the photo.
3. **Given** Wikivoyage has no usable article but Wikipedia does, **When** the overview loads,
   **Then** the Wikipedia extract is shown and the card cites Wikipedia.
4. **Given** an overview was loaded earlier, **When** the user reopens the same place offline,
   **Then** the saved overview is restored from on-device storage with no network call.
5. **Given** a monument (heritage place), **When** its overview loads, **Then** the article and
   photo are the monument's own — not the country's article or flag.

---

### User Story 2 - Read the whole guide in-app as collapsible sections (Priority: P1)

Rather than being pushed to the website by a truncated summary, the user taps "Read the whole
guide here" and the full article is fetched as plain text and rendered inline as a list of
collapsible sections (Get in, See, Do, Eat, Sleep, …). Housekeeping sections (references,
external links, galleries, etc.) are dropped. The full guide is saved on the device for offline
re-reading.

**Why this priority**: The REST summary is only the lead and was often visibly cut off, sending
people to leave the app; bringing the whole readable guide in-app is the feature's headline
improvement and directly serves the local-first promise.

**Independent Test**: Open a place with a rich Wikivoyage article, tap "Read the whole guide
here", confirm multiple named sections appear as expandable blocks, then go offline, reopen, and
confirm the full guide still renders.

**Acceptance Scenarios**:

1. **Given** an overview card is shown online, **When** the user taps "Read the whole guide
   here", **Then** the full article is fetched and its sections render as collapsible
   `<details>` blocks, each headed by its section title.
2. **Given** the full article is loaded, **When** its lead paragraph is longer than the summary
   extract, **Then** the fuller lead replaces the summary text in the overview card and the
   citation follows the full-article source.
3. **Given** an article contains housekeeping sections (references, external links, see also,
   further reading, notes, sources, bibliography, gallery), **When** it is rendered, **Then**
   those sections are omitted and only readable travel content remains.
4. **Given** Wikivoyage has no full article, **When** the user requests it, **Then** the app
   falls back to the Wikipedia full article, and if neither exists it shows a graceful message
   with a Retry action and the plain links still work.
5. **Given** a full guide was loaded earlier, **When** the user reopens the place offline,
   **Then** the saved full guide is restored and readable.

---

### User Story 3 - Open focused guide links (city, country, understand, phrasebooks) (Priority: P2)

For any opened place the app offers a tidy, grouped set of ready-to-open Wikivoyage links: the
city travel guide (when the place is a city), the country travel guide, the country's
"Understand" overview section, and one phrasebook per spoken language of the country (each
phrasebook also covering that language's alphabet and pronunciation). An honest search link is
always present as a fallback.

**Why this priority**: These pure links always work — offline-safe to build, resilient to title
mismatches — and give the user reliable jumping-off points even when the online overview fetch
returns nothing. They are secondary to the in-app reading experience but never fail.

**Independent Test**: Open a visited city in a country with two official languages and confirm
the links are grouped into "Explore", "Understand the country", and "Language & alphabet", with a
phrasebook link per language and a working Wikivoyage search link at the bottom.

**Acceptance Scenarios**:

1. **Given** a city place, **When** the guide links render, **Then** an "Explore" group shows the
   city travel guide and the country travel guide.
2. **Given** any place, **When** the guide links render, **Then** an "Understand the country"
   group links to the country article's "Understand" section.
3. **Given** a country with N distinct spoken-language names, **When** the guide links render,
   **Then** the "Language & alphabet" group shows N phrasebook links with duplicates removed and
   empty names skipped.
4. **Given** an exact article title may not match a place's name, **When** the user needs a
   fallback, **Then** a "Search Wikivoyage for …" link built from the place and country name is
   always shown and every link opens in a new browser tab.

---

### User Story 4 - Keep guides opt-in, private, and inert (Priority: P2)

The user controls whether overviews load automatically. Because opening a place is itself a
deliberate action, auto-load is on by default, but a Settings toggle switches it to manual (load
only on tap). No guide request carries cookies, credentials, a referrer, or any telemetry, and
everything downloaded is treated as plain text — never HTML that could execute.

**Why this priority**: Privacy-by-default and inert-data are constitutional non-negotiables; this
story guards them, but the functional guide experience (Stories 1–3) is what users come for.

**Independent Test**: Turn off "Load guide overviews automatically", open a place, and confirm no
overview loads until the user taps "Load overview & photo"; inspect the outgoing request and
confirm no cookies, no credentials, and a no-referrer policy.

**Acceptance Scenarios**:

1. **Given** the auto-load toggle is off, **When** the user opens a place, **Then** no overview
   is fetched and a "Load overview & photo" button is offered instead.
2. **Given** the auto-load toggle is on and the device is offline, **When** the user opens a
   place with no saved guide, **Then** nothing is fetched and the plain links remain usable.
3. **Given** any guide fetch, **When** the request is made, **Then** it omits credentials, sends
   `no-referrer`, and carries no telemetry.
4. **Given** fetched article content contains stray markup, **When** it is displayed, **Then**
   the markup is stripped and only inert plain text is rendered.

---

### Edge Cases

- The device is offline when a place is opened with nothing saved → no fetch is attempted; a
  message explains the links open once back online, and the plain links still work.
- The article title is a disambiguation or missing page → the summary fetch treats it as unusable
  (only "standard" pages yield an overview) and returns nothing; the search fallback covers it.
- Two places share a title (e.g. "Paris, France" vs "Paris, Texas") → saved overviews are keyed by
  country ISO code plus the summary title, so one place never shows another's saved overview.
- On-device storage is unavailable (private-browsing/quota) → guides still display for the current
  view; they simply are not persisted, and reads fail silently.
- A country's language list has duplicate or blank names → duplicates are collapsed and blanks
  skipped so no empty or repeated phrasebook link appears.
- A monument has its own article but Wikivoyage lacks a monument guide → the overview and photo use
  the monument's own article, while the buildable city/country links are unaffected.
- The full article's lead is shorter than the REST summary → the summary extract is kept as the
  card text rather than being replaced by a thinner lead.
- Any fetch fails, times out, is blocked, or returns a non-OK status → the call returns nothing and
  the UI degrades to links and a Retry action; it never throws.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST build, for an opened place, a set of ready-to-open guide links: a
  city travel guide (only when the place is a city), the country travel guide, the country's
  "Understand" section, and one phrasebook per distinct spoken-language name of the country.
- **FR-002**: Guide-link construction MUST be pure and offline-safe — it MUST NOT perform any
  network request and every entry MUST be a directly openable URL.
- **FR-003**: The country name used for links and titles MUST be the common Wikivoyage article
  title (e.g. "Russia", not "Russian Federation"), supplied by the app's reference data.
- **FR-004**: Phrasebook links MUST use the "<Language> phrasebook" article title, MUST de-duplicate
  by language name, and MUST skip empty names.
- **FR-005**: On explicit user action (opening a place with auto-load on, or a manual tap), the
  system MAY fetch a short article summary from Wikivoyage and, in parallel, from Wikipedia, and
  MUST prefer the Wikivoyage text while using the Wikipedia lead image as the photo.
- **FR-006**: The summary fetch MUST accept only "standard" articles (rejecting disambiguation and
  missing pages) and MUST return nothing when the extract is empty.
- **FR-007**: A lead image MUST be shown only when its URL is hosted on `upload.wikimedia.org`.
- **FR-008**: On explicit user action, the system MUST be able to fetch the WHOLE article as plain
  text and render it inline as collapsible sections, one per article section heading.
- **FR-009**: When rendering the full article, the system MUST omit housekeeping sections
  (references, external links, see also, further reading, notes, sources, bibliography, gallery).
- **FR-010**: When the loaded full-article lead is longer than the summary extract, the system MUST
  replace the card text with that lead and update the citation to the full-article source.
- **FR-011**: Both summary and full-article fetches MUST fall back from Wikivoyage to Wikipedia,
  and MUST degrade gracefully (return nothing, show a message plus Retry, keep the links working)
  on offline, blocked, missing, non-OK, or any error condition — never throwing.
- **FR-012**: All fetched article text MUST be treated as inert plain text: markup MUST be stripped
  defensively and content MUST NEVER be rendered as HTML or executed.
- **FR-013**: Every guide network request MUST omit credentials/cookies, send a `no-referrer`
  referrer policy, and carry no telemetry or user identifiers.
- **FR-014**: Loaded overviews and full guides MUST be saved on the device and restored on reopen,
  so a previously-loaded guide reads offline.
- **FR-015**: Saved guides MUST be keyed by country ISO code plus article title so that
  same-named places in different countries never share a saved guide.
- **FR-016**: Automatic overview loading MUST be a user-controllable setting, on by default, that
  can be switched to manual (load only on tap); when off, no fetch occurs until the user acts.
- **FR-017**: The system MUST always present a Wikivoyage full-text search link (built from the
  place and country name) as a fallback for title mismatches or failed fetches.
- **FR-018**: A monument (heritage) place MUST use its OWN article and photo as its overview
  (not the country's article or flag), while still offering the buildable country links.
- **FR-019**: Every external link MUST open in a new browser tab with `noopener`/`noreferrer`, and
  displayed guide content MUST show the required "CC BY-SA" attribution to its source.
- **FR-020**: The guide seam MUST remain framework-agnostic and self-contained — pure functions
  over plain inputs, with no dependency on the app's stores, reference data, or UI — so it can be
  lifted into other apps in the ecosystem, and it MUST accept an injectable fetch for testing.

### Key Entities *(include if feature involves data)*

- **WikivoyagePlaceInput**: The plain input a guide is built from — optional city name, country
  display (article) name, country ISO 3166-1 alpha-2 code (used only to mint stable link ids), and
  an optional list of spoken languages. Carries nothing app-specific.
- **WikivoyageLanguage**: A spoken language of a place, identified by an opaque code and an English
  name (as Wikivoyage titles phrasebooks); only the name is used for links.
- **WikivoyageLink**: One ready-to-open guide link — stable id, kind (`place`, `country`,
  `understand`, `phrasebook`), human label, short hint, article title, and URL (optionally to a
  section anchor).
- **WikivoyageSummary**: An opt-in, online-fetched article summary — title, plain-text extract,
  page URL, attribution string, and an optional Wikimedia-hosted lead image URL.
- **WikiFullText / WikiGuideSection**: A whole article as inert plain text — title, URL,
  attribution, and an ordered list of sections, each a heading (empty for the lead) plus plain-text
  body with paragraphs separated by blank lines.
- **Saved guide entry**: An on-device persisted summary or full-text record, keyed by project,
  country ISO code, and article title, enabling offline re-reading.
- **Auto-load setting**: A persisted user preference controlling whether overviews load
  automatically when a place is opened online.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening a visited place online with auto-load on shows an overview card (extract plus
  photo when available) with zero additional user taps.
- **SC-002**: A guide loaded once while online is fully readable after the device goes offline and
  the place is reopened, in 100% of cases where on-device storage is available.
- **SC-003**: The full in-app article renders every content section as an expandable block and
  omits 100% of the eight named housekeeping section types.
- **SC-004**: When Wikivoyage lacks an article, the overview and full guide fall back to Wikipedia
  in 100% of cases where Wikipedia has one.
- **SC-005**: 100% of guide network requests carry no cookies/credentials and send `no-referrer`
  (verifiable by request inspection).
- **SC-006**: No fetched article content is ever rendered as HTML or executed; 100% of adversarial
  markup in extracts is stripped to plain text.
- **SC-007**: With auto-load off, opening a place issues zero guide network requests until the user
  taps to load.
- **SC-008**: Two same-named places in different countries never display each other's saved guide
  (0 cross-contamination across the keyed store).
- **SC-009**: A monument place's overview photo is the monument's own image, never the country
  flag, in 100% of monuments that have their own article.
- **SC-010**: The guide seam module imports nothing from the app's stores, reference data, or React
  (0 app-specific dependencies), so it is liftable as-is into another app.

## Assumptions

- Guide reference text and images come from Wikivoyage and Wikipedia (both CC BY-SA 4.0); the app
  aggregates and links to them and authors no travel content of its own.
- "Opening a place" is treated as the user's explicit, deliberate action, which is why automatic
  overview loading is on by default; the Settings toggle exists for users who prefer manual loading.
- Summaries are fetched from the MediaWiki REST summary endpoint; full articles from the MediaWiki
  Action API TextExtracts (plain text, anonymous CORS). The default language is English (`en`).
- The consuming app supplies the common country (article) name and per-country language list from
  its bundled reference data; the seam itself ships no data.
- On-device persistence uses the browser's local storage; when it is unavailable, guides still
  display for the current session but are not saved.
- City and monument places open a city-style detail page carrying guides inline; countries and
  airports open the country page; both render the same guide content.
- Section splitting relies on MediaWiki plain-text conventions ("== Heading ==" top-level,
  "=== … ===" as in-section lead-ins); deeper structure is flattened into readable paragraphs.

## Out of Scope

- Downloadable/bundled offline guide packs — guides are only saved after the user loads them once
  while online; there is no pre-bundled corpus.
- Editing, translating, or authoring guide content in-app; the app only reads and links.
- Non-English Wikivoyage/Wikipedia languages beyond the default `en` behavior (the seam accepts a
  language parameter, but no in-app language switcher ships).
- Rich media beyond a single lead photo — no galleries, maps, or embedded HTML from the articles.
- Structured extraction of listings (hotels, restaurants, POIs) into app data; guides remain free
  text plus links.
- A modal guide viewer — guides render inline on the place's detail page, not in a separate dialog.
- Guides for place kinds without a resolvable country, which render no guide affordance.
