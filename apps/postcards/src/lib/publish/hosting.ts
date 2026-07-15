// The host-facing README shipped INSIDE a published export (Constitution VIII:
// interoperable & self-documenting; FR-015). The "Push to GitHub" target writes
// this alongside index.html as README.md, so whoever hosts the site knows what
// it is, how to serve it, and how the optional passphrase works. Kept in sync
// with ./HOSTING.md (same text) and mirrored by docs/publishing.md.

export const HOSTING_README = `# Your published Postcards journey

This folder is a **self-contained, read-only travel-blog website**. Everything —
the reader code, styles, your journey data, and every photo — lives inside the
single \`index.html\` file. It runs **fully offline** and makes **no network
requests of any kind**: no fonts, no map tiles, no analytics, no trackers.

## How to view it

Just open \`index.html\`. Double-click it, or drag it into a browser tab. That's
it — there is no server and no build step.

## How to host it (pick one)

- **A plain folder or USB stick** — copy \`index.html\` anywhere and open it.
- **GitHub Pages** — put \`index.html\` in a repository, then in *Settings →
  Pages* choose the branch and \`/ (root)\` folder. Your site appears at
  \`https://<user>.github.io/<repo>/\`.
- **Netlify / Cloudflare Pages / Vercel** — drag the folder onto their "deploy"
  drop zone. No configuration needed.
- **Nextcloud / ownCloud** — upload \`index.html\`, then use *Share → Share link*.
  (Some Nextcloud setups download HTML instead of rendering it; if so, wrap it in
  a folder and share that, or enable "open in viewer".)
- **Any static web host** — upload \`index.html\` to the web root.

## The optional passphrase (client-side encryption)

If the author set a passphrase, the journey is stored **encrypted** (AES-GCM,
with a key stretched from the passphrase via PBKDF2-SHA256). When a visitor opens
the site they are asked for the passphrase; it is checked **entirely in their own
browser** and the content is decrypted there.

- The passphrase is **never written into any file** — you cannot recover it from
  the site, and neither can anyone else.
- There is **no recovery**. If the passphrase is lost, the author simply
  re-publishes with a new one.
- This works on any **static host with no server** (including GitHub Pages).

Share the passphrase with your readers **separately** from the link.

## No analytics — and how to add your own

The published site collects **nothing**. If you self-host and *want* analytics,
add your own script tag to a copy of \`index.html\`, or (better) put the file
behind a host that logs requests. Postcards never adds tracking for you.

## Optional: server-side password (a different thing)

The passphrase above is for **static hosts**. If instead you run a **server**
(nginx, Caddy, Apache), you can add HTTP **Basic-Auth** in front of the file as a
separate access control. For example, with nginx:

\`\`\`
location /my-journey/ {
  auth_basic "Private";
  auth_basic_user_file /etc/nginx/.htpasswd;
}
\`\`\`

This is independent of the client-side passphrase — use either, both, or neither.

## Attribution

Place coordinates come from **GeoNames** (CC BY 4.0). The route map's outline and
reference geometry derive from **Natural Earth** and **OpenStreetMap**
contributors. This credit is shown in the site's footer and must be preserved.

---

Published with **Postcards** — a private, local-first travel journal.
`;
