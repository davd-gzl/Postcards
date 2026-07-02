import { create } from "zustand";

// Tiny UI store. A focus "nonce" lets the "/" shortcut (in App) ask the
// lazily-mounted search input (in PlaceSearch) to focus, without a global event.
interface UiState {
  searchFocusNonce: number;
  focusSearch: () => void;
}

export const useUi = create<UiState>((set, get) => ({
  searchFocusNonce: 0,
  focusSearch: () => set({ searchFocusNonce: get().searchFocusNonce + 1 }),
}));
