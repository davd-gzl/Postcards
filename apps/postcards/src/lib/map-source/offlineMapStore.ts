// The device-global offline map store seam (Constitution: Ecosystem & shared
// offline maps). Offline map packs must NEVER be read by hard-coded app-private
// paths — the app only ever asks *this* store for a pack URL. Today a bundled
// probe implements it; tomorrow a Capacitor `SharedOfflineMapStore` plugin
// (iOS App Group / Android SAF / shared filesystem) implements the SAME
// interface with no app-facing change.

export interface OfflineMapPack {
  /** Stable pack id (e.g. "world-detail"). */
  id: string;
  /** A URL MapLibre can read via the pmtiles:// protocol, e.g. "pmtiles://<url>". */
  pmtilesUrl: string;
}

export interface OfflineMapStore {
  /**
   * The detail (street-level) basemap pack installed on this device, or null if
   * none is available. Resolving a URL here — never a hard-coded path — is what
   * lets a shared, cross-app store back the same seam later.
   */
  detailPack(): Promise<OfflineMapPack | null>;
}

/**
 * Default store for the web/PWA build: looks for a PMTiles pack the operator has
 * placed alongside the app's own assets. None is bundled (a street-level world
 * pack is device-global, not app-private, and far too large to ship in-app);
 * this simply lights up the offline-detail basemap when a pack is present.
 */
export class BundledOfflineMapStore implements OfflineMapStore {
  constructor(
    private readonly baseUrl: string = import.meta.env.BASE_URL,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  async detailPack(): Promise<OfflineMapPack | null> {
    const url = `${this.baseUrl}basemap/world-detail.pmtiles`;
    try {
      // Range-GET only the first bytes so we can PROVE it's a PMTiles archive, not
      // just a 200. A common self-host history-fallback (try_files … /index.html)
      // returns 200 with index.html for the missing pack; a bare-200 check would
      // then advertise a "Streets (offline)" basemap that renders broken. Verify
      // the content-type isn't HTML and the 7-byte PMTiles magic header is present.
      const res = await this.fetchFn(url, { headers: { Range: "bytes=0-6" } });
      if (!res.ok) return null;
      if ((res.headers.get("content-type") ?? "").includes("text/html")) return null;
      const magic = new Uint8Array(await res.arrayBuffer()).subarray(0, 7);
      if (String.fromCharCode(...magic) !== "PMTiles") return null;
      return { id: "world-detail", pmtilesUrl: `pmtiles://${url}` };
    } catch {
      return null; // offline / not installed / not a real pack → gracefully absent
    }
  }
}

export const bundledOfflineMapStore = new BundledOfflineMapStore();
