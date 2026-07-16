import type { MapPackRef, MapSource, ResolvedMapStyle } from "./types";
import type { StyleSpecification } from "maplibre-gl";
import {
  bundledOfflineMapStore,
  type OfflineMapStore,
} from "./offlineMapStore";

// MapSource with three packs:
// - "world-overview": bundled, fully-offline base (default; no network, ever).
// - "osm-raster": OPT-IN online OpenStreetMap raster tiles for a detailed,
//   colored basemap. Explicitly labeled online; never the default.
// - "world-detail": OPT-IN, fully-offline street-level vector basemap read via
//   the pmtiles:// protocol from the device-global OfflineMapStore. Only offered
//   when a pack is actually installed (none is bundled — a world street pack is
//   device-global and far too large to ship in-app). (Constitution II/III/V +
//   Ecosystem.)
const WORLD_PACK: MapPackRef = {
  id: "world-overview",
  label: "Simple (offline)",
  scope: "world",
};

const OSM_PACK: MapPackRef = {
  id: "osm-raster",
  label: "Detailed — OpenStreetMap (online)",
  scope: "world",
};

const DETAIL_PACK: MapPackRef = {
  id: "world-detail",
  label: "Detailed — streets (offline)",
  scope: "world",
};

/**
 * A MapLibre vector style over a PMTiles archive. Layer `source-layer`s follow
 * the Protomaps "basemap" flavor (build.protomaps.com), the recommended free,
 * openly-licensed (OpenStreetMap / ODbL) world PMTiles pack. A pack using a
 * different schema only needs its own style here.
 */
export function detailVectorStyle(pmtilesUrl: string): StyleSpecification {
  return {
    version: 8,
    name: "Postcards offline detail (PMTiles)",
    sources: {
      basemap: { type: "vector", url: pmtilesUrl, attribution: "© OpenStreetMap contributors" },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#eef1f5" } },
      {
        id: "earth",
        type: "fill",
        source: "basemap",
        "source-layer": "earth",
        paint: { "fill-color": "#f7f8fa" },
      },
      {
        id: "landuse",
        type: "fill",
        source: "basemap",
        "source-layer": "landuse",
        paint: { "fill-color": "#eef2ea", "fill-opacity": 0.7 },
      },
      {
        id: "water",
        type: "fill",
        source: "basemap",
        "source-layer": "water",
        paint: { "fill-color": "#a9cbe8" },
      },
      {
        id: "roads",
        type: "line",
        source: "basemap",
        "source-layer": "roads",
        paint: { "line-color": "#d8dce2", "line-width": 1 },
      },
      {
        id: "boundaries",
        type: "line",
        source: "basemap",
        "source-layer": "boundaries",
        paint: { "line-color": "#c4b8d6", "line-width": 0.8, "line-dasharray": [2, 1] },
      },
    ],
  };
}

const OVERVIEW_STYLE: ResolvedMapStyle = {
  style: {
    version: 8,
    name: "Postcards world overview",
    sources: {},
    // Soft-blue sea (matches MapView's themeColors ocean); the light/dark theme
    // effect repaints this at runtime, this is just the first-paint value.
    layers: [{ id: "background", type: "background", paint: { "background-color": "#d9e6f1" } }],
  },
  attribution: "Boundaries © Natural Earth (public domain)",
};

export class BundledMapSource implements MapSource {
  constructor(private readonly offlineStore: OfflineMapStore = bundledOfflineMapStore) {}

  async listPacks(): Promise<MapPackRef[]> {
    const packs = [WORLD_PACK, OSM_PACK];
    // Only advertise the offline-detail pack when one is actually installed.
    if (await this.offlineStore.detailPack()) packs.push(DETAIL_PACK);
    return packs;
  }

  async isAvailableOffline(packId: string): Promise<boolean> {
    if (packId === WORLD_PACK.id) return true;
    if (packId === DETAIL_PACK.id) return !!(await this.offlineStore.detailPack());
    return false;
  }

  async resolveStyle(packId: string): Promise<ResolvedMapStyle> {
    if (packId === OSM_PACK.id) {
      return {
        style: {
          version: 8,
          name: "OpenStreetMap raster",
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution: "© OpenStreetMap contributors",
            },
          },
          // A neutral background shows through where tiles aren't loaded yet /
          // aren't cached (offline in an un-saved area), instead of black.
          layers: [
            { id: "osm-bg", type: "background", paint: { "background-color": "#dfe4ea" } },
            { id: "osm", type: "raster", source: "osm" },
          ],
        },
        attribution: "© OpenStreetMap contributors (ODbL)",
      };
    }
    if (packId === DETAIL_PACK.id) {
      const pack = await this.offlineStore.detailPack();
      // Fall back to the always-available overview if the pack vanished.
      if (pack) {
        return {
          style: detailVectorStyle(pack.pmtilesUrl),
          attribution: "© OpenStreetMap contributors (ODbL) · offline pack",
        };
      }
    }
    return OVERVIEW_STYLE;
  }
}

export const bundledMapSource = new BundledMapSource();
