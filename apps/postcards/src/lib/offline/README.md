# Offline seam

Self-contained, framework-agnostic machinery for taking map data offline —
written to be lifted wholesale into a shared ecosystem library later (like the
`wikivoyage` seam). No imports from the app: plain inputs, injectable fetch.

- `tiles.ts` — pure slippy-map math (`tilesForBounds`) + `saveAreaOffline`,
  which fetches tiles so the service worker's cache rule stores them. CORS +
  explicit referrerPolicy (OSM requires a Referer). Concurrency-capped,
  abortable, progress-reporting, injectable `fetchFn` for tests.
- `regions.ts` — a named catalog of continent-scale download packs with EXACT
  tile counts and honest size estimates, computed before any download.

Rules (Constitution): downloads happen only on explicit user action; tile
sources are named and openly licensed; nothing is fetched at startup.

Extraction checklist: move `src/lib/offline/` verbatim + its unit tests
(tests/unit/offlineTiles.spec.ts); consuming apps keep their own UI and their
service-worker cache rule (see vite.config.ts runtimeCaching for the contract:
CacheFirst on the tile host, 200s only).
