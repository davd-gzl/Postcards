import { create } from "zustand";
import type { PlaceRef } from "../schema/models";

export type Tab = "map" | "stats" | "places" | "trips" | "passport" | "journal" | "settings";
export type PlacesView = "visited" | "wishlist" | "countries" | "monuments" | "favorites";

// Small cross-cutting UI store:
// - tab lives here so any screen can navigate (e.g. a Places row jumping to the map)
// - searchFocusNonce lets the "/" shortcut focus the lazily-mounted search input
// - mapFocus lets other tabs ask the map to fly somewhere
// - cityPageId opens the per-city detail page over the current tab
// - placesViewRequest lets the stat strip open Places pre-filtered
// - journalDraftRequest lets a city page open the Journal composer prefilled
interface UiState {
  tab: Tab;
  setTab: (tab: Tab) => void;
  searchFocusNonce: number;
  focusSearch: () => void;
  mapFocus: { lon: number; lat: number; nonce: number } | null;
  flyTo: (lon: number, lat: number) => void;
  /** GeoNames id of the city whose detail page is open (null = closed). */
  cityPageId: string | null;
  openCity: (id: string) => void;
  closeCity: () => void;
  placesViewRequest: { view: PlacesView; nonce: number } | null;
  openPlaces: (view: PlacesView) => void;
  journalDraftRequest: { place: PlaceRef; nonce: number } | null;
  openJournalDraft: (place: PlaceRef) => void;
  // Travel-log time filter — shared so the map's trip arcs honour the same
  // period as the Trips list. "all" | 4-digit year, and "all" | "01".."12".
  tripYear: string;
  tripMonth: string;
  setTripPeriod: (year: string, month: string) => void;
}

export const useUi = create<UiState>((set, get) => ({
  tab: "map",
  setTab: (tab) => set({ tab, cityPageId: null }),
  searchFocusNonce: 0,
  focusSearch: () => set({ searchFocusNonce: get().searchFocusNonce + 1 }),
  mapFocus: null,
  flyTo: (lon, lat) =>
    set({
      tab: "map",
      cityPageId: null,
      mapFocus: { lon, lat, nonce: (get().mapFocus?.nonce ?? 0) + 1 },
    }),
  cityPageId: null,
  openCity: (id) => set({ cityPageId: id }),
  closeCity: () => set({ cityPageId: null }),
  placesViewRequest: null,
  openPlaces: (view) =>
    set({
      tab: "places",
      cityPageId: null,
      placesViewRequest: { view, nonce: (get().placesViewRequest?.nonce ?? 0) + 1 },
    }),
  journalDraftRequest: null,
  openJournalDraft: (place) =>
    set({
      tab: "journal",
      cityPageId: null,
      journalDraftRequest: { place, nonce: (get().journalDraftRequest?.nonce ?? 0) + 1 },
    }),
  tripYear: "all",
  tripMonth: "all",
  setTripPeriod: (tripYear, tripMonth) => set({ tripYear, tripMonth }),
}));
