// Parse a hand-typed "lat, lon" coordinate string for the Add-a-place form.
// The documented, on-screen order is latitude-first ("48.85, 2.35"), but people
// routinely paste the OTHER order — GeoJSON, MapLibre, and many map tools emit
// [lng, lat]. A latitude can never exceed ±90, so when the first value is out of
// latitude range but the pair is valid the other way round, the input is
// unambiguously reversed and we correct it (flagging `swapped` so the UI can say
// so). When BOTH readings are in range we cannot tell them apart, so we respect
// the documented latitude-first order and let the form's live preview (which
// resolves the point to a country) expose a genuine mix-up. Pure & offline.

export interface ParsedCoords {
  lat: number;
  lon: number;
  /** True when the input was reversed (lon, lat) and we corrected it. */
  swapped: boolean;
}

const PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/;

export function parseCoordsInput(input: string): ParsedCoords | null {
  const m = PAIR.exec(input);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  // Reading it as typed: a = latitude, b = longitude.
  const asTyped = Math.abs(a) <= 90 && Math.abs(b) <= 180;
  // Reading it reversed: b = latitude, a = longitude.
  const reversed = Math.abs(b) <= 90 && Math.abs(a) <= 180;
  // Prefer the documented latitude-first order whenever it is physically valid.
  if (asTyped) return { lat: a, lon: b, swapped: false };
  // Otherwise, if only the reversed reading is valid, the user pasted lon, lat.
  if (reversed) return { lat: b, lon: a, swapped: true };
  return null;
}
