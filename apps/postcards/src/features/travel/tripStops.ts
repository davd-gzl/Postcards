import type { PlaceRef } from "../../lib/schema/models";

// Immutable ordered-stops helpers for the trip composer (spec 019). Pure, no I/O —
// each returns a NEW array so React state updates stay predictable. A reconstructed
// trip is an ordered chain of stops; `from`/`to` are just its first/last stop.

/** Append a stop to the end of the chain. */
export function addStop(stops: PlaceRef[], place: PlaceRef): PlaceRef[] {
  return [...stops, place];
}

/** Remove the stop at `index` (out-of-range index is a no-op copy). */
export function removeStop(stops: PlaceRef[], index: number): PlaceRef[] {
  if (index < 0 || index >= stops.length) return [...stops];
  return stops.filter((_, i) => i !== index);
}

/** Move a stop from one position to another; indices are clamped, so a drag past
 *  the ends just parks it at the end. A no-op move returns an equal-length copy. */
export function moveStop(stops: PlaceRef[], from: number, to: number): PlaceRef[] {
  const n = stops.length;
  if (n === 0) return [];
  const clamp = (i: number) => Math.max(0, Math.min(n - 1, i));
  const src = clamp(from);
  const dst = clamp(to);
  if (src === dst) return [...stops];
  const next = [...stops];
  const [moved] = next.splice(src, 1);
  next.splice(dst, 0, moved!);
  return next;
}

/** The journey's endpoints (first/last stop), or null when there are fewer than two
 *  stops — a reconstructed trip needs at least two to have a `from → to`. */
export function endpoints(stops: PlaceRef[]): { from: PlaceRef; to: PlaceRef } | null {
  if (stops.length < 2) return null;
  return { from: stops[0]!, to: stops[stops.length - 1]! };
}
