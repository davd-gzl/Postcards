# Wikivoyage seam

A **self-contained, framework-agnostic** module that turns a place into
Wikivoyage travel-guide links (city guide, country guide, country overview, and
a phrasebook per spoken language — which also covers the alphabet/pronunciation),
plus an **opt-in** online fetch of a short article summary.

It is written to be lifted **as-is** into a shared ecosystem library later. To
keep it extractable it has **no dependency** on this app's stores, reference
data, or React — every function takes plain inputs.

## Contract

Input — `WikivoyagePlaceInput` (see `types.ts`):

```ts
{ cityName?: string; countryName: string; countryIso2: string; languages?: {code,name}[] }
```

- `countryName` MUST be the **Wikivoyage article title** — i.e. the *common*
  country name ("Russia", "Laos", "Taiwan"), NOT an ISO "official" name
  ("Russian Federation", …). The consuming app supplies this (Postcards derives
  it from `world-countries` `name.common`, shipped as `reference/article-names.json`).
- `languages[].name` is the English language name Wikivoyage titles phrasebooks
  with ("French" → "French phrasebook").

Output:

- `guidesFor(input, lang?)` → `WikivoyageLink[]` — pure, offline-safe; each entry
  is a ready-to-open URL. No network.
- `fetchSummary(title, { lang?, signal?, fetchFn? })` → `WikivoyageSummary | null`
  — **opt-in, online**. Only call on an explicit user action. Degrades gracefully
  (returns `null` on offline/blocked/missing/disambiguation). Inert: reads only the
  plain-text `extract` and strips markup. Sends `no-referrer` and no credentials —
  nothing leaks. Wikivoyage text is **CC BY-SA 4.0**; `attribution` is returned for
  display and must be shown.

## Design rules (Constitution)

- **Aggregator, never author** — links/summaries only; no authored travel content.
- **Privacy by default** — no telemetry; summaries fetched only on demand; `no-referrer`.
- **Graceful degradation** — links always work offline; a search-URL fallback covers
  title mismatches.
- **Inert** — fetched text is treated as data, never HTML/executed.

## Extraction checklist

- Move `src/lib/wikivoyage/` verbatim; carry `tests/unit/wikivoyage.spec.ts` (app-independent).
- Keep the `GuideButton` React adapter and the `ReferenceData` name/language lookups
  in the consuming app — the library stays data-free (pure functions over caller-supplied names).
- Ship `article-names.json` / `languages.json` as the consuming app's reference data,
  not inside the library.
