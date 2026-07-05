import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { feature } from "topojson-client";
import type { FeatureCollection, Polygon, MultiPolygon, Point, Feature } from "geojson";
import { getReferenceData } from "../../lib/reference/referenceData";
import { bundledMapSource } from "../../lib/map-source/bundledMapSource";
import { useVisits } from "../../lib/store/useVisits";
import {
  airportPoints,
  visitedCityPoints,
  visitedCountryNumerics,
  wishlistCityPoints,
} from "./visitedLayers";
import type { Bounds } from "./viewport";
import type { City, Country } from "../../lib/reference/types";
import { CONTINENT_COLORS, CONTINENT_FALLBACK } from "../../lib/reference/continents";
import { countryFlag } from "../../lib/format/format";

// Natural Earth 50m country geometry, served as a static asset (SW-cached for
// offline) rather than bundled into JS, so the map chunk stays lean.
const GEOMETRY_URL = `${import.meta.env.BASE_URL}basemap/countries-50m.json`;

// Register the pmtiles:// protocol once so the offline-detail vector basemap
// (a device-global PMTiles pack, when installed) resolves. Harmless no-op when
// no pack is present.
let pmtilesRegistered = false;
function ensurePmtilesProtocol(): void {
  if (pmtilesRegistered) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  pmtilesRegistered = true;
}

async function loadCountries(): Promise<FeatureCollection<Polygon | MultiPolygon> | null> {
  try {
    const res = await fetch(GEOMETRY_URL);
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topo: any = await res.json();
    const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<
      Polygon | MultiPolygon
    >;
    const ref = getReferenceData();
    for (const f of fc.features) {
      const numeric = String(f.id ?? "");
      const country = ref.countryByNumeric(numeric);
      f.properties = { ...(f.properties ?? {}), numeric, continent: country?.continent ?? "" };
    }
    return fc;
  } catch {
    return null;
  }
}

// Data-driven color: visited countries take their continent's hue.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function continentColorExpr(): any {
  const pairs = Object.entries(CONTINENT_COLORS).flatMap(([k, v]) => [k, v]);
  return ["match", ["get", "continent"], ...pairs, CONTINENT_FALLBACK];
}

const EMOJI_FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
const PILL_FONT = '600 21px "Inter Variable", system-ui, sans-serif';

/**
 * Draw a small city marker pill: [flag] population — one canvas image, so we
 * get labels without a glyph server. Drawn at 2x for crisp rendering
 * (display size ≈ half). Favorites get a gold ring.
 */
function makeCityPill(iso2: string, popLabel: string, favorite: boolean): ImageData {
  const h = 30; // 15px on screen
  const pad = 9;
  const flagFont = `19px ${EMOJI_FONT}`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = PILL_FONT;
  const textW = popLabel ? ctx.measureText(popLabel).width : 0;
  ctx.font = flagFont;
  const flagW = ctx.measureText(countryFlag(iso2)).width;
  const w = Math.ceil(pad + flagW + (popLabel ? 6 + textW : 0) + pad);
  canvas.width = w;
  canvas.height = h;

  // Pill background.
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(r, 1);
  ctx.arcTo(w - 1, 1, w - 1, h - 1, r - 1);
  ctx.arcTo(w - 1, h - 1, 1, h - 1, r - 1);
  ctx.arcTo(1, h - 1, 1, 1, r - 1);
  ctx.arcTo(1, 1, w - 1, 1, r - 1);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = favorite ? 3 : 1.5;
  ctx.strokeStyle = favorite ? "#f59e0b" : "rgba(15, 23, 41, 0.25)";
  ctx.stroke();

  // Flag + population.
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = flagFont;
  ctx.fillStyle = "#334155";
  ctx.fillText(countryFlag(iso2), pad, h / 2 + 1);
  if (popLabel) {
    ctx.font = PILL_FONT;
    ctx.fillStyle = "#1e293b";
    ctx.fillText(popLabel, pad + flagW + 6, h / 2 + 1);
  }
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Draw an airport marker: [✈ CODE] pill, tinted so it never reads as a city
 * flag-pill. Sky blue = been there, amber = wish to fly through; favorites get a
 * gold ring. One canvas image per (code, wish, fav), drawn at 2x.
 */
function makeAirportPin(iata: string, wish: boolean, favorite: boolean): ImageData {
  const h = 30; // 15px on screen
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
  const features: Feature<Point>[] = cities.map((c) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [c.lon, c.lat] },
    properties: { name: c.name },
  }));
  return { type: "FeatureCollection", features };
}

export interface MapFocus {
  lon: number;
  lat: number;
  key: number;
}

export interface MapFit {
  bounds: [[number, number], [number, number]]; // [[west,south],[east,north]]
  key: number;
}

export type Basemap = "simple" | "osm" | "detail";

export function MapView({
  onBounds,
  focus,
  fit,
  onCountryTap,
  viewCities,
  basemap = "simple",
}: {
  onBounds?: (b: Bounds) => void;
  focus?: MapFocus | null;
  fit?: MapFit | null;
  /** Tap a country polygon to act on it (toggle visited). */
  onCountryTap?: (country: Country) => void;
  /** The cities currently shown in the list — drawn as hollow dots for map↔list sync. */
  viewCities?: City[];
  /**
   * "simple" = bundled offline overview (default); "osm" = opt-in online OSM
   * raster; "detail" = opt-in offline street vector from an installed PMTiles pack.
   */
  basemap?: Basemap;
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
  const onCountryTapRef = useRef(onCountryTap);
  onCountryTapRef.current = onCountryTap;
  const viewCitiesRef = useRef(viewCities);
  viewCitiesRef.current = viewCities;
  const [failed, setFailed] = useState(false);

  function emitBounds(map: MlMap) {
    const b = map.getBounds();
    onBoundsRef.current?.({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    });
  }

  function applyVisited(map: MlMap) {
    const numerics = visitedCountryNumerics(visitsRef.current, ref);
    const filter: maplibregl.FilterSpecification = [
      "in",
      ["get", "numeric"],
      ["literal", numerics],
    ];
    if (map.getLayer("countries-visited")) map.setFilter("countries-visited", filter);
    if (map.getLayer("countries-visited-line")) map.setFilter("countries-visited-line", filter);
    const src = map.getSource("cities") as GeoJSONSource | undefined;
    src?.setData(visitedCityPoints(visitsRef.current, ref));
    const wishSrc = map.getSource("wishlist") as GeoJSONSource | undefined;
    wishSrc?.setData(wishlistCityPoints(visitsRef.current, ref));
    const airSrc = map.getSource("airports") as GeoJSONSource | undefined;
    airSrc?.setData(airportPoints(visitsRef.current, ref));
  }

  function applyViewCities(map: MlMap) {
    const src = map.getSource("cities-inview") as GeoJSONSource | undefined;
    src?.setData(inViewPoints(viewCitiesRef.current ?? []));
  }

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    ensurePmtilesProtocol();
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        attributionControl: { compact: true },
        center: [6, 32],
        zoom: 1.1,
        style: { version: 8, sources: {}, layers: [] },
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    // Generate marker images lazily.
    //  city:    "pill-<CC>-<0|1 fav>-<popLabel>"
    //  airport: "air-<IATA>-<0|1 wish>-<0|1 fav>"
    map.on("styleimagemissing", (e) => {
      if (map.hasImage(e.id)) return;
      if (e.id.startsWith("pill-")) {
        const rest = e.id.slice(5);
        const cc = rest.slice(0, 2);
        const fav = rest.slice(3, 4) === "1";
        const popLabel = rest.slice(5);
        map.addImage(e.id, makeCityPill(cc, popLabel, fav), { pixelRatio: 2 });
      } else if (e.id.startsWith("air-")) {
        const [, iata, wish, fav] = e.id.split("-");
        map.addImage(e.id, makeAirportPin(iata ?? "", wish === "1", fav === "1"), {
          pixelRatio: 2,
        });
      }
    });

    map.on("load", async () => {
      if (cancelled) return;
      // A rich base (online OSM raster or offline street vector) shows through
      // the country overlay; the simple overview is opaque.
      const richBase = basemap !== "simple";
      const pack =
        basemap === "osm" ? "osm-raster" : basemap === "detail" ? "world-detail" : "world-overview";
      const { style, attribution } = await bundledMapSource.resolveStyle(pack);
      if (cancelled) return;
      map.setStyle(style);
      map.once("styledata", async () => {
        if (cancelled) return;
        const countriesFc = await loadCountries();
        if (cancelled || !map.getStyle()) return;
        if (countriesFc) {
          map.addSource("countries", { type: "geojson", data: countriesFc, attribution });
          // Over a rich base the fill is invisible but kept for country hit-testing.
          map.addLayer({
            id: "countries-base",
            type: "fill",
            source: "countries",
            paint: richBase
              ? { "fill-color": "#000000", "fill-opacity": 0 }
              : { "fill-color": "#f4f6f9", "fill-outline-color": "#d6dce4" },
          });
          map.addLayer({
            id: "countries-visited",
            type: "fill",
            source: "countries",
            filter: ["in", ["get", "numeric"], ["literal", []]],
            paint: {
              "fill-color": continentColorExpr(),
              "fill-opacity": richBase ? 0.28 : 0.42,
            },
          });
          map.addLayer({
            id: "countries-visited-line",
            type: "line",
            source: "countries",
            filter: ["in", ["get", "numeric"], ["literal", []]],
            paint: { "line-color": continentColorExpr(), "line-width": 1.2, "line-opacity": 0.9 },
          });
        }
        // Hollow dots for the cities currently listed below the map.
        map.addSource("cities-inview", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "cities-inview",
          type: "circle",
          source: "cities-inview",
          paint: {
            "circle-radius": 3.5,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#8a94a6",
            "circle-stroke-width": 1.2,
          },
        });
        // Wish-to-go cities: hollow amber dots under the visited pills.
        map.addSource("wishlist", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "cities-wishlist",
          type: "circle",
          source: "wishlist",
          paint: {
            "circle-radius": 4,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#f59e0b",
            "circle-stroke-width": 2,
          },
        });
        // Visited cities: small flag+population pills. Collision detection is ON
        // (no allow-overlap): when pills would stack, the most populous city
        // wins and the rest appear as you zoom in.
        map.addSource("cities", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "cities-visited",
          type: "symbol",
          source: "cities",
          layout: {
            "icon-image": [
              "concat",
              "pill-",
              ["get", "cc"],
              "-",
              ["to-string", ["get", "fav"]],
              "-",
              ["get", "popLabel"],
            ],
            "icon-size": 1,
            "icon-padding": 1,
            "symbol-sort-key": ["get", "sortKey"],
          },
        });
        // Logged airports: plane pills (sky = been, amber = wish), on top of cities.
        map.addSource("airports", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
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
        });
        loadedRef.current = true;
        applyVisited(map);
        applyViewCities(map);
        emitBounds(map);
      });
    });

    map.on("moveend", () => {
      if (loadedRef.current) emitBounds(map);
    });

    // Tap a country to toggle it visited (dots win when both are under the tap).
    map.on("click", (e) => {
      if (!loadedRef.current || !onCountryTapRef.current) return;
      const layers = ["countries-visited", "countries-base"].filter((l) => map.getLayer(l));
      if (!layers.length) return;
      const hitMarker = map.queryRenderedFeatures(e.point, {
        layers: ["cities-visited", "cities-inview", "airports"].filter((l) => map.getLayer(l)),
      });
      if (hitMarker.length) return;
      const feats = map.queryRenderedFeatures(e.point, { layers });
      const numeric = feats[0]?.properties?.numeric;
      if (numeric == null) return;
      const country = ref.countryByNumeric(String(numeric));
      if (country) onCountryTapRef.current(country);
    });
    map.on("mousemove", (e) => {
      if (!loadedRef.current) return;
      const layers = ["countries-visited", "countries-base"].filter((l) => map.getLayer(l));
      if (!layers.length) return;
      const feats = map.queryRenderedFeatures(e.point, { layers });
      map.getCanvas().style.cursor = feats.length ? "pointer" : "";
    });

    return () => {
      cancelled = true;
      loadedRef.current = false;
      map.remove();
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
    if (!map || !focus) return;
    map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 4.5), speed: 1.4 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fit) return;
    map.fitBounds(fit.bounds, { padding: 48, maxZoom: 6, duration: 700 });
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

  return <div ref={containerRef} className="map-canvas" role="application" aria-label="Map of visited places" />;
}
