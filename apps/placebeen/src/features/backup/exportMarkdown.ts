import type { Trip, Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { computeCoverage } from "../stats/computeStats";
import { travelTotals, tripDistanceKm } from "../travel/distance";
import { formatDate, formatInt, formatKm, formatPercent } from "../../lib/format/format";

const MODE_LABEL: Record<Trip["mode"], string> = {
  flight: "Flight",
  train: "Train",
  bus: "Bus",
  ferry: "Ferry",
  car: "Car",
  other: "Other",
};

/** Escape pipe/newline so free text can't break the Markdown table (inert output). */
function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

/**
 * Human-readable, non-authoritative Markdown summary for sharing with friends
 * (FR-011). Not re-importable; contains no executable content.
 */
export function toMarkdown(visits: Visit[], trips: Trip[], ref: ReferenceData): string {
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

  if (trips.length) {
    const totals = travelTotals(trips, ref);
    lines.push("");
    lines.push("## Travel log");
    lines.push("");
    lines.push(`**${formatInt(totals.trips)} trips** · **${formatKm(totals.totalKm)}** travelled`);
    lines.push("");
    lines.push("| From | To | Mode | Date | Distance |");
    lines.push("| --- | --- | --- | --- | --- |");
    const byDate = [...trips].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    for (const t of byDate) {
      const km = tripDistanceKm(t, ref);
      lines.push(
        `| ${cell(t.from.name)} | ${cell(t.to.name)} | ${MODE_LABEL[t.mode]} | ` +
          `${cell(formatDate(t.date))} | ${km == null ? "—" : cell(formatKm(km))} |`,
      );
    }
  }

  lines.push("");
  lines.push("_Exported from Place'Been — local-first, private, offline._");
  return lines.join("\n");
}
