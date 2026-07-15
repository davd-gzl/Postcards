# Postcards wiki

A privacy-first, local-first aggregator for remembering the places you've been —
no server, no account, one portable file you own. This wiki has nine pages; each
topic has a single home, and other pages link to it.

**Start here:** [Home](Home.md) → [Features](Features.md) → [Architecture](Architecture.md).

### Pages

- **[Home](Home.md)** — what Postcards is, the constitution in brief, and a tour of the screens.
- **[Features](Features.md)** — everything the app does today, screen by screen and feature by feature.
- **[Architecture](Architecture.md)** — tech stack, workspace layout, and the seams (`MapSource`, schema, stores, sync) that enforce the constitution in code.
- **[Data and provenance](Data-and-Provenance.md)** — every named, openly-licensed dataset, its license, and how provenance is recorded and shown.
- **[Privacy and the Constitution](Privacy-and-Constitution.md)** — the eight non-negotiable principles and the code and tests that make each one real.
- **[Publishing](Publishing.md)** — turning a slice of your journal into a self-contained, read-only travel-blog site.
- **[Device sync](Device-Sync.md)** — server-less phone ↔ laptop sync through the one portable file.
- **[Development](Development.md)** — clone, install, run, test, self-host, and the Spec-Driven Development workflow.
- **[Roadmap](Roadmap.md)** — an honest account of what is shipped, partial, spec-only, and out of scope.

### Jump to a screen

[Map](Features.md#the-map) · [Places](Features.md#places) ·
[Trips](Features.md#trips--boarding-pass-import) · [Journal](Features.md#journal) ·
[Moments](Features.md#moments) · [Passport](Features.md#passport--world-poster) ·
[Stats](Features.md#coverage--statistics) · [Backup](Features.md#backup-import--reset)

---

*In-repo deep-dives live under [`docs/`](../docs) and per-feature specs under
[`specs/`](../specs). Reference-data provenance is in
[`provenance.json`](../apps/postcards/src/lib/reference/data/provenance.json).*
