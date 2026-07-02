// Intl-based formatting so numbers/percents/dates adapt to the viewer's locale
// (Constitution VII: regional adaptivity). Locale defaults to the environment.

export function formatInt(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(Math.round(n));
}

/** Compact figure, e.g. 2200000 -> "2.2M". Surfaces the sort key in tight rows. */
export function formatCompact(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
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
