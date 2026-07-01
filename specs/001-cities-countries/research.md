# Phase 0 Research: Cities & Countries Core (MVP)

Decisions that resolve the Technical Context. Format per decision: **Decision / Rationale /
Alternatives considered**. All choices are checked against the constitution (aggregator,
local-first, privacy, portable file, no lock-in, inert data, accessible, interoperable).

## 1. UI framework & build

- **Decision**: TypeScript + React 18, built with Vite; PWA via `vite-plugin-pwa`.
- **Rationale**: Ratified web-first baseline; largest OSS contributor pool; best-in-class
  accessibility and keyboard handling; the same build is the self-hostable website and the
  Capacitor webview payload.
- **Alternatives**: Svelte/SolidJS (smaller ecosystems, fewer contributors); React Native/Flutter
  (rejected during stack selection — weaker web parity / a11y / OSS reach).

## 2. Native packaging

- **Decision**: Capacitor for iOS/Android, wrapping the same web build. Plugins: Filesystem
  (read/write the portable file), Share (export Markdown/JSON), and (later) a custom Offline Map
  Store plugin.
- **Rationale**: One codebase → phone + web; native file/share access from web code; drop-to-native
  exactly where needed (the shared map store). Desktop later via Tauri using the same core.
- **Alternatives**: PWA-only (no cross-app shared storage, weaker native file/share); Cordova
  (legacy).

## 3. Maps & offline base map

- **Decision**: MapLibre GL JS with the `pmtiles` protocol. Bundle a **world-overview** PMTiles
  file (low/mid zoom) built from the Protomaps basemap (OpenStreetMap, ODbL) plus a MapLibre style
  and offline glyphs/sprites. All map access goes through a `MapSource` interface.
- **Rationale**: MapLibre is the reference open web map (no Google); PMTiles is a single serverless
  file — the exact fit for "one file, offline, self-hostable" and for a future device-global shared
  store. Overview zoom keeps the bundle small while covering the core "which countries/cities"
  use case. The `MapSource` seam satisfies the ecosystem constraint (no app-private assumption).
- **Alternatives**: Raster tiles (heavier, not vector-styleable offline); Leaflet (weaker vector
  offline); Mapbox GL (proprietary license); bundling full street-level planet (~100GB+ — deferred
  to downloadable region packs).
- **Provenance**: Basemap © OpenStreetMap contributors, ODbL. Recorded in `public/basemap` and
  `PROVENANCE.md`; attribution shown in-app.

## 4. Reference datasets (aggregated, never authored)

- **Decision**:
  - **Countries & territories + boundaries**: Natural Earth Admin 0 (public domain). Country
    identity keyed by **ISO 3166-1 alpha-2**.
  - **First-level subdivisions (regions)**: Natural Earth Admin 1 (public domain). Keyed by
    **ISO 3166-2** where available, else the Natural Earth code.
  - **City gazetteer**: GeoNames (CC BY 4.0), population-thresholded subset (target ~cities15000)
    to bound size. Keyed by **GeoNames ID**.
- **Rationale**: All openly licensed with clear provenance; stable public identifiers make the
  portable user file small, inert, and resilient to dataset updates; honors "aggregator, never an
  author." Thresholding the gazetteer keeps the bundle reasonable; richer/■niche gazetteers become
  opt-in community datasets later.
- **Alternatives**: Natural Earth populated places only (public domain but ~7k cities — too sparse);
  full GeoNames (too large to bundle); Wikidata (great but heavier query model — a later
  integration).
- **Provenance**: Each dataset ships with source URL, license, and version in
  `public/reference/PROVENANCE.md`; GeoNames attribution surfaced in-app (CC BY).
- **Note**: If a needed place is missing from these datasets, the app does **not** create it;
  per the constitution it is surfaced as "not in dataset" with a pointer to contribute to the
  external dataset (a separate, shareable dataset — not app code).

## 5. Local persistence & the portable file

- **Decision**: IndexedDB (via `idb`) as the working store; the **canonical portable format is a
  single JSON document** exported/imported with full-fidelity restore. User data stores stable
  reference IDs + a denormalized display name per record (so the file is legible standalone).
  Reference datasets are bundled read-only and never mixed into the user file.
- **Rationale**: Satisfies "one portable, human-readable file" and "reference/personal data cleanly
  separable"; denormalized names keep the file understandable without the app; ID-based records stay
  small and survive dataset updates.
- **Alternatives**: SQLite/OPFS as canonical (binary, not git-diffable — rejected for the portable
  format, though acceptable as an internal cache); embedding full reference data in the user file
  (bloated, violates separation).

## 6. Schema, validation & inert-data security

- **Decision**: Define models in **Zod**; generate a published, versioned **JSON Schema** from them
  for external tools/AI. Every import is parsed as data and validated/sanitized against the schema
  before use. No `eval`, no dynamic code, no data-driven fetch/URL execution. A top-level
  `schemaVersion` enables documented migrations.
- **Rationale**: One source of truth for runtime validation + TS types + external schema; directly
  implements "security by design — data is inert" and "interoperable & AI-friendly."
- **Alternatives**: Ajv + hand-written JSON Schema (two sources to keep in sync); no schema (unsafe).
- **Tests**: An adversarial-import suite (malformed, truncated, oversized, script-like/formula-like
  fields, wrong schema version) must always reject-or-sanitize and never execute.

## 7. State management & statistics

- **Decision**: Zustand store over the IndexedDB layer. Statistics computed in memory from user
  visits + precomputed reference denominators (counts of cities/subdivisions per country). The two
  per-country metrics — **% of cities** and **% of first-level subdivisions** — are both computed
  and displayed.
- **Rationale**: Tiny, open, no boilerplate; ≥10k visits is trivial in memory (<1s); denominators
  come straight from reference data, keeping the app an aggregator.
- **Alternatives**: Redux (heavier); recompute from DB each render (slower); a Web Worker (not
  needed at MVP scale — revisit if the gazetteer grows).

## 8. Accessibility, shortcuts & regional adaptivity

- **Decision**: Semantic HTML + ARIA, visible focus, full keyboard operability, a command/quick-add
  shortcut, reduced-motion support. Automated WCAG 2.1 AA checks via `@axe-core/playwright`.
  Number/percent/date formatting via the Intl APIs to adapt to the viewed region/locale.
- **Rationale**: Directly implements Principle VII; web platform gives the strongest a11y story.
- **Alternatives**: Component-library defaults only (insufficient for AA guarantees); custom i18n
  framework (overkill for MVP formatting needs).

## 9. Testing strategy

- **Decision**: Vitest for unit (stats math, schema validation/sanitization, export→import
  round-trip fidelity); Playwright for e2e including an **offline/airplane-mode** scenario and the
  adversarial-import suite; axe-core for a11y gates. Chromium is preinstalled.
- **Rationale**: Covers the constitution's mandated security-focused and core-logic tests plus the
  offline and a11y success criteria.
- **Alternatives**: Jest (slower with Vite/ESM); Cypress (Playwright already available here).

## Open items intentionally deferred (not blockers)

- Exact city-gazetteer population threshold (affects bundle size) — finalized when the dataset is
  vendored; the design is threshold-agnostic.
- Localized map labels beyond default names — future i18n work.
- Device-global shared Offline Map Store implementation and downloadable region packs — separate
  follow-up feature; only the `MapSource` seam is required now.
