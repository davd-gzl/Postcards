# Postcards (app)

Local-first, privacy-first aggregator for remembering the places you've been. Web-first
(React + TypeScript + Vite), packaged for phone via Capacitor. No Google, no backend, works offline.

See the repo root [`CLAUDE.md`](../../CLAUDE.md), the constitution
(`.specify/memory/constitution.md`), and the feature docs in `specs/001-cities-countries/`.
Current implementation status: [`REVIEW-NOTES.md`](../../REVIEW-NOTES.md).

## Develop

```bash
pnpm install                # from repo root
pnpm --filter postcards dev        # dev server
pnpm --filter postcards test       # unit tests (Vitest)
pnpm --filter postcards test:e2e   # browser smoke test (Playwright)
pnpm --filter postcards build      # production PWA build
```

## Structure

```
src/
  app/            app shell, routing, keyboard shortcuts
  features/
    visits/       search + add + list visits
    map/          MapLibre map + visited layers (offline, bundled geometry)
    stats/        coverage math + view (both per-country metrics)
    backup/       JSON export/import (inert, validated) + Markdown export
  lib/
    schema/       Zod models (source of truth) + inert-data sanitization
    db/           IndexedDB persistence
    store/        Zustand store
    reference/    bundled reference data (countries, FR regions, sample cities) + provenance
    map-source/   MapSource seam (bundled now; shared Offline Map Store later)
    format/       Intl formatting
  ui/             shared components (attribution, a11y primitives)
public/           PWA assets
```

## Principles (non-negotiable)

Aggregator-only (no invented facts), local-first, private (no telemetry), one portable JSON file,
inert data (parsed never executed), accessible + keyboard-first. See the constitution.
