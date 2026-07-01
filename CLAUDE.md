# CLAUDE.md — Place'Been

Guidance for Claude Code (and contributors) working in this repo.

## What this is

Place'Been is a **privacy-first, local-first aggregator for remembering places you've been**
(cities, countries, and later more). It stores your visits and displays them well — it is **not** a
trip planner. One member of a wider ecosystem of the maintainer's Capacitor apps.

## Non-negotiables (see `.specify/memory/constitution.md`)

- **Aggregator, never an author** — all world facts come from named, openly-licensed external
  datasets with recorded provenance; the app invents no reference data. Missing data → a separate
  shareable dataset, not app code.
- **Local-first & fully decentralized** — no server, no account; works offline; the device is the
  source of truth.
- **Privacy by default** — no telemetry; data leaves the device only on explicit user action.
- **One portable, human-readable file** — JSON source of truth (+ Markdown export), documented
  versioned schema.
- **Zero lock-in** — no Google/proprietary deps; open, replaceable components only.
- **Security by design — data is inert** — imports are validated & sanitized, never executed.
- **Efficient, accessible, keyboard-first** — WCAG 2.1 AA; shortcuts; regional adaptivity.
- **Interoperable & AI-friendly** — open, versioned, documented formats.

## Tech baseline (ratified)

- **Web-first, one codebase**: TypeScript + React (Vite) → self-hostable PWA + native iOS/Android
  via **Capacitor**. Desktop later via Tauri.
- **Maps**: MapLibre GL JS + **PMTiles** (offline single-file tiles), no Google. Tiles from
  Protomaps/OpenStreetMap (ODbL). Consumed only through the `MapSource` seam.
- **Reference data**: Natural Earth (Admin 0/1, public domain) + GeoNames (cities, CC BY 4.0).
- **Storage**: IndexedDB working store; canonical portable file is JSON. Reference vs personal data
  kept strictly separate.
- **Validation**: Zod → generated JSON Schema; inert-data import rules.
- **State**: Zustand. **Tests**: Vitest + Playwright + axe-core.

## Ecosystem constraint

Offline maps must be **device-global / cross-app**, never locked to app-private storage. The MVP
uses a bundled world-overview basemap behind the `MapSource` interface; a future reusable **Offline
Map Store** Capacitor plugin (App Group on iOS, SAF/content-provider on Android) implements the same
seam. Never read tiles by hard-coded app-private paths.

## Workflow (Spec-Driven Development via GitHub Spec Kit)

Every feature: `/speckit-specify` → (`/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement`. No implementation without an approved spec + plan. Each plan must pass the
Constitution Check.

- Active feature: **`specs/001-cities-countries/`** (MVP: log cities/countries, offline map, stats
  incl. both %-of-cities and %-of-regions per country, single-file backup/restore). See its
  `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.
- Out of scope for the MVP: extra place types, ticket logs, Wikivoyage, downloadable map packs, the
  shared Offline Map Store implementation, comparisons/leaderboards, tracking, P2P, AI suggestions.

## Planned structure (workspace)

`apps/placebeen/` (the app) with `src/features/{visits,map,stats,backup}` and
`src/lib/{store,db,schema,reference,map-source,format}`; `public/{basemap,reference}` for bundled
assets; `packages/` reserved for shared ecosystem packages. No code exists yet — the repo currently
holds Spec Kit scaffolding and the feature's spec/plan.
