import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import { feature } from "topojson-client";
import type { FeatureCollection, Polygon, MultiPolygon, Point, Feature } from "geojson";
import { getReferenceData } from "../../lib/reference/referenceData";
import { bundledMapSource } from "../../lib/map-source/bundledMapSource";
import { useVisits } from "../../lib/store/useVisits";
import { visitedCityPoints, visitedCountryNumerics } from "./visitedLayers";
import type { Bounds } from "./viewport";
import type { City, Country } from "../../lib/reference/types";
import { CONTINENT_COLORS, CONTINENT_FALLBACK } from "../../lib/reference/continents";

// Natural Earth 50m country geometry, served as a static asset (SW-cached for
// offline) rather than bundled into JS, so the map chunk stays lean.
const GEOMETRY_URL = `${import.meta.env.BASE_URL}basemap/countries-50m.json`;

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

export function MapView({
  onBounds,
  focus,
  fit,
  onCountryTap,
  viewCities,
}: {
  onBounds?: (b: Bounds) => void;
  focus?: MapFocus | null;
  fit?: MapFit | null;
  /** Tap a country polygon to act on it (toggle visited). */
  onCountryTap?: (country: Country) => void;
  /** The cities currently shown in the list — drawn as hollow dots for map↔list sync. */
  viewCities?: City[];
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
  }

  function applyViewCities(map: MlMap) {
    const src = map.getSource("cities-inview") as GeoJSONSource | undefined;
    src?.setData(inViewPoints(viewCitiesRef.current ?? []));
  }

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
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

    map.on("load", async () => {
      if (cancelled) return;
      const { style, attribution } = await bundledMapSource.resolveStyle("world-overview");
      if (cancelled) return;
      map.setStyle(style);
      map.once("styledata", async () => {
        if (cancelled) return;
        const countriesFc = await loadCountries();
        if (cancelled || !map.getStyle()) return;
        if (countriesFc) {
          map.addSource("countries", { type: "geojson", data: countriesFc, attribution });
          map.addLayer({
            id: "countries-base",
            type: "fill",
            source: "countries",
            paint: { "fill-color": "#f4f6f9", "fill-outline-color": "#d6dce4" },
          });
          map.addLayer({
            id: "countries-visited",
            type: "fill",
            source: "countries",
            filter: ["in", ["get", "numeric"], ["literal", []]],
            paint: { "fill-color": continentColorExpr(), "fill-opacity": 0.42 },
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
        // Visited cities: same green as the ✓ toggle, on top.
        map.addSource("cities", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "cities-visited",
          type: "circle",
          source: "cities",
          paint: {
            "circle-radius": 4.5,
            "circle-color": "#16a34a",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
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
      const hitCity = map
        .queryRenderedFeatures(e.point, { layers: ["cities-visited", "cities-inview"].filter((l) => map.getLayer(l)) });
      if (hitCity.length) return;
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
