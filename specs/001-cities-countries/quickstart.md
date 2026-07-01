# Quickstart & Validation: Cities & Countries Core (MVP)

A run/validation guide proving the feature works end-to-end. Implementation details live in
`tasks.md` (Phase 2) and the code; this file is how you *check* it. Commands are indicative of the
planned toolchain (pnpm workspace, Vite, Vitest, Playwright, Capacitor).

## Prerequisites

- Node 20+, pnpm 9+
- Chromium (preinstalled in this environment at `/opt/pw-browsers/chromium`)
- For native runs only: Xcode (iOS) / Android SDK

## Setup

```bash
pnpm install
```

## Run the app (web / PWA)

```bash
pnpm --filter placebeen dev        # local dev server
pnpm --filter placebeen build      # static, self-hostable PWA build
pnpm --filter placebeen preview    # serve the production build
```

## Run on a phone (Capacitor)

```bash
pnpm --filter placebeen build
pnpm --filter placebeen exec cap sync
pnpm --filter placebeen exec cap run ios      # or: cap run android
```

## Automated checks

```bash
pnpm test           # Vitest unit: stats math, schema validation/sanitization, export→import
pnpm test:e2e       # Playwright: user flows, offline scenario, adversarial imports
pnpm test:a11y      # axe-core WCAG 2.1 AA gate (may be part of test:e2e)
```

## Validation scenarios (map to spec Success Criteria)

### V1 — Log a place offline (US1, SC-001, SC-002)
1. Start the app with the network disabled.
2. Quick-add → search "Lisbon" → select → confirm.
3. **Expect**: the visit is saved and listed; the whole flow completes in under 5 seconds; no
   network request occurs.

### V2 — Offline map on fresh install (US2, SC-007, SC-002)
1. Fresh profile, network disabled, open the Map.
2. **Expect**: a usable world map renders with **no** downloads; visited cities show as points and
   visited countries are visually distinguished; panning/zooming stays available at overview detail.
   (Backed by `BundledPmtilesMapSource` — see `contracts/map-source.md`.)

### V3 — Both per-country percentages (US4, FR-007)
1. Log several cities across a few French regions, plus the country France.
2. Open Statistics and select France.
3. **Expect**: countries visited, % of world, cities visited, **and both** % of France's cities and
   % of France's regions (first-level subdivisions). Figures update <1s after adding/removing a
   visit (SC-004). Denominators come from reference data (`contracts/reference-data.md`).

### V4 — Backup & restore round-trip (US3, SC-003)
1. Export the data file.
2. Inspect it in a text editor → it is readable JSON matching `contracts/portable-data-file.md`.
3. Wipe local data (or use a fresh profile) → import the file.
4. **Expect**: all visits, dates, and notes restored identically (full-fidelity).

### V5 — Markdown share export (US3, FR-011)
1. Choose "Export Markdown".
2. **Expect**: a readable Markdown summary/table of visited places, containing no executable
   content.

### V6 — Inert-data security (FR-012, SC-008, Constitution VI)
1. Attempt to import each adversarial fixture: malformed JSON, unknown keys, wrong/newer
   `schemaVersion`, oversized strings, and fields with leading formula/command characters
   (`=`, `+`, `@`) or control characters.
2. **Expect**: every case is rejected or safely sanitized with a clear reason; nothing is executed;
   no partial silent import.

### V7 — Keyboard & accessibility (US5, SC-005)
1. Complete V1–V4 using the keyboard only; verify visible focus and working shortcuts.
2. Run `pnpm test:a11y`.
3. **Expect**: all primary actions reachable via keyboard; zero critical WCAG 2.1 AA violations.

### V8 — Privacy (SC-006)
1. With dev tools / a proxy capturing traffic, exercise all core flows.
2. **Expect**: zero outbound requests carrying user data; data leaves the device only via explicit
   export/share.

## Done when

All V1–V8 pass, the requirements checklist stays green, and the Constitution Check in `plan.md`
holds after implementation.
