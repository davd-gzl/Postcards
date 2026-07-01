import { z } from "zod";
import { sanitizeText } from "./sanitize";

// Canonical, versioned schema for the portable data file.
// Single source of truth: these Zod models generate TS types AND the published
// JSON Schema (see tests/unit/schema.spec.ts). Contract: contracts/portable-data-file.md
export const FORMAT = "placebeen" as const;
export const SCHEMA_VERSION = 1;

const isoCountryId = z
  .string()
  .regex(/^[A-Z]{2}$/, "country id must be an ISO 3166-1 alpha-2 code");

export const PlaceRefSchema = z.object({
  kind: z.enum(["country", "city"]),
  id: z.string().min(1).max(64),
  name: z
    .string()
    .min(1)
    .max(200)
    .transform((s) => sanitizeText(s, 200)),
  countryId: isoCountryId,
});

export const VisitSchema = z.object({
  visitId: z.string().uuid(),
  place: PlaceRefSchema,
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
  addedAt: z.string().datetime({ offset: true }),
});

export const ReferenceSourceSchema = z.object({
  dataset: z.string().max(100),
  license: z.string().max(100),
  version: z.string().max(50),
  url: z.string().max(300).optional(),
});

export const PlaceBeenFileSchema = z
  .object({
    format: z.literal(FORMAT),
    schemaVersion: z.number().int().min(1),
    exportedAt: z.string().datetime({ offset: true }),
    visits: z.array(VisitSchema),
    referenceSources: z.array(ReferenceSourceSchema).optional().default([]),
  })
  .strict();

export type PlaceKind = z.infer<typeof PlaceRefSchema>["kind"];
export type PlaceRef = z.infer<typeof PlaceRefSchema>;
export type Visit = z.infer<typeof VisitSchema>;
export type ReferenceSource = z.infer<typeof ReferenceSourceSchema>;
export type PlaceBeenFile = z.infer<typeof PlaceBeenFileSchema>;

/** Stable key used for dedupe: one visit per (kind, id). */
export function placeKey(place: Pick<PlaceRef, "kind" | "id">): string {
  return `${place.kind}:${place.id}`;
}
