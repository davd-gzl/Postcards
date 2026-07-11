import type { Story } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { formatDate } from "../../lib/format/format";

/**
 * Escape free text for a shared Markdown document so it stays inert: angle
 * brackets and backticks are neutralized so imported titles/text can't smuggle
 * raw HTML or code spans into a downstream renderer that permits inline HTML.
 * Newlines are kept — a story body is multi-line prose.
 */
function md(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/`/g, "\\`").trim();
}

/**
 * Human-readable, non-authoritative Markdown feed of your journal, for sharing
 * with friends (date, place, title, text — no photos). Not re-importable;
 * contains no executable content. A shareable website export may come later.
 */
export function journalToMarkdown(stories: Story[], ref: ReferenceData): string {
  const lines: string[] = [];
  lines.push("# Travel journal");
  for (const s of stories) {
    const country = ref.countryByIso2(s.place.countryId)?.name ?? s.place.countryId;
    lines.push("");
    lines.push(`## ${md(s.title)}`);
    lines.push("");
    lines.push(`_${md(formatDate(s.date))} — ${md(s.place.name)}, ${md(country)}_`);
    if (s.text) {
      lines.push("");
      lines.push(md(s.text));
    }
  }
  lines.push("");
  lines.push("_Exported from Postcards — local-first, private, offline._");
  return lines.join("\n");
}

export const JOURNAL_EXPORT_FILENAME = "journal.md";
