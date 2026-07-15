# Postcards — working task list

Running checklist for the current batch of requests. Kept so nothing is
forgotten. Grouped by area; each item links to where it lives. Push directly to
`claude/monument-display-optimize-x1j6le`.

## Done (this session)

- [x] Reset all data button, gated behind a typed `RESET` confirmation (`features/backup/Backup.tsx`)
- [x] Journal: writing form sits directly under the daily button (export note moved below composer)

## Journal → Publish mode (self-hostable travel blog) — via speckit

Decisions locked with the user:
- **Access:** client-side **passphrase encryption** (AES; decrypts in-browser; works on GitHub Pages, no server)
- **Target:** **portable site bundle** for any static host / git; "push to GitHub" is one optional connector (zero lock-in)
- **Scope:** **selectable** — one trip / date range / tag, with preview; strip photo EXIF/GPS on export
- **Journey model:** **Trips drive the route** (from→to legs + transport mode); stories + photos attach to each place

- [x] Write `specs/012-journal-publish/spec.md` + `plan.md` (Constitution Check)
- [x] Foundation: passphrase encryption (`lib/publish/encrypt.ts`, AES-GCM+PBKDF2, tested)
- [x] Foundation: journey-bundle assembler (`lib/publish/bundle.ts`, trips-driven route + steps, tested)
- [x] Reader UI (Polarsteps-style book — inline-SVG route map, transport legs, photo-led steps, paging, cover) — DONE
- [x] Self-contained HTML export + optional GitHub push + passphrase-gate variant — DONE
- [x] Docs for the host (HOSTING.md shipped in export + docs/publishing.md) — DONE

## Device sync (phone ↔ laptop) — P2P or git mode

My take (WDYT): this fits the constitution perfectly (local-first, decentralized,
no server, zero lock-in) and shares the "push to any git remote" seam with Publish
mode, so it's high-value and not much extra surface. Recommendation:

- **Git mode first** — the portable JSON lives in a git repo; each device pulls,
  merges **at the record level** (id-keyed upsert, newest-wins — the app already
  has non-destructive `mergeVisits`), and pushes. Robust, offline-friendly, reuses
  the publish Sync button. The only hard part is merge/conflict handling → do it
  per-record, never whole-file, so two devices always converge.
- **P2P (WebRTC / local network) later** — direct phone↔laptop over a QR-paired
  data channel, no cloud at all. Great for the constitution but heavier (pairing,
  signaling); worth a second phase once git mode proves the merge model.

- [x] Spec `specs/013-device-sync/spec.md` (git mode first, P2P as phase 2)
- [x] Record-level convergent merge core (`lib/sync/merge.ts`, newest-wins + tombstones, tested — deterministic/commutative/idempotent)
- [ ] Sync engine wiring (git pull→merge→push) + Sync button/UI, shared git connector with Publish mode
- [ ] `updatedAt` on records (schema) for the merge timestamp

## UX / behaviour batch

- [x] City name never cropped; on hover show full name (tooltip) — shared CityLine + picker/passport/airports
- [x] Favorites-only mode — already a first-class view; unified the glyph on the heart (was amber star)
- [ ] Back-online: show a small "Reconnect" button when connection returns — do NOT auto-reconnect
- [ ] Show current mode (Offline / Online) explicitly somewhere
- [ ] Make it obvious how to add a non-existent spot on the map (custom place discoverability)
- [ ] Light / dark mode **toggle** (today dark only follows the OS; add an explicit switch)

## Stats

- [x] Show **percentage** of countries done, not only "3/50" (added to the compact strip)
- [x] Make the Stats page much more ergonomic & UX-friendly — DONE via workflow (coverage hero,
      continent constellation, KPI strip, unified cards, by-country disclosure). 220 tests green.

## Moments

- [x] Order Moments by **continent → country** (grouping UI + grouping.ts) and expand
      the curated list 75 → 105 with real, provenance-cited experiences (Wikidata/GeoNames
      coords; UNESCO/Wikivoyage concepts). +15 tests. DONE.

## Intra-city places (finer granularity)

- [ ] Log **places within a city** — subway/metro stations, districts/neighbourhoods,
      parks, etc. — **adapting per city to whatever real data exists**. STRICT: base
      everything on real, openly-licensed datasets with provenance (OSM metro stations,
      admin districts, Wikidata) — **invent nothing** (Constitution I: aggregator, never
      an author). Missing data → a shareable dataset, not app-authored points.
- [ ] Spec `specs/014-intra-city-places/spec.md` (place hierarchy: country → city → sub-place; per-city data availability drives what's offered)

## i18n

- [ ] Add languages: **French** and **Korean** (introduce an i18n layer; translate UI strings) — large

## Investigations / answers

- [x] Why is "Gili Meno" (Indonesia) missing? ANSWER: it's an **upstream GeoNames data gap**,
      not a Postcards cutoff. The gazetteer (135,233 rows via all-the-cities 3.1.0) applies NO
      population threshold and includes Gili Air (pop 1800) and Gili Trawangan (pop 1500) — but
      GeoNames never emitted a record for Gili Meno, so there's nothing upstream to include. Fixes:
      (a) add it as a custom place now (~ -8.349, 116.056, Indonesia); (b) durable = contribute it
      to GeoNames / ship a provenance-tagged supplemental gazetteer — never bake a world fact into app code.
- [x] Answer: how to add a non-existing spot today — only via AddPlaceForm, mounted ONLY in the
      global search's "no results" branch (must type an exact zero-match name). Discoverability is poor →
      see UX item below.
- [x] Improve add-a-spot discoverability: map long-press/right-click "+ Add here" (seeds coords),
      keyboard "+ Add place" control, search near-miss add-row. (AddPlaceForm, MapView, MapScreen, PlaceSearch)

## Documentation

- [ ] Write a **full wiki** for the project (features, hosting, data/provenance,
      architecture, how-to) once the batch is done → then **launch a workflow** to
      make it perfect.

## Map data loading (structure + preprocessing)

- [x] **P1 spatial grid index** for the gazetteer viewport query — replaces the per-pan
      linear scan of 135k rows with a 1°×1° grid (city/region zoom now visits a few cells).
- [x] **P2a prime geometry early** — getCountries() fetch starts at map mount, overlapping init.
- [ ] Follow-ups from the audit (larger/build-step): P2b 110m land seed for instant coastline,
      P2c geometry in a worker, P3 don't gate first paint on all reference JSON, P4 columnar
      binary gazetteer (build step), P5 zero-copy worker handoff, P6 kill duplicate downloads,
      P7 pre-simplify country geometry. (Full ranked plan captured from the audit.)

## Workflows

- [x] **Tile loading** workflow — desktop & mobile; tiles sometimes not loaded though on-screen (DONE: audit + fixes #1–6 shipped; #7 no-remount-on-toggle and #8 robust-offline-base deferred as follow-ups)
- [ ] **Discovery + specs** workflow — implementation maps for the UX/stats/i18n/moments batch + write specs 012/013 (running)
- [ ] **Stats UX** workflow — run after all the above is finished
- [ ] **Wiki** workflow — perfect the full project wiki (last)

Note: user asked to lean on workflows generously ("launch as many as you need, for every task").
