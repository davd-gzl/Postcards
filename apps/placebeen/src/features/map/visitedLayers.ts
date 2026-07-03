import type { Feature, FeatureCollection, Point } from "geojson";
import type { Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { formatCompact } from "../../lib/format/format";

function isVisited(v: Visit): boolean {
  return v.status !== "wishlist";
}

/** Numeric ISO ids (matching the map geometry) of countries with any visit. */
export function visitedCountryNumerics(visits: Visit[], ref: ReferenceData): string[] {
  const set = new Set<string>();
  for (const v of visits) {
    if (!isVisited(v)) continue;
    const c = ref.countryByIso2(v.place.countryId);
    if (c) set.add(c.numeric);
  }
  return [...set];
}

/**
 * Point features for visited cities. Each carries what the flag-pill marker
 * needs: country code, compact population label, favorite flag, and a
 * collision sort key so the most populous city wins when markers collide.
 */
export function visitedCityPoints(visits: Visit[], ref: ReferenceData): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const v of visits) {
    if (!isVisited(v) || v.place.kind !== "city") continue;
    const city = ref.cityById(v.place.id);
    if (!city) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [city.lon, city.lat] },
      properties: {
        name: city.name,
        cc: city.countryIso2,
        popLabel: city.population != null ? formatCompact(city.population) : "",
        fav: v.favorite ? 1 : 0,
        sortKey: -(city.population ?? 0),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Point features for wish-to-go cities (drawn as distinct wish markers). */
export function wishlistCityPoints(visits: Visit[], ref: ReferenceData): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const v of visits) {
    if (v.status !== "wishlist" || v.place.kind !== "city") continue;
    const city = ref.cityById(v.place.id);
    if (!city) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [city.lon, city.lat] },
      properties: { name: city.name, cc: city.countryIso2 },
    });
  }
  return { type: "FeatureCollection", features };
}
