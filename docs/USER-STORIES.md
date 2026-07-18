# Postcards — User Stories (living record)

The durable, reusable record of what the product owner (the maintainer) wants
Postcards to be and do. Kept like the constitution: append here whenever a new
story is articulated; never drop one silently. The constitution
(`.specify/memory/constitution.md`) says what must always be true; **this** says
what we're building and why. Spec-driven detail for the active redesign lives in
`specs/015-coherent-efficient/`.

Status legend: ✅ done (verified & shipped) · 🚧 in progress · 🔲 planned · 💬 answered.

---

## Vision / North Star

**A pocket atlas of where you've been — mark a place in a tap, offline; browse and
show it off; turn it into a shareable travel blog. No accounts, no GAFAM, no
lock-in.** It is *"Been"* (simple, local, note the cities you've been) **+** a
*Polarsteps*-style journal **+** one-button publish — and it must stay that simple
to feel.

**Primary user:** a non-technical traveller, often offline or on a weak/metered
connection, using it on the go (a train, a hotel, a bar) to show a friend "that's
where I've been" and tell the story.

**Three core jobs (in order):** ① log fast (one tap, offline) · ② browse & show a
friend (favorites / this-trip / near-me in one tap; tap a place → map + list +
photo) · ③ journal & publish (one tap to write; one button to a shareable site).

**Standing principles (from the owner, reinforcing the constitution):** efficient
(fast, low-memory — it must not lag on a phone); strictly offline-capable and
no-backend/decentralized; no GAFAM; privacy by default; one portable file; usable
by non-technical people; **no blabla** (terse copy); WCAG AA + keyboard-first.

---

## Epic A — Coherence & efficiency redesign (spec 015)

The agreed themes. Full detail + acceptance criteria in
`specs/015-coherent-efficient/{spec,plan,tasks}.md`.

- ✅ **A1 — One clean Online/Offline mode.** The map has no "detailed map" button;
  one global mode gates all egress; online controls grouped in Settings; Offline =
  zero app-initiated requests.
- ✅ **A2 — Durable long-term memory.** Request persistent storage on first data; a
  protection indicator + last-backup read so a browser reset can't silently wipe a
  user's travels.
- 🚧 **A3 — Fast "show a friend" navigation.** Tap a place anywhere → map flies AND
  its list row selects/scrolls (✅). One-tap views were tried as a top chip row and
  **removed** (owner: "looks bad, takes space for little"); reachable via Places
  tabs instead. Remaining: richer sort/filter (see Epic B).
- 🔲 **A4 — Journal like Polarsteps.** One-tap compose (✅); finish sort/filter parity.
- 🔲 **A5 — Effortless sharing, GitHub demoted.** QR + one-file transfer; one-button
  self-contained site → drag-to-Netlify-Drop; GitHub PAT behind "Advanced"; **no
  OAuth** (a serverless PWA can't do it without a backend). Owner leaning "token is
  fine, just make QR/file/publish the headline."
- 🔲 **A6 — No-blabla onboarding.** Terse, mode-adaptive first run.
- 🔲 **A7 — Native app via Capacitor.** Android now + iOS from one codebase; durable
  native storage; status bar / safe areas / keyboard / haptics.
- 🔲 **A8 — Speed & mobile** (cross-cutting): snappy on phone + laptop even with the
  full gazetteer; city-detail photo always visible on mobile.

---

## Epic B — Filtering, performance & data density (owner batch, 2026-07-17)

The map/list/stats must scale and let the user slice their data precisely, and
must not lag on a phone.

- ✅ **B1 — Personal-status filter.** Map list filter is **All · Visited · Want list
  · Not visited** (visited / wishlist / neither).
- 🔲 **B2 — Filter by population (number of people).** A "more detailed" filter: show
  only cities above a population threshold (e.g. >10k, >100k, >1M). Applies to the
  map list and Places; combinable with the status/date/folder filters. Keep this a
  first-class, reusable filter dimension.
- ✅ **B3 — Lower the marker cap.** Default is now **25 on mobile / 100 on desktop**
  (was 250), and the Settings picker offers 25/50/100/200/400. Marked places are
  kept first, so the cap only ever thins browse markers, never your own. _(60a8367)_
- ✅ **B4 — "Show all visited" vs "optimize".** Settings → Map → **"Show one city per
  area"**: OFF shows every visited city; ON collapses each area (country +
  subdivision) to its most-populous visited city — favourites and custom points
  always survive. A dense map stays fast and readable; the data is untouched.
- ✅ **B5 — Airport visit counts.** The Trips screen shows a **"Busiest airports"**
  roll-up: every airport you've been to, ranked by how many times it appears across
  your trips (each flight leg touching it counts) plus any explicit airport visit —
  most-visited first. Tap a row to fly to it on the map.

---

## Epic C — Stats screen: compact & deeper

The stats screen must show more at a glance and stop being noisy.

- ✅ **C1 — At-a-glance progress bars.** Stats now opens with **two headline bars** —
  Countries and **Big cities** (every gazetteer city, 15k+ people) — read before
  drilling into any country. Replaced the single countries ring.
- ✅ **C2 — Compact, no per-city chips.** The **one-chip-per-city** wall inside each
  country card is **gone** (a country's cities % is already the bar; names live in
  Places + on the map). Regions and monuments chips stay — they're few and "what's
  left" is actionable. _Deeper still (distributions/records) remains open._

---

## How to use this file

- When the owner articulates a new want, **add it here first** (as a story with an
  id + status), then implement.
- Reconcile status as work ships; link to the relevant `specs/…` or commit when a
  story is delivered.
- This complements `BACKLOG.md` (tactical, per-commit) — this file is the durable
  *why/what*, the backlog is the *doing*.
