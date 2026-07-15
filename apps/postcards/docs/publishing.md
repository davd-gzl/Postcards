# Publishing a journey (Publish mode)

Postcards is your **private editor**. **Publish mode** turns a slice of your
journal into a **self-contained, read-only travel-blog website** you can host
anywhere — with no server and no build step. The app never changes; nothing
leaves your device except the single file you explicitly export.

This document is for you (the author) and for anyone who ends up hosting an
export. The exact same host-facing notes ship *inside* every GitHub export as
`README.md` (source: `src/lib/publish/hosting.ts` / `HOSTING.md`).

## What you get

A single **`index.html`**. Inside it: the reader (a small HTML/CSS/JS "book"),
your journey data, and every photo as an inline `data:` URL. It:

- runs **fully offline** and makes **zero external network requests** — no CDN,
  no web font, no map tile, no analytics;
- is **inert** — story text and captions are escaped and rendered as plain text,
  never executed, so a shared page can't form raw HTML, a script, or a tracking
  pixel;
- carries **no EXIF/GPS** — photos were already re-encoded on capture, so no
  camera or location metadata is included.

## How to publish

Open **Journal → 🌍 Publish site** (or **Settings → Publish mode**). Then:

1. **Choose what to publish** — *Everything*, *one trip*, or *a date range*.
   (The route is derived from your **Trips**; stories and photos attach to the
   places along it. Totals — countries and great-circle distance — are derived
   from the trip endpoints, never invented.)
2. **Write the cover** — a title and an optional subtitle.
3. **Optionally set a passphrase** (see below). Empty = a public site.
4. **Preview the book** in place — it uses the exact same reader that ships.
5. **Export**:
   - **Download `index.html`** — always available, touches no network. Drop it on
     any host or open it straight from the folder.
   - **Push to GitHub Pages** — one optional target. Provide owner / repo / branch
     and a fine-grained token (kept only in memory, never bundled). It writes
     `index.html` + this `README.md`. Change the selection and push again to
     update the live site (Sync).

## The reader (what a visitor sees)

A **cover** (title, date range, totals) → a **route map** (every stop in visit
order, transport legs drawn as coloured segments over a graticule, with Natural
Earth / OpenStreetMap / GeoNames attribution) → **one photo-led page per stop**
(hero photo, place, date, a transport-in badge, the story, and a photo gallery).

- Page **left → right** with the on-screen buttons, the **← / →** arrow keys, or
  by **swiping**. `Home` / `End` jump to the cover / last page.
- The photo **gallery** opens an accessible lightbox: arrows page, `Escape`
  closes, focus returns to the thumbnail.
- **Reduced motion** is respected (instant page turns).
- **Light and dark** themes follow the visitor's system, with a toggle.
- Keyboard-first and built to **WCAG 2.1 AA**.

## Hosting the file

| Host | What to do |
|------|------------|
| **Folder / USB stick** | Copy `index.html`; open it. |
| **GitHub Pages** | Put `index.html` in a repo; *Settings → Pages* → branch, `/ (root)`. |
| **Netlify / Cloudflare Pages / Vercel** | Drag the folder onto the deploy drop zone. |
| **Nextcloud / ownCloud** | Upload `index.html`; *Share → Share link*. |
| **Any static host** | Upload `index.html` to the web root. |

## The optional passphrase (client-side encryption)

Set a passphrase before exporting and the **journey payload is encrypted** with
**AES-GCM**, using a key derived from the passphrase via **PBKDF2-SHA256** (a
fresh random salt and IV per build). A visitor is shown a passphrase prompt; the
content is decrypted **entirely in their browser** (Web Crypto), so this works on
a plain **static host with no server**.

- The passphrase is **never written into any file**.
- A wrong passphrase fails to authenticate and reveals nothing.
- There is **no recovery** by design — if the passphrase is lost, re-publish with
  a new one.
- Share the passphrase **separately** from the link.

## Access control for self-hosters (server Basic-Auth)

The passphrase above is the option for **static hosts**. If you run a **server**,
you can instead (or additionally) gate the file with HTTP **Basic-Auth** — a
separate mechanism. Example (nginx):

```
location /my-journey/ {
  auth_basic "Private";
  auth_basic_user_file /etc/nginx/.htpasswd;
}
```

Caddy, Apache (`.htaccess` + `.htpasswd`), and most hosts have an equivalent.

## Analytics

There are **none**, by default, ever. If you self-host and want them, add your
own script to a copy of `index.html`, or use a host that logs requests. Postcards
adds no tracking for you.

## Privacy & zero lock-in (why it's built this way)

- **Local-first** — the whole build runs on-device; the local download target
  contacts no network. GitHub is one optional connector; remove it and download
  still works fully.
- **Portable** — the output is plain, relative-path static files runnable
  anywhere. No Google, no proprietary SDK, no host-side build step.
- **One-way share** — the published site is a share artifact, not a backup and
  not re-importable. Your canonical backup stays the portable JSON file
  (**Settings → Export**).
