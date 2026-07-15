import { create } from "zustand";
import { DEFAULT_SCOPE, type CountryScope } from "../reference/scope";

// Lasting, cross-screen preferences (persisted to localStorage): the "what
// counts as a country" scope (honoured by stats, the map's counter strip and the
// country checklist), and whether place guides fetch their overview automatically
// when online.
const SCOPE_KEY = "postcards-country-scope";
const AUTO_GUIDES_KEY = "postcards-auto-guides";
const ONLINE_MAP_KEY = "postcards-online-map";
const MAX_MARKERS_KEY = "postcards-max-markers";
const THEME_KEY = "postcards-theme";

// Explicit colour theme. "system" follows the device (prefers-color-scheme);
// "light"/"dark" force a palette. The choice is applied by toggling a data-theme
// attribute on <html> (see applyThemeAttr + styles.css); the same key is read by
// a tiny inline script in index.html to avoid a flash of the wrong palette.
export type ThemeMode = "system" | "light" | "dark";

// How many airport / monument markers to draw at most in the current view, so a
// dense area doesn't blanket the map. Clamped to a sane range.
export const MARKER_CAP_CHOICES = [100, 250, 500, 1000] as const;
// Default lean: fewer markers means every pan and every visit-toggle redraw
// stays instant on phones; Settings offers more for people who want density.
const DEFAULT_MAX_MARKERS = 100;

// localStorage is unavailable in private mode / restricted contexts; reads fall
// back to null and writes are silently swallowed (settings just don't persist).
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

function loadMaxMarkers(): number {
  const n = Number(readLocal(MAX_MARKERS_KEY));
  return (MARKER_CAP_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_MAX_MARKERS;
}

function loadScope(): CountryScope {
  const v = readLocal(SCOPE_KEY);
  return v === "un" || v === "all" ? v : DEFAULT_SCOPE;
}

function loadTheme(): ThemeMode {
  const v = readLocal(THEME_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

// Drive the palette by toggling <html data-theme>. "system" removes the
// attribute (CSS then follows prefers-color-scheme); "light"/"dark" force it.
// Guarded so it's safe under SSR / non-DOM test environments.
export function applyThemeAttr(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

// Default ON: opening a place is itself an explicit action, so loading its public
// Wikivoyage/Wikipedia overview is expected. The toggle lets privacy-minded users
// require a tap instead. Only "0" disables it (so a first run defaults to on).
function loadAutoGuides(): boolean {
  return readLocal(AUTO_GUIDES_KEY) !== "0";
}

// The detailed OpenStreetMap map is on by default (it fetches map tiles from
// OpenStreetMap). Turning this off makes the app use the no-network offline map
// only, restoring the zero-outbound-request posture. Only "0" disables it.
function loadOnlineMap(): boolean {
  return readLocal(ONLINE_MAP_KEY) !== "0";
}

interface SettingsState {
  countryScope: CountryScope;
  setCountryScope: (scope: CountryScope) => void;
  autoLoadGuides: boolean;
  setAutoLoadGuides: (value: boolean) => void;
  onlineMap: boolean;
  setOnlineMap: (value: boolean) => void;
  maxMarkers: number;
  setMaxMarkers: (value: number) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  countryScope: loadScope(),
  setCountryScope: (countryScope) => {
    writeLocal(SCOPE_KEY, countryScope);
    set({ countryScope });
  },
  autoLoadGuides: loadAutoGuides(),
  setAutoLoadGuides: (autoLoadGuides) => {
    writeLocal(AUTO_GUIDES_KEY, autoLoadGuides ? "1" : "0");
    set({ autoLoadGuides });
  },
  onlineMap: loadOnlineMap(),
  setOnlineMap: (onlineMap) => {
    writeLocal(ONLINE_MAP_KEY, onlineMap ? "1" : "0");
    set({ onlineMap });
  },
  maxMarkers: loadMaxMarkers(),
  setMaxMarkers: (maxMarkers) => {
    writeLocal(MAX_MARKERS_KEY, String(maxMarkers));
    set({ maxMarkers });
  },
  theme: loadTheme(),
  setTheme: (theme) => {
    writeLocal(THEME_KEY, theme);
    applyThemeAttr(theme);
    set({ theme });
  },
}));

// Apply the saved theme once at module load, so the palette matches the stored
// choice even on the app's very first render (the index.html inline script
// already handles the pre-paint case for explicit light/dark).
applyThemeAttr(loadTheme());
