import {
  MAX_PHOTOS_PER_VISIT,
  normalizeVisitPhotos,
  placeKey,
  PostcardsFileSchema,
  SCHEMA_VERSION,
  type Trip,
  type Visit,
} from "../../lib/schema/models";

export type ImportResult =
  | { ok: true; visits: Visit[]; trips: Trip[]; warnings: string[] }
  | { ok: false; error: string };

/** Reject absurdly large inputs before parsing (main-thread DoS guard). Generous
 *  enough for photo-rich gallery files (postcards are embedded, downscaled) — this
 *  is a safety ceiling, not a schema rule, so the user's own backup always restores. */
const MAX_IMPORT_CHARS = 256_000_000;

/**
 * Parse + validate + sanitize an imported file (Constitution VI: data is inert).
 * The content is treated as pure data — parsed, never executed. Malformed,
 * unknown, or newer-versioned files are rejected with a clear reason. The Zod
 * schema transforms sanitize free-text fields (see models.ts / sanitize.ts).
 */
export function importFile(text: string): ImportResult {
  if (text.length > MAX_IMPORT_CHARS) {
    return { ok: false, error: "This file is too large to import safely." };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }

  const format = (raw as { format?: unknown }).format;
  // "placebeen" is the pre-rename marker — accept it so files exported by the
  // old build still restore, and normalize to the current marker for the schema.
  if (typeof raw !== "object" || raw === null || (format !== "postcards" && format !== "placebeen")) {
    return { ok: false, error: "This does not look like a Postcards file (missing format marker)." };
  }
  if (format === "placebeen") (raw as { format: string }).format = "postcards";

  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version === "number" && version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This file was made by a newer version (schema v${version}). Please update the app.`,
    };
  }

  const parsed = PostcardsFileSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.join(".") || "file";
    return { ok: false, error: `Invalid data at "${where}": ${first?.message ?? "unknown error"}.` };
  }

  // Migrate every record to the current photo shape (legacy `photo` -> `photos`)
  // so both the persisted copy and the in-memory copy are v3-shaped — otherwise a
  // restored postcard is invisible until the next reload.
  // Enforce one-visit-per-place on import too (FR-015); when a hand-edited file
  // lists a place twice, keep the first record's identity but UNION the galleries
  // (photos are now the payload — dropping one silently would lose data).
  const byPlace = new Map<string, Visit>();
  for (const raw of parsed.data.visits) {
    const v = normalizeVisitPhotos(raw);
    const key = placeKey(v.place);
    const existing = byPlace.get(key);
    if (!existing) {
      byPlace.set(key, v);
      continue;
    }
    const photos = [...(existing.photos ?? [])];
    for (const p of v.photos ?? []) {
      if (photos.length >= MAX_PHOTOS_PER_VISIT) break;
      if (!photos.some((q) => q.src === p.src)) photos.push(p);
    }
    byPlace.set(key, { ...v, visitId: existing.visitId, addedAt: existing.addedAt, photos });
  }
  const visits = [...byPlace.values()];
  // Enforce one-record-per-tripId too — the "trips" store is keyed on tripId, so a
  // hand-edited file with a duplicate id would silently drop rows on persist and
  // diverge from the in-memory count. Keep last-wins to match the IndexedDB put order.
  const tripById = new Map<string, Trip>();
  for (const t of parsed.data.trips) tripById.set(t.tripId, t);
  const trips = [...tripById.values()];
  const warnings: string[] = [];
  if (visits.length !== parsed.data.visits.length) warnings.push("Merged duplicate places in the file.");
  if (trips.length !== parsed.data.trips.length) warnings.push("Merged duplicate trips in the file.");
  return { ok: true, visits, trips, warnings };
}
