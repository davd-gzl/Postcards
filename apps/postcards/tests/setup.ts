import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initReferenceDataSync } from "../src/lib/reference/referenceData";
import type { Airport, City, Subdivision } from "../src/lib/reference/types";

// Tests read the real bundled reference data from disk and inject it synchronously.
const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) =>
  JSON.parse(readFileSync(join(here, "..", "public", "reference", name), "utf8"));
initReferenceDataSync(
  read("cities.json") as City[],
  read("subdivisions.json") as Subdivision[],
  read("airports.json") as Airport[],
);
