import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import { feature } from "topojson-client";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { getReferenceData } from "../../lib/reference/referenceData";
import { bundledMapSource } from "../../lib/map-source/bundledMapSource";
import { useVisits } from "../../lib/store/useVisits";
import { visitedCityPoints, visitedCountryNumerics } from "./visitedLayers";
import type { Bounds } from "./viewport";

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
    for (const f of fc.features) {
      f.properties = { ...(f.properties ?? {}), numeric: String(f.id ?? "") };
    }
    return fc;
  } catch {
    return null;
  }
}

export interface MapFocus {
  lon: number;
  lat: number;
  key: number;
}

export function MapView({
  onBounds,
  focus,
}: {
  onBounds?: (b: Bounds) => void;
  focus?: MapFocus | null;
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
    if (map.getLayer("countries-visited")) {
      map.setFilter("countries-visited", ["in", ["get", "numeric"], ["literal", numerics]]);
    }
    const src = map.getSource("cities") as GeoJSONSource | undefined;
    src?.setData(visitedCityPoints(visitsRef.current, ref));
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
        const countries = await loadCountries();
        if (cancelled || !map.getStyle()) return;
        if (countries) {
          map.addSource("countries", { type: "geojson", data: countries, attribution });
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
            paint: { "fill-color": "#22c55e", "fill-opacity": 0.32 },
          });
        }
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
        emitBounds(map);
      });
    });

    map.on("moveend", () => {
      if (loadedRef.current) emitBounds(map);
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
    if (!map || !focus) return;
    map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 4.5), speed: 1.4 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

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
