# Workflow exceptions (Spec-Driven Development)

The constitution's development workflow expects every feature to go through
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
This file records the features that shipped **without** a spec under `specs/`,
so the exception is explicit instead of silent (per convergence task T068 of
`specs/001-cities-countries/tasks.md`).

## Recorded exception (2026-07-12)

The following features were built beyond the 001-cities-countries MVP during
rapid iteration, guided by the constitution directly rather than by a written
spec. They are documented in `CLAUDE.md` ("Shipped beyond the original MVP")
and honour all constitutional principles (aggregated reference data with
provenance, local-first, privacy by default, inert data, keyboard-first):

- Trips / travel log, incl. boarding-pass import (`src/features/travel/`)
- Journal — mini travel blog with photos (`src/features/journal/`)
- Moments — once-in-a-lifetime experiences list (`src/features/experiences/`)
- Passport — flag collection + world poster export (`src/features/passport/`)
- Wikivoyage/Wikipedia guides seam, incl. full-article reader (`src/lib/wikivoyage/`)
- Per-place photo gallery (`src/features/visits/PhotoGallery.tsx`)
- Airports & UNESCO monuments place kinds (+ datasets under `public/reference/`)
- Custom user-authored places ("add it yourself")

## Policy going forward

New feature-sized work SHOULD return to the spec-first workflow
(`/speckit-specify`). Retro-writing specs for the features above is welcome but
not required; if one of them grows materially, that growth gets a spec first.
