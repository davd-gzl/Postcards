import type { Trip } from "../../lib/schema/models";

/** Month names for the filter dropdown, index 0 = January. */
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "all" (no time filter) or a 4-digit year string. */
export type YearFilter = "all" | string;
/** "all" (whole year) or a 2-digit month string ("01".."12"). */
export type MonthFilter = "all" | string;

/** Distinct 4-digit years across dated items, newest first. Undated items are ignored. */
export function distinctYearsDesc(items: { date: string | null }[]): string[] {
  const set = new Set<string>();
  for (const it of items) if (it.date) set.add(it.date.slice(0, 4));
  return [...set].sort((a, b) => b.localeCompare(a));
}

/** Distinct years present across dated trips, newest first. Undated trips are ignored. */
export function tripYears(trips: Trip[]): string[] {
  return distinctYearsDesc(trips);
}

/** Distinct months ("01".."12") that have a dated trip in the given year, ascending. */
export function tripMonths(trips: Trip[], year: string): string[] {
  const set = new Set<string>();
  const prefix = `${year}-`;
  for (const t of trips) if (t.date && t.date.startsWith(prefix)) set.add(t.date.slice(5, 7));
  return [...set].sort();
}

/**
 * Filter trips to a time period. "all" year → every trip (dated or not). A
 * specific year (optionally + month) keeps only dated trips in that window;
 * undated trips fall out, since they can't belong to a period.
 */
export function tripsInPeriod(trips: Trip[], year: YearFilter, month: MonthFilter): Trip[] {
  if (year === "all") return trips;
  const prefix = `${year}-`;
  return trips.filter((t) => {
    if (!t.date || !t.date.startsWith(prefix)) return false;
    if (month !== "all" && t.date.slice(5, 7) !== month) return false;
    return true;
  });
}

/** Human label for the active period, e.g. "2024", "August 2024", or "" for all-time. */
export function periodLabel(year: YearFilter, month: MonthFilter): string {
  if (year === "all") return "";
  if (month === "all") return year;
  const name = MONTH_NAMES[Number(month) - 1] ?? month;
  return `${name} ${year}`;
}
