<div align="center">

# Place'Been

**Remember every place you've been — privately, offline, and forever.**

Place'Been is a local-first, privacy-first app for logging the cities and countries
you've visited and seeing them on a map. No account, no server, no tracking. Your
data lives in one portable file that you own.

_It remembers where you've been — it is **not** a trip planner._

<img src="docs/screenshots/map-desktop.png" alt="Place'Been world map with visited countries highlighted and a live list of cities in view" width="880">

</div>

## Why it's different

- 🔒 **Private by default** — no telemetry, no analytics, no beacons. Nothing leaves your device unless you export it.
- ✈️ **Works fully offline** — the world map and all reference data are bundled. Open it in airplane mode and everything works.
- 📄 **One portable file** — your whole history is a single human-readable JSON file you can back up, diff, or move anywhere. Markdown export for sharing.
- 🌍 **Aggregator, never an author** — every place, boundary, and coordinate comes from named, openly-licensed datasets with recorded provenance. The app invents nothing.
- ⌨️ **Fast & accessible** — keyboard-first, WCAG 2.1 AA, no clutter.
- 🧩 **Zero lock-in** — no Google, no proprietary services. Open, replaceable components only.

## What it looks like

| Map | Stats | Places |
| :---: | :---: | :---: |
| <img src="docs/screenshots/map-mobile.png" alt="Mobile map with visited places and a list of cities in view" width="260"> | <img src="docs/screenshots/stats-mobile.png" alt="Coverage statistics: countries, percent of world, cities, per-continent and per-country breakdowns" width="260"> | <img src="docs/screenshots/places-mobile.png" alt="Browsable country checklist" width="260"> |
| Pan the world; the **cities-in-view** list updates live. One tap marks a place visited. | **Countries, % of the world, cities**, plus per-continent bars and per-country coverage. | Your visited list, or browse the full country checklist and tick places off. |

## Features

- **Log visits fast** — search any city or country (population-ranked, accent-insensitive), or tap it straight on the map. Optional date and note per visit. Duplicates are prevented; every add/remove has one-tap **Undo**.
- **Offline map** — visited countries are shaded, visited cities are dots. Pan and zoom the whole world with no network.
- **Coverage stats** — countries visited and **% of the world**, cities visited, per-continent progress, and for any country both **% of its cities** and **% of its regions** you've reached.
- **Backup & restore** — export everything to one JSON file and re-import it losslessly on any device, or export **Markdown** to share a readable summary. Imports are schema-validated and sanitized — data is parsed, never executed.

## Getting started

Requires [Node.js](https://nodejs.org) 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install                        # from the repo root
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
| Mobile | **Capacitor** for native iOS/Android (one codebase) |
| Map | **MapLibre GL** + bundled Natural Earth geometry, behind a pluggable `MapSource` seam |
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
| `world-countries` | Country → continent grouping | ODbL 1.0 |

Provenance is recorded in [`apps/placebeen/src/lib/reference/data/provenance.json`](apps/placebeen/src/lib/reference/data/provenance.json) and shown in-app.

## Project layout

```
apps/placebeen/          the app (React + TS + Vite → PWA + Capacitor)
  src/features/          visits · map · stats · backup
  src/lib/               schema (Zod) · db (IndexedDB) · store (Zustand)
                         reference (datasets) · map-source · format
  public/                bundled basemap + reference data
specs/001-cities-countries/   the MVP spec, plan, tasks, and contracts
.specify/                Spec Kit workflow, templates, and the constitution
docs/                    screenshots, UX backlog
```

This repo is a pnpm workspace; shared ecosystem packages will live in `packages/` later.

## Status & roadmap

The **cities-and-countries MVP is runnable today** — logging, offline map, coverage stats, and
single-file backup/restore all work, covered by 53 unit tests plus Playwright e2e (smoke,
accessibility, keyboard-only, and a zero-network privacy check).

Planned next:

- **Full region data** beyond France (Natural Earth Admin 1) so per-country region coverage is exact everywhere.
- **Street-level offline basemap** (PMTiles / OpenStreetMap) behind the existing `MapSource` seam.
- **Native iOS/Android** wiring via Capacitor (currently config-only) and a device-global, cross-app **Offline Map Store**.

## How it's built

Place'Been is developed with **Spec-Driven Development** using
[GitHub Spec Kit](https://github.com/github/spec-kit): every feature flows through
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. The MVP spec
and its plan live in [`specs/001-cities-countries/`](specs/001-cities-countries/), and the
project's non-negotiable principles are in
[`.specify/memory/constitution.md`](.specify/memory/constitution.md).

## License

Open source for personal, non-commercial use. A specific license file is still to be added.
