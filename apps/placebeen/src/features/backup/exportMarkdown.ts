import type { Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { computeCoverage } from "../stats/computeStats";
import { formatDate, formatInt, formatPercent } from "../../lib/format/format";

/** Escape pipe/newline so free text can't break the Markdown table (inert output). */
function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

/**
 * Human-readable, non-authoritative Markdown summary for sharing with friends
 * (FR-011). Not re-importable; contains no executable content.
 */
export function toMarkdown(visits: Visit[], ref: ReferenceData): string {
  const cov = computeCoverage(visits, ref);
  const lines: string[] = [];
  lines.push("# Places I've been");
  lines.push("");
  lines.push(
    `**${formatInt(cov.countriesVisited)} countries** (${formatPercent(cov.worldPct)} of the world) · ` +
      `**${formatInt(cov.citiesVisited)} cities**`,
  );
  lines.push("");
  lines.push("| Place | Type | Country | Date |");
  lines.push("| --- | --- | --- | --- |");
  const sorted = [...visits].sort((a, b) => a.place.name.localeCompare(b.place.name));
  for (const v of sorted) {
    const country = ref.countryByIso2(v.place.countryId)?.name ?? v.place.countryId;
    lines.push(
      `| ${cell(v.place.name)} | ${v.place.kind} | ${cell(country)} | ${cell(formatDate(v.date))} |`,
    );
  }
  lines.push("");
  lines.push("_Exported from Place'Been — local-first, private, offline._");
  return lines.join("\n");
}
