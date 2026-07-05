# Offline maps & the Offline Map Store

Place'Been renders maps only through the **`MapSource`** seam
(`src/lib/map-source/`). There are three basemaps:

| Pack id | What it is | Network | Default |
| --- | --- | --- | --- |
| `world-overview` | Bundled Natural Earth country overview | **Offline** | ✅ |
| `osm-raster` | OpenStreetMap raster tiles | Online (opt-in) | — |
| `world-detail` | Street-level **PMTiles** vector pack | **Offline** | opt-in, only when installed |

## Why no street pack is bundled

The project constitution requires offline maps to be **device-global / cross-app, never locked to
app-private storage** — and a world street-level pack is far too large to ship inside an app. So
Place'Been never bundles one and never reads tiles by a hard-coded app-private path. Instead it
asks an **`OfflineMapStore`** for a pack:

```ts
export interface OfflineMapStore {
  detailPack(): Promise<OfflineMapPack | null>; // { id, pmtilesUrl } or null
}
```

- **Today** — `BundledOfflineMapStore` probes for a pack the operator placed with the app's assets
  (`<base>/basemap/world-detail.pmtiles`) and returns a `pmtiles://…` URL if present, else `null`.
- **Later** — a Capacitor `SharedOfflineMapStore` plugin (iOS **App Group**, Android **SAF /
  content-provider**) implements the *same* interface, so a pack shared across the maintainer's
  apps lights up the offline street basemap with **no app change**.

If the store returns `null`, the "Streets (offline)" option is simply hidden and nothing else
changes. If a pack disappears, the app falls back to the bundled overview rather than erroring.

## Adding a PMTiles pack (operator / self-host)

1. Get a PMTiles world (or regional) basemap — e.g. build one at
   [build.protomaps.com](https://build.protomaps.com) (OpenStreetMap data, ODbL). The default
   style in `bundledMapSource.ts` (`detailVectorStyle`) targets the Protomaps **basemap** flavor
   layer schema (`earth`, `water`, `landuse`, `roads`, `boundaries`). A pack with a different
   schema just needs its own style.
2. Place it at `apps/placebeen/public/basemap/world-detail.pmtiles` (self-hosted PWA), or expose it
   through your platform's shared store so `OfflineMapStore.detailPack()` resolves its URL.
3. Reload — the map's basemap toggle now includes **Streets (offline)**. The `pmtiles://` protocol
   is already registered (`pmtiles` npm package), so MapLibre reads the archive directly with
   HTTP range requests; fully offline once cached.

> Note: a world street pack can be hundreds of MB — deliver it via the device-global store, not by
> committing it into the app bundle. The PWA precache glob includes `*.pmtiles`, but large packs
> should live in the shared store, not the app's precache.

## Extending the seam

- New online/offline source? Add a `MapPackRef` + a `resolveStyle` branch in `bundledMapSource.ts`.
- New device store? Implement `OfflineMapStore` and inject it into `new BundledMapSource(store)`.
  Everything else (protocol registration, basemap toggle, fallback) is unchanged.
