import { create } from "zustand";

export type Tab = "map" | "stats" | "places" | "trips";

// Small cross-cutting UI store:
// - tab lives here so any screen can navigate (e.g. a Places row jumping to the map)
// - searchFocusNonce lets the "/" shortcut focus the lazily-mounted search input
// - mapFocus lets other tabs ask the map to fly somewhere
interface UiState {
  tab: Tab;
  setTab: (tab: Tab) => void;
  searchFocusNonce: number;
  focusSearch: () => void;
  mapFocus: { lon: number; lat: number; nonce: number } | null;
  flyTo: (lon: number, lat: number) => void;
}

export const useUi = create<UiState>((set, get) => ({
  tab: "map",
  setTab: (tab) => set({ tab }),
  searchFocusNonce: 0,
  focusSearch: () => set({ searchFocusNonce: get().searchFocusNonce + 1 }),
  mapFocus: null,
  flyTo: (lon, lat) =>
    set({ tab: "map", mapFocus: { lon, lat, nonce: (get().mapFocus?.nonce ?? 0) + 1 } }),
}));
