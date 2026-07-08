import { PostcardsFileSchema, SCHEMA_VERSION, type Trip, type Visit } from "../../lib/schema/models";
import { dedupeUpsert } from "../../lib/store/useVisits";

export type ImportResult =
  | { ok: true; visits: Visit[]; trips: Trip[]; warnings: string[] }
  | { ok: false; error: string };

/** Reject absurdly large inputs before parsing (main-thread DoS guard). */
const MAX_IMPORT_CHARS = 20_000_000;

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

  // Future: migrate parsed.data.schemaVersion < SCHEMA_VERSION here.
  // Enforce one-visit-per-place on import too (FR-015), not only on add.
  const visits = parsed.data.visits.reduce<Visit[]>((acc, v) => dedupeUpsert(acc, v), []);
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
