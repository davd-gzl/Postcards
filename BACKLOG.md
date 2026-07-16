# Postcards — Backlog

The single source of truth for requested work. Chat is lossy; this file is not.
Every request becomes a line here, and it only moves to **Done** once it's been
**verified** (screenshot for UI, test for logic) — not when the code merely
exists. See `AGENTS.md` for the working agreement.

Status: 🔲 open · 🔧 in progress · ✅ done (verified) · 💬 answered (no code) · 🧊 deferred

_Last reconciled: 2026-07-16._

## Done (verified)

- ✅ Offline base map recoloured — soft-blue sea, warm land, defined coastlines &
  borders (was near-white land on near-white sea = blank). _Screenshot._
- ✅ Journal composer no longer opens by default — open it from the toolbar or by
  long-pressing the page. _Screenshot: closed by default → long-press opens._
- ✅ "Load guide overviews automatically when online" — verified already wired
  (`GuideButton` auto-loads on open when the toggle is on, online, not Offline
  mode). No change needed; likely looked inert due to toggle-off / offline / a
  stale build.
- ✅ Top-bar "● Online" chip is now a real **toggle button** — click it to flip
  Offline mode (label/dot follow the mode, aria-pressed, tooltip). _Screenshot,
  online↔offline._ (Earlier I'd wrongly moved the *map* layer button; the ask was
  this top-bar chip.)
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

## Needs a decision from you

- ❓ **GitHub sync via OAuth.** A pure serverless PWA can't complete GitHub OAuth
  in-browser: the Web flow needs a client secret, and the Device flow's token
  exchange isn't CORS-enabled — both require a backend/proxy, which conflicts
  with the "no server, fully decentralized" constitution. Today's on-device
  Personal Access Token is the backend-free option. Options to choose from:
  (a) keep the PAT but smooth its UX (guided scopes, validation, a "create
  token" deep link); (b) OAuth Device flow via a small user-hosted/community
  CORS proxy (opt-in, off by default); (c) relax the constitution to allow one
  tiny serverless token-exchange function.
- ❓ Curated **data-pack catalog** — a few ready-made, provenance-tagged packs
  (metros, national parks, more monuments) installable in one tap, instead of
  today's paste-a-URL-only flow. (Offered; awaiting go-ahead.)

## Open

- 🔲 Marker popup i18n — map popup labels are captured in English and go stale on
  a language switch (use a `tRef` updated each render).
- 🔲 Guides panel body i18n — City/Country guide bodies.
- 🔲 Guide link-list i18n — `lib/wikivoyage/guides.ts`.
- 🔲 Search "＋ Add" dropdown restructure — wrap results + add-row in one
  positioned container.

## Deferred

- 🧊 Capacitor native feel: status bar, safe areas, keyboard, haptics.
