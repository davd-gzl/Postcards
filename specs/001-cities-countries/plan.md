# Implementation Plan: Cities & Countries Core (MVP)

**Feature Directory**: `specs/001-cities-countries` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-cities-countries/spec.md`

## Summary

Deliver the first vertical slice of Place'Been: let a user log visited cities and countries,
see them on a fully-offline map, get instant coverage statistics (countries, % of world, cities,
and — per country — both % of cities and % of regions), and back up/restore everything as one
portable file. Built web-first (React + TypeScript) as a single codebase that runs as a
self-hostable PWA and wraps to native iOS/Android via Capacitor. Maps use MapLibre GL + a bundled
world-overview PMTiles basemap consumed through a pluggable `MapSource` seam, so a later
device-global shared map store drops in without app changes. All reference facts come from named,
openly-licensed datasets (Natural Earth, GeoNames, Protomaps/OSM); the app authors none of them.
The portable file is JSON validated against a published, versioned schema (never executed), with a
Markdown export for sharing.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Node 20 (build/tooling only)

**Primary Dependencies**: Vite (build), MapLibre GL JS + `pmtiles` (maps/offline tiles), `idb`
(IndexedDB wrapper), Zod (runtime validation + TS types; JSON Schema generated from it),
Zustand (small state store), `vite-plugin-pwa` (service worker/manifest), Capacitor (native
iOS/Android: Filesystem, Share, App-launcher plugins). No Google, no proprietary SDKs.

**Storage**: On-device IndexedDB is the working store; the canonical **portable file is a single
JSON document** (export/import, full-fidelity restore). Reference datasets are bundled read-only
and kept separate from user data. Markdown export for human sharing.

**Testing**: Vitest (unit: stats math, schema validation/sanitization, import/export round-trip),
Playwright (e2e/integration, offline scenarios) with `@axe-core/playwright` for automated
WCAG 2.1 AA checks. Chromium is preinstalled in this environment.

**Target Platform**: Modern browsers (PWA, self-hostable) + iOS 15+ / Android 10+ via Capacitor.
Desktop (Tauri) is architecture-compatible but out of scope for the MVP.

**Project Type**: Local-first web/mobile application (single codebase), organized as a workspace
so shared ecosystem packages (e.g. the future Offline Map Store) can be added later.

**Performance Goals**: Log a visit in <5s end-to-end; statistics update <1s on ≥10k visits; map
interactions feel instantaneous; app shell + world map usable fully offline on first launch.

**Constraints**: Fully offline-capable for all core actions; zero telemetry; zero outbound
network carrying user data; data files strictly inert (parsed, never evaluated); WCAG 2.1 AA;
bundled world-overview basemap kept small (overview zoom only).

**Scale/Scope**: MVP screens: Map, Add/Search, Visits list, Statistics, Backup/Restore.
Reference data on the order of ~250 countries/territories, ~4k first-level subdivisions, and a
bounded city gazetteer (population-thresholded, ~25k). Personal history designed to stay fast to
tens of thousands of visits.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Aggregator, never an author | All world facts come from named external datasets (Natural Earth, GeoNames, Protomaps/OSM) with recorded provenance; app stores only user visits, never invents reference facts; missing places point to the external dataset | ✅ PASS |
| II | Local-first & decentralized | IndexedDB + single-file store; no account, no backend, no network required; works offline | ✅ PASS |
| III | Privacy by default | No telemetry/analytics; data leaves device only on explicit export/share; no network in core flows | ✅ PASS |
| IV | One portable, human-readable file | Canonical JSON export/import with full-fidelity restore + Markdown export; documented versioned schema | ✅ PASS |
| V | Zero lock-in / no proprietary deps | React, MapLibre, PMTiles, Natural Earth, GeoNames all open & replaceable; no Google; no paid APIs | ✅ PASS |
| VI | Security by design — data is inert | Zod schema validation + sanitization on every import; parse-only, no `eval`/dynamic execution; adversarial import tests | ✅ PASS |
| VII | Efficient, accessible, keyboard-first | Keyboard shortcuts for core actions; WCAG 2.1 AA target enforced with axe-core; Intl-based regional formatting | ✅ PASS |
| VIII | Interoperable & AI-friendly | Published JSON Schema (generated from Zod), versioned stable format, Markdown export | ✅ PASS |
| — | Technology Constraints | Matches ratified baseline (web-first, React+TS, Capacitor, MapLibre+PMTiles, JSON+MD) | ✅ PASS |
| — | Ecosystem & shared offline maps | Maps consumed via `MapSource` interface; MVP backs it with bundled assets but makes **no app-private assumption**, so the device-global shared Offline Map Store implements the same seam later | ✅ PASS |

**Result**: No violations. Complexity Tracking below is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-cities-countries/
├── plan.md              # This file
├── research.md          # Phase 0: decisions (datasets, storage, schema, map seam)
├── data-model.md        # Phase 1: entities, fields, relationships, validation
├── quickstart.md        # Phase 1: runnable validation guide
├── contracts/           # Phase 1: portable-file schema, MapSource, reference-data shapes
│   ├── portable-data-file.md
│   ├── map-source.md
│   └── reference-data.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (passing)
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

A lightweight **pnpm workspace** so ecosystem-shared packages can be added later at low cost.
For the MVP, one app; the map-source seam lives in the app but is structured to extract into
`packages/offline-map-store` when that follow-up feature begins.

```text
apps/placebeen/
├── src/
│   ├── features/
│   │   ├── visits/          # log/search/list visits, dedupe
│   │   ├── map/             # MapLibre view, visited layers (points + choropleth)
│   │   ├── stats/           # coverage math: countries, %world, cities, %cities, %regions
│   │   └── backup/          # export/import (JSON) + Markdown export
│   ├── lib/
│   │   ├── store/           # Zustand store (in-memory) over IndexedDB
│   │   ├── db/              # idb persistence for user data
│   │   ├── schema/          # Zod models + generated JSON Schema for the portable file
│   │   ├── reference/       # loaders for countries, subdivisions, city gazetteer
│   │   ├── map-source/      # MapSource interface + BundledPmtilesMapSource impl
│   │   └── format/          # Intl-based number/percent/date formatting
│   ├── ui/                  # shared components, keyboard-shortcut + a11y primitives
│   └── app/                 # routes/pages, shell, PWA registration
├── public/
│   ├── basemap/             # world-overview .pmtiles + MapLibre style + glyphs/sprites
│   └── reference/           # bundled openly-licensed datasets + PROVENANCE.md
├── ios/                     # Capacitor iOS project
├── android/                 # Capacitor Android project
└── tests/
    ├── unit/                # Vitest
    └── e2e/                 # Playwright (+ axe-core), incl. offline & adversarial-import
packages/                    # (reserved) future shared ecosystem packages
```

**Structure Decision**: Workspace with a single MVP app under `apps/placebeen`. Reference data and
basemap are bundled under `public/` and kept strictly separate from user data. The `map-source`
and (future) shared-store boundary is captured now via the `MapSource` interface so no app-facing
change is needed when the device-global Offline Map Store package lands.

## Complexity Tracking

> No Constitution Check violations — this table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
