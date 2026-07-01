import type { MapPackRef, MapSource, ResolvedMapStyle } from "./types";

// MVP MapSource: a bundled, fully-offline base style (no external tiles, no
// Google). Country polygons are drawn by the map layer from bundled Natural
// Earth geometry; this source just provides the base canvas + attribution.
// Later, a `SharedOfflineMapStore` will implement the same interface backed by
// a device-global PMTiles store and expose download/manage operations.
const WORLD_PACK: MapPackRef = {
  id: "world-overview",
  label: "World (overview)",
  scope: "world",
};

export class BundledMapSource implements MapSource {
  async listPacks(): Promise<MapPackRef[]> {
    return [WORLD_PACK];
  }

  async isAvailableOffline(packId: string): Promise<boolean> {
    // The world-overview base is bundled in the app, so always available offline.
    return packId === WORLD_PACK.id;
  }

  async resolveStyle(_packId: string): Promise<ResolvedMapStyle> {
    return {
      style: {
        version: 8,
        name: "Place'Been world overview",
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#0b1220" },
          },
        ],
      },
      attribution: "Boundaries © Natural Earth (public domain)",
    };
  }
}

export const bundledMapSource = new BundledMapSource();
