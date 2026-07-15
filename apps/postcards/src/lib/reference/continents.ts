// Continent/region categories (from world-countries "region") and their colors.
// Palette validated with the dataviz skill's validator (worst adjacent CVD ΔE 25
// on the light map surface — well clear of the ≥12 target).
export const CONTINENT_COLORS: Record<string, string> = {
  Europe: "#2a78d6",
  Asia: "#1baf7a",
  Africa: "#eb6834",
  Americas: "#4a3aa7",
  Oceania: "#e87ba4",
  Antarctic: "#7a8699",
};

export const CONTINENT_FALLBACK = "#22c55e";

export function continentColor(continent: string | undefined): string {
  return (continent && CONTINENT_COLORS[continent]) || CONTINENT_FALLBACK;
}

// Display order for continent groupings (matches the world-countries "region"
// set). Alphabetical, which is also the reading order used elsewhere.
export const CONTINENT_ORDER = [
  "Africa",
  "Americas",
  "Antarctic",
  "Asia",
  "Europe",
  "Oceania",
] as const;

// Bucket for borderless moments (worldwide scope, or an anchor whose country we
// can't resolve). Always pinned LAST, after every real continent.
export const ACROSS_THE_WORLD = "Across the world";

// Full ordered list used when grouping moments by home: continents first, the
// borderless bucket last.
export const MOMENT_GROUP_ORDER: readonly string[] = [...CONTINENT_ORDER, ACROSS_THE_WORLD];
