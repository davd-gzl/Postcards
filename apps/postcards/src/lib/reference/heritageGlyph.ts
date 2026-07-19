/** The badge emoji for a World Heritage site's category, matching the map's
 *  monument markers (see MONUMENT_STYLE in MapView). Using it for list rows means
 *  a visited monument never reads as a city (which shows a country flag). */
export function heritageGlyph(category?: string | null): string {
  return category === "natural" ? "🌲" : category === "mixed" ? "🏞️" : "🏛️";
}
