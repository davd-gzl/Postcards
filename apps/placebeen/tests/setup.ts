import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initReferenceDataSync } from "../src/lib/reference/referenceData";
import type { City } from "../src/lib/reference/types";

// Tests read the real bundled gazetteer from disk and inject it synchronously.
const here = dirname(fileURLToPath(import.meta.url));
const cities = JSON.parse(
  readFileSync(join(here, "..", "public", "reference", "cities.json"), "utf8"),
) as City[];
initReferenceDataSync(cities);
