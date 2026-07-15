# Features

Everything Postcards ships today, grouped by what it does. Postcards is a
**privacy-first, local-first aggregator for remembering places you've been** — it stores your
visits and shows them off, and is deliberately **not** a trip planner. Every feature below honours
the project [Constitution](Privacy-and-Constitution.md): world facts come only from named, openly-licensed
datasets ([Reference Data](Data-and-Provenance.md)); your own data stays on the device; imports are
inert; and the whole thing is keyboard-first and works offline.

For how these pieces fit together (React 19 + Vite, Zustand stores, IndexedDB, the `MapSource`
seam) see [Architecture](Architecture.md); for the portable file shape see the
[Data Model](Architecture.md#the-zod-schema-and-generated-json-schema).

> Each feature that has its own spec is linked to it under `specs/`. `001-cities-countries` is the
> original MVP; features 002–014 are retro-specs / designed-with-the-maintainer specs written
> around the shipped code.

---

## Navigation & shell

The app is one screen with a persistent shell: a **top bar** (brand → map, a global place
[search](#places), the online/offline chip, an optional PWA **Install** button, a GitHub star link,
a **How it works** modal, and **Settings**) and a **bottom nav** of five sections:

| Section | Shortcut | What it is |
|---------|----------|------------|
| **Map** | `1` / `m` | The world map + in-view list |
| **Places** | `2` / `p` | Your visited/wishlist/favorite places, monuments, countries, Moments, Passport |
| **Trips** | `3` / `t` | The travel log |
| **Journal** | `4` / `j` | Your travel blog |
| **Stats** | `5` / `s` | Coverage & records |

Extra keyboard shortcuts: `/` focuses map search, `?` opens the shortcuts help, `f` jumps to the
Passport, `x` to Moments, and `Escape`/the phone **Back** gesture retraces your own steps (closing
an open dialog first, then walking the app's history) instead of quitting. Focus is moved to the
main region on every tab/page change, and there's a skip-to-content link — part of the WCAG 2.1 AA
commitment.

---

## Places

`src/features/visits` · `src/features/city` · `src/features/country` · specs
[`001`](../specs/001-cities-countries), [`002`](../specs/002-place-types),
[`011`](../specs/011-photo-gallery)

The heart of the app: a log of places, each recorded with a one-tap state control. Five **place
kinds** share one record shape (`PlaceRef` in the [schema](Architecture.md#the-zod-schema-and-generated-json-schema)):

- **Cities** — from the GeoNames gazetteer (the full ~135k-city set streams in behind the map;
  the ≥15,000-population subset loads first).
- **Countries** — ISO 3166-1. A country is **never** marked visited on its own: visiting any place
  inside it makes it count (coverage is *derived*). Countries keep a Want-to-go flag only.
- **Airports** — IATA-coded airports (OpenFlights). A logged airport counts toward *country*
  coverage but never toward the %-of-cities / %-of-regions metrics (a layover isn't a visit).
- **Monuments** — UNESCO World Heritage sites plus a famous-landmarks seed. `heritage.json` is
  built from the 2025 UNESCO World Heritage List (47th session, **1,353 sites**); a small
  `landmarks.json` seed (Eiffel Tower, …) merges in at load.
- **Custom** — your own places the datasets don't know (a hamlet, a viewpoint, grandma's village),
  added via **Add place** with a name, country, and optional coordinates. Clearly marked "your own
  place" and stored only in your file — the app never presents them as reference data.

**State toggles** (`StateToggles`): every place row offers **Been ✓**, **Want to go ⚑**, and
**Favorite ♥**, each a single tap with no menus. Want is offered only until you've been; Favorite
only once you've been. Removing a visit shows an undo toast that restores just that one record.

The **Places** screen has view tabs — **Visited**, **Favorites** (appears once you star anything),
**Wishlist**, **Monuments**, **Countries** — plus a separate cluster for the **✨ Moments** and
**🛂 Passport** collections. Visited places can be filtered by name and by year; long lists page in
steps of 100. The Countries view is a full checklist (yours sorted first) with a UN-member /
all-territories [scope toggle](#coverage--statistics). A **place detail page** (opened from any
row) gathers reference facts, your visit date & note, its [photo gallery](#photo-galleries), nearby
monuments/airports, and its [travel guide](#travel-guides) inline.

Global **search** (top bar, `PlaceSearch`) ranks prefix matches first and, on picking a city, flies
the map there — it does **not** auto-mark anything visited.

---

## The map

`src/features/map` · specs [`001`](../specs/001-cities-countries),
[`004`](../specs/004-offline-map-seam) · see also [Offline Maps](Architecture.md#seam-1--mapsource-the-offline-first-basemap)

A MapLibre GL map (code-split so it loads only when shown, and kept mounted so switching tabs never
reloads it). It is consumed strictly through the `MapSource` seam, which offers three basemaps:

- **Simple (offline)** — a bundled Natural Earth vector outline base (`public/basemap/`, public
  domain). Always available, zero network, and the automatic fallback when online tiles can't load.
- **Detailed — OpenStreetMap (online)** — opt-in raster OSM tiles; the everyday detailed base, and
  downloadable for offline use per region in [Settings](#backup-import--reset).
- **Streets (offline)** — an opt-in street-level PMTiles vector pack, offered **only** when a pack
  is installed via the device-global Offline Map Store (none is bundled — a world street pack is
  too large and must stay cross-app). Reads via the `pmtiles://` protocol; never a hard-coded
  app-private path.

Turning **online maps** off in Settings forces the offline base and makes the map do zero outbound
requests — the privacy escape hatch. A transient tile outage falls back to the offline base for the
session only and offers a manual **Reconnect**.

Map controls:

- **Mode segmented control** — All / Cities / 🏛 Monuments / ✈ Airports; the in-view list and
  markers follow the mode.
- **Layers panel (≡)** — 🌐 Globe projection, 🧵 Trip arcs (honouring the Trips time filter),
  ∴ Small towns, 🗺 My countries (visited countries tinted; on by default), and the basemap switch.
- **＋ Add place** — drop your own place at the map centre; a long-press / right-click seeds the
  coordinates directly.
- **Fit to my places** — frames everything of yours with coordinates (visited + wishlist + custom),
  handling the antimeridian so Fiji + Samoa don't frame the whole globe. This is the first frame on
  open, before the basemap even finishes.
- A draggable **splitter** between the map and the in-view list (left/right on desktop, up/down on
  mobile), keyboard-nudgeable, its size persisted.

The in-view list shows the most relevant (population-sorted) places in the current viewport, filters
by All / Hide visited / Visited, sorts A–Z, and pages in small steps. Tapping a row zooms the map to
it; the selected row exposes a 📖 guide button and the state toggles.

---

## Coverage & statistics

`src/features/stats` · spec [`001`](../specs/001-cities-countries)

The **Stats** screen turns your log into "how much of the world?":

- **Coverage hero** — a ring of countries visited / world total, with a floor so a real visit never
  reads a discouraging 0%. A **country-scope toggle** switches the denominator between all
  countries & territories and UN members only, and is respected everywhere (stats, passport, poster).
- **Continent constellation** — a lit dot per continent touched (Antarctica earns a dot only once
  visited), plus a per-continent progress grid (visited / total, %).
- **KPI pills** — cities, airports (shown once you have one), and monuments visited.
- **Records** — fun superlatives across visited cities: northernmost & southernmost, biggest by
  population, first and latest visit by date. City records fly the map when tapped.
- **Travel totals** — trips, total distance, and a by-mode breakdown (mirrors the [Trips](#trips--boarding-pass-import) screen).
- **By country** — an expandable card per visited country showing the two headline metrics
  **% of cities** and **% of regions** (states/provinces), plus **% of heritage sites** where the
  country has any. Expanding reveals tappable chips: cities visited, regions visited, **regions
  still to visit** (the "what's left" list), and monuments seen / to see.

Denominators come from the loaded [reference datasets](Data-and-Provenance.md) and grow live as the full
gazetteer streams in. A numerator can never exceed its denominator — only cities present in a
country's gazetteer count toward that country's percentages.

---

## Trips & boarding-pass import

`src/features/travel` · `src/lib/bcbp` · specs [`003`](../specs/003-travel-log),
[`006`](../specs/006-boarding-pass)

A **log of journeys already taken** (not a planner). Each trip is a **from** place, a **to** place,
a **mode** (flight / train / bus / ferry / car / other), and optional date and note. Endpoints reuse
`PlaceRef`, so a leg can join cities, airports, or countries.

- **Distance is derived, never stored** — the great-circle (haversine) distance between the two
  endpoints' coordinates. An endpoint without coordinates (e.g. a whole country) simply yields no
  distance.
- **Totals** — trip count, total distance travelled, and a per-mode breakdown, all recomputed under
  a shared **year / month period filter** that the map's trip arcs also honour.
- Trips are their **own log** — logging one never marks its endpoints visited, keeping coverage
  and undo predictable. Add / edit / remove, each with a one-tap undo.

**Boarding-pass import (BCBP):** read an IATA Bar-Coded Boarding Pass entirely on-device by
**pasting the code** or **scanning a photo** where the browser's `BarcodeDetector` supports
PDF417/Aztec/QR (feature-detected, graceful paste-only fallback). A single leg prefills the trip
form for review; a multi-leg connection logs every fully-resolved leg as a flight with one undo. The
year (absent from the pass) resolves to the most recent past occurrence; airport codes are resolved
against the gazetteer and **never invented** — an unknown code is left for you to fill (single leg)
or the leg is skipped and reported (connection). Non-boarding-pass input is rejected with a clear
message. The pass is never uploaded.

---

## Journal

`src/features/journal` · spec [`007`](../specs/007-journal)

A mini **travel blog** inside the app: dated, titled stories about places you've been, each with its
own small photo gallery.

- **Greets you ready to write** — the composer is open with today's date filled in; no button press
  to start.
- **Place picker** lists only places you've marked visited (it never invents a place). A **📍 Near
  me** button ranks nearby gazetteer cities from your current position — requested only on that tap,
  used once, and **never stored**; picking one only fills the Place field, marking nothing visited.
- **Never loses your writing** — the in-progress place/date/title/text are mirrored to a debounced
  localStorage draft and restored when you come back, even across a tab switch, backgrounding, or the
  page being reclaimed. (Photos are rehydrated from the store, not cached, to protect the quota.)
- **Near midnight** the "Today's story" tap first asks which of two candidate days it's about.
- **Photos** — up to **24 per story**, downscaled on-device, each with an optional caption; browsed
  in a keyboard-navigable lightbox.
- **Feed** — newest first, filterable by destination / country and by year, paging in steps of 20.
- **Export** the whole journal as a readable **Markdown** file, and open **[Publish mode](#publish-mode)**
  to turn a slice of it into a shareable website.

Stories are personal data, sanitized and stored on-device in the same portable file as everything
else.

---

## Moments

`src/features/experiences` · spec [`008`](../specs/008-moments)

A curated list of **once-in-a-lifetime world experiences** you live somewhere rather than places you
own on a map — see the northern lights, cross the equator, stand before the Pyramids. Each moment
has an emoji, a name, and a one-line hint; a running **"X of Y lived"** tally sits at the top.

- Check off the ones you've lived with the same **Been ✓** control used everywhere.
- Each moment links to a few **real anchor places** where it happens (Tromsø, Fairbanks, Reykjavík
  for the aurora), shown as flag chips; tapping one flies the map there and marks nothing.
- Moments are grouped by their home **continent → country** (read from the primary anchor's country
  code); borderless ones sit under "Across the world".

The bundled starter list (`public/reference/experiences.json`) is an **aggregate**: only the short
name/hint/emoji are app-authored; anchor coordinates come from Wikidata (CC0) / GeoNames, and the
concepts are attributed to UNESCO / Wikivoyage, each with per-item provenance. Each moment is stored
as a neutral **`custom`** record carrying the `ZZ` code, so it rides along in your backup but never
counts toward country statistics. Lives as a view inside [Places](#places).

---

## Passport & world poster

`src/features/passport` · spec [`009`](../specs/009-passport-poster)

Your **passport** is a collection of flags — one per visited country, **derived** from the places
logged inside each — arranged like the pages of a real passport:

- Flags are **grouped by continent**, each section showing its own "collected of total" progress;
  only continents with at least one flag are shown. A header tallies flags collected of the world
  total (under the current [scope](#coverage--statistics)).
- Tapping a flag opens that country's page. An **airport-only** country (a pure layover) collects no
  flag. A checklist of the flags **still to collect** expands below.
- **Download a world poster** — an on-device PNG that stamps a flag on every visited country, with
  the countries-visited / cities totals. Where the basemap lacks a country's geometry (Kosovo,
  Tuvalu, overseas territories…), it falls back to the coordinates of a place you actually recorded
  there — nothing is invented. The poster is shown as a preview first; downloading is an explicit
  button. Lives as a view inside [Places](#places).

---

## Travel guides

`src/features/guides` · `src/lib/wikivoyage` · spec [`010`](../specs/010-guides-wikivoyage)

Opt-in, privacy-preserving **Wikivoyage / Wikipedia** guides on a place's detail page:

- An **overview card** — a short plain-text extract with a lead photo — prefers the Wikivoyage blurb
  and falls back to Wikipedia (the photo comes from Wikipedia). A **monument** shows *its own*
  article and photo, not the country's flag.
- **Read the whole guide in-app** — the full article as collapsible sections, so you needn't leave
  for the website.
- **Focused links** — the city guide, country guide, the country's "Understand" overview, and a
  **phrasebook per spoken language** (languages from `languages.json`).
- **Opt-in & private** — fetched only when you open a place (the Settings toggle can require a manual
  tap), never tracked, everything treated as inert plain text. Once loaded, overviews and full guides
  are **saved on-device** so they still read offline. An always-working search link is the honest
  fallback when an exact title doesn't match.

The guide code lives under `src/lib/wikivoyage/` as a clean, reusable seam (see its README) intended
to lift into the maintainer's other apps.

---

## Photo galleries

`src/features/visits/PhotoGallery.tsx` · spec [`011`](../specs/011-photo-gallery)

Every logged place (city, country, monument, airport, or your own) can hold **your own photos** — a
postcard, the monument, the view — up to **48 per place**, each with an optional caption. Images are
**downscaled on-device** to a bounded inline data URL, stored locally with the visit, and only ever
leave the device inside an explicit export. A row shows a thumbnail with a count badge; opening the
gallery gives a keyboard-navigable lightbox to page through, caption, add, or remove. Picking more
than the cap adds only enough to fill it and tells you the gallery is full — no photo is silently
lost. Photos render from local storage with no download, even on a fresh offline install.

---

## Backup, import & reset

`src/features/backup` · spec [`001`](../specs/001-cities-countries)

Your data is **one portable, human-readable file** — you own it and it never leaves the device
except on an explicit action.

- **Export data (.json)** — the canonical, versioned backup: visits, trips, stories (with inline
  photos), and reference-source provenance. Delivered through the OS share sheet on native
  (iOS/Android) and mobile web, falling back to a plain download — no proprietary cloud SDK.
- **Export .csv** — a places list (`lat, lon, country, city, been` with `been`/`want`/`fave` tags).
- **Export .md** — a readable Markdown summary of places and trips.
- **Import** understands two things, chosen by **content, not extension**: a **JSON backup** is a
  full **restore** that ⚠ replaces everything on the device (you're asked to confirm); anything else
  is treated as a **places CSV/TSV** and **merged** in (only adds/updates places, never erasing
  trips or stories). All imports are **validated & sanitized with Zod — never executed**.
- **Backup reminder** — a gentle nudge when a backup is overdue, snoozeable, cleared by a real export.
- **Reset** — a danger-zone wipe of everything on the device in one transaction; it has no undo, so
  it makes you **type the word `RESET`** first. (Separately, Settings has a maps-only reset that
  clears tile caches without touching your places.)

The same JSON file powers [Device sync](#device-sync), so the sync repo doubles as a plain backup.
See the [Data Model](Architecture.md#the-zod-schema-and-generated-json-schema) for the schema.

---

## Publish mode

`src/features/publish` · `src/lib/publish` · spec [`012`](../specs/012-journal-publish)

The app stays your **private editor**; Publish mode turns a **slice** of your journal into a
self-contained, read-only **travel-blog website** you can host anywhere — a folder, a USB stick,
GitHub Pages, Netlify, Nextcloud — with no server and no build step.

- **Choose a scope** — everything, one trip, or a date range — with a **live preview** of the exact
  cover, route, steps, and photos that will ship (and an in-modal "Preview book" iframe).
- **A Polarsteps-style book** — a cover with title, dates, and totals (stops, countries, distance);
  a journey map of every step in order with the transport between them, using the bundled offline
  basemap and keeping the Natural Earth / OpenStreetMap credit; and one photo-led page per place.
- **Build a portable bundle** — a single `index.html` with all data, photos, basemap geometry, and
  reader code embedded and addressed by relative paths. It renders fully **offline with zero external
  requests**. A host-facing `README.md` ships alongside.
- **Optional passphrase** — encrypts the payload with **AES-GCM in your browser**; visitors decrypt
  client-side, so it works on a public host like GitHub Pages and the passphrase is never in the
  files (and can't be recovered if lost).
- **Photos are stripped of EXIF/GPS** (already re-encoded on capture) and all text is escaped to
  inert content — a shared page can never run a script.
- **Push to GitHub** is one optional button *behind* the always-available local download; the token
  is held only in memory and never bundled. No analytics unless a self-hoster adds their own.

---

## Device sync

`src/features/settings/SyncSection.tsx` · `src/lib/sync` · spec [`013`](../specs/013-device-sync)

Keep your postcards the same across devices **without a server or an account**, through the portable
JSON file you already own placed in a **git repo** (reusing the same connector as the Publish "push"
button; GitHub is one example).

- **One button** — **Sync now** pulls the shared file, merges it into local data, and pushes the
  result, reporting how many records were **added / updated / removed** across places, trips, and
  stories.
- **Record-level merge** — never a whole-file overwrite. Newest edit wins (each record carries an
  `updatedAt` stamp), and **deletions stick** via tombstones carried in the file, so two devices
  editing offline always converge regardless of who syncs first.
- **Explicit & private** — runs only on tap; no telemetry, no account. The pulled file is validated
  & sanitized exactly like a manual import (inert, never executed); on any failure local data is left
  untouched. The remote config lives on the device (localStorage) and the **token is never written
  into the synced file** or any export. Transport security is the git host's own HTTPS.

---

## Theme, status & language

Three device-local personalizations, each saved only in this browser/app (localStorage):

- **Theme (light / dark / system)** — `ThemeToggle`. A three-option segmented control that follows
  the device or forces light/dark by stamping `data-theme` on `<html>`. The map's basemap palette
  follows the same resolved choice so it never desyncs from the UI.
- **Online / offline indicator** — `ConnectionStatus`. A small always-visible chip in the top bar
  reporting connectivity, using a text label (not colour alone) plus an `aria-live` region for
  accessibility. It drives the map's reconnect prompt and the guides' offline messaging.
- **Language (EN / FR / KO)** — `LanguageToggle`. English, Français, and 한국어, each option labelled
  in its own language. Switching updates every on-screen string live (via the `useT` hook against the
  Zustand settings store) and sets `<html lang>` and the Intl formatter locale. Plural handling is
  per-locale (Korean has no plural inflection).

---

## Also worth knowing

- **Installable & native** — a self-hostable **PWA** (top-bar Install button) and native **iOS /
  Android** via Capacitor (spec [`005`](../specs/005-native-capacitor); see [Native Builds](Development.md)).
- **Offline map packs** — per-region OSM tile downloads with honest tile counts and size estimates
  *before* downloading, cancelable, with a maps-only cache reset ([Settings](#backup-import--reset);
  [Offline Maps](Architecture.md#seam-1--mapsource-the-offline-first-basemap)).
- **Attribution & provenance** — Settings shows the machine-readable list of every reference dataset
  and its license; see [Reference Data](Data-and-Provenance.md) and the repo `PROVENANCE.md` files.
- **How it works** — an in-app explainer modal, reachable from the top bar.

---

*Grounded in the code under `apps/postcards/src/features` and the specs under `specs/`. For deeper
dives see [Architecture](Architecture.md) and [Data and provenance](Data-and-Provenance.md).*
