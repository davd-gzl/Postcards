# Publishing

Postcards is your **private editor**. **Publish mode** turns a slice of that
private journal into a **self-contained, read-only travel-blog website** — a
Polarsteps-style "book" a visitor pages through — that you can host anywhere with
**no server and no host-side build step**. The app itself never changes and
nothing leaves your device except the single file you explicitly export.

This is feature **012** (`specs/012-journal-publish/`). The code lives under
`apps/postcards/src/lib/publish/` (the pure builder, encryption, reader, and
GitHub target) and `apps/postcards/src/features/publish/PublishScreen.tsx` (the
UI). Host-facing notes ship *inside* every GitHub export as `README.md` and are
mirrored in `apps/postcards/docs/publishing.md`.

Related: [Trips](Features.md#trips--boarding-pass-import) drive the route, [Journal](Features.md#journal) stories and the
[Photo gallery](Features.md#photo-galleries) fill the pages, and everything here honours the
[constitution](Privacy-and-Constitution.md) — privacy, offline-first, and inert data included.

---

## What Publish mode is

Open it from **Journal → Publish** or **Settings → Publish mode** (the
`PublishScreen` modal is mounted from both `JournalScreen.tsx` and
`SettingsScreen.tsx`). In one dialog you:

1. **Choose the scope** — *Everything*, *One trip*, or *A date range*
   (`type Scope = "all" | "trip" | "range"`).
2. **Write the cover** — a title (default *"My travels"*, max 120 chars) and an
   optional subtitle (max 160).
3. **Optionally set a passphrase** — empty means a public site.
4. **Preview the book** in an inline `<iframe>` that runs the exact same reader
   code that ships, so what you see is what visitors get.
5. **Export** — download `index.html`, or push to GitHub Pages.

Everything is derived on-device from records you already have. The build invents
no world facts: the route comes from your Trips, the distance and country totals
are computed from trip-endpoint coordinates, and the map credit is preserved.
That keeps the [Constitution](Privacy-and-Constitution.md)'s "aggregator, never an author"
and "local-first" promises intact.

> The published site is a **one-way share artifact** — human-readable and
> hostable, but deliberately **not re-importable**. Your canonical backup stays
> the portable JSON file (see [Backup and restore](Features.md#backup-import--reset)).

---

## What ships: one self-contained `index.html`

The export is a **single `index.html`** file. Everything is inlined into it:

- the reader (a small HTML/CSS/JS "book" — no framework at runtime);
- your journey data as an inline `<script type="application/json">` payload;
- every photo as an inline `data:` URL.

The consequences, baked into `renderReader.ts`:

- **Fully offline, zero external requests** — there is no CDN, web font, map
  tile, analytics beacon, or any other absolute URL in the document. The page
  also sets `<meta name="robots" content="noindex, nofollow">` and
  `<meta name="referrer" content="no-referrer">`.
- **Inert** — all story text and captions are placed with `textContent`, never
  `innerHTML`; the embedded JSON escapes `<`, `>`, `&`, and the U+2028/U+2029
  line separators to their `\uXXXX` forms so the data can never close the
  `<script>` element or smuggle markup. A shared page **cannot** form raw HTML, a
  script, or a tracking pixel.
- **No EXIF/GPS** — photos are already re-encoded through the capture pipeline
  ([Photo gallery](Features.md#photo-galleries)), so no camera or location metadata reaches
  the file.

`renderReaderHtml(journey, opts?)` is a **pure** function — it returns a string
and touches no I/O, no DOM, no globals — which is what lets a unit test assert the
output is self-contained.

---

## Building the book: how a journey is derived

The ordered "book" is assembled by `buildJourney(input, selection)` in
`src/lib/publish/bundle.ts` — pure and deterministic, no I/O. The shape it
produces:

```ts
interface JourneyStep {
  place; lat; lon;
  date: string | null;
  arriveBy: TravelMode | null;   // transport used to REACH this step
  story?: { title; text; date };
  photos: { src; caption }[];
}
interface PublishedJourney {
  title; subtitle?;
  dateRange: { start; end };
  steps: JourneyStep[];
  totals: { countries; places; distanceKm };
}
```

- **The route is Trips-driven.** The selected [Trips](Features.md#trips--boarding-pass-import) are sorted by
  date, and each `from → to` leg is stitched into an ordered list of places.
  A leg's transport mode becomes the next step's `arriveBy` badge. Consecutive
  legs that share an endpoint don't duplicate the place.
- **Stories and photos attach to places.** Each step picks up the *earliest*
  [Journal](Features.md#journal) story for its place, plus every photo from visits and
  stories at that place (de-duplicated by `src`).
- **Story-only fallback.** If the selection contains no trips, the build
  publishes the in-scope stories in date order as the steps — so a journal with
  no logged trips still produces a book.
- **Totals are derived, never fabricated.** `countries` counts distinct country
  IDs (excluding the `ZZ` "unknown" sentinel); `places` is the step count;
  `distanceKm` is the summed great-circle (`haversineKm`) length between
  consecutive step coordinates, rounded. A step whose place has no coordinate is
  **skipped** (the reader is map-led), and a coordinate-less endpoint contributes
  no distance.

Coordinates are resolved through the same `coordsOf(place, ref)` used by the
[Trips](Features.md#trips--boarding-pass-import) travel log, against the [reference data](Data-and-Provenance.md);
custom places carry their own `lat`/`lon`.

---

## The reader: what a visitor discovers

The emitted document opens as a book (all logic in the inline `READER_JS` inside
`renderReader.ts`):

- **Cover** — kicker, title, optional subtitle, the date range, and a row of
  totals (countries · distance in km · places), plus a hint to page on.
- **Journey map** — an inline SVG on an equirectangular projection (720×360)
  with a 30° graticule. Each transport leg is drawn as a straight segment
  **coloured by mode** (flight, train, bus, ferry, car, other), each stop is a
  dot, and a legend lists only the modes actually used. It is pure inline SVG, so
  it makes **zero tile calls** — consistent with the app's offline
  [Map](Features.md#the-map). A visible attribution line credits GeoNames / Natural Earth /
  OpenStreetMap (see below).
- **One photo-led page per stop** — a hero photo (or a country-flag placeholder
  when a stop has no photo, so there is never a broken image), a transport-in
  badge, the place name with its flag, the date, the story title and text, and a
  thumbnail gallery.
- **An accessible lightbox** — clicking a thumbnail opens a modal that pages with
  the arrow keys, closes with `Escape`, and returns focus to the thumbnail.

Navigation and accessibility, per the reader runtime:

- Page **left → right** with the on-screen **Back / Next** buttons, the
  **← / →** (or `PageUp` / `PageDown`) keys, or by **swiping**; `Home` / `End`
  jump to the cover / last page.
- `prefers-reduced-motion` is respected — page turns become instant.
- **Light and dark** themes follow the visitor's system, with an in-page toggle;
  a progress bar and a "n / total" counter track position.
- A `<noscript>` block explains that the book needs JavaScript, and reassures the
  reader that nothing is sent anywhere.

The whole reader is keyboard-first and targets **WCAG 2.1 AA** — the same bar the
rest of the app holds itself to ([Privacy and security](Privacy-and-Constitution.md),
[Testing](Development.md#testing)).

---

## Optional passphrase encryption (client-side, zero-knowledge)

A published site is just static files — on GitHub Pages, Netlify, or a USB stick
there is **no server** to check a password. A server-checked login is therefore
impossible on those hosts, and a "hide it with CSS" gate would be fake: the data
would still be sitting in the file. So Postcards does the only thing that is
genuinely private on static hosting — it **encrypts the journey data itself**,
and decrypts it in the visitor's browser.

When you set a passphrase, `PublishScreen` calls `encryptJson(journey,
passphrase)` (`src/lib/publish/encrypt.ts`) and ships the reader with the
ciphertext instead of the plaintext (`renderReaderHtml(null, { encrypted })`).
The scheme, using only the browser's built-in **Web Crypto** (no dependency):

- **AES-GCM** (authenticated) with a 256-bit key **derived from the passphrase**
  via **PBKDF2-SHA256**, 250,000 iterations.
- A fresh random **salt (16 bytes)** and **IV (12 bytes)** per build, stored
  alongside the ciphertext in a self-describing envelope
  (`{ v, alg, kdf, iter, salt, iv, ct }`).
- The reader ships a tiny inline decrypt routine mirroring the same scheme. On
  load it shows a passphrase prompt; the entered passphrase is used to derive the
  key and decrypt **entirely in the browser** — no network request of any kind.
- A wrong passphrase (or a tampered file) fails the GCM authentication and yields
  a single generic message, *"Wrong passphrase, or the file is damaged."* — it
  never leaks which, and never reveals any content.
- To avoid leaking metadata, an encrypted document's `<title>` is a neutral
  *"A locked journey"* rather than the real journey title.

Crucially, **the passphrase is never written into any file**. It exists only in
your head and in whatever channel you use to share it with readers — share it
**separately** from the link. This satisfies the [Constitution](Privacy-and-Constitution.md)
promise that data is inert at rest and that there is no server.

The in-app **Preview** always shows the journey unlocked, because you (the
author) already have the data — only the *exported* file is gated.

---

## The passphrase caveat: there is no recovery

Because the passphrase is never stored anywhere in the bundle, **a lost
passphrase cannot be recovered** — not by you, not by the reader, not by anyone.
There is deliberately no back door: that is the whole point of zero-knowledge
encryption. If a passphrase is lost, the fix is simply to **re-publish** the site
with a new one. The host `README.md` states this plainly so whoever hosts the
file understands it up front.

---

## Hosting the file (GitHub Pages, Netlify, Nextcloud, USB, any static host)

Because the output is one relative-path `index.html` with no build step, it runs
anywhere. The host-facing `README.md` (source: `src/lib/publish/hosting.ts`)
lists the options:

| Host | What to do |
|------|------------|
| **Folder / USB stick** | Copy `index.html` anywhere and open it (double-click or drag into a tab). |
| **GitHub Pages** | Put `index.html` in a repo, then *Settings → Pages* → pick the branch and `/ (root)`. The site appears at `https://<user>.github.io/<repo>/`. |
| **Netlify / Cloudflare Pages / Vercel** | Drag the folder onto their deploy drop zone — no configuration. |
| **Nextcloud / ownCloud** | Upload `index.html`, then *Share → Share link*. (Some setups download HTML instead of rendering it; if so, wrap it in a folder and share that.) |
| **Any static web host** | Upload `index.html` to the web root. |

No host-side build, no runtime, no database — the file *is* the site.

---

## The optional GitHub push (one connector behind a seam)

Downloading `index.html` always works and touches no network. As **one optional
convenience**, Publish mode can push straight to a GitHub Pages repo. Expand
*"Push to GitHub Pages (optional)"* and provide **owner / repo / branch** and a
**fine-grained token** with `contents:write` on the repo (the shared
`GitHubConnectorFields` form). The push then writes two files —
`index.html` and the host `README.md` — via `GitHubTarget` in
`src/lib/publish/gitTarget.ts`:

- It talks to the **GitHub Contents REST API** with plain `fetch` (no SDK, no
  proprietary dependency), upserting each file: read its current blob SHA, then
  `PUT` the new content.
- The **token is held only in memory** in the modal's React state — it is never
  written into the exported bundle and never persisted.
- Changing the selection and pushing again re-publishes to the same repo (Sync).
- The endpoint is overridable (`apiBase`) for GitHub Enterprise.

`GitHubTarget` implements a small `PublishTarget` seam and is deliberately **one
implementation** of it — mirroring the `MapSource` pattern
([Architecture](Architecture.md)). The same target (with its conditional
`getFile` / `putFileConditional` / `GitPushConflictError` methods) is reused by
[Device sync](Device-Sync.md). Remove the connector and local download still
works fully — the app has **no hard dependency** on GitHub, honouring the
Constitution's zero-lock-in principle.

If a push fails (bad token, offline, expired credentials), the app reports it and
you fall back to local download; no journey data is sent anywhere else.

---

## Server-side Basic-Auth (a separate, optional thing)

The client-side passphrase is for **static hosts**. If instead you run a
**server** (nginx, Caddy, Apache), you can gate the file with HTTP **Basic-Auth**
as an entirely separate access control — use either, both, or neither. The
shipped `README.md` documents the nginx form:

```
location /my-journey/ {
  auth_basic "Private";
  auth_basic_user_file /etc/nginx/.htpasswd;
}
```

This is *documented, not implemented in the bundle* — it is a hosting choice for
self-hosters, kept clearly distinct from the static-host passphrase.

---

## No analytics, by default and forever

The published site collects **nothing** — there is no telemetry in the app and
none injected into the export, matching the app's own no-tracking guarantee
([Privacy and security](Privacy-and-Constitution.md)). If a self-hoster *wants*
analytics, the README explains they can add their own script tag to a copy of
`index.html`, or put the file behind a host that logs requests. Postcards never
adds tracking for you.

The map/reader keeps the reference-data **attribution** required by the source
licences — *"Coordinates from GeoNames (CC BY 4.0). Outline data © Natural Earth
/ OpenStreetMap contributors."* — visibly in the footer and under the map, and it
must be preserved (see [Reference data](Data-and-Provenance.md)).

---

## Where it lives in the code

| File | Role |
|------|------|
| `src/features/publish/PublishScreen.tsx` | The Publish modal: scope, cover, passphrase, preview, download, GitHub push. |
| `src/lib/publish/bundle.ts` | `buildJourney()` — derive the ordered steps, legs, and totals (pure). |
| `src/lib/publish/renderReader.ts` | `renderReaderHtml()` — emit the self-contained, inert reader document (pure). |
| `src/lib/publish/encrypt.ts` | WebCrypto AES-GCM + PBKDF2-SHA256 encrypt/decrypt of the payload. |
| `src/lib/publish/gitTarget.ts` | `GitHubTarget` — the optional GitHub Contents-API push behind the `PublishTarget` seam. |
| `src/lib/publish/hosting.ts` | `HOSTING_README` — the host-facing README shipped inside each export. |
| `src/lib/publish/HOSTING.md` | The same host notes as a repo file. |
| `apps/postcards/docs/publishing.md` | The author + host guide (mirrors the README). |
| `specs/012-journal-publish/` | The feature `spec.md` and `plan.md`. |

Note that a few things described in the spec/plan are intentionally simpler in the
shipped code: the scope selector offers *Everything / One trip / Date range* (the
spec's "tag" scope awaits the additive `tags` field); the reader map is a
schematic graticule with straight mode-coloured segments rather than embedded
country polygons; and GitHub auth uses a supplied fine-grained token (not the
device-flow). The privacy, offline, inert-data, and zero-lock-in guarantees all
hold as designed.
