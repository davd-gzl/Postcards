# Hosting Postcards for free (private repo)

Postcards is a **static PWA** — one folder of files, no backend, no database, no
env vars, no secrets. That makes it free and trivial to host. GitHub Pages needs
a **public** repo on the free tier, so while this repo is private, use **Netlify**
(free, works with private repos). Everything the host needs is already committed:

- `netlify.toml` — build command + publish dir + Node version (auto-read on connect).
- `apps/postcards/public/_redirects` — SPA/PWA fallback (also works on drag-and-drop).
- `apps/postcards/public/_headers` — safe security + caching headers.
- `.nvmrc` — Node 22.

Pick one of the two paths below.

---

## Path A — Connect the repo (auto-deploy on every push)

Best if you want the live site to update whenever you push.

1. Go to **[app.netlify.com](https://app.netlify.com)** → **Add new site** → **Import an existing project** → **GitHub**.
2. Authorize Netlify's GitHub app and **grant it access to `davd-gzl/Postcards`** (you can scope it to just this repo — the repo stays private).
3. Pick the repo. Netlify reads `netlify.toml`, so the settings are pre-filled:
   - **Build command:** `pnpm --filter postcards build`
   - **Publish directory:** `apps/postcards/dist`
   - **Base directory:** _(leave empty — repo root)_
   - **Production branch:** `claude/repo-setup-speckit-3magw3` (this repo's default branch) — set it under **Site config → Build & deploy → Branches** if it doesn't default correctly.
4. **Deploy site.** You get a free HTTPS URL like `https://your-name.netlify.app` (rename it under **Site config → Change site name**). A custom domain is optional and also free (you add DNS).

Every push to the production branch now rebuilds and redeploys automatically.

---

## Path B — Drag-and-drop / CLI (no repo connection, repo stays fully private)

Best if you'd rather **not** give any third party access to the repo. You build
locally and hand Netlify only the finished files.

```bash
# 1. Build the static site
pnpm install
pnpm --filter postcards build      # → apps/postcards/dist
```

Then either:

- **Drag-and-drop:** open **[app.netlify.com/drop](https://app.netlify.com/drop)** and drop the **`apps/postcards/dist`** folder. Instant live URL. Re-drop to update.
- **CLI:**
  ```bash
  npx netlify-cli deploy --prod --dir apps/postcards/dist
  ```
  (First run opens a browser to log in; no repo access is ever requested.)

The `_redirects` and `_headers` files are baked into `dist/`, so the SPA fallback
and headers apply here too.

---

## Notes

- **It's a PWA:** once opened, it works offline and can be "installed" to a phone
  home screen. Serve it over HTTPS (Netlify always does) so the service worker runs.
- **Privacy holds when hosted:** the app still makes no network calls of its own —
  the only outbound requests are map tiles you explicitly opt into (the online
  OpenStreetMap basemap). Your data never leaves the browser.
- **No env/secrets:** don't add any — there's nothing server-side.

## Alternative host (same config)

Prefer **Cloudflare Pages**? It also has a great free tier and works with private
repos. Use the same settings — Build command `pnpm --filter postcards build`,
Output directory `apps/postcards/dist` — and it honours the same `_redirects` /
`_headers` files. (Set `NODE_VERSION=22` in its build environment variables, since
it doesn't read `netlify.toml`.)
