# Postcards — working task list

> **FINAL STEP (user-authorized):** once every item below is done, AUTO-MERGE
> `claude/monument-display-optimize-x1j6le` into the deployed default branch
> `claude/repo-setup-speckit-3magw3` so GitHub Pages ships it (no manual merge).
>
> **TRANSLATION POLICY (user):** do fr/ko translation AT THE END, not per feature.
> New features add en.ts keys + fr/ko placeholders (English, to keep the
> compile-time key-parity build green); a single final pass translates them all.
> **Quality bar (user): keep it secure & done the right way** — inert/validated
> data, sanitized text, no injection, tokens on-device only.

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
- [x] Sync engine wiring (git pull→merge→push, conditional-push retry) + Sync UI, shared connector — DONE
- [x] `updatedAt` on records + tombstones (schema v6, DB v4, backfilled) — DONE

## Add-place

- [x] Auto-select the country from the coordinates (nearest gazetteer city, `countryAtPoint`) so
      adding a place is just naming the spot — country pre-fills from a typed/dropped point, still
      editable, blank in open ocean. DONE.

## Publish mode — follow-up (v3)

- [ ] Reframe the published site from a paged "book (read once at the end)" into a LIVING BLOG:
      a scrollable, dated feed of entries you re-publish over time; masthead with "Last updated" +
      a "latest entry" jump link; per-post permalinks; keep the labeled-city map. Keep "book" as an
      alternate layout (Blog default). Self-contained, a11y, encryption preserved. (in progress)

## Publish mode — follow-up (v2)

- [x] Name a trip (folder) + "By trip" publish scope (optional `name` on trips, TravelScreen field
      + folder grouping, PublishScreen selector, title from the name). DONE.
- [x] Editorial published site (paper/ink, serif+sans, cover) + a fitted map labeling EACH city
      (pins + names, curved route, compass/legend) — self-contained, zero external requests. DONE.

## Batch 4 (current)

- [ ] Remove the "＋ Add place" button from the map controls (keep long-press/right-click + search add).
- [ ] List rows to ONE column (flag + name); move the date into a per-row "more" menu that also
      lets you set a **folder** etc. Implies **folders on visits/places**, surfaced via the row menu.
- [ ] BUG: zooming OUT doesn't show all flags on the first try — they load in late. Make the
      visited-flag / in-view marker repaint immediate on zoom-out (debounce/idle/recompute lag).
- [ ] Round out **Capacitor** for a native feel (status bar, safe-area insets, splash, haptics,
      keyboard handling) — verify config + platforms.
- [ ] BUG: long-press to add a place → the add-place modal is BROKEN on mobile. Fix the overlay/dialog
      sizing/positioning on small screens.
- [ ] **Do all remaining backlog items, integrated** (below).
- [ ] **Launch a workflow** on "whatever could be upgraded" → implement top picks.

### Remaining backlog to finish (integration)
- [ ] Map-data perf (from the read-only audit): gazetteer **spatial index** for the viewport query;
      geometry prime/low-res-seed + kill first-load double-fetch.
- [ ] Intra-city places (spec 014) — structure + loading seam + UI with graceful per-city availability;
      small provenance-cited sample where feasible (full dataset stays a follow-up).
- [ ] Tile audit #7 (no full remount on basemap/theme toggle) + #8 (robust offline first-paint).
- [ ] ShortcutsHelp.tsx i18n (interleaved <kbd> — deferred earlier).

## Journal

- [x] **Calendar view** — Feed/Calendar toggle; a month grid tinting each entry-day by its dominant
      place's continent (alpha by count), with count badges + aria labels (not colour-only); tap a
      day to pin the feed to it, an empty day opens the composer pre-dated. Respects the place + year
      filters. DONE (accessible table, +tests).
- [x] **Journal folders** — optional `folder` on stories (additive, sanitized, schema v7→v8), a
      datalist combobox in the composer with proposed folders (existing + place/country/trip context),
      a "By folder" feed filter, folder tag on cards. DONE (+tests).

## Map

- [x] Filter the map by DATE — a year chip filter (Any / each visited year / No date) driving
      visited markers + country shading + the in-view list AND the trip arcs from ONE shared
      selection (the useUi tripYear). DONE (+ mapDateFilter tests).
- [x] Removed the map "Show list / Show map" toggle (+ listTall state + .list-tall CSS + dead i18n keys). DONE.

## Sync — the ideal frictionless flow (user vision)

Goal: **one-time setup, then it just works** — auto fetch/pull/push, and data transferred so
there's **no conflict** (or as little as possible) with a **remediation** path for the rare case.
The conflict-free ENGINE already exists (`lib/sync/merge.ts` — record-level newest-wins +
tombstones, converges). Remaining is the UX:

- [x] **One-button setup** (stored once on-device, connected/disconnected chip, Disconnect, Download-data-file for the no-token path). DONE.
- [x] **Opt-in auto push/pull** (off by default; pull on launch/focus/visible/online, debounced push on edit/backgrounding; single in-flight lock, self-write loop guarded; manual Sync-now stays). DONE.
- [x] **Conflict-free transfer** — reuses the record-level merge + conditional-push retry. DONE (pre-existing).
- [x] **Remediation** — sync log (last 10 runs, per-store counts) + a safety guard that blocks a
      mass-deletion pull with an "apply anyway / skip" prompt (never silent loss) + distinct error codes. DONE.
- [x] Token-free clarity + token guide + guided GitHub proposition:
      - Make clear you DON'T need a token: "Download" the site/data and host/`git push` it yourself on
        any static host (GitHub Pages, Netlify, Nextcloud, USB) — zero lock-in. Token is only for the
        in-app convenience push.
      - Add an in-app GUIDE for the fine-grained PAT (how to create it, minimal scope: contents:write on
        the one repo, stays on-device, never in exports) in `GitHubConnectorFields`.
      - Make GitHub a recommended, walked-through option (create repo → token → push → your URL at
        username.github.io/repo). Optionally OAuth Device Flow later (needs a client_id — maintainer setup).
      — queued after the blog agent (shares PublishScreen / i18n).

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

- [x] Spec `specs/014-intra-city-places/spec.md` + implementation `tasks.md` — DONE.
- [ ] **DEFERRED (documented follow-up):** the actual per-city sub-place dataset (OSM metro
      stations, admin districts, Wikidata) needs external data this environment's egress blocks;
      inventing coordinates would violate Constitution I. The structure (spec + tasks.md runway)
      is committed; the dataset + loading seam + UI are the follow-up. See `wiki/Roadmap.md`.

## i18n

- [x] Add languages: **French** and **Korean** — DONE. Zero-dep i18n layer (typed en/fr/ko with
      compile-time key parity), useT hook, language switcher, locale-aware Intl formatting. +14 tests.
- [x] **Final translation pass** (per "translate at the end") — DONE. Real fr/ko for every deferred
      placeholder (blog/map/sync/journal, ~132 values) + extracted & translated City/Country/Photo/
      BoardingPass/Publish/About screens (~208 more values). **610 keys each, exact parity.** Only
      ShortcutsHelp (interleaved <kbd>) + the "My travels" default-title sentinel left in English.

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

- [x] Write a **full wiki** (9 pages under `wiki/`, written from the real code + a polish
      pass for accuracy/consistency/cross-links) — DONE via workflow.

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
