# Phase 1 Data Model: Cities & Countries Core (MVP)

Two cleanly separated domains, per the constitution:

- **User data** — authored by the person; the only thing in the portable file.
- **Reference data** — aggregated from external openly-licensed datasets; bundled read-only,
  never in the portable file, never invented by the app.

User records reference the world by **stable public identifiers** plus a denormalized display name,
so the portable file is small, inert, and legible on its own.

---

## User data (portable, in the JSON file)

### PlaceRef (embedded value, not stored standalone)

A stable pointer to a place in reference data.

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `"country" \| "city"` | Place type recorded for this visit |
| `id` | string | Stable external id: ISO 3166-1 alpha-2 for countries (e.g. `"FR"`); GeoNames id (as string) for cities (e.g. `"2988507"`) |
| `name` | string | Denormalized human-readable name at time of logging (keeps the file legible); display always re-resolves from reference data when available |
| `countryId` | string | ISO 3166-1 alpha-2 of the containing country (equals `id` when `kind = "country"`) |

**Validation**: `kind` in enum; `id` non-empty and shape-checked per `kind`; `name` non-empty,
length-bounded, plain text only (no control characters / markup / formula-like leading `=`,`+`).

### Visit

One record that a place was visited. User-authored.

| Field | Type | Notes |
|-------|------|-------|
| `visitId` | string (UUID) | Locally generated stable id |
| `place` | PlaceRef | What was visited |
| `date` | string \| null | Optional ISO 8601 date (`YYYY-MM-DD`); null if unknown |
| `note` | string \| null | Optional personal note; plain text, length-bounded, sanitized |
| `addedAt` | string | ISO 8601 timestamp the record was created |

**Rules**:
- **Dedupe**: at most one Visit per distinct `(place.kind, place.id)` for MVP; re-logging the same
  place updates rather than duplicates (FR-015).
- `date`, when present, must parse as a valid calendar date and not be in the future beyond today.
- `note`/`name` are treated as inert text: validated, length-capped, and sanitized on import;
  never interpreted.

### PlaceBeenFile (the portable file root)

| Field | Type | Notes |
|-------|------|-------|
| `format` | `"placebeen"` | Fixed magic string identifying the format |
| `schemaVersion` | integer | Starts at `1`; drives documented migrations |
| `exportedAt` | string | ISO 8601 timestamp |
| `visits` | Visit[] | All user visits |
| `referenceSources` | ReferenceSource[] | Provenance of datasets used to resolve ids (informational) |

**Rules**: unknown top-level keys are rejected on import; `format` and `schemaVersion` are required;
a newer `schemaVersion` than the app supports is refused with a clear message; older versions are
migrated forward.

### ReferenceSource (provenance record, informational)

| Field | Type | Notes |
|-------|------|-------|
| `dataset` | string | e.g. `"naturalearth-admin0"`, `"geonames"` |
| `license` | string | e.g. `"Public Domain"`, `"CC-BY-4.0"` |
| `version` | string | dataset version/date |
| `url` | string | source URL (informational only — never fetched from file contents) |

---

## Reference data (bundled read-only, NOT in the portable file)

### Country

| Field | Type | Notes |
|-------|------|-------|
| `iso2` | string | ISO 3166-1 alpha-2 (primary key) |
| `iso3` | string | ISO 3166-1 alpha-3 |
| `name` | string | Common name |
| `isSovereign` | boolean | Distinguishes sovereign states from self-governed/dependent territories (represented as the dataset defines — not merged/invented) |
| `geometryRef` | string | Reference into the boundary dataset for the map choropleth |
| `cityCount` | integer | Precomputed # of gazetteer cities in this country (denominator for **% of cities**) |
| `subdivisionCount` | integer | Precomputed # of first-level subdivisions (denominator for **% of subdivisions**) |

### Subdivision (first-level region)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | ISO 3166-2 where available, else Natural Earth code (primary key) |
| `countryIso2` | string | Parent country |
| `name` | string | Region name |

### City (gazetteer entry)

| Field | Type | Notes |
|-------|------|-------|
| `geonameId` | string | GeoNames id (primary key) |
| `name` | string | City name |
| `countryIso2` | string | Parent country |
| `subdivisionId` | string \| null | Parent first-level subdivision, if known |
| `lat` | number | Latitude (for the map point) |
| `lon` | number | Longitude |
| `population` | integer \| null | Informational (e.g. gazetteer threshold) |

---

## Relationships

```text
PlaceBeenFile 1───* Visit ─── PlaceRef ──▶ (resolves to) Country | City   [by stable id]
Country 1───* Subdivision
Country 1───* City
Subdivision 1───* City        (subdivisionId, when known)
```

- A Visit's `PlaceRef.id` resolves to a Country (`iso2`) or City (`geonameId`) in reference data.
- If resolution fails (dataset lacks the id), the app shows the stored denormalized `name` and flags
  it as unresolved — it never fabricates a reference entry.

## Derived statistics (computed, not stored)

| Metric | Definition |
|--------|------------|
| Countries visited | count of distinct `countryId` across visits |
| % of world | countries visited ÷ total Countries in reference data |
| Cities visited | count of distinct city visits |
| % of a country's cities | distinct visited cities in country ÷ that country's `cityCount` |
| % of a country's regions | distinct subdivisions with ≥1 visited city (or a country visit) ÷ `subdivisionCount` |

All denominators come from reference data (aggregator principle). Recompute target: <1s at ≥10k
visits (SC-004).

## Validation & security summary

- All imported data validated against the published JSON Schema (generated from Zod) before use.
- String fields (`name`, `note`) are length-bounded, plain-text, and sanitized; leading
  formula/command characters and control characters are stripped/rejected.
- No field is ever executed, evaluated, or used to trigger a fetch. Parsing is data-only.
- Unknown keys rejected; version mismatches handled explicitly (migrate or refuse).
