import {
  FORMAT,
  PostcardsFileSchema,
  SCHEMA_VERSION,
  type PostcardsFile,
  type ReferenceSource,
  type Trip,
  type Visit,
} from "../../lib/schema/models";
import { getReferenceData } from "../../lib/reference/referenceData";

/** Build the canonical portable file object from the current visits + trips. */
export function buildFile(visits: Visit[], trips: Trip[] = [], now = new Date()): PostcardsFile {
  const referenceSources: ReferenceSource[] = getReferenceData().provenance.map((p) => ({
    dataset: p.dataset,
    license: p.license,
    version: p.version,
    url: p.url,
  }));
  const file: PostcardsFile = {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    visits,
    trips,
    referenceSources,
  };
  // Validate our own output before handing it to the user.
  return PostcardsFileSchema.parse(file);
}

/** Serialize to pretty, human-readable JSON (the canonical portable format). */
export function serializeFile(visits: Visit[], trips: Trip[] = [], now = new Date()): string {
  return JSON.stringify(buildFile(visits, trips, now), null, 2);
}

export const EXPORT_FILENAME = "places.postcards.json";
