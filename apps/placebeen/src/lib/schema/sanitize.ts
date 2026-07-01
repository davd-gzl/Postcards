// Inert-data helpers (Constitution VI: data is parsed, never executed).
// These neutralize content that could be dangerous when a data file is later
// opened in another tool (e.g. a spreadsheet) or rendered.

/** Characters that trigger formula evaluation in spreadsheet software. */
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@"]);

/** Remove C0/C1 control characters except newline (\n = 10) and tab (9). */
function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    const isControl = (code >= 0 && code <= 31 && code !== 9 && code !== 10) || code === 127;
    if (!isControl) out += ch;
  }
  return out;
}

/**
 * Sanitize a free-text string from (potentially untrusted) data:
 * - normalize newlines and remove control characters,
 * - neutralize leading formula/command characters,
 * - collapse to a bounded length.
 * Returns plain, inert text. Never evaluates anything.
 */
export function sanitizeText(input: string, maxLength = 2000): string {
  let out = stripControlChars(input.replace(/\r\n?/g, "\n")).trim();
  while (out.length > 0 && (FORMULA_PREFIXES.has(out[0]!) || out[0] === "\t")) {
    out = out.slice(1).trimStart();
  }
  if (out.length > maxLength) out = out.slice(0, maxLength);
  return out;
}

/** True if a value is a finite, safe number. */
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
