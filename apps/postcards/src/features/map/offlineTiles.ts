// "Save this area for offline": pre-fetch the OSM raster tiles covering the
// current view (and a couple of zoom levels deeper) so the service worker's
// CacheFirst rule stores them and the area works with no network later.
// Only ever runs on an explicit user action (Constitution: data/requests leave
// the device only when the user asks).

import type { Bounds } from "./viewport";

export const OSM_TILE_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAX_ZOOM = 19;

function lon2x(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function lat2y(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Tile URLs covering `bounds` from `baseZoom` for `levels` zoom levels, capped at
 * `maxTiles` (coarsest levels first, so a cap keeps the wider-area tiles). Pure
 * and deterministic — unit-tested.
 */
export function tilesForBounds(
  bounds: Bounds,
  baseZoom: number,
  levels = 3,
  maxTiles = 800,
  template = OSM_TILE_TEMPLATE,
): string[] {
  const z0 = clamp(Math.round(baseZoom), 1, MAX_ZOOM);
  const urls: string[] = [];
  for (let dz = 0; dz < levels && z0 + dz <= MAX_ZOOM; dz++) {
    const z = z0 + dz;
    const n = 2 ** z;
    const yMin = clamp(lat2y(bounds.north, z), 0, n - 1);
    const yMax = clamp(lat2y(bounds.south, z), 0, n - 1);
    // A viewport crossing the antimeridian has west > east; split it into two
    // x-spans ([west..edge] and [edge..east]) so the date line saves like anywhere
    // else (mirrors the wrap handling in viewport.ts).
    const xw = clamp(lon2x(bounds.west, z), 0, n - 1);
    const xe = clamp(lon2x(bounds.east, z), 0, n - 1);
    const spans: [number, number][] =
      bounds.west <= bounds.east ? [[xw, xe]] : [[xw, n - 1], [0, xe]];
    for (const [x0, x1] of spans) {
      for (let x = x0; x <= x1; x++) {
        for (let y = yMin; y <= yMax; y++) {
          if (urls.length >= maxTiles) return urls;
          urls.push(template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
        }
      }
    }
  }
  return urls;
}

export interface SaveProgress {
  done: number;
  total: number;
}

/**
 * Fetch every tile so the SW caches it. Uses no-cors (opaque responses are
 * cacheable per the workbox rule's status:0). Concurrency-limited and abortable.
 */
export async function saveAreaOffline(
  bounds: Bounds,
  baseZoom: number,
  opts: {
    levels?: number;
    maxTiles?: number;
    template?: string;
    concurrency?: number;
    onProgress?: (p: SaveProgress) => void;
    signal?: AbortSignal;
    fetchFn?: typeof fetch;
  } = {},
): Promise<{ saved: number; failed: number; total: number; capped: boolean }> {
  const maxTiles = opts.maxTiles ?? 800;
  const urls = [...new Set(tilesForBounds(bounds, baseZoom, opts.levels ?? 3, maxTiles, opts.template))];
  const capped = urls.length >= maxTiles;
  const doFetch = opts.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const total = urls.length;
  let done = 0;
  let failed = 0;
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      if (opts.signal?.aborted) return;
      const url = urls[i++]!;
      try {
        await doFetch(url, { mode: "no-cors" });
      } catch {
        failed++;
      }
      done++;
      opts.onProgress?.({ done, total });
    }
  }
  // Keep concurrency modest to respect the OSM tile usage policy (no bulk hammering).
  await Promise.all(Array.from({ length: opts.concurrency ?? 3 }, worker));
  return { saved: done - failed, failed, total, capped };
}
