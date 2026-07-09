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
export const SCHEMA_VERSION = 2;

const isoCountryId = z
  .string()
  .regex(/^[A-Z]{2}$/, "country id must be an ISO 3166-1 alpha-2 code");

export const PlaceRefSchema = z
  .object({
    // Additive: older files only ever used "country"/"city", so they still validate.
    // A file with "airport" opened in an older app build fails closed (unknown kind), by design.
    kind: z.enum(["country", "city", "airport"]),
    id: z.string().min(1).max(64),
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((s) => sanitizeText(s, 200)),
    countryId: isoCountryId,
  })
  .strict();

// Ids are opaque, inert stable strings — the app mints UUIDs, but the portable
// file is meant to be hand- and tool-writable (AI-friendly), so we don't demand
// strict RFC-4122 form (Zod 4 tightened .uuid()); just a bounded non-empty id.
const idString = z.string().min(1).max(100);

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
   * Your own "postcard" photo for this place, stored on-device as an inline image
   * data URL — never an external link (privacy: it can't phone home; inert: it's
   * only ever shown via <img src>, never executed). Downscaled on capture.
   */
  photo: z
    .string()
    .max(6_000_000)
    .refine((s) => s.startsWith("data:image/"), "photo must be an inline image data URL")
    .nullable()
    .optional(),
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
    referenceSources: z.array(ReferenceSourceSchema).optional().default([]),
  })
  .strict();

export type PlaceKind = z.infer<typeof PlaceRefSchema>["kind"];
export type PlaceRef = z.infer<typeof PlaceRefSchema>;
export type Visit = z.infer<typeof VisitSchema>;
export type TravelMode = z.infer<typeof TravelModeSchema>;
export type Trip = z.infer<typeof TripSchema>;
export type ReferenceSource = z.infer<typeof ReferenceSourceSchema>;
export type PostcardsFile = z.infer<typeof PostcardsFileSchema>;

/** Stable key used for dedupe: one visit per (kind, id). */
export function placeKey(place: Pick<PlaceRef, "kind" | "id">): string {
  return `${place.kind}:${place.id}`;
}
