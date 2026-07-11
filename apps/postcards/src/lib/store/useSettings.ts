import { create } from "zustand";
import { DEFAULT_SCOPE, type CountryScope } from "../reference/scope";

// Lasting, cross-screen preferences (persisted to localStorage): the "what
// counts as a country" scope (honoured by stats, the map's counter strip and the
// country checklist), and whether place guides fetch their overview automatically
// when online.
const SCOPE_KEY = "postcards-country-scope";
const AUTO_GUIDES_KEY = "postcards-auto-guides";
const ONLINE_MAP_KEY = "postcards-online-map";

function loadScope(): CountryScope {
  try {
    const v = localStorage.getItem(SCOPE_KEY);
    return v === "un" || v === "all" ? v : DEFAULT_SCOPE;
  } catch {
    return DEFAULT_SCOPE;
  }
}

// Default ON: opening a place is itself an explicit action, so loading its public
// Wikivoyage/Wikipedia overview is expected. The toggle lets privacy-minded users
// require a tap instead. Only "0" disables it (so a first run defaults to on).
function loadAutoGuides(): boolean {
  try {
    return localStorage.getItem(AUTO_GUIDES_KEY) !== "0";
  } catch {
    return true;
  }
}

// The detailed OpenStreetMap map is on by default (it fetches map tiles from
// OpenStreetMap). Turning this off makes the app use the no-network offline map
// only, restoring the zero-outbound-request posture. Only "0" disables it.
function loadOnlineMap(): boolean {
  try {
    return localStorage.getItem(ONLINE_MAP_KEY) !== "0";
  } catch {
    return true;
  }
}

interface SettingsState {
  countryScope: CountryScope;
  setCountryScope: (scope: CountryScope) => void;
  autoLoadGuides: boolean;
  setAutoLoadGuides: (value: boolean) => void;
  onlineMap: boolean;
  setOnlineMap: (value: boolean) => void;
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
  autoLoadGuides: loadAutoGuides(),
  setAutoLoadGuides: (autoLoadGuides) => {
    try {
      localStorage.setItem(AUTO_GUIDES_KEY, autoLoadGuides ? "1" : "0");
    } catch {
      /* private mode: not persisted */
    }
    set({ autoLoadGuides });
  },
  onlineMap: loadOnlineMap(),
  setOnlineMap: (onlineMap) => {
    try {
      localStorage.setItem(ONLINE_MAP_KEY, onlineMap ? "1" : "0");
    } catch {
      /* private mode: not persisted */
    }
    set({ onlineMap });
  },
}));
