# Postcards

**A privacy-first, local-first aggregator for remembering the places you've been.**

Search a city, country, airport, or monument you've visited, tap to mark it, and
watch your map fill in. No account, no server, no tracking — your whole history
lives in one portable file you own.

> Postcards remembers **where you've been**. It is deliberately **not a trip
> planner**, a booking tool, or a tracker.

Postcards is one member of a wider ecosystem of the maintainer's Capacitor apps.
It ships as a self-hostable PWA (React 19 + TypeScript + Vite), wrapped as native
iOS/Android via Capacitor, with an offline MapLibre map, IndexedDB working store,
Zustand state, and Zod-validated data.

---

## The wiki

Nine pages, each with one home for its topic. Start here, then follow the thread
you need.

| Page | What's on it |
| --- | --- |
| **Home** (this page) | What Postcards is, the constitution in brief, and a tour of the screens. |
| [Features](Features.md) | Everything the app does today, screen by screen and feature by feature. |
| [Architecture](Architecture.md) | The tech stack, the workspace layout, and the seams (`MapSource`, schema, stores, sync) that keep the constitution enforceable in code. |
| [Data and provenance](Data-and-Provenance.md) | Every named, openly-licensed dataset, its license, and how provenance is recorded and surfaced. |
| [Privacy and the Constitution](Privacy-and-Constitution.md) | The eight non-negotiable principles and the code and tests that make each one real. |
| [Publishing](Publishing.md) | Turning a slice of your journal into a self-contained, read-only travel-blog site. |
| [Device sync](Device-Sync.md) | Server-less phone ↔ laptop sync through the one portable file. |
| [Development](Development.md) | Clone, install, run, test, self-host — and the Spec-Driven Development workflow. |
| [Roadmap](Roadmap.md) | An honest account of what is shipped, partial, spec-only, and out of scope. |

New here? Read this page, then [Features](Features.md) for what it does and
[Architecture](Architecture.md) for how it is built.

---

## What Postcards is

Postcards **aggregates** your travel memories and **displays them well**. It is
an aggregator, never an author: every place, boundary, and coordinate comes from
a named, openly-licensed external dataset with recorded provenance — the app
invents no reference data. What it adds is *your* layer: which of those places
you've been, when, with a note and a photo, plus the trips between them and the
stories about them.

Because everything is local-first, the device is the source of truth. There is
no server and no account; the app works fully offline (the map and all reference
data are bundled), and nothing leaves your device unless you explicitly export
it. Your entire history is a single human-readable JSON file — back it up, diff
it, or move it to another device losslessly.

Country coverage is **derived, not authored**: visiting a city (or a monument)
counts its country. There is no separate per-country record to maintain — a
country is "visited" simply because you logged a place inside it. (Airports are
the exception: changing planes is not being there, so they never make a country
count as visited.)

## The constitution, in brief

The project's non-negotiable principles live in
`.specify/memory/constitution.md`. Every feature and plan must pass a
Constitution Check. See [Privacy and the Constitution](Privacy-and-Constitution.md)
for the full text and where each principle is made real in code; in brief:

| Principle | What it means |
| --- | --- |
| **Aggregator, never an author** | All world facts come from named, openly-licensed datasets with provenance. Missing data becomes a separate shareable dataset, never app code. |
| **Local-first & fully decentralized** | No server, no account. Works offline. The device is the source of truth. |
| **Privacy by default** | No telemetry, no analytics, no beacons. Data leaves the device only on explicit user action. |
| **One portable, human-readable file** | JSON source of truth (plus Markdown export), with a documented, versioned schema. |
| **Zero lock-in** | No Google or proprietary dependencies — open, replaceable, self-hostable components only. |
| **Security by design — data is inert** | Imports are schema-validated and sanitized, parsed but never executed. |
| **Efficient, accessible, keyboard-first** | WCAG 2.1 AA, keyboard shortcuts, regional adaptivity. |
| **Interoperable & AI-friendly** | Open, versioned, documented formats. |

An ecosystem constraint sits alongside these: offline maps must be
**device-global / cross-app**, never locked to app-private storage. The map is
consumed only through the `MapSource` seam, and tiles are never read from
hard-coded app-private paths. See
[Architecture](Architecture.md#seam-1--mapsource-the-offline-first-basemap).

## A quick tour of the screens

The app has a five-section bottom nav — **Map, Places, Trips, Journal, Stats** —
with **Settings** and "How it works" in the top bar. **Passport** and **Moments**
are collections that live as views inside **Places** (they're collections of
places, not destinations of their own). A global search box sits in the top bar
on every screen; picking a city flies the map there.

Each section has a keyboard shortcut (`1`–`5`, or the initial letter), `/`
focuses search, `?` opens the shortcuts help, and the phone Back gesture retraces
your own steps rather than quitting the app. The full breakdown is on the
[Features](Features.md) page; a taste follows.

### Map
The offline world map. Visited countries are shaded, visited cities show as
flag + population pills, and airports you've flown through show as ✈ pills; a
live "cities in view" list updates as you pan. One tap flips the flat map to a
spinnable **3D globe**, where trips arc across the sphere as great circles. Prefer
streets? An **opt-in online OpenStreetMap** detail map is one tap away — offline
stays the default. MapLibre is code-split so it loads only when the map is first
shown, and it stays mounted (hidden) thereafter to keep its camera and tiles.
See [Features → The map](Features.md#the-map).

### Places
Everything place-shaped, one view each: **Visited**, **Favorites**, **Wishlist**,
**Monuments**, and a full **Countries** checklist. Rows carry a date, note,
photos, a favorite star, and a guide button. A year filter narrows the visited
list. Two collections sit in their own cluster here: **Moments** and the
**Passport**. See [Features → Places](Features.md#places).

### Trips
The travel log: journeys you've actually taken (flight, train, bus, ferry, car)
between two places. Each trip's **great-circle distance** is derived from its
endpoints' coordinates; totals roll up trips + kilometres + a per-mode breakdown,
and you can **filter by year and month** — the list, the totals, and the map's
trip arcs all narrow together. You can **import a flight from a boarding pass**
(scan the barcode or paste the code) — the IATA BCBP is decoded on-device. A log
of past travel, not a planner. See
[Features → Trips & boarding-pass import](Features.md#trips--boarding-pass-import).

### Journal
A mini travel blog: dated, titled stories about places you've been, each with its
own little photo gallery. The composer opens ready to write with today's date
filled in, guards against losing writing when you leave the page, and near
midnight asks which day the story is really about. A separate **Publish** mode
turns a slice of the journal into a self-contained travel-blog site. See
[Features → Journal](Features.md#journal) and [Publishing](Publishing.md).

### Moments
A curated list of once-in-a-lifetime world experiences — see the northern lights,
cross the equator, stand before the Pyramids — that you live somewhere rather than
own on a map. Check the ones you've lived; flag the ones you dream of. Each moment
links to a few real anchor places (tapping one flies the map there) and is stored
as a normal record in your portable file. Moments carry the neutral `ZZ` code and
never count toward country stats. Reached via **Places → Moments** (or the `x`
shortcut). See [Features → Moments](Features.md#moments).

### Passport
Your flag collection — one flag per visited country, derived from the places
logged inside each country — arranged like the pages of a real passport, grouped
by continent with per-continent progress. A downloadable **world-poster PNG** is
rendered entirely on-device. Reached via **Places → Passport** (or the `f`
shortcut). See [Features → Passport & world poster](Features.md#passport--world-poster).

### Stats
Your coverage: countries visited and **% of the world**, cities visited, travel
totals, and per-continent progress. You **choose what counts as a country** —
sovereign UN member states only, or including dependent territories — and the
count, denominators, and checklists all follow that pick. For each country you
see the **% of its cities** you've reached and the **% of its first-level
regions** (states/provinces). Wishlisted places never inflate coverage. See
[Features → Coverage & statistics](Features.md#coverage--statistics).

### Settings
What counts as a country (the sovereignty scope), offline map packs (with honest
tile counts and size estimates shown *before* you download), theme, language
(English, French, Korean), guide auto-load, the online map toggle, marker cap,
device sync, and your data — export/import front and centre. See
[Features → Backup, import & reset](Features.md#backup-import--reset) and
[Features → Theme, status & language](Features.md#theme-status--language).

---

## Tech at a glance

| Area | Choice |
| --- | --- |
| App | TypeScript + React 19 (Vite), shipped as a self-hostable **PWA** |
| Mobile | **Capacitor** wraps the same web build as native iOS/Android |
| Map | **MapLibre GL** behind a pluggable `MapSource` seam: bundled offline overview + opt-in OpenStreetMap detail + PMTiles |
| Storage | **IndexedDB** working store; canonical portable file is **JSON** (+ Markdown export) |
| Validation | **Zod** schema; inert-data import rules |
| State | **Zustand** · **Tests**: Vitest + Playwright + axe-core |
| License | **AGPL-3.0-or-later** |

For how these fit together, start with [Architecture](Architecture.md); for the
principles behind them, read [Privacy and the Constitution](Privacy-and-Constitution.md).
