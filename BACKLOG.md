# Postcards — Backlog

The single source of truth for requested work. Chat is lossy; this file is not.
Every request becomes a line here, and it only moves to **Done** once it's been
**verified** (screenshot for UI, test for logic) — not when the code merely
exists. See `AGENTS.md` for the working agreement.

Status: 🔲 open · 🔧 in progress · ✅ done (verified) · 💬 answered (no code) · 🧊 deferred

_Last reconciled: 2026-07-16._

## Done (verified)

- ✅ PWA auto-update prompt — a "new version — reload" banner (SW registered
  manually in `main.tsx`, prompt mode) so an open tab never serves a stale
  cached build. _Screenshot._
- ✅ Journal: accent-insensitive city search over the feed + calendar.
- ✅ Published route map drew blank/white → embed a compact world coastline +
  enforce a minimum span (single stop now shows regional context). _Screenshots._
- ✅ Intro: explicit Online/Offline mode chooser + "Offline map for a trip" row.
- ✅ Intro: white flash on entry fixed (opaque overlay from frame 0).
- ✅ Intro: entry fade removed.
- ✅ About: app version shown (0.1.0), injected from package.json at build time.
- ✅ Map: first-run "detailed world map" consent banner removed.
- ✅ Map: online/offline toggle moved OUT of the Layers panel → always pressable
  beside the Layers button (two-way, state-aware tooltip). _Screenshot._
- ✅ Moments: explicit loading / load-error states.
- ✅ Guides: online photo gated on connectivity; loading lines get aria-live.
- ✅ Map: "hide visited" keeps flags on the map (narrows the list only).

## Answered (no code change)

- 💬 The 🔗 on a published entry is a **permalink**: a stable `#entry-N` link that
  also copies that post's full URL to the clipboard.
- 💬 Other downloadable packs (besides the ~17 MB full city list): **offline map
  regions** (save OSM tiles for a trip) and **community place packs** — both in
  Settings.

## Open

- 🔲 Marker popup i18n — map popup labels are captured in English and go stale on
  a language switch (use a `tRef` updated each render).
- 🔲 Guides panel body i18n — City/Country guide bodies.
- 🔲 Guide link-list i18n — `lib/wikivoyage/guides.ts`.
- 🔲 Search "＋ Add" dropdown restructure — wrap results + add-row in one
  positioned container.

## Deferred

- 🧊 Capacitor native feel: status bar, safe areas, keyboard, haptics.
