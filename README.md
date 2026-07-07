<div align="center">

# Place'Been

**Remember every place you've been — privately, offline, in a file you own.**

Search a city or country you've visited, tap to mark it, and watch your map fill
in. No account, no server, no tracking.

_Place'Been remembers where you've been — it is **not** a trip planner._

<img src="docs/screenshots/map-desktop.png" alt="Place'Been world map with visited countries highlighted and a live list of cities in view" width="880">

</div>

## Why Place'Been

- 🔒 **Private by default** — no telemetry, no analytics, no beacons. Nothing leaves your device unless you export it.
- ✈️ **Works offline by default** — the map and all reference data are bundled; open it in airplane mode and everything works. An online detail map is available, opt-in.
- 📄 **One portable file you own** — your whole history is a single human-readable file: back it up, diff it, or move it anywhere.
- 🌍 **Aggregator, never an author** — every place, boundary, and coordinate comes from named, openly-licensed datasets with recorded provenance. The app invents nothing.
- ⌨️ **Fast & accessible** — keyboard-first, WCAG 2.1 AA, no clutter.
- 🧩 **Zero lock-in** — no Google, no proprietary services. Open, replaceable, self-hostable components only.

## What it looks like

| Map | Stats | Places |
| :---: | :---: | :---: |
| <img src="docs/screenshots/map-mobile.png" alt="Mobile map with visited cities shown as flag and population pills, plus a live list of cities in view" width="250"> | <img src="docs/screenshots/stats-mobile.png" alt="Coverage statistics: countries, percent of world, cities, per-continent and per-country breakdowns" width="250"> | <img src="docs/screenshots/places-mobile.png" alt="Places screen with Visited, Wishlist, and Countries segments" width="250"> |
| Visited cities show as flag + population pills; the cities-in-view list updates live. | Your coverage at a glance. | What you've visited, a wishlist, or the full country checklist. |

## Features

- **Log visits — or wishlist them** — search any city, country, or **airport** (by name or IATA code, e.g. `CDG`) — population-ranked, accent-insensitive — or tap it straight on the map. Save places you *want* to go to a **wishlist**, and **star** your favorites. Optional date and note per visit; duplicates are prevented; every add or remove has one-tap **Undo**.
- **Offline map** — visited countries are shaded, visited cities show as flag + population pills, and airports you've been through show as ✈ pills; pan and zoom the whole world with no network. Prefer streets? One tap switches to an **opt-in online OpenStreetMap** detail map — offline stays the default.
- **Coverage stats** — countries visited and **% of the world**, cities visited, and per-continent progress. For each country you see the **% of its cities** you've reached — plus the **% of its first-level regions** (states/provinces), now covering countries **worldwide**. Wishlisted places never inflate your coverage.
- **Travel log** — record journeys you've actually taken (flight, train, bus, ferry, car) between two places; each trip's **great-circle distance** is derived from the endpoints' coordinates, trips are drawn as **arcs on the map**, and totals roll up trips + kilometres + a per-mode breakdown. **Import a flight from a boarding pass** — scan its barcode or paste the code, and the IATA **BCBP** is decoded **on-device** into a trip. A log of past travel, not a planner.
- **Backup & restore** — export everything to one JSON file and re-import it losslessly on any device, or export **Markdown** to share a readable summary. Imports are schema-validated and sanitized: data is parsed, never executed.

## Getting started

Requires [Node.js](https://nodejs.org) 20+ and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/davd-gzl/place-been.git
cd place-been
pnpm install
pnpm --filter placebeen dev         # run the app at http://localhost:5173
```

Other useful scripts:

```bash
pnpm --filter placebeen test        # unit tests (Vitest)
pnpm --filter placebeen test:e2e    # browser e2e (Playwright): smoke, a11y, keyboard, privacy
pnpm --filter placebeen build       # production PWA build
```

## Tech stack

| Area | Choice |
| --- | --- |
| App | TypeScript + React (Vite), shipped as a self-hostable **PWA** |
| Mobile | **Capacitor** wraps the same web build as native iOS/Android — config + Android project + scripts committed ([`docs/NATIVE-BUILDS.md`](docs/NATIVE-BUILDS.md)); signed builds need a Mac / Android SDK |
| Map | **MapLibre GL** behind a pluggable `MapSource` seam: bundled Natural Earth overview (offline default) + opt-in OpenStreetMap detail |
| Storage | **IndexedDB** working store; canonical portable file is **JSON** (+ Markdown export) |
| Validation | **Zod** schema; inert-data import rules |
| State | **Zustand** · **Tests**: Vitest + Playwright + axe-core |

## Reference data

All world facts come from named, openly-licensed datasets — the app authors none of them.

| Dataset | Used for | License |
| --- | --- | --- |
| ISO 3166-1 (via `i18n-iso-countries`) | Country list (~250) | MIT / public codes |
| Natural Earth (via `world-atlas`) | Country boundaries on the map | Public Domain |
| GeoNames (via `all-the-cities`) | City gazetteer — **24,323** cities, population ≥ 15k, real GeoNames IDs | CC BY 4.0 |
| GeoNames admin-1, named via `countries-states-cities` | First-level regions (states/provinces) worldwide — **2,661** regions for per-country region coverage | CC BY 4.0 / ODbL 1.0 |
| OpenFlights (via `airport-data`, aggregated from OurAirports) | Airports — **5,609** IATA-coded airports worldwide, real coordinates | ODbL 1.0 / OurAirports public domain |
| `world-countries` | Country → continent grouping (baked into `continents.json`) | ODbL 1.0 |

Provenance is recorded in [`apps/placebeen/src/lib/reference/data/provenance.json`](apps/placebeen/src/lib/reference/data/provenance.json) and shown in-app.

## Project layout

```
apps/placebeen/          the app (React + TS + Vite → PWA + Capacitor)
  src/features/          visits · map · stats · travel · backup
  src/lib/               schema (Zod) · db (IndexedDB) · store (Zustand)
                         reference (datasets) · map-source · format
  public/                bundled basemap + reference data
specs/001-cities-countries/   the MVP spec, plan, tasks, and contracts
.specify/                Spec Kit workflow, templates, and the constitution
docs/                    screenshots, UX backlog
```

This repo is a pnpm workspace; shared ecosystem packages will live in `packages/` later.

## Status & roadmap

The **cities-and-countries MVP is runnable today** — logging, the offline map, coverage stats, and
single-file backup/restore all work, covered by a unit-test suite plus Playwright e2e (smoke,
accessibility, keyboard-only, and a zero-network privacy check).

Recently shipped:

- **Worldwide region coverage** — per-country **% of first-level regions** now works everywhere (GeoNames admin-1, named via a nearest-centroid crosswalk), not just one country.
- **Airports as a place type** — log airports you've flown through by name or IATA code; they show as distinct ✈ pills on the map and in your totals, and count toward country coverage (see [`specs/002-place-types/`](specs/002-place-types/)). The place model is now generalized, so further types are drop-in datasets.
- **Travel log** — a **Trips** tab records past journeys with a derived great-circle distance and totals (see [`specs/003-travel-log/`](specs/003-travel-log/)); trips are drawn as **great-circle arcs on the map**, live in the same portable file, and export to Markdown. **Import a flight from a boarding pass** — scan the barcode or paste the code; the IATA BCBP is decoded on-device (see [`specs/006-boarding-pass/`](specs/006-boarding-pass/)).
- **Offline street-map seam + downloadable maps** — a street-level **offline** vector basemap via the `pmtiles://` protocol behind a device-global **`OfflineMapStore`** ([`docs/OFFLINE-MAPS.md`](docs/OFFLINE-MAPS.md), [`specs/004-offline-map-seam/`](specs/004-offline-map-seam/)); the online OpenStreetMap basemap can be **saved for offline** area-by-area. Nothing is bundled app-private, per the constitution.
- **Refined design + dark mode** — a considered palette, Space Grotesk display type, boarding-pass motifs, and automatic light/dark theme (the offline map follows it too).

Planned next:

- **More place types** — UNESCO World Heritage sites and national parks, once their openly-licensed datasets are vendored (their upstream feeds are network-restricted in CI, so they wait for the dataset, not the code).
- **Shared Offline Map Store plugin** — the native `SharedOfflineMapStore` (iOS App Group / Android SAF) behind the seam above, so one map pack serves every app in the ecosystem.
- **Native iOS/Android** builds via Capacitor (scaffolding + docs in place; signed builds need a Mac / Android SDK).

## How it's built & contributing

Place'Been is developed with **Spec-Driven Development** using
[GitHub Spec Kit](https://github.com/github/spec-kit): every feature flows through
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. The MVP spec and
its plan live in [`specs/001-cities-countries/`](specs/001-cities-countries/), and the project's
non-negotiable principles are in
[`.specify/memory/constitution.md`](.specify/memory/constitution.md).

Issues and pull requests are welcome — please start from a spec (and keep changes aligned with the
constitution) rather than opening code-first PRs.

## License

[**GNU Affero General Public License v3.0 or later**](LICENSE) (`AGPL-3.0-or-later`).

You're free to use, study, share, and modify Place'Been. The AGPL's one condition is
**reciprocity**: if you distribute a modified version — or run one as a network service others can
use — you must offer those users the corresponding source under the same license. That keeps every
fork and hosted copy as open, inspectable, and lock-in-free as this one, which is the whole point of
a privacy-first app you're meant to be able to trust and self-host.

The reference datasets keep their own upstream licenses (see [Reference data](#reference-data)); the
AGPL covers Place'Been's own code.
