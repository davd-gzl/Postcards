# Research: Coherent & Efficient Postcards

Phase 0 decisions. The stack is already chosen (constitution + existing code); these
resolve the *new* choices this feature introduces. No NEEDS CLARIFICATION remained
after the discovery discussion; the items below record the "how."

## R1 — One egress gate (Theme 1)

**Decision**: Make `useSettings.offlineMode` the single source of truth for all optional
egress, and derive the map basemap purely from it. Remove the per-map "detailed map"
button from the map surface; keep exactly one online-map control, in Settings, disabled
while Offline mode is on. The top-bar `ConnectionStatus` chip remains the toggle.

**Rationale**: The recurring "detailed map re-appears" complaint is a two-sources-of-truth
bug (a map-local basemap toggle vs. the global mode). Collapsing to one gate is less code
and removes the confusion; it also makes SC-001 (zero optional requests offline) auditable
in one place.

**Alternatives rejected**: Keep both controls but sync them (fragile, still two sources);
a per-feature online toggle (more surface, worse for a non-technical user).

## R2 — Durable data / long-term memory (Theme 7)

**Decision**: Three tiers, weakest→strongest:
1. **Web persistence**: call `navigator.storage.persist()` the first time real data is
   written (not on cold load), and read `navigator.storage.persisted()` +
   `estimate()` to show status. Surface a compact "your data is protected / at risk"
   indicator and a last-backup time; nudge a backup when data changed since.
2. **Backup/restore safety net**: the existing single JSON file is the recovery unit;
   make export one tap and restore obvious. This is what saves the "browser cleared"
   case when persistence is refused (notably some iOS Safari contexts).
3. **Native durable storage (Capacitor)**: in the native shell, WebView IndexedDB is not
   subject to browser eviction, and a periodic file backup via `@capacitor/filesystem`
   gives a second copy. Strongest tier; ties into Theme 8.

**Rationale**: Persistence API is the only web mechanism to prevent silent eviction, but it
is not guaranteed (Safari), so the backup file must be a first-class, well-surfaced safety
net — directly answering the "brother lost everything on a reset" problem.

**Alternatives rejected**: Auto-cloud backup (needs a backend/account — violates the
constitution); relying on IndexedDB alone (evictable on the web).

## R3 — Device-to-device transfer: QR + file (Theme 4)

**Decision**: The **portable file is the primary transfer**, moved via the OS share sheet
(`@capacitor/share` on native / download on web). **QR is a convenience** for small
libraries: encode the JSON (photos excluded or heavily compressed) into a QR the other
device scans with its camera — fully offline, no server. When the payload exceeds a safe
single-QR size, fall back to the file with a one-line explanation (no silent failure).

**Rationale**: Full data with inlined photos is far too large for a QR; honesty beats a
broken feature. QR shines for a quick "here's my places list" hand-off; the file covers
everything. Both are accountless and secret-free (unlike the GitHub token).

**Alternatives rejected**: Multi-hundred chunked animated QR for full libraries (fragile,
slow, bad UX); WebRTC/P2P (needs a signaling server — backend).

**Open dependency note**: needs a small, offline QR generate+scan capability
(generate = tiny lib or inline; scan = `BarcodeDetector` where available, else a bundled
decoder). Pick the lightest option that keeps the install small (validate in Phase 1).

## R4 — One-button publish → drag-to-host (Theme 4)

**Decision**: Reuse `renderReader` to emit **one self-contained `.html`** (already inlines
CSS/JS/data/photos, zero external requests). The publish action saves/share-sheets that
file and shows dead-simple instructions: "drag this onto netlify.com/drop (no login) and
send the link." Keep the existing in-app preview. GitHub push remains available but behind
an **Advanced** disclosure.

**Rationale**: The self-contained single file already exists and satisfies FR-016 (renders
offline for the recipient). Drag-to-Netlify-Drop needs no account or token — the correct
non-technical path. No new publishing infra.

**Alternatives rejected**: Leading with GitHub Pages (token complexity, the exact pain the
user cited); a zip of separate assets (a single HTML is simpler to hand off).

## R5 — Place tap ↔ map/list selection (Theme 2)

**Decision**: Extend `useUi` with a "selected place" signal alongside the existing
`flyTo`/`mapFocus`. A tap anywhere sets both: the map flies (existing) and the in-view
list scrolls-to + highlights the matching row. One-tap entry points (Favorites, Wishlist,
Monuments-near-me, This-trip) reuse the existing `openPlaces(view)` + trip filter.

**Rationale**: The nav store already brokers cross-screen intent; adding a selection nonce
is the minimal, consistent extension. Avoids a new global.

**Alternatives rejected**: Local component state passed via props (breaks the map↔list
decoupling); URL-router state (the app is tab-based, not route-based).

## R6 — Performance budget (Theme 6, cross-cutting)

**Decision**: Treat perf as a gate on every theme. Known levers: cap/tier the full-gazetteer
dot source by zoom (already partly done), reuse the small thumbnail variant in lists/grids
(already added), virtualize long lists where needed, and keep MapView source updates
incremental (already the pattern). Measure on a throttled profile before/after each theme.

**Rationale**: The "too slow" complaint is diffuse; making perf a per-theme acceptance gate
(not a final cleanup) is how it actually stays fast.

## R7 — Native app hardening (Theme 8)

**Decision**: Use Capacitor with `@capacitor/status-bar`, `@capacitor/keyboard`,
`@capacitor/haptics`, and existing `env(safe-area-inset-*)` CSS. Android first (user's
platform), iOS from the same build. Durable storage = WebView IndexedDB + periodic
`@capacitor/filesystem` JSON backup. No platform-exclusive features.

**Rationale**: These are the standard, minimal Capacitor plugins for native feel; they add
no proprietary lock-in and keep one codebase. Durability is the headline native win.

**Alternatives rejected**: A separate native codebase (violates one-codebase baseline);
React Native (drops the PWA/self-host path).

## Summary of new dependencies to validate in Phase 1

- Offline **QR** generate + scan (smallest footprint; prefer platform `BarcodeDetector`).
- Capacitor plugins: `@capacitor/share`, `@capacitor/status-bar`, `@capacitor/keyboard`,
  `@capacitor/haptics`, `@capacitor/filesystem` (all first-party, open, no GAFAM).
- No other runtime deps; **no backend, no OAuth, no analytics.**
