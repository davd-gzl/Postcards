import { z } from "zod";
import { sanitizeText } from "./sanitize";

// Canonical, versioned schema for the portable data file.
// Single source of truth: these Zod models generate TS types AND the published
// JSON Schema (see tests/unit/schema.spec.ts). Contract: contracts/portable-data-file.md
export const FORMAT = "postcards" as const;
// v2 adds the optional top-level `trips` array (travel log). Files stay
// structurally back-compatible (v1 files import unchanged), but the bump means an
// older build opening a v2 file shows the graceful "update the app" prompt rather
// than a cryptic strict-parse error on the unknown `trips` key.
// v3 turns a visit's single `photo` into a `photos` gallery (each with an optional
// caption). Both fields validate, so v1/v2 files import unchanged; new exports write
// `photos`. Older builds opening a v3 file get the same graceful "update" prompt.
// v4 adds the "custom" place kind — a USER-authored point (name + coordinates) for
// places missing from the reference datasets. Reference data stays aggregated;
// custom points are personal data and live only in the user's own file.
// v5 adds the optional top-level `stories` array (Journal — a mini travel blog).
// Files stay structurally back-compatible (v4 files import unchanged), but the bump
// means an older build opening a v5 file shows the graceful "update the app" prompt
// rather than a cryptic strict-parse error on the unknown `stories` key.
export const SCHEMA_VERSION = 5;

const isoCountryId = z
  .string()
  .regex(/^[A-Z]{2}$/, "country id must be an ISO 3166-1 alpha-2 code");

export const PlaceRefSchema = z
  .object({
    // Additive: older files only ever used "country"/"city", so they still validate.
    // A file with a newer kind opened in an older app build fails closed (unknown kind), by design.
    kind: z.enum(["country", "city", "airport", "heritage", "custom"]),
    id: z.string().min(1).max(64),
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((s) => sanitizeText(s, 200)),
    countryId: isoCountryId,
    // Coordinates carried on the record itself — only used by kind "custom"
    // (user-authored points have no reference-data entry to look coords up in).
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
  })
  .strict();

// Ids are opaque, inert stable strings — the app mints UUIDs, but the portable
// file is meant to be hand- and tool-writable (AI-friendly), so we don't demand
// strict RFC-4122 form (Zod 4 tightened .uuid()); just a bounded non-empty id.
const idString = z.string().min(1).max(100);

/** Most photos one place's gallery may hold (bounds the inline portable file). */
export const MAX_PHOTOS_PER_VISIT = 48;

/** A bounded, inert inline image data URL (never an external link). */
const photoDataUrl = z
  .string()
  .max(6_000_000)
  .refine((s) => s.startsWith("data:image/"), "photo must be an inline image data URL");

/**
 * One photo in a place's gallery: the inline image + an optional short caption
 * (e.g. "the old town", "the monument"). Inert & private: the image is only ever
 * rendered via <img src>, never executed, and never leaves the device except in an
 * explicit export. Downscaled on capture.
 */
export const PhotoSchema = z
  .object({
    src: photoDataUrl,
    caption: z
      .string()
      .max(300)
      .nullable()
      .optional()
      .transform((v) => (v == null ? null : sanitizeText(v, 300))),
  })
  .strict();

export const VisitSchema = z.object({
  visitId: idString,
  place: PlaceRefSchema,
  /** "visited" = been there; "wishlist" = want to go. Old files default to visited. */
  status: z.enum(["visited", "wishlist"]).optional().default("visited"),
  /** Starred by the user. */
  favorite: z.boolean().optional().default(false),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  note: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .transform((v) => (v == null ? null : sanitizeText(v, 2000))),
  /**
   * Legacy single "postcard" photo (schema ≤ v2). Kept so v1/v2 files import
   * unchanged; on load it is migrated into `photos[0]` (see normalizeVisitPhotos).
   */
  photo: photoDataUrl.nullable().optional(),
  /**
   * Your gallery of photos for this place — a postcard, a monument, the view, …
   * each with an optional caption. Stored on-device (privacy/inert as above).
   */
  photos: z.array(PhotoSchema).max(MAX_PHOTOS_PER_VISIT).optional(),
  addedAt: z.string().datetime({ offset: true }),
}).strict();

/** How a journey was made. Additive: unknown modes never occur (closed enum). */
export const TravelModeSchema = z.enum(["flight", "train", "bus", "ferry", "car", "other"]);

/**
 * A journey already taken (Travel Log). from/to reuse PlaceRef so a leg can join
 * cities, airports, or countries. Distance is DERIVED from endpoint coordinates
 * at read time (see features/travel/distance.ts) — never stored, never invented.
 */
export const TripSchema = z
  .object({
    tripId: idString,
    from: PlaceRefSchema,
    to: PlaceRefSchema,
    mode: TravelModeSchema.optional().default("flight"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    carrier: z
      .string()
      .max(120)
      .nullable()
      .optional()
      .transform((v) => (v == null ? null : sanitizeText(v, 120))),
    note: z
      .string()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => (v == null ? null : sanitizeText(v, 2000))),
    addedAt: z.string().datetime({ offset: true }),
  })
  .strict();

/** Most photos one journal story may hold (bounds the inline portable file). */
export const MAX_PHOTOS_PER_STORY = 24;

/**
 * One journal story (Journal — a mini travel blog): a dated, titled entry about a
 * place you've been, with free text and its own small photo gallery. Personal data
 * only — the app never authors world facts here. Photos reuse PhotoSchema, so they
 * stay inline, inert data URLs that never leave the device outside an explicit export.
 */
export const StorySchema = z
  .object({
    storyId: idString,
    place: PlaceRefSchema,
    /** The day the story is about — required, unlike a visit's optional date. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z
      .string()
      .min(1)
      .max(200)
      .transform((s) => sanitizeText(s, 200)),
    text: z
      .string()
      .max(8000)
      .transform((s) => sanitizeText(s, 8000)),
    photos: z.array(PhotoSchema).max(MAX_PHOTOS_PER_STORY).optional(),
    addedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const ReferenceSourceSchema = z
  .object({
    dataset: z.string().max(100),
    license: z.string().max(100),
    version: z.string().max(50),
    url: z.string().max(300).optional(),
  })
  .strict();

export const PostcardsFileSchema = z
  .object({
    format: z.literal(FORMAT),
    schemaVersion: z.number().int().min(1),
    exportedAt: z.string().datetime({ offset: true }),
    visits: z.array(VisitSchema),
    // Additive & optional: files predating the travel log import unchanged.
    trips: z.array(TripSchema).optional().default([]),
    // Additive & optional: files predating the journal import unchanged.
    stories: z.array(StorySchema).optional().default([]),
    referenceSources: z.array(ReferenceSourceSchema).optional().default([]),
  })
  .strict();

export type PlaceKind = z.infer<typeof PlaceRefSchema>["kind"];
export type PlaceRef = z.infer<typeof PlaceRefSchema>;
export type Photo = z.infer<typeof PhotoSchema>;
export type Visit = z.infer<typeof VisitSchema>;

/**
 * Migrate a visit's legacy single `photo` into the `photos` gallery and drop the
 * legacy field, so the rest of the app only ever reads `photos`. Idempotent —
 * safe to run on every load/import. Returns a new object (never mutates input).
 */
export function normalizeVisitPhotos(v: Visit): Visit {
  const photos: Photo[] = v.photos ? [...v.photos] : [];
  if (v.photo && !photos.some((p) => p.src === v.photo)) {
    photos.unshift({ src: v.photo, caption: null });
  }
  const { photo: _legacy, ...rest } = v;
  // Only carry `photos` when there is at least one — keeps photo-less records and
  // exports clean, and the rest of the app reads `v.photos ?? []`.
  return photos.length ? { ...rest, photos } : rest;
}
export type TravelMode = z.infer<typeof TravelModeSchema>;
export type Trip = z.infer<typeof TripSchema>;
export type Story = z.infer<typeof StorySchema>;
export type ReferenceSource = z.infer<typeof ReferenceSourceSchema>;
export type PostcardsFile = z.infer<typeof PostcardsFileSchema>;

/** Stable key used for dedupe: one visit per (kind, id). */
export function placeKey(place: Pick<PlaceRef, "kind" | "id">): string {
  return `${place.kind}:${place.id}`;
}
