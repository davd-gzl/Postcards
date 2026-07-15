# Feature Specification: Journal Publish mode (shareable travel-blog website)

**Feature Directory**: `specs/012-journal-publish`

**Created**: 2026-07-15

**Status**: Draft — designed with the maintainer

**Input**: Maintainer description: "The app is my private editor. Give me a separate Publish mode
that turns a slice of my journal into a self-contained, read-only travel-blog website I can host
anywhere — GitHub Pages, Netlify, Nextcloud, a USB stick, a plain folder — with no server. Someone
opening it should discover it like a Polarsteps book: a cover with the title, dates, and totals,
then a journey map with every step in order and the transport between them, and one photo-led page
per place they page through left to right. Let me choose what to publish (one trip, a date range,
or a tag) and preview it first. Strip the GPS out of my photos. Optionally lock the whole thing
with a passphrase that decrypts in the visitor's browser — no server, works on GitHub Pages, and
the passphrase is never in the files. Build a portable bundle for any host; 'push to GitHub' is
just one optional button behind that. Ship a README so whoever hosts it knows what to do. Route map
uses my bundled offline basemap, keeps the Natural Earth / OpenStreetMap credit, and there's no
analytics unless a self-hoster adds their own."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select a slice and build a portable travel-blog site (Priority: P1)

The user opens Publish mode, chooses what to share — a single trip/journey, a date range, or a tag —
and sees a live preview of exactly what will go out. When they are happy, they build a single,
self-contained, read-only website bundle they can save and drop onto any static host, git remote, or
USB stick. The app itself never changes; it stays the private editor, and nothing leaves the device
except the bundle the user explicitly produces.

**Why this priority**: The whole feature is worthless without the ability to turn a chosen slice of
the private journal into a portable artifact. This is the smallest slice that already delivers value —
a shareable website the user fully owns and can host anywhere — and everything else (the reader
experience, encryption, connectors) layers on top of it.

**Independent Test**: Offline, pick a date range that covers a couple of logged trips and their
stories, preview it, build the bundle, then open the built bundle in a fresh browser with no network
and confirm a complete, working site renders with zero external requests.

**Acceptance Scenarios**:

1. **Given** Publish mode is open, **When** the user chooses a scope (a trip, a date range, or a
   tag), **Then** a preview shows the exact cover, steps, route, and photos that will be published,
   and nothing outside the scope.
2. **Given** a chosen scope, **When** the user builds, **Then** a single self-contained site bundle
   is produced whose data, photos, basemap geometry, and reader code are all embedded and addressed
   by relative paths (no absolute host, no external URL).
3. **Given** a built bundle, **When** it is opened directly from a folder or a static host with no
   server and no build step, **Then** the site renders and is fully navigable.
4. **Given** the current selection is empty (no trips or stories in scope), **When** the user looks
   at the build action, **Then** it is disabled with a clear explanation instead of producing an
   empty site.

---

### User Story 2 - Read the journey like a book you discover (Priority: P1)

A visitor opens the published site and discovers it as a book: a cover page with the title, the date
range, and totals (countries visited, distance travelled), then a journey map showing every step in
visit order with the transport legs between them, then one photo-led page per step — a hero photo,
the place, the date, the story, and its gallery — which they page through left to right. It works
with arrow keys and swipe, honours reduced-motion, and is fully accessible.

**Why this priority**: The reader experience is the entire payoff — the thing every visitor actually
sees. A bundle nobody enjoys reading is a failed share. It is independently testable against any
built bundle and is the second half of the minimum shippable product.

**Independent Test**: Open a built bundle offline, confirm the cover shows the title, date range, and
totals, then page from the cover through every step with the right-arrow key and by swiping, open a
photo gallery and page it, and run an automated accessibility audit on the reader.

**Acceptance Scenarios**:

1. **Given** a published site, **When** it loads, **Then** the first thing shown is a cover page with
   the journey title, its date range, and totals (number of countries, total distance).
2. **Given** the cover, **When** the visitor advances, **Then** a journey map shows every step in
   visit order and the transport legs between them, drawn as great-circle arcs styled by mode.
3. **Given** the map, **When** the visitor pages forward, **Then** each step is its own photo-led
   page (hero photo, place name, date, story text, photo gallery), reached left→right in journey
   order and returnable right→left.
4. **Given** any page, **When** the visitor uses the left/right arrow keys or swipes, **Then** the
   book pages accordingly; **and** when the visitor prefers reduced motion, page turns are instant
   with no animation.
5. **Given** a page's gallery, **When** the visitor opens a photo, **Then** a read-only lightbox pages
   with arrows, closes with Escape, and returns focus to the thumbnail — the same accessible pattern
   as the app's gallery.
6. **Given** the reader is navigated by keyboard alone, **When** an accessibility audit runs, **Then**
   every action is reachable, focus is visible, and there are zero critical WCAG 2.1 AA violations.

---

### User Story 3 - Lock a public site with a passphrase, no server (Priority: P2)

The user optionally protects a published site with a passphrase. The journey data is encrypted when
the bundle is built; a visitor who opens the site is asked for the passphrase, which decrypts the
content entirely in their own browser. The passphrase is never written into any published file, and
the whole thing works on a plain static host such as GitHub Pages, with no server.

**Why this priority**: Passphrase protection makes it safe to put a journey on a public host, which is
a real want — but it is optional and layers on top of an already-useful public bundle, so it comes
after the core build and reader.

**Independent Test**: Build a bundle with a passphrase, host it as static files, confirm that without
the passphrase the content cannot be read and the passphrase appears nowhere in the files, then enter
the correct passphrase and confirm the journey decrypts and renders with no server involved.

**Acceptance Scenarios**:

1. **Given** the user sets a passphrase before building, **When** the bundle is produced, **Then** the
   journey payload is stored encrypted and the passphrase is present in none of the published files.
2. **Given** an encrypted site on a static host, **When** a visitor without the passphrase opens it,
   **Then** they see only a passphrase prompt and cannot read the journey content.
3. **Given** the passphrase prompt, **When** the visitor enters the correct passphrase, **Then** the
   content is decrypted in the browser and the book renders — with no network request to any server.
4. **Given** a wrong passphrase, **When** the visitor submits it, **Then** decryption fails with a
   clear message and no content is revealed.

---

### User Story 4 - Publish to a host: local download always, GitHub in one tap (Priority: P2)

The user publishes through a pluggable target. A local download/save target — which works for every
host and has zero lock-in — is always available. As one optional connector behind the same seam,
"Push to GitHub" publishes the bundle to GitHub Pages after a one-time authorization (a token or the
device-flow), and a Sync button re-publishes later updates. Removing the connector leaves
local-download publishing completely intact.

**Why this priority**: One-tap hosting is a delightful convenience, but the portable bundle already
lets a user host anywhere by hand; the connector is additive and must never become a hard dependency,
so it is the last slice.

**Independent Test**: Build a bundle and save it locally (confirming it works with no network), then,
with the GitHub connector authorized, push the same bundle to a Pages site, edit the selection, and
Sync to confirm the live site updates.

**Acceptance Scenarios**:

1. **Given** a built bundle, **When** the user picks the local target, **Then** the bundle is saved to
   the device with no network request of any kind.
2. **Given** the GitHub connector is authorized (token or device-flow), **When** the user pushes,
   **Then** the prebuilt static bundle is published to a Pages branch and the site becomes reachable.
3. **Given** a previously published site, **When** the user changes the selection and taps Sync,
   **Then** the connector re-publishes and the live site reflects the new selection.
4. **Given** the GitHub connector is unavailable, unauthorized, or removed, **When** the user
   publishes, **Then** local download still works fully and the app reports the connector state
   without sending data anywhere else.

---

### Edge Cases

- A place has a story but no trip leg in scope → it still appears as a page, ordered by its date, with
  no fabricated transport leg leading into it (the route just has a gap).
- A trip endpoint has no coordinate (e.g. a whole country) → the step renders but contributes no arc
  and no distance, exactly as in the Travel Log; distance is never fabricated.
- A step has no photo → the page shows a map thumbnail or a neutral placeholder as its hero, never a
  broken image.
- Two steps are the same place on different dates → both pages render; the journey is time-ordered,
  not de-duplicated by place.
- Story text or a caption contains angle brackets, backticks, or link/image syntax → it is emitted as
  inert, escaped content in the generated HTML, so a shared page can never form raw HTML, a script, or
  a tracking pixel.
- The passphrase is lost → an encrypted bundle cannot be recovered; by design there is no back door,
  and the maintainer simply re-publishes. The host docs state this plainly.
- A photo carries EXIF/GPS metadata → it is stripped on build; no location or camera data reaches the
  published files.
- The visitor prefers reduced motion → all page-turn and map animations degrade to instant.
- A very large journey (hundreds of photos) → the reader lazy-loads images and stays responsive; each
  image is already downscaled by the capture pipeline.
- The GitHub token is expired or the device-flow is denied → the app reports it and the user falls
  back to local download; no journey data is sent to any other destination.
- The device is offline while publishing via GitHub → the connector fails gracefully and the local
  download target still produces the bundle.
- A self-hoster wants server-side access control → the docs describe an optional Basic-Auth
  environment-variable route, kept clearly separate from the static-host client-side passphrase.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A separate **Publish mode** MUST let the user build a self-contained, **read-only**
  travel-blog website from their own journal data. The app MUST remain the private editor; the
  published site MUST NOT be editable, MUST NOT embed the editor, and MUST NOT write back any data.
- **FR-002**: The publish scope MUST be **selectable** — a single trip/journey, a date range, or a
  tag — and the user MUST be able to **preview** exactly what will be published (cover, steps, route,
  photos) before building.
- **FR-003**: The journey MUST be **derived from the user's Trips**: each trip's from→to leg and its
  transport mode form the route, in visit (date) order, and stories and photos attach to the places
  (steps) along that route. The app MUST NOT invent route, transport, or reference/world facts.
- **FR-004**: The published reader MUST present the journey **as a book**: a **cover page** (title,
  date range, and totals — countries visited and total distance) followed by one **photo-led page per
  step** (hero photo, place name, date, story text, photo gallery), paged **left→right** through steps.
- **FR-005**: The reader MUST show a **journey map** with every included step in visit order and the
  **transport legs** between steps (great-circle arcs styled by mode), reusing the same bundled
  **offline basemap geometry** and trip-arc rendering the app already uses, and MUST make **zero
  external tile calls** to draw it.
- **FR-006**: The reader MUST be operable by **keyboard** (left/right arrows page the book; the gallery
  pages with arrows and closes with Escape) and by **swipe** on touch, MUST respect
  `prefers-reduced-motion` (instant page turns when requested), and MUST meet **WCAG 2.1 AA**.
- **FR-007**: The cover's distance and country totals MUST be **derived** from the included trips'
  endpoint coordinates (great-circle), reusing the Travel Log distance logic; a leg whose endpoint
  lacks a coordinate contributes to the journey but not to distance (never fabricated).
- **FR-008**: The build MUST **strip EXIF/GPS and other embedded metadata** from every published photo,
  and MUST emit captions and story text as **inert, escaped** content that cannot form raw HTML, a
  script, or a link/image tracking pixel.
- **FR-009**: The output MUST be a **portable site bundle** that runs on **any static host or git
  remote** (GitHub Pages, Netlify, Nextcloud, a USB stick, a plain folder) with **no server and no
  host-side build step**; all assets (data payload, photos, basemap geometry, reader code, styles) MUST
  be embedded/self-contained and addressed by relative paths.
- **FR-010**: Publishing MUST go through a pluggable **publish-target seam**. A **local download/save**
  target MUST be the default, MUST touch no network, and MUST remain fully functional if every
  connector is removed. **"Push to GitHub"** MUST be **one optional connector** behind that seam
  (authenticated by a user-supplied token or GitHub **device-flow**), offered with a **Sync** action to
  re-publish updates.
- **FR-011**: The user MUST be able to optionally protect a published site with a **passphrase** using
  **client-side AES encryption**: the data payload is encrypted at build time, decrypted only in the
  **visitor's browser** after they enter the passphrase, and the passphrase MUST **never** appear in
  any published file. This MUST work on a **static host with no server**.
- **FR-012**: Encryption MUST use a standard authenticated cipher (**AES-GCM**) with a key derived from
  the passphrase via a **salted KDF** (random per-build salt and IV stored alongside the ciphertext); a
  wrong passphrase MUST fail to decrypt with a clear message and MUST NOT reveal the content.
- **FR-013**: For self-hosters running a server, the docs MUST **separately** describe an optional
  **environment-variable Basic-Auth** route as an alternative access control, clearly distinguished
  from (and not a replacement for) the static-host client-side passphrase.
- **FR-014**: The published site MUST contain **no analytics or telemetry by default** and MUST make no
  network request other than loading its own bundled assets; the docs MUST explain how a self-hoster
  could add their own analytics if they choose.
- **FR-015**: Every build MUST include human-readable **"docs for the host"** — a **README shipped
  inside the export** explaining how to host it (static host, GitHub Pages, Nextcloud, USB), how the
  optional passphrase works, and how to add server Basic-Auth / analytics — mirrored under the repo
  `docs/`.
- **FR-016**: The published site MUST preserve the reference-data **attribution (Natural Earth /
  OpenStreetMap)** required by the source datasets' licenses, visibly on the map/reader.
- **FR-017**: Publishing MUST be an **explicit, user-initiated** action; no journal, photo, or location
  data may leave the device except through the export or connector the user invokes, and the local
  download target MUST never contact the network.
- **FR-018**: The publish selection MUST read **only the user's own on-device data** (visits, trips,
  stories) as validated by the portable schema; the bundle's data payload MUST be a **filtered
  projection** of that data (scoped and EXIF-stripped) and MUST itself be **inert** — rendered by the
  reader, never executed.
- **FR-019** (SHOULD): The preview SHOULD render with the **same reader code** used in the bundle, so
  what the user sees before building matches the published result.
- **FR-020** (SHOULD): Steps without a connecting trip (a place with a story but no leg in scope)
  SHOULD still appear as pages ordered by date, with no fabricated transport leg into them.
- **FR-021** (SHOULD): The bundle SHOULD be reproducible from the same selection so a Sync produces a
  clean, deterministic update rather than an accreting site.

### Key Entities *(include if feature involves data)*

- **Publish Selection**: The user's choice of what to publish — a scope (one trip/journey, a date
  range, or a tag), an optional title, and options (passphrase on/off, target). Transient input to a
  build; not persisted personal data.
- **Journey**: The ordered sequence of steps and transport legs derived from the selected Trips (and
  the stories/photos attaching to their places), in visit-date order. Derived, never authored.
- **Step (Page)**: One place in the journey rendered as a photo-led page — hero photo, place name,
  date, story text, and a photo gallery. Attaches stories and photos to a place from the route.
- **Transport Leg**: The connection between two steps, carrying the mode from the source Trip; drawn as
  a great-circle arc and contributing to distance when both endpoints have coordinates.
- **Cover**: The opening page — title, date range (min/max included date), and totals (countries
  visited, total distance).
- **Site Bundle**: The self-contained, read-only static website output — reader code, styles, data
  payload, embedded photos, bundled basemap geometry, attribution, and the host README. Addressed by
  relative paths; runs on any static host with no build step.
- **Encrypted Payload**: The optionally AES-GCM-encrypted journey data plus its salt and IV; decrypted
  only in the visitor's browser from a passphrase that is never stored in the bundle.
- **Publish Target**: The pluggable seam for delivering a bundle. The default **Local Download** target
  saves the bundle with no network; the optional **GitHub Pages connector** (token or device-flow) is
  one implementation behind the same interface, with a Sync action.
- **Host Docs**: The README shipped inside the export (mirrored in the repo `docs/`) explaining
  hosting, the passphrase, server Basic-Auth, analytics, and the no-recovery caveat.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the app, a user can select a scope, preview it, and produce a self-contained site
  bundle that opens in a browser **fully offline** with **zero external network requests** (verifiable
  by network inspection).
- **SC-002**: The reader renders a cover plus **one page per step in visit order**, pages left→right by
  arrow key and by swipe, and passes an automated **WCAG 2.1 AA** audit with **zero critical
  violations**.
- **SC-003**: The journey map renders **every included step and its transport legs** using only bundled
  geometry — **zero external tile requests** — with Natural Earth / OpenStreetMap attribution visible.
- **SC-004**: A passphrase-encrypted bundle **cannot be read without the passphrase**, the passphrase
  appears in **none** of the published files, and the correct passphrase decrypts and renders the whole
  journey **in the browser on a static host with no server**.
- **SC-005**: **100%** of published photos carry no EXIF/GPS metadata, and 100% of story titles, story
  text, and captions are escaped so none renders as HTML, a script, or a link/image.
- **SC-006**: A bundle saved locally and dropped onto a static host (GitHub Pages, Netlify, Nextcloud,
  or a USB folder) serves a **working site with no host-side build step**.
- **SC-007**: The GitHub connector is **optional** — removing it leaves local-download publishing
  fully functional, proving the app has no hard dependency on GitHub.
- **SC-008**: The published site contains **no analytics or telemetry** and makes no network request
  other than loading its own bundled assets (verifiable by inspection).
- **SC-009**: Re-publishing (**Sync**) after changing the selection updates the live site to match the
  new selection.

## Assumptions

- **Journey model** follows the maintainer's locked decision: **Trips drive the route** (from→to legs
  and transport mode); **stories and photos attach to places**. A "trip/journey" scope groups the
  selected trips and the stories/photos on their endpoint places; a "date range" scope includes trips
  and stories whose date falls in the range; a "tag" scope includes items carrying the chosen tag.
- **Tags** are not yet stored by the app. This feature adds an **additive, optional** `tags: string[]`
  to stories (schema-version bump, following the established additive pattern used for `trips` and
  `stories`), so older portable files import unchanged. Until tags ship, the "tag" scope can initially
  reuse country/place grouping — the scope selector is designed so tag is one filter among the three.
- **Photos** are already downscaled to inline data URLs by the capture pipeline (`lib/image/downscale`,
  a canvas re-encode that drops metadata); the publish step **re-encodes to guarantee** no EXIF/GPS
  survives into the bundle.
- The **reader** is a small, self-contained HTML/CSS/JS app embedded in the bundle. It uses only the
  browser's built-in **WebCrypto (SubtleCrypto)** for AES-GCM and the passphrase KDF, so encryption
  adds **no third-party dependency** and runs on any static host.
- The reader's **map** embeds the same bundled **Natural Earth** geometry (`public/basemap/
  countries-50m.json`, public domain) the app's poster and offline basemap already use, plus
  great-circle trip arcs reused from the app's `visitedLayers` — so the route draws **offline** with
  zero external tile calls.
- The **GitHub connector** uses either a user-supplied fine-grained token or GitHub's **device
  authorization flow**, and pushes the prebuilt static bundle to a Pages branch. It is **one connector
  behind the publish-target seam**; the canonical, always-available output is the portable bundle.
- The **client-side passphrase** protects a **static-host** site (no server). The **server Basic-Auth**
  route is a separate option for self-hosters who run a server; it is **documented**, not implemented,
  in the static bundle.
- **Totals** reuse the Travel Log's great-circle distance and the app's existing country-coverage
  logic; no new reference facts are introduced.
- The published site is a **one-way** share artifact — human-readable and hostable, but **not
  re-importable**; the canonical backup remains the portable JSON file.

## Out of Scope

- Server-side rendering, a hosted backend, accounts, or comments / likes / reactions / any social
  features on the published site.
- Real-time or automatic re-publishing; **Sync is a user-initiated push**.
- Editing journal data from the published site — it is strictly read-only.
- Live or street-level map tiles in the reader; it uses the bundled overview geometry, matching the
  app's offline guarantee. Downloadable tile packs remain the Offline Map Store follow-up.
- Multi-user access, per-visitor access lists, or key management beyond the single shared passphrase
  (static host) and the documented server Basic-Auth route.
- Connectors beyond local download and GitHub (a Netlify or Nextcloud API push, etc.); those hosts are
  supported via the drop-in portable bundle rather than a dedicated connector in this increment.
- **Re-importing** a published site back into the app (the portable JSON file stays canonical).
- **Passphrase recovery** for an encrypted bundle — by design there is none; the maintainer re-publishes.
