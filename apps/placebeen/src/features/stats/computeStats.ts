import type { Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";

export interface Coverage {
  countriesVisited: number;
  worldCountryCount: number;
  worldPct: number; // 0..1
  citiesVisited: number;
}

export interface CountryCoverage {
  iso2: string;
  name: string;
  citiesVisited: number;
  citiesTotal: number;
  cityPct: number; // 0..1
  regionsVisited: number;
  regionsTotal: number;
  regionPct: number; // 0..1
}

function pct(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

/** Coverage counts only places actually visited — never the wishlist. */
export function onlyVisited(visits: Visit[]): Visit[] {
  return visits.filter((v) => v.status !== "wishlist");
}

/** Distinct country ids across visited records (a city visit implies its country). */
export function visitedCountryIds(visits: Visit[]): Set<string> {
  return new Set(onlyVisited(visits).map((v) => v.place.countryId));
}

export function computeCoverage(visits: Visit[], ref: ReferenceData): Coverage {
  const countriesVisited = visitedCountryIds(visits).size;
  const cityIds = new Set(
    onlyVisited(visits)
      .filter((v) => v.place.kind === "city")
      .map((v) => v.place.id),
  );
  const worldCountryCount = ref.worldCountryCount();
  return {
    countriesVisited,
    worldCountryCount,
    worldPct: pct(countriesVisited, worldCountryCount),
    citiesVisited: cityIds.size,
  };
}

/** Both per-country metrics: % of the country's cities AND % of its regions (FR-007). */
export function computeCountryCoverage(
  visits: Visit[],
  ref: ReferenceData,
  iso2: string,
): CountryCoverage {
  const country = ref.countryByIso2(iso2);
  const visitedCityIds = new Set<string>();
  const visitedRegionIds = new Set<string>();
  for (const v of onlyVisited(visits)) {
    if (v.place.kind !== "city") continue;
    // Only count cities that exist in this country's gazetteer, so the numerator
    // can never exceed the denominator (imported cities outside the dataset don't inflate %).
    const city = ref.cityById(v.place.id);
    if (!city || city.countryIso2 !== iso2) continue;
    visitedCityIds.add(v.place.id);
    if (city.subdivisionId) visitedRegionIds.add(city.subdivisionId);
  }
  const citiesTotal = country?.cityCount ?? 0;
  const regionsTotal = country?.subdivisionCount ?? 0;
  return {
    iso2,
    name: country?.name ?? iso2,
    citiesVisited: visitedCityIds.size,
    citiesTotal,
    cityPct: pct(visitedCityIds.size, citiesTotal),
    regionsVisited: visitedRegionIds.size,
    regionsTotal,
    regionPct: pct(visitedRegionIds.size, regionsTotal),
  };
}

export interface ContinentCoverage {
  continent: string;
  visited: number;
  total: number;
  pct: number; // 0..1
}

/** Countries visited per continent, against each continent's full country count. */
export function computeContinentCoverage(visits: Visit[], ref: ReferenceData): ContinentCoverage[] {
  const totals = new Map<string, number>();
  for (const c of ref.countries) {
    if (!c.continent) continue;
    totals.set(c.continent, (totals.get(c.continent) ?? 0) + 1);
  }
  const visitedByContinent = new Map<string, Set<string>>();
  for (const iso2 of visitedCountryIds(visits)) {
    const continent = ref.countryByIso2(iso2)?.continent;
    if (!continent) continue;
    if (!visitedByContinent.has(continent)) visitedByContinent.set(continent, new Set());
    visitedByContinent.get(continent)!.add(iso2);
  }
  return [...visitedByContinent.entries()]
    .map(([continent, set]) => {
      const total = totals.get(continent) ?? 0;
      return { continent, visited: set.size, total, pct: pct(set.size, total) };
    })
    .sort((a, b) => b.visited - a.visited || a.continent.localeCompare(b.continent));
}

export interface CountryDetail {
  cities: string[];
  regionsVisited: string[];
  regionsRemaining: number;
}

/** Names behind a country's numbers: visited cities + covered regions. */
export function countryDetail(visits: Visit[], ref: ReferenceData, iso2: string): CountryDetail {
  const cities: string[] = [];
  const regionIds = new Set<string>();
  for (const v of onlyVisited(visits)) {
    if (v.place.kind !== "city") continue;
    const city = ref.cityById(v.place.id);
    if (!city || city.countryIso2 !== iso2) continue;
    cities.push(city.name);
    if (city.subdivisionId) regionIds.add(city.subdivisionId);
  }
  cities.sort((a, b) => a.localeCompare(b));
  const regionsVisited = [...regionIds]
    .map((id) => ref.subdivisionById(id)?.name ?? id)
    .sort((a, b) => a.localeCompare(b));
  const totalRegions = ref.countryByIso2(iso2)?.subdivisionCount ?? 0;
  return { cities, regionsVisited, regionsRemaining: Math.max(0, totalRegions - regionIds.size) };
}

export type CountrySort = "cities" | "regions" | "name";

/** Countries with recorded visits, sorted by the chosen key, for the stats list. */
export function visitedCountriesList(
  visits: Visit[],
  ref: ReferenceData,
  sortBy: CountrySort = "cities",
): CountryCoverage[] {
  const list = [...visitedCountryIds(visits)].map((iso2) =>
    computeCountryCoverage(visits, ref, iso2),
  );
  const byName = (a: CountryCoverage, b: CountryCoverage) => a.name.localeCompare(b.name);
  const cmp: Record<CountrySort, (a: CountryCoverage, b: CountryCoverage) => number> = {
    cities: (a, b) => b.citiesVisited - a.citiesVisited || byName(a, b),
    regions: (a, b) => b.regionsVisited - a.regionsVisited || byName(a, b),
    name: byName,
  };
  return list.sort(cmp[sortBy]);
}
