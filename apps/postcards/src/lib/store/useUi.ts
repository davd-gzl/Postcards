import { create } from "zustand";
import type { PlaceRef } from "../schema/models";

export type Tab = "map" | "stats" | "places" | "trips" | "passport" | "journal" | "settings";
export type PlacesView = "visited" | "wishlist" | "countries" | "monuments" | "favorites";

/** One navigation snapshot — what Escape/Back returns to. */
interface NavState {
  tab: Tab;
  cityPageId: string | null;
  countryPageId: string | null;
}

// Small cross-cutting UI store:
// - tab lives here so any screen can navigate (e.g. a Places row jumping to the map)
// - searchFocusNonce lets the "/" shortcut focus the lazily-mounted search input
// - mapFocus lets other tabs ask the map to fly somewhere
// - cityPageId / countryPageId open detail pages over the current tab
// - placesViewRequest lets the stat strip open Places pre-filtered
// - journalDraftRequest lets a city page open the Journal composer prefilled
// - history powers Escape/Back: every navigation pushes the previous snapshot,
//   goBack() pops it (so the top-bar tab follows where you return to)
interface UiState {
  tab: Tab;
  setTab: (tab: Tab) => void;
  searchFocusNonce: number;
  focusSearch: () => void;
  mapFocus: { lon: number; lat: number; nonce: number } | null;
  flyTo: (lon: number, lat: number) => void;
  /** GeoNames id (or heritage/custom id) of the open detail page (null = closed). */
  cityPageId: string | null;
  openCity: (id: string) => void;
  closeCity: () => void;
  /** ISO2 of the open country page (null = closed). */
  countryPageId: string | null;
  openCountry: (iso2: string) => void;
  placesViewRequest: { view: PlacesView; nonce: number } | null;
  openPlaces: (view: PlacesView) => void;
  journalDraftRequest: { place: PlaceRef; nonce: number } | null;
  openJournalDraft: (place: PlaceRef) => void;
  history: NavState[];
  /** Return to the previous screen. True if there was somewhere to go back to. */
  goBack: () => boolean;
  // Travel-log time filter — shared so the map's trip arcs honour the same
  // period as the Trips list. "all" | 4-digit year, and "all" | "01".."12".
  tripYear: string;
  tripMonth: string;
  setTripPeriod: (year: string, month: string) => void;
}

const HISTORY_CAP = 24;

export const useUi = create<UiState>((set, get) => {
  /** Snapshot the current screen onto the history stack (deduped, capped). */
  function pushHistory(): NavState[] {
    const { tab, cityPageId, countryPageId, history } = get();
    const snap: NavState = { tab, cityPageId, countryPageId };
    const last = history[history.length - 1];
    if (
      last &&
      last.tab === snap.tab &&
      last.cityPageId === snap.cityPageId &&
      last.countryPageId === snap.countryPageId
    ) {
      return history;
    }
    return [...history.slice(-(HISTORY_CAP - 1)), snap];
  }

  return {
    tab: "map",
    setTab: (tab) => set({ history: pushHistory(), tab, cityPageId: null, countryPageId: null }),
    searchFocusNonce: 0,
    focusSearch: () => set({ searchFocusNonce: get().searchFocusNonce + 1 }),
    mapFocus: null,
    flyTo: (lon, lat) =>
      set({
        history: pushHistory(),
        tab: "map",
        cityPageId: null,
        countryPageId: null,
        mapFocus: { lon, lat, nonce: (get().mapFocus?.nonce ?? 0) + 1 },
      }),
    cityPageId: null,
    openCity: (id) => set({ history: pushHistory(), cityPageId: id, countryPageId: null }),
    closeCity: () => {
      // Prefer real back-navigation; fall back to just closing the page.
      if (!get().goBack()) set({ cityPageId: null, countryPageId: null });
    },
    countryPageId: null,
    openCountry: (iso2) => set({ history: pushHistory(), countryPageId: iso2, cityPageId: null }),
    placesViewRequest: null,
    openPlaces: (view) =>
      set({
        history: pushHistory(),
        tab: "places",
        cityPageId: null,
        countryPageId: null,
        placesViewRequest: { view, nonce: (get().placesViewRequest?.nonce ?? 0) + 1 },
      }),
    journalDraftRequest: null,
    openJournalDraft: (place) =>
      set({
        history: pushHistory(),
        tab: "journal",
        cityPageId: null,
        countryPageId: null,
        journalDraftRequest: { place, nonce: (get().journalDraftRequest?.nonce ?? 0) + 1 },
      }),
    history: [],
    goBack: () => {
      const h = get().history;
      const last = h[h.length - 1];
      if (!last) return false;
      set({ ...last, history: h.slice(0, -1) });
      return true;
    },
    tripYear: "all",
    tripMonth: "all",
    setTripPeriod: (tripYear, tripMonth) => set({ tripYear, tripMonth }),
  };
});
