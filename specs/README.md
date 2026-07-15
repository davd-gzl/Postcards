# Feature specs index

Specifications for Postcards features, in the Spec Kit format (see each `spec.md`).
`001-cities-countries` is the original MVP and carries the full workflow artifacts
(`plan.md`, `tasks.md`, `research.md`, `contracts/`, …). Every other directory is a
**retro-spec** — it describes an already-shipped feature, written after the fact
(convergence task T068 of `001-cities-countries/tasks.md`). Retro-specs are
`spec.md` (and sometimes `plan.md`) only, by design.

| #   | Directory | Feature | Kind |
|-----|-----------|---------|------|
| 001 | [`001-cities-countries`](001-cities-countries/) | Log cities/countries, offline map, coverage stats, single-file backup/restore | MVP |
| 002 | [`002-place-types`](002-place-types/) | Airports & more place types | retro-spec |
| 003 | [`003-travel-log`](003-travel-log/) | Trips / past journeys, distances & totals | retro-spec |
| 004 | [`004-offline-map-seam`](004-offline-map-seam/) | Offline detail basemap seam (PMTiles + Offline Map Store) | retro-spec |
| 005 | [`005-native-capacitor`](005-native-capacitor/) | Native iOS/Android packaging (Capacitor) | retro-spec |
| 006 | [`006-boarding-pass`](006-boarding-pass/) | Boarding-pass import (BCBP) | retro-spec |
| 007 | [`007-journal`](007-journal/) | Journal — dated, place-tagged travel-blog stories with photos | retro-spec |
| 008 | [`008-moments`](008-moments/) | Moments — once-in-a-lifetime world experiences linked to real places | retro-spec |
| 009 | [`009-passport-poster`](009-passport-poster/) | Passport flag collection & downloadable world-poster PNG | retro-spec |
| 010 | [`010-guides-wikivoyage`](010-guides-wikivoyage/) | Travel guides — opt-in Wikivoyage/Wikipedia summaries & full articles | retro-spec |
| 011 | [`011-photo-gallery`](011-photo-gallery/) | Per-place photo galleries, custom user places & the monument place type | retro-spec |

`002`–`006` predate this index (early retro-spec sketches). `007`–`011` were added
to cover the remaining shipped features — journal, moments, passport, guides, and
photos — which had no spec. All honour the constitution (`../CLAUDE.md`):
aggregator-only reference data with provenance, local-first, privacy by default,
inert data, keyboard-first, WCAG 2.1 AA.

`plan.md` and `tasks.md` exist only for `001-cities-countries`; the retro-specs are
`spec.md`-first by design. The workflow exception that authorized retro-specifying
these features is recorded in [`../docs/WORKFLOW-EXCEPTIONS.md`](../docs/WORKFLOW-EXCEPTIONS.md).
