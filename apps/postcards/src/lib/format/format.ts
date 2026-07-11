// Intl-based formatting so numbers/percents/dates adapt to the viewer's locale
// (Constitution VII: regional adaptivity). Locale defaults to the environment.

export function formatInt(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(Math.round(n));
}

/**
 * Flag emoji for an ISO 3166-1 alpha-2 country/territory code ("FR" -> 🇫🇷).
 * Pure Unicode regional indicators — offline, no assets; platforms without a
 * flag font show the letter pair, which stays informative.
 */
export function countryFlag(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/[A-Z]/g, (ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Great-circle distance in km -> localized "1,234 km" (rounded to the km). */
export function formatKm(km: number, locale?: string): string {
  return `${formatInt(km, locale)} km`;
}

/** value in [0,1] -> localized percentage, e.g. 0.1234 -> "12%". */
export function formatPercent(value: number, locale?: string, digits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(value);
}

/** ISO YYYY-MM-DD -> localized date; passthrough if unparseable. */
export function formatDate(iso: string | null, locale?: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}
