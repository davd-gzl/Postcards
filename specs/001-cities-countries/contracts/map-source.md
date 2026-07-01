# Contract: `MapSource` interface (the offline-map seam)

The map layer consumes tiles **only** through this interface. The MVP backs it with a bundled
world-overview PMTiles file, but the interface makes **no assumption about where tiles live** — so
the future device-global, cross-app **Offline Map Store** (App Group on iOS, SAF/content-provider
on Android, shared filesystem on desktop) implements the same contract with zero app-facing change.
This directly satisfies the constitution's "Ecosystem & shared offline maps" constraint.

## Interface (TypeScript, illustrative)

```ts
/** Where a set of offline tiles physically lives, resolved per platform. */
export interface MapPackRef {
  /** Stable id, e.g. "world-overview", "fr-detail". */
  id: string;
  /** Human label for UI. */
  label: string;
  /** Coverage hint (e.g. "world", ISO country code). Informational. */
  scope: string;
}

export interface ResolvedMapStyle {
  /** A MapLibre style object (already pointing at the resolved tile source). */
  style: unknown;
  /** Attribution string to display (e.g. "© OpenStreetMap contributors"). */
  attribution: string;
}

export interface MapSource {
  /** Packs available to this app right now (MVP: just the bundled world overview). */
  listPacks(): Promise<MapPackRef[]>;

  /** True if the given pack's tiles are present locally and usable offline. */
  isAvailableOffline(packId: string): Promise<boolean>;

  /**
   * Resolve a MapLibre style whose sources point at locally-available tiles.
   * Implementations decide the physical backing (bundled asset, App Group container,
   * SAF folder, served URL) — callers never care.
   */
  resolveStyle(packId: string): Promise<ResolvedMapStyle>;
}
```

## MVP implementation: `BundledPmtilesMapSource`

- Ships one pack: `{ id: "world-overview", label: "World (overview)", scope: "world" }`.
- Tiles: a bundled `world-overview.pmtiles` under `public/basemap/`, read via the MapLibre `pmtiles`
  protocol. On web it is served/fetched from app assets; under Capacitor it is read from bundled
  assets / the app filesystem. Either way, available offline on first launch (SC-007).
- `resolveStyle` returns the bundled MapLibre style wired to the `pmtiles://` source, with OSM/ODbL
  attribution.

## Forward compatibility (later feature — not built here)

- A `SharedOfflineMapStore` implementation of `MapSource` will resolve packs from a device-global,
  cross-app location and expose additional download/manage operations behind a **superset**
  interface (e.g. `download(packId)`, `remove(packId)`, `usageBytes()`), delivered as a reusable
  Capacitor plugin + SDK. The MVP app depends only on the read-side `MapSource` above, so adopting
  the shared store is a dependency swap, not a rewrite.

## Rules

- The map feature MUST NOT read tile files by hard-coded app-private paths; it MUST go through
  `MapSource`.
- No network is required to render an available pack.
- Attribution returned by `resolveStyle` MUST be displayed.
