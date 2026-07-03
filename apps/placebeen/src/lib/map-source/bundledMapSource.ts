import type { MapPackRef, MapSource, ResolvedMapStyle } from "./types";

// MVP MapSource with two packs:
// - "world-overview": bundled, fully-offline base (default; no network, ever).
// - "osm-raster": OPT-IN online OpenStreetMap raster tiles for a detailed,
//   colored basemap. Explicitly labeled online; never the default; the app
//   stays fully usable without it (Constitution II/III/V).
// Later, a `SharedOfflineMapStore` implements the same interface backed by a
// device-global PMTiles store.
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

export class BundledMapSource implements MapSource {
  async listPacks(): Promise<MapPackRef[]> {
    return [WORLD_PACK, OSM_PACK];
  }

  async isAvailableOffline(packId: string): Promise<boolean> {
    return packId === WORLD_PACK.id;
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
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        attribution: "© OpenStreetMap contributors (ODbL)",
      };
    }
    return {
      style: {
        version: 8,
        name: "Place'Been world overview",
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#eaf0f6" },
          },
        ],
      },
      attribution: "Boundaries © Natural Earth (public domain)",
    };
  }
}

export const bundledMapSource = new BundledMapSource();
