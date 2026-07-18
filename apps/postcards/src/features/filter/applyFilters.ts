import type { Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import type { FilterState } from "../../lib/store/useFilters";
import { mapDateMatches, rangeExactYear } from "../travel/period";
import type { TFunction, MessageKey } from "../../lib/i18n";

// Pure predicates shared by every screen that slices places (spec 016 D3). No I/O,
// no mutation — deterministic for a given (input, FilterState). The map feeds its
// browse cities through viewport.ts (status + population there); THESE cover the
// Places lists and the active-filter summary, so both screens agree.

/** Whether one visit record passes the filter (Places lists). `status` is owned by
 *  the Places tab, so callers pass state.status = "all" there; population gates
 *  cities only (D4 — non-city kinds pass it unchanged). */
export function placeMatches(v: Visit, ref: ReferenceData, s: FilterState): boolean {
  if (s.status === "visited" && v.status !== "visited") return false;
  if (s.status === "wishlist" && v.status !== "wishlist") return false;
  if (s.status === "unvisited") return false; // a saved record is never "unvisited"
  if (!mapDateMatches(v.date, s.date)) return false;
  if (s.folder && v.folder !== s.folder) return false;
  if (s.favoritesOnly && !v.favorite) return false;
  if (s.hasPhoto && !(v.photos && v.photos.length > 0)) return false;
  if (s.hasNote && !(v.note && v.note.trim())) return false;
  if (s.minPop > 0 && v.place.kind === "city") {
    const c = ref.cityById(v.place.id);
    if ((c?.population ?? 0) < s.minPop) return false;
  }
  if (s.continent && ref.continentOf(v.place.countryId) !== s.continent) return false;
  return true;
}

/** Population of a visit's place for sorting (cities only; others sort as 0). */
function popOf(v: Visit, ref: ReferenceData): number {
  if (v.place.kind !== "city") return 0;
  return ref.cityById(v.place.id)?.population ?? 0;
}

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

/** Order a visit list per state.sort ("pop" = most people first; "az" = by name). */
export function sortPlaces(list: Visit[], ref: ReferenceData, s: FilterState): Visit[] {
  const out = [...list];
  if (s.sort === "az") out.sort((a, b) => collator.compare(a.place.name, b.place.name));
  else out.sort((a, b) => popOf(b, ref) - popOf(a, ref) || collator.compare(a.place.name, b.place.name));
  return out;
}

export interface ActiveFilterChip {
  field: keyof FilterState;
  label: string;
}

/** Localised, ordered summary of every non-default dimension (one chip each). The
 *  caller wires each chip's ✕ to clearField(field). Pure: no store dependency. */
export function activeChips(s: FilterState, t: TFunction): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (s.status !== "all") {
    chips.push({ field: "status", label: t(`filter.status.${s.status}` as MessageKey) });
  }
  if (s.minPop > 0) {
    const label = s.minPop >= 1_000_000 ? "1M+" : s.minPop >= 100_000 ? "100k+" : "10k+";
    chips.push({ field: "minPop", label });
  }
  if (s.date.mode === "undated") {
    chips.push({ field: "date", label: t("filter.date.undated") });
  } else if (s.date.mode === "range") {
    const y = rangeExactYear(s.date);
    chips.push({ field: "date", label: y ?? [s.date.from, s.date.to].filter(Boolean).join(" – ") });
  }
  if (s.folder) chips.push({ field: "folder", label: `📁 ${s.folder}` });
  if (s.mode !== "all") {
    chips.push({ field: "mode", label: t(`filter.mode.${s.mode}` as MessageKey) });
  }
  if (s.favoritesOnly) chips.push({ field: "favoritesOnly", label: t("filter.favoritesOnly") });
  if (s.hasPhoto) chips.push({ field: "hasPhoto", label: t("filter.hasPhoto") });
  if (s.hasNote) chips.push({ field: "hasNote", label: t("filter.hasNote") });
  if (s.continent) chips.push({ field: "continent", label: s.continent });
  if (s.sort !== "pop") chips.push({ field: "sort", label: t("filter.sort.az") });
  return chips;
}
