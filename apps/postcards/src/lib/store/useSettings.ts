import { create } from "zustand";
import { DEFAULT_SCOPE, type CountryScope } from "../reference/scope";

// Lasting, cross-screen preferences (persisted to localStorage). Currently just
// the "what counts as a country" scope, honoured by the stats, the map's
// counter strip, and the country checklist.
const SCOPE_KEY = "postcards-country-scope";

function loadScope(): CountryScope {
  try {
    const v = localStorage.getItem(SCOPE_KEY);
    return v === "un" || v === "all" ? v : DEFAULT_SCOPE;
  } catch {
    return DEFAULT_SCOPE;
  }
}

interface SettingsState {
  countryScope: CountryScope;
  setCountryScope: (scope: CountryScope) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  countryScope: loadScope(),
  setCountryScope: (countryScope) => {
    try {
      localStorage.setItem(SCOPE_KEY, countryScope);
    } catch {
      /* private mode: not persisted */
    }
    set({ countryScope });
  },
}));
