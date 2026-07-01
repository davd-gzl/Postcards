import type { Feature, FeatureCollection, Point } from "geojson";
import type { Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";

/** Numeric ISO ids (matching the map geometry) of countries with any visit. */
export function visitedCountryNumerics(visits: Visit[], ref: ReferenceData): string[] {
  const set = new Set<string>();
  for (const v of visits) {
    const c = ref.countryByIso2(v.place.countryId);
    if (c) set.add(c.numeric);
  }
  return [...set];
}

/** Point features for visited cities (uses reference coordinates). */
export function visitedCityPoints(visits: Visit[], ref: ReferenceData): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const v of visits) {
    if (v.place.kind !== "city") continue;
    const city = ref.cityById(v.place.id);
    if (!city) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [city.lon, city.lat] },
      properties: { name: city.name },
    });
  }
  return { type: "FeatureCollection", features };
}
