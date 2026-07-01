# Contract: Bundled Reference Data

Reference data is aggregated from external, openly-licensed datasets and bundled **read-only**,
strictly separate from user data. The app never authors or edits these facts (Constitution I).
Records in the portable user file reference this data by **stable public identifiers**.

## Datasets, licenses, provenance

| Domain | Dataset | License | Primary key |
|--------|---------|---------|-------------|
| Countries & territories, boundaries | Natural Earth Admin 0 | Public Domain | ISO 3166-1 alpha-2 |
| First-level subdivisions (regions) | Natural Earth Admin 1 | Public Domain | ISO 3166-2 (fallback: NE code) |
| City gazetteer | GeoNames (population-thresholded) | CC BY 4.0 | GeoNames id |
| Base map tiles | Protomaps basemap (OpenStreetMap) | ODbL | n/a (tiles) |

`public/reference/PROVENANCE.md` records source URL, license, and version/date for each; GeoNames
(CC BY) attribution and OSM (ODbL) attribution are shown in-app. URLs are informational only and are
never fetched as a result of parsing any data file.

## Delivered shapes (read-only)

Loaders expose the entities defined in `data-model.md`:

- **Country**: `iso2`, `iso3`, `name`, `isSovereign`, `geometryRef`, `cityCount`, `subdivisionCount`.
- **Subdivision**: `id`, `countryIso2`, `name`.
- **City**: `geonameId`, `name`, `countryIso2`, `subdivisionId?`, `lat`, `lon`, `population?`.

`cityCount` and `subdivisionCount` are **precomputed at build time** so the two per-country metrics
(% of cities, % of subdivisions) resolve without scanning the full gazetteer at runtime.

## Loader contract

```ts
export interface ReferenceData {
  countries(): Promise<Country[]>;
  countryByIso2(iso2: string): Promise<Country | undefined>;
  subdivisionsOf(countryIso2: string): Promise<Subdivision[]>;
  /** Search cities for the add/log flow; bounded results for responsiveness. */
  searchCities(query: string, opts?: { limit?: number }): Promise<City[]>;
  cityById(geonameId: string): Promise<City | undefined>;
  /** Total number of countries in the dataset — denominator for "% of world". */
  worldCountryCount(): Promise<number>;
}
```

## Rules

- Reference data is immutable at runtime; user actions never write to it.
- A place absent from reference data is **not** created by the app; the add flow reports "not in
  dataset" and points to the external dataset (Constitution I, FR-016).
- Datasets are versioned; updating a dataset MUST keep prior identifiers resolvable where possible,
  and the user file stores a denormalized `name` so historical records stay legible if an id is
  retired.
- Reference data is loaded independently of user data so the user can back up personal records
  without the datasets (Constitution — Data & Dataset Standards).
