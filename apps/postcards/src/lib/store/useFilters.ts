import { create } from "zustand";

// The ONE shared filter state. Every screen that slices the user's places — the
// map (markers + in-view list + counters) and the Places lists — reads THIS, so
// they can never disagree (spec 016). Preference dimensions persist to
// localStorage (reusing the keys the old scattered controls used); the rest are
// session-scoped, exactly as the map's date/folder always were.

// Structurally identical to the map's CityFilter / MapMode / MapDate so a
// FilterState value passes straight into viewport.ts and MapView without adapters
// (TypeScript structural typing), while this module stays free of feature imports.
export type FilterStatus = "all" | "visited" | "wishlist" | "unvisited";
export type SortOrder = "pop" | "az";
export type FilterMode = "all" | "cities" | "monuments" | "airports";
export type FilterDate =
  | { mode: "all" }
  | { mode: "undated" }
  | { mode: "range"; from: string; to: string };

export interface FilterState {
  status: FilterStatus;
  /** Minimum city population (0 = any). Gates cities only (spec 016 D4). */
  minPop: number;
  date: FilterDate;
  /** "" = all folders/trips. */
  folder: string;
  sort: SortOrder;
  /** Map-only: which place kind the markers show. */
  mode: FilterMode;
  // Growth dimensions (US4) — off by default, hosted in the one panel.
  favoritesOnly: boolean;
  hasPhoto: boolean;
  hasNote: boolean;
  /** "" = all continents. */
  continent: string;
}

export const POP_CHOICES = [0, 10_000, 100_000, 1_000_000] as const;

export const DEFAULT_FILTERS: FilterState = {
  status: "all",
  minPop: 0,
  date: { mode: "all" },
  folder: "",
  sort: "pop",
  mode: "all",
  favoritesOnly: false,
  hasPhoto: false,
  hasNote: false,
  continent: "",
};

// Persisted preference dimensions reuse the keys the old inline controls used, so
// upgrading users keep their choices; session dimensions are never written.
const STATUS_KEY = "postcards-city-filter";
const MINPOP_KEY = "postcards-city-minpop";
const SORT_KEY = "postcards-list-sort";
const MODE_KEY = "postcards-map-mode";

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: not persisted */
  }
}

function loadStatus(): FilterStatus {
  const v = readLocal(STATUS_KEY);
  return v === "visited" || v === "wishlist" || v === "unvisited" ? v : "all";
}
function loadMinPop(): number {
  const n = Number(readLocal(MINPOP_KEY));
  return (POP_CHOICES as readonly number[]).includes(n) ? n : 0;
}
function loadSort(): SortOrder {
  return readLocal(SORT_KEY) === "az" ? "az" : "pop";
}
function loadMode(): FilterMode {
  const v = readLocal(MODE_KEY);
  return v === "cities" || v === "monuments" || v === "airports" ? v : "all";
}

function persist(state: FilterState): void {
  writeLocal(STATUS_KEY, state.status);
  writeLocal(MINPOP_KEY, String(state.minPop));
  writeLocal(SORT_KEY, state.sort);
  writeLocal(MODE_KEY, state.mode);
}

/** True iff every dimension is at its default (⇒ no active filters, empty summary). */
export function isDefault(s: FilterState): boolean {
  return (
    s.status === "all" &&
    s.minPop === 0 &&
    s.date.mode === "all" &&
    s.folder === "" &&
    s.sort === "pop" &&
    s.mode === "all" &&
    !s.favoritesOnly &&
    !s.hasPhoto &&
    !s.hasNote &&
    s.continent === ""
  );
}

/** A copy of `s` with exactly `field` reset to its default (for a chip's ✕). */
export function withFieldCleared(s: FilterState, field: keyof FilterState): FilterState {
  return { ...s, [field]: DEFAULT_FILTERS[field] } as FilterState;
}

interface FilterStore extends FilterState {
  set: (partial: Partial<FilterState>) => void;
  clearField: (field: keyof FilterState) => void;
  clearAll: () => void;
}

export const useFilters = create<FilterStore>((set, get) => ({
  ...DEFAULT_FILTERS,
  status: loadStatus(),
  minPop: loadMinPop(),
  sort: loadSort(),
  mode: loadMode(),
  set: (partial) => {
    set(partial);
    persist(get());
  },
  clearField: (field) => {
    set({ [field]: DEFAULT_FILTERS[field] } as Partial<FilterState>);
    persist(get());
  },
  clearAll: () => {
    set({ ...DEFAULT_FILTERS });
    persist(get());
  },
}));

/** Read the current FilterState (the persisted/session fields only) without the actions. */
export function currentFilters(s: FilterStore): FilterState {
  return {
    status: s.status,
    minPop: s.minPop,
    date: s.date,
    folder: s.folder,
    sort: s.sort,
    mode: s.mode,
    favoritesOnly: s.favoritesOnly,
    hasPhoto: s.hasPhoto,
    hasNote: s.hasNote,
    continent: s.continent,
  };
}
