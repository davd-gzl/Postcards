import type { Bounds } from "../map/viewport";
import { tilesForBounds } from "../map/offlineTiles";

// Named, human-sized offline map packs: a continent-scale bounding box plus the
// zoom levels worth keeping. Tile counts are EXACT (computed from the grid);
// sizes are estimates (~18 KB per OSM raster tile on average).
export interface OfflineRegion {
  id: string;
  name: string;
  emoji: string;
  bounds: Bounds;
  baseZoom: number;
  levels: number;
}

export const OFFLINE_REGIONS: OfflineRegion[] = [
  { id: "europe", name: "Europe", emoji: "🏰", bounds: { west: -11, south: 35, east: 32, north: 62 }, baseZoom: 4, levels: 4 },
  { id: "north-america", name: "North America", emoji: "🗽", bounds: { west: -140, south: 15, east: -52, north: 62 }, baseZoom: 3, levels: 4 },
  { id: "south-america", name: "South America", emoji: "🦜", bounds: { west: -82, south: -56, east: -34, north: 13 }, baseZoom: 3, levels: 4 },
  { id: "africa", name: "Africa", emoji: "🦁", bounds: { west: -18, south: -35, east: 52, north: 38 }, baseZoom: 3, levels: 4 },
  { id: "middle-east", name: "Middle East", emoji: "🕌", bounds: { west: 25, south: 12, east: 64, north: 42 }, baseZoom: 4, levels: 4 },
  { id: "asia", name: "Asia", emoji: "🏯", bounds: { west: 45, south: 5, east: 150, north: 55 }, baseZoom: 3, levels: 4 },
  { id: "southeast-asia", name: "Southeast Asia", emoji: "🏝️", bounds: { west: 92, south: -11, east: 141, north: 24 }, baseZoom: 4, levels: 4 },
  { id: "oceania", name: "Oceania", emoji: "🦘", bounds: { west: 110, south: -48, east: 180, north: -8 }, baseZoom: 3, levels: 4 },
];

const AVG_TILE_KB = 18;
export const REGION_MAX_TILES = 40_000;

export interface RegionEstimate {
  tiles: number;
  mb: number;
  capped: boolean;
}

/** Exact tile count for a region's download plan + an honest size estimate. */
export function estimateRegion(r: OfflineRegion): RegionEstimate {
  const tiles = tilesForBounds(r.bounds, r.baseZoom, r.levels, REGION_MAX_TILES).length;
  return {
    tiles,
    mb: Math.round((tiles * AVG_TILE_KB) / 1024),
    capped: tiles >= REGION_MAX_TILES,
  };
}
