# Glossary — Postcards

A shared vocabulary for the Postcards project: the domain terms, the data model, and
the tech seams. Terms are grouped; within a group they're alphabetical. When a word in a
definition is itself defined here, it's written in `code style` on first use.

> Postcards is a **privacy-first, local-first aggregator for remembering places you've
> been** — it stores your visits and displays them well. It is **not** a trip planner.

---

## Principles (the constitution)

- **Aggregator, never an author** — every world/reference fact comes from a named,
  openly-licensed external dataset with recorded provenance. The app invents no reference
  data; missing data is flagged honestly (or shipped as a separate dataset), never faked.
- **Local-first** — no server, no account. The device is the source of truth; the app
  works fully offline.
- **Privacy by default** — no telemetry. Data leaves the device only on an explicit user
  action (see `egress`).
- **Inert data** — imported files are validated and sanitized, never executed. Data is
  displayed, never run.
- **One portable file** — the canonical export is a single human-readable `JSON` file
  (plus a Markdown export), against a documented, versioned `schema`.
- **Zero lock-in** — open, replaceable components only; no Google/proprietary
  dependencies.
- **Accessible & keyboard-first** — WCAG 2.1 AA, full keyboard operability, `i18n`.

---

## Personal data (what you record)

- **Visit** — one personal record about a `place`: its `status`, plus optional `date`,
  `note`, `photos`, `folder`, and `favorite` flag. The unit the whole app slices and
  counts.
- **Status** — a visit's state: **visited** (been there), **wishlist** / **want-list**
  (want to go), or, for filtering only, **unvisited** (not marked). A place is never both.
- **Place / PlaceRef** — a reference to somewhere, tagged by `kind`. The four kinds:
  - **city** — a gazetteer city (GeoNames).
  - **country** — a country. Never marked visited directly; see `derived-visited`.
  - **heritage** / **monument** — a UNESCO World Heritage site.
  - **airport** — an airport, keyed by its `IATA` code.
  - **custom** — a user-invented place (its own coordinates + name), added from the map.
- **Favorite** — a ♥ flag on a visit; Favorites is also a saved view in Places.
- **Folder / trip** — a free-text label grouping visits (e.g. "Japan 2024"). On the map a
  trip can also draw arcs between its places.
- **Note** — free text on a visit ("what do you remember?"). Multi-line; capped at 2000
  chars; round-trips through the portable `JSON`.
- **Photo / postcard** — an image attached to a visit, with an optional caption.
  Downscaled on-device, stored locally, and only ever leaves the device inside an explicit
  export.
- **Story** — a journal entry: a dated, titled piece of writing tied to a `place`. The
  Journal is the feed of stories.

---

## Reference data (the world facts the app aggregates)

- **Gazetteer** — the bundled ~135k-city dataset (GeoNames). Scanned by `viewport` logic
  to decide which cities fall in view.
- **GeoNames** — cities dataset (CC BY 4.0). Source of city names, coordinates, population.
- **Natural Earth** — public-domain country (Admin 0) and subdivision (Admin 1) borders.
- **UNESCO World Heritage** — the source list for `heritage`/monument places.
- **ISO2** — a country's two-letter code (e.g. `FR`). Used to join places to countries.
- **IATA** — an airport's three-letter code (e.g. `CDG`). The `airport` place id.
- **Region / subdivision** — a first-level admin area within a country (Admin 1), e.g. a
  state or province.
- **Derived-visited** — a country counts as visited **because you visited a `place` inside
  it**. Coverage is derived, never a standalone country record (aggregator rule).
- **Provenance** — the recorded source + license for each reference dataset.

---

## Map

- **MapLibre GL** — the open map renderer (no Google).
- **PMTiles** — a single-file offline tile format. The offline basemap ships as one file.
- **Basemap** — the base map tiles under the markers (offline vector, or online OSM
  detail). Chosen behind the `MapSource` seam.
- **MapSource** — the interface (seam) the app reads tiles through, so the tile backend is
  swappable (bundled basemap now; a device-global `Offline Map Store` later).
- **Offline Map Store** — a planned reusable Capacitor plugin holding offline tiles
  **device-globally / cross-app** (App Group on iOS, SAF on Android) — never in
  app-private storage.
- **Mode** — the map's place-kind switch: **all / cities / monuments / airports**. Changes
  the whole dataset shown, so it's a first-class pill, not a filter row.
- **Marker** — a dot/flag on the map. Your `visit` markers (visited flags, want-list dots)
  are always drawn; **browse dots** are discoverable places you haven't marked yet.
- **Browse dots** — the capped set of not-yet-marked cities painted for discovery. Capped
  so they never crowd out your own markers ("two counters": your places uncapped vs.
  discoverable places capped).
- **In-view list** — the list beside/below the map, in lock-step with the markers: the
  same `viewport` scan feeds both, so they never disagree.
- **Viewport** — the current map bounds. `viewport.ts` scans the `gazetteer` (via a 1°
  spatial grid) to find the in-view cities efficiently.
- **Optimize markers** — collapse your visited cities to one representative per area
  (zoom-aware) so a zoomed-out map stays readable.
- **Trip arcs** — great-circle lines drawn between a `trip`'s places.

---

## Filter (spec 016 — one shared filter)

- **Shared filter state** — the ONE `useFilters` store every screen reads, so the map, the
  Places lists, and the counters can never disagree.
- **FilterPanel** — the single dialog that hosts every slicing dimension (status,
  population, date, folder, sort, growth dims). Opened from one "Filter" control.
- **Status filter** — **multi-select**: any combination of visited / want-list /
  not-visited. Empty (or all three) = show everything.
- **Population threshold** — minimum city headcount (any / 10k+ / 100k+ / 1M+). Gates
  cities only.
- **Date window** — any / a year / a precise from–to range / undated-only.
- **Chips / FilterSummary** — the compact removable summary of the active filters, with a
  one-tap Clear all.
- **Growth dimensions** — record-only filters (favorites-only, has-photo, has-note,
  continent) that act on saved visits.

---

## Stats

- **Coverage** — how much of a set you've seen, as a progress bar.
- **% of cities** — visited cities ÷ the country's gazetteer city count.
- **% of regions** — visited regions ÷ the country's subdivision count.
- **Passport** — the countries view: which countries you've entered (derived), foldable
  into Places.

---

## Storage & format

- **IndexedDB** — the on-device working store for visits, photos, stories, settings.
- **Portable JSON** — the canonical, human-readable, versioned export/import file.
- **Schema** — the Zod-defined shape of the data; generates a JSON Schema and drives
  inert-import validation.
- **Backup / restore** — export the portable file / re-import it. The durability nudge
  reminds you to back up.
- **Publish / reader** — an exported, read-only static page of your places (a "reader"),
  shareable as a self-contained file.
- **Egress** — any outbound network request. Off by default; gated behind explicit opt-in
  (online basemap, Wikivoyage fetch). Offline mode blocks all optional egress.
- **Locked journal** — an optionally passphrase-encrypted journal (crypto at rest).
- **Sync token** — a credential for optional sync; excluded from device backups.

---

## Wikivoyage seam (opt-in online guides)

- **Guides** — Wikivoyage/Wikipedia overviews and links shown on a `place`'s detail
  screen. Opt-in online; degrades gracefully offline; saved offline once fetched.
- **Phrasebook** — a Wikivoyage language phrasebook link (alphabet, key phrases).

---

## Tech baseline

- **PWA** — the installable, offline-capable web app (the primary form).
- **Capacitor** — the wrapper shipping the one codebase as native iOS/Android.
- **Zustand** — the state-management library (the stores: `useVisits`, `useFilters`,
  `useSettings`, `useUi`, …).
- **Vite** — the build tool/bundler.
- **i18n parity** — every UI string key must exist in **en + fr + ko**; a missing key
  fails the build (compile-time parity). Verified by a unit test.
- **Vitest / Playwright / axe-core** — unit tests / end-to-end tests / accessibility gate.
- **WCAG 2.1 AA** — the accessibility bar the app commits to.
