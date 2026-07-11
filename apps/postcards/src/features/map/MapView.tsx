import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap, type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { feature } from "topojson-client";
import type { FeatureCollection, Polygon, MultiPolygon, Point, Feature, LineString } from "geojson";
import { getReferenceData } from "../../lib/reference/referenceData";
import { bundledMapSource } from "../../lib/map-source/bundledMapSource";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";
import { airportPoints, monumentPoints, visitedCityPoints, wishlistCityPoints } from "./visitedLayers";
import type { Bounds } from "./viewport";
import type { City } from "../../lib/reference/types";
import type { PlaceRef } from "../../lib/schema/models";
import { countryFlag, formatInt } from "../../lib/format/format";

// Natural Earth 50m country geometry, served as a static asset (SW-cached for
// offline). Fetched ONCE and cached at module scope so remounts (basemap change,
// tab switch) never re-download or re-parse it.
const GEOMETRY_URL = `${import.meta.env.BASE_URL}basemap/countries-50m.json`;

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

let pmtilesRegistered = false;
function ensurePmtilesProtocol(): void {
  if (pmtilesRegistered) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  pmtilesRegistered = true;
}

async function fetchCountries(): Promise<FeatureCollection<Polygon | MultiPolygon> | null> {
  try {
    const res = await fetch(GEOMETRY_URL);
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topo: any = await res.json();
    const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<
      Polygon | MultiPolygon
    >;
    for (const f of fc.features) {
      f.properties = { ...(f.properties ?? {}), numeric: String(f.id ?? "") };
    }
    return fc;
  } catch {
    return null;
  }
}

// Module-level cache: resolve the country geometry at most once per session, and
// allow a retry after a failed load (offline first-run) without a full remount.
let countriesPromise: Promise<FeatureCollection<Polygon | MultiPolygon> | null> | null = null;
function getCountries(force = false): Promise<FeatureCollection<Polygon | MultiPolygon> | null> {
  if (force) countriesPromise = null;
  if (!countriesPromise) {
    countriesPromise = fetchCountries().then((fc) => {
      if (!fc) countriesPromise = null; // let a later attempt retry
      return fc;
    });
  }
  return countriesPromise;
}

const EMOJI_FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
const PILL_FONT = '600 21px "Inter Variable", system-ui, sans-serif';

/**
 * A compact city marker: just the country flag in a small pill — no population
 * label (that's shown on tap, in a popup). Favourites get a gold ring. Drawn at
 * 2× for crispness.
 */
/**
 * Visited-city marker: the bare flag emoji (no box) with a soft white halo so it
 * reads on any basemap. Favourites get a small gold star at the corner.
 */
function makeCityPill(iso2: string, favorite: boolean): ImageData {
  const w = 44;
  const h = 38; // ~19px on screen
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `27px ${EMOJI_FONT}`;
  ctx.shadowColor = "rgba(255, 255, 255, 0.95)";
  ctx.shadowBlur = 5;
  // Draw twice: a stronger halo pass, then the crisp flag.
  ctx.fillText(countryFlag(iso2), w / 2, h / 2 + 1);
  ctx.shadowBlur = 0;
  ctx.fillText(countryFlag(iso2), w / 2, h / 2 + 1);
  if (favorite) {
    ctx.font = `14px ${EMOJI_FONT}`;
    ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
    ctx.shadowBlur = 3;
    ctx.fillText("⭐", w - 9, 9);
  }
  return ctx.getImageData(0, 0, w, h);
}

/** Monument pin: 🏛 on a crisp white chip with an amber ring — the bare grey
 * emoji vanished against the basemap. Amber-filled once seen, + a ✅ badge. */
function makeMonumentPin(seen: boolean): ImageData {
  const s = 40; // 20px on screen
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = seen ? "#f6c98a" : "#ffffff";
  ctx.fill();
  ctx.lineWidth = seen ? 3.5 : 2.5;
  ctx.strokeStyle = "#b45309";
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `22px ${EMOJI_FONT}`;
  ctx.fillText("🏛️", s / 2, s / 2 + 1);
  if (seen) {
    ctx.font = `13px ${EMOJI_FONT}`;
    ctx.fillText("✅", s - 9, 9);
  }
  return ctx.getImageData(0, 0, s, s);
}

/** Airport marker: [✈ CODE] pill, tinted (sky = been, amber = wish). */
function makeAirportPin(iata: string, wish: boolean, favorite: boolean): ImageData {
  const h = 30;
  const pad = 8;
  const gap = 5;
  const planeFont = `16px ${EMOJI_FONT}`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const plane = "✈️";
  ctx.font = planeFont;
  const planeW = ctx.measureText(plane).width;
  ctx.font = PILL_FONT;
  const codeW = ctx.measureText(iata).width;
  const w = Math.ceil(pad + planeW + gap + codeW + pad);
  canvas.width = w;
  canvas.height = h;

  const accent = wish ? "#d97706" : "#0284c7";
  const bg = wish ? "#fff7ed" : "#eff6ff";
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(r, 1);
  ctx.arcTo(w - 1, 1, w - 1, h - 1, r - 1);
  ctx.arcTo(w - 1, h - 1, 1, h - 1, r - 1);
  ctx.arcTo(1, h - 1, 1, 1, r - 1);
  ctx.arcTo(1, 1, w - 1, 1, r - 1);
  ctx.closePath();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = favorite ? 3 : 1.5;
  ctx.strokeStyle = favorite ? "#f59e0b" : accent;
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = planeFont;
  ctx.fillText(plane, pad, h / 2 + 1);
  ctx.font = PILL_FONT;
  ctx.fillStyle = accent;
  ctx.fillText(iata, pad + planeW + gap, h / 2 + 1);
  return ctx.getImageData(0, 0, w, h);
}

function inViewPoints(cities: City[]): FeatureCollection<Point> {
  const ref = getReferenceData();
  const features: Feature<Point>[] = cities.map((c) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [c.lon, c.lat] },
    properties: {
      id: c.id,
      name: c.name,
      cc: c.countryIso2,
      pop: c.population ?? 0,
      region: c.subdivisionId ? ref.subdivisionById(c.subdivisionId)?.name ?? "" : "",
    },
  }));
  return { type: "FeatureCollection", features };
}

/**
 * Popup for any tappable place marker: name, region · population, and actions —
 * check/uncheck visited right from the map, plus the city detail page.
 */
function openPlacePopup(
  map: MlMap,
  lngLat: maplibregl.LngLatLike,
  info: { name: string; sub: string; place: PlaceRef; hasPage: boolean },
): void {
  const el = document.createElement("div");
  el.className = "map-popup";
  const name = document.createElement("strong");
  name.textContent = info.name;
  el.appendChild(name);
  if (info.sub) {
    const sub = document.createElement("span");
    sub.textContent = info.sub;
    el.appendChild(sub);
  }
  const actions = document.createElement("div");
  actions.className = "map-popup-actions";
  const popup = new maplibregl.Popup({ closeButton: false, offset: 12, maxWidth: "220px" })
    .setLngLat(lngLat)
    .setDOMContent(el);

  // The toggle flips in place — the popup STAYS OPEN so you can check/uncheck
  // (or read the details) without re-tapping the marker.
  let visited = findByPlace(useVisits.getState().visits, info.place)?.status === "visited";
  const toggle = document.createElement("button");
  toggle.type = "button";
  const paint = () => {
    toggle.className = "mini-btn" + (visited ? " mini-on" : "");
    toggle.textContent = visited ? "✓ Visited" : "✓ Been there";
  };
  paint();
  toggle.onclick = () => {
    void useVisits.getState().toggleVisit(info.place);
    visited = !visited;
    paint();
  };
  actions.appendChild(toggle);

  if (info.hasPage) {
    const page = document.createElement("button");
    page.type = "button";
    page.className = "mini-btn";
    page.textContent = "Details";
    page.onclick = () => {
      popup.remove();
      useUi.getState().openCity(info.place.id);
    };
    actions.appendChild(page);
  }
  el.appendChild(actions);
  popup.addTo(map);
}

export interface MapFocus {
  lon: number;
  lat: number;
  key: number;
}

export interface MapFit {
  bounds: [[number, number], [number, number]];
  key: number;
}

export type Basemap = "simple" | "osm" | "detail";
export type MapMode = "all" | "cities" | "monuments" | "airports";

const MODE_LAYERS: Record<Exclude<MapMode, "all">, string[]> = {
  cities: ["cities-visited", "cities-inview", "cities-all", "cities-wishlist"],
  monuments: ["poi-monuments"],
  airports: ["airports"],
};

// Theme colours for the offline overview base (kept out of the render body).
function themeColors(dark: boolean) {
  return {
    ocean: dark ? "#0d1016" : "#eaf0f6",
    land: dark ? "#1b1f29" : "#f4f6f9",
    landLine: dark ? "#2b313d" : "#d6dce4",
  };
}

/** Overlay layers added on top of whichever base style is in use. */
function overlayLayers(basemap: Basemap, dark: boolean): StyleSpecification["layers"] {
  const richBase = basemap !== "simple";
  const { land, landLine } = themeColors(dark);
  return [
    // Country fill — the land silhouette on "simple", and a transparent hit-test
    // surface over rich bases. NOT coloured by visited-ness (no country highlight).
    {
      id: "countries-base",
      type: "fill",
      source: "countries",
      paint: richBase
        ? { "fill-color": "#000000", "fill-opacity": 0 }
        : { "fill-color": land, "fill-outline-color": landLine },
    },
    // A faint outline that's ALWAYS drawn, so the map is never a featureless
    // rectangle even if rich-base tiles fail to load (offline / blocked).
    {
      id: "countries-outline",
      type: "line",
      source: "countries",
      paint: {
        "line-color": richBase ? (dark ? "#4a5364" : "#9aa6b8") : landLine,
        "line-width": 0.7,
        "line-opacity": richBase ? 0.6 : 0.9,
      },
    },
    {
      id: "trip-arcs",
      type: "line",
      source: "trip-arcs",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": [
          "match",
          ["get", "mode"],
          "flight", "#2563eb",
          "train", "#16a34a",
          "bus", "#d97706",
          "ferry", "#0891b2",
          "car", "#7c3aed",
          "#64748b",
        ],
        "line-width": 1.8,
        "line-opacity": 0.75,
      },
    },
    // The whole gazetteer as a faint dot field (~135k points, loaded once) — you
    // can SEE every city/town in the world, at any zoom.
    {
      id: "cities-all",
      type: "circle",
      source: "cities-all",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 0.7, 4, 1.6, 8, 3.2],
        "circle-color": "#93a0b4",
        "circle-opacity": 0.45,
      },
    },
    {
      id: "cities-inview",
      type: "circle",
      source: "cities-inview",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 4, 8, 6.5],
        "circle-color": "#ffffff",
        "circle-stroke-color": "#7b8698",
        "circle-stroke-width": 1.6,
      },
    },
    {
      id: "cities-wishlist",
      type: "circle",
      source: "wishlist",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 5, 8, 7.5],
        "circle-color": "#ffffff",
        "circle-stroke-color": "#f59e0b",
        "circle-stroke-width": 2.5,
      },
    },
    // Monuments (UNESCO World Heritage): 🏛 badges — filled amber once seen.
    {
      id: "poi-monuments",
      type: "symbol",
      source: "monuments",
      layout: {
        "icon-image": ["concat", "mon-", ["to-string", ["get", "seen"]]],
        "icon-size": 1,
        "icon-padding": 0,
        "icon-allow-overlap": true,
      },
    },
    {
      id: "cities-visited",
      type: "symbol",
      source: "cities",
      layout: {
        "icon-image": ["concat", "pill-", ["get", "cc"], "-", ["to-string", ["get", "fav"]]],
        // Grow with zoom so markers stay obvious on big screens & close views.
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.9, 5, 1.1, 10, 1.35],
        "icon-padding": 1,
        // EVERY visited city keeps its flag on screen — where you've been should
        // always be visible, even when markers crowd each other.
        "icon-allow-overlap": true,
        "symbol-sort-key": ["get", "sortKey"],
      },
    },
    {
      id: "airports",
      type: "symbol",
      source: "airports",
      layout: {
        "icon-image": [
          "concat",
          "air-",
          ["get", "iata"],
          "-",
          ["to-string", ["get", "wish"]],
          "-",
          ["to-string", ["get", "fav"]],
        ],
        "icon-size": 1,
        "icon-padding": 1,
        "icon-allow-overlap": true,
      },
    },
  ];
}

export function MapView({
  onBounds,
  focus,
  fit,
  viewCities,
  tripArcs,
  basemap = "simple",
  dark = false,
  globe = false,
  reducedMotion = false,
  mode = "all",
  onBaseUnavailable,
}: {
  /** Which marker categories are shown (a "mode" switcher over the map). */
  mode?: MapMode;
  onBounds?: (b: Bounds) => void;
  focus?: MapFocus | null;
  fit?: MapFit | null;
  viewCities?: City[];
  tripArcs?: FeatureCollection<LineString> | null;
  basemap?: Basemap;
  dark?: boolean;
  globe?: boolean;
  /** Honour the user's reduced-motion preference for fly/fit camera moves. */
  reducedMotion?: boolean;
  /** Called once when the online (OSM) base can't load its tiles, so the caller
   *  can fall back to the always-available offline base. */
  onBaseUnavailable?: () => void;
}) {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const loadedRef = useRef(false);
  const visitsRef = useRef(visits);
  visitsRef.current = visits;
  const onBoundsRef = useRef(onBounds);
  onBoundsRef.current = onBounds;
  const viewCitiesRef = useRef(viewCities);
  viewCitiesRef.current = viewCities;
  const tripArcsRef = useRef(tripArcs);
  tripArcsRef.current = tripArcs;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const onBaseUnavailableRef = useRef(onBaseUnavailable);
  onBaseUnavailableRef.current = onBaseUnavailable;
  // True while a programmatic camera move is in flight — its moveend must NOT
  // refresh the cities list (the list only follows the user's own map moves).
  const suppressBoundsRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [dataState, setDataState] = useState<"loading" | "ready" | "error">("loading");

  function emitBounds(map: MlMap) {
    const b = map.getBounds();
    onBoundsRef.current?.({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
      zoom: map.getZoom(),
    });
  }

  function applyVisited(map: MlMap) {
    (map.getSource("cities") as GeoJSONSource | undefined)?.setData(
      visitedCityPoints(visitsRef.current, ref),
    );
    (map.getSource("wishlist") as GeoJSONSource | undefined)?.setData(
      wishlistCityPoints(visitsRef.current, ref),
    );
    (map.getSource("airports") as GeoJSONSource | undefined)?.setData(
      airportPoints(visitsRef.current, ref),
    );
    (map.getSource("monuments") as GeoJSONSource | undefined)?.setData(
      monumentPoints(visitsRef.current, ref),
    );
  }

  function applyMode(map: MlMap, m: MapMode) {
    for (const [cat, ids] of Object.entries(MODE_LAYERS)) {
      const on = m === "all" || m === cat;
      for (const id of ids) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      }
    }
  }

  function applyViewCities(map: MlMap) {
    (map.getSource("cities-inview") as GeoJSONSource | undefined)?.setData(
      inViewPoints(viewCitiesRef.current ?? []),
    );
  }

  function applyTripArcs(map: MlMap) {
    (map.getSource("trip-arcs") as GeoJSONSource | undefined)?.setData(
      tripArcsRef.current ?? { type: "FeatureCollection", features: [] },
    );
  }

  function applyTheme(map: MlMap, isDark: boolean) {
    const { ocean, land, landLine } = themeColors(isDark);
    if (map.getLayer("background")) map.setPaintProperty("background", "background-color", ocean);
    if (map.getLayer("osm-bg")) map.setPaintProperty("osm-bg", "background-color", ocean);
    if (basemap === "simple" && map.getLayer("countries-base")) {
      map.setPaintProperty("countries-base", "fill-color", land);
      map.setPaintProperty("countries-base", "fill-outline-color", landLine);
    }
  }

  // Load (or retry) the country geometry into the already-running map.
  function loadGeometry(map: MlMap, force = false) {
    setDataState("loading");
    void getCountries(force).then((fc) => {
      if (!mapRef.current || map !== mapRef.current) return;
      if (fc) {
        (map.getSource("countries") as GeoJSONSource | undefined)?.setData(fc);
        setDataState("ready");
      } else {
        setDataState("error");
      }
    });
  }

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: MlMap | null = null;
    ensurePmtilesProtocol();

    (async () => {
      const pack =
        basemap === "osm" ? "osm-raster" : basemap === "detail" ? "world-detail" : "world-overview";
      const { style: baseStyle, attribution } = await bundledMapSource.resolveStyle(pack);
      if (cancelled || !containerRef.current) return;

      // Build the COMPLETE style up front — base + overlay sources + overlay
      // layers + projection — so the map is never a blank canvas waiting on an
      // async setStyle. Overlay sources start empty and are filled on load.
      const fullStyle: StyleSpecification = {
        ...baseStyle,
        projection: { type: globe ? "globe" : "mercator" },
        sources: {
          ...baseStyle.sources,
          // tolerance 0: never simplify the country polygons — per-zoom
          // simplification of the huge Arctic multipolygons produces degenerate
          // triangles that render as ghostly land-coloured streaks over the ocean.
          countries: { type: "geojson", data: EMPTY_FC, attribution, tolerance: 0 },
          "cities-all": { type: "geojson", data: EMPTY_FC },
          "trip-arcs": { type: "geojson", data: EMPTY_FC },
          "cities-inview": { type: "geojson", data: EMPTY_FC },
          wishlist: { type: "geojson", data: EMPTY_FC },
          monuments: { type: "geojson", data: EMPTY_FC },
          cities: { type: "geojson", data: EMPTY_FC },
          airports: { type: "geojson", data: EMPTY_FC },
        },
        layers: [...baseStyle.layers, ...overlayLayers(basemap, dark)],
      };

      try {
        map = new maplibregl.Map({
          container: containerRef.current,
          attributionControl: { compact: true },
          center: [6, 32],
          zoom: 1.1,
          style: fullStyle,
          // Needed to snapshot the canvas for the globe↔flat crossfade.
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
      } catch {
        setFailed(true);
        return;
      }
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      // Marker images, generated lazily on demand.
      map.on("styleimagemissing", (e) => {
        if (!map || map.hasImage(e.id)) return;
        if (e.id.startsWith("pill-")) {
          const [, cc, fav] = e.id.split("-");
          map.addImage(e.id, makeCityPill(cc ?? "", fav === "1"), { pixelRatio: 2 });
        } else if (e.id.startsWith("mon-")) {
          map.addImage(e.id, makeMonumentPin(e.id === "mon-1"), { pixelRatio: 2 });
        } else if (e.id.startsWith("air-")) {
          const [, iata, wish, fav] = e.id.split("-");
          map.addImage(e.id, makeAirportPin(iata ?? "", wish === "1", fav === "1"), {
            pixelRatio: 2,
          });
        }
      });

      map.on("load", () => {
        if (cancelled || !map) return;
        loadedRef.current = true;
        applyTheme(map, dark);
        applyVisited(map);
        applyViewCities(map);
        applyTripArcs(map);
        loadGeometry(map);
        applyMode(map, mode);
        // The full-gazetteer dot field: set ONCE (static), so it costs nothing
        // on pan/zoom.
        (map.getSource("cities-all") as GeoJSONSource | undefined)?.setData({
          type: "FeatureCollection",
          features: ref.allCities().map((c) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [c.lon, c.lat] },
            properties: {},
          })),
        });
        emitBounds(map);
      });

      map.on("moveend", () => {
        if (!loadedRef.current || !map) return;
        if (suppressBoundsRef.current) {
          suppressBoundsRef.current = false; // programmatic fly — keep the list still
          return;
        }
        emitBounds(map);
      });
      // Any real user gesture re-enables list refreshes immediately.
      for (const ev of ["dragstart", "wheel", "dblclick"] as const) {
        map.on(ev, () => {
          suppressBoundsRef.current = false;
        });
      }

      // If the online (OSM) base can't fetch its tiles (offline, or blocked), fall
      // back to the always-available offline base rather than showing a bare canvas.
      if (basemap === "osm") {
        let osmErrors = 0;
        let fellBack = false;
        map.on("error", (e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((e as any)?.sourceId !== "osm") return;
          if (!fellBack && ++osmErrors >= 4) {
            fellBack = true;
            onBaseUnavailableRef.current?.();
          }
        });
      }

      // Tap any place marker → ONE popup (a single dispatcher across all
      // tappable layers — per-layer handlers would fire together when a city
      // and a monument overlap under the tap). Cities outrank monuments;
      // among cities the most populous wins.
      const tappable = ["cities-visited", "cities-inview", "cities-wishlist", "poi-monuments"];
      map.on("click", (e) => {
        if (!map || !loadedRef.current) return;
        const m = map; // narrow once — closures below can't re-null it
        const layers = tappable.filter((l) => m.getLayer(l));
        if (!layers.length) return;
        const feats = m.queryRenderedFeatures(e.point, { layers });
        if (!feats.length) return;
        const score = (f: maplibregl.MapGeoJSONFeature) =>
          f.layer.id === "poi-monuments" ? -1 : Number(f.properties?.pop ?? 0);
        const f = feats.reduce((best, cur) => (score(cur) > score(best) ? cur : best));
        const p = f.properties ?? {};
        const isMonument = f.layer.id === "poi-monuments";
        const isCustom = Number(p.custom) === 1;
        const kind = isMonument ? "heritage" : isCustom ? "custom" : "city";
        const region = p.region ? String(p.region) : "";
        const popN = Number(p.pop);
        const country = ref.countryByIso2(String(p.cc ?? ""))?.name ?? String(p.cc ?? "");
        const sub = isMonument
          ? `Site · ${country}`
          : [country, region].filter(Boolean).join(" - ") +
            (popN > 0 ? ` · ${formatInt(popN)} people` : "");
        openPlacePopup(map, e.lngLat, {
          name: String(p.name ?? ""),
          sub,
          place: {
            kind,
            id: String(p.id ?? ""),
            name: String(p.name ?? ""),
            countryId: String(p.cc ?? ""),
          } as PlaceRef,
          hasPage: kind === "city" || kind === "heritage",
        });
        suppressBoundsRef.current = true;
        map.easeTo({
          center: e.lngLat,
          zoom: Math.max(map.getZoom(), 6.5),
          duration: reducedRef.current ? 0 : 550,
        });
      });
      map.on("mousemove", (e) => {
        if (!map || !loadedRef.current) return;
        const m = map;
        const layers = tappable.filter((l) => m.getLayer(l));
        const hit = layers.length ? m.queryRenderedFeatures(e.point, { layers }).length > 0 : false;
        m.getCanvas().style.cursor = hit ? "pointer" : "";
      });
    })();

    return () => {
      cancelled = true;
      loadedRef.current = false;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyVisited(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyViewCities(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewCities]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyTripArcs(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripArcs]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyTheme(map, dark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyMode(map, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    // Crossfade globe↔flat: freeze the last frame as an overlay image, switch the
    // projection underneath, fade the frozen frame out. (Needs preserveDrawingBuffer.)
    const host = containerRef.current;
    if (!reducedRef.current && host) {
      try {
        const url = map.getCanvas().toDataURL();
        const ghost = document.createElement("img");
        ghost.src = url;
        ghost.className = "map-ghost";
        ghost.alt = "";
        host.appendChild(ghost);
        requestAnimationFrame(() => {
          ghost.style.opacity = "0";
        });
        setTimeout(() => ghost.remove(), 450);
      } catch {
        /* snapshot unavailable — switch without the fade */
      }
    }
    map.setProjection({ type: globe ? "globe" : "mercator" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globe]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    suppressBoundsRef.current = true; // programmatic — the list must not move
    // easeTo, not flyTo: fly's zoom-out-then-in arc reads as a jarring
    // "dezoom/rezoom" when hopping between nearby places (Lyon → its airport).
    map.easeTo({
      center: [focus.lon, focus.lat],
      zoom: Math.max(map.getZoom(), 4.5),
      duration: reducedRef.current ? 0 : 650,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fit) return;
    suppressBoundsRef.current = true; // programmatic — the list must not move
    map.fitBounds(fit.bounds, {
      padding: 48,
      maxZoom: 6,
      duration: reducedRef.current ? 0 : 700,
      animate: !reducedRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit?.key]);

  if (failed) {
    return (
      <div className="map-fallback">
        <p className="muted">
          The map couldn’t start (WebGL may be unavailable here). Your visits, the cities list, and
          statistics still work.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="map-canvas"
        role="application"
        aria-label="Map of visited places"
      />
      {dataState !== "ready" && (
        <div className="map-status" role="status">
          {dataState === "loading" ? (
            <span className="muted small">Loading map…</span>
          ) : (
            <span className="small">
              Map data didn’t load.{" "}
              <button
                type="button"
                className="link"
                onClick={() => mapRef.current && loadGeometry(mapRef.current, true)}
              >
                Retry
              </button>
            </span>
          )}
        </div>
      )}
    </>
  );
}
