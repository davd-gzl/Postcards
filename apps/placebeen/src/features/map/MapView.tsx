import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import { feature } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { getReferenceData } from "../../lib/reference/referenceData";
import { bundledMapSource } from "../../lib/map-source/bundledMapSource";
import { useVisits } from "../../lib/store/useVisits";
import { visitedCityPoints, visitedCountryNumerics } from "./visitedLayers";

// Build country polygons once from bundled Natural Earth geometry (offline).
function buildCountries(): FeatureCollection<Polygon | MultiPolygon> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = feature(worldTopo as any, (worldTopo as any).objects.countries) as unknown as FeatureCollection<
    Polygon | MultiPolygon
  >;
  for (const f of fc.features) {
    f.properties = { ...(f.properties ?? {}), numeric: String(f.id ?? "") };
  }
  return fc;
}

export function MapView() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const loadedRef = useRef(false);
  const visitsRef = useRef(visits);
  visitsRef.current = visits;
  const [failed, setFailed] = useState(false);

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
        center: [8, 30],
        zoom: 1.4,
        style: { version: 8, sources: {}, layers: [] },
      });
    } catch {
      // No WebGL (e.g. some headless/older environments) — degrade gracefully.
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", async () => {
      if (cancelled) return;
      const { style, attribution } = await bundledMapSource.resolveStyle("world-overview");
      map.setStyle(style);
      map.once("styledata", () => {
        if (cancelled) return;
        map.addSource("countries", { type: "geojson", data: buildCountries() });
        map.addLayer({
          id: "countries-base",
          type: "fill",
          source: "countries",
          paint: { "fill-color": "#1b2942", "fill-outline-color": "#2b3d5e" },
        });
        map.addLayer({
          id: "countries-visited",
          type: "fill",
          source: "countries",
          filter: ["in", ["get", "numeric"], ["literal", []]],
          paint: { "fill-color": "#38bdf8", "fill-opacity": 0.55 },
        });
        map.addSource("cities", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "cities-visited",
          type: "circle",
          source: "cities",
          paint: {
            "circle-radius": 4,
            "circle-color": "#fbbf24",
            "circle-stroke-color": "#0b1220",
            "circle-stroke-width": 1,
          },
        });
        loadedRef.current = true;
        applyVisited(map);
      });
      map.getContainer().setAttribute("data-attribution", attribution);
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

  if (failed) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <p className="notice">
          The map couldn’t start (WebGL may be unavailable here). Your visits and statistics still
          work — see the Visits and Stats tabs.
        </p>
      </div>
    );
  }

  return (
    <div className="map-holder">
      <div ref={containerRef} className="map-wrap" role="application" aria-label="Map of visited places" />
    </div>
  );
}
