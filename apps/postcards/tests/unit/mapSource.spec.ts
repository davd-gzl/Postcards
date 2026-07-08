import { describe, it, expect } from "vitest";
import {
  BundledMapSource,
  detailVectorStyle,
} from "../../src/lib/map-source/bundledMapSource";
import {
  BundledOfflineMapStore,
  type OfflineMapStore,
} from "../../src/lib/map-source/offlineMapStore";

const emptyStore: OfflineMapStore = { detailPack: async () => null };
const installedStore: OfflineMapStore = {
  detailPack: async () => ({ id: "world-detail", pmtilesUrl: "pmtiles://https://x/world.pmtiles" }),
};

// Fake fetch responses for the Range-GET pack probe.
function res(opts: { ok: boolean; contentType?: string; body?: string }): Response {
  return {
    ok: opts.ok,
    headers: { get: (k: string) => (k === "content-type" ? opts.contentType ?? "" : null) },
    arrayBuffer: async () => new TextEncoder().encode(opts.body ?? "").buffer,
  } as unknown as Response;
}
const pmtilesHeader = "PMTiles"; // 7-byte magic + version byte

describe("BundledOfflineMapStore (device-global pack probe)", () => {
  it("returns a pmtiles:// pack when a real archive is present (magic header)", async () => {
    const store = new BundledOfflineMapStore(
      "/",
      (async () => res({ ok: true, contentType: "application/octet-stream", body: pmtilesHeader })) as unknown as typeof fetch,
    );
    const pack = await store.detailPack();
    expect(pack).not.toBeNull();
    expect(pack!.pmtilesUrl.startsWith("pmtiles://")).toBe(true);
    expect(pack!.pmtilesUrl).toContain("basemap/world-detail.pmtiles");
  });

  it("rejects an SPA history-fallback that returns 200 index.html (not a real pack)", async () => {
    const htmlType = new BundledOfflineMapStore(
      "/",
      (async () => res({ ok: true, contentType: "text/html", body: "<!doctype html>" })) as unknown as typeof fetch,
    );
    expect(await htmlType.detailPack()).toBeNull();
    // Even if the server mislabels the type, the wrong magic bytes reject it.
    const wrongMagic = new BundledOfflineMapStore(
      "/",
      (async () => res({ ok: true, contentType: "application/octet-stream", body: "<html>" })) as unknown as typeof fetch,
    );
    expect(await wrongMagic.detailPack()).toBeNull();
  });

  it("is gracefully absent when no pack exists (404) or offline (throws)", async () => {
    const missing = new BundledOfflineMapStore("/", (async () => res({ ok: false })) as unknown as typeof fetch);
    expect(await missing.detailPack()).toBeNull();
    const offline = new BundledOfflineMapStore("/", (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch);
    expect(await offline.detailPack()).toBeNull();
  });
});

describe("BundledMapSource packs", () => {
  it("hides the offline-detail pack until one is installed", async () => {
    const none = new BundledMapSource(emptyStore);
    expect((await none.listPacks()).map((p) => p.id)).toEqual(["world-overview", "osm-raster"]);
    expect(await none.isAvailableOffline("world-detail")).toBe(false);

    const yes = new BundledMapSource(installedStore);
    expect((await yes.listPacks()).map((p) => p.id)).toContain("world-detail");
    expect(await yes.isAvailableOffline("world-detail")).toBe(true);
  });

  it("world-overview is always offline; osm-raster never is", async () => {
    const src = new BundledMapSource(emptyStore);
    expect(await src.isAvailableOffline("world-overview")).toBe(true);
    expect(await src.isAvailableOffline("osm-raster")).toBe(false);
  });

  it("resolves the offline-detail style from the installed pack's pmtiles url", async () => {
    const src = new BundledMapSource(installedStore);
    const { style } = await src.resolveStyle("world-detail");
    const source = style.sources.basemap as { type: string; url: string };
    expect(source.type).toBe("vector");
    expect(source.url).toBe("pmtiles://https://x/world.pmtiles");
  });

  it("falls back to the offline overview when the detail pack is absent", async () => {
    const src = new BundledMapSource(emptyStore);
    const { style } = await src.resolveStyle("world-detail");
    expect(style.name).toContain("world overview");
  });

  it("osm-raster stays an online raster style", async () => {
    const src = new BundledMapSource(emptyStore);
    const { style } = await src.resolveStyle("osm-raster");
    expect((style.sources.osm as { type: string }).type).toBe("raster");
  });
});

describe("detailVectorStyle (Protomaps basemap schema)", () => {
  it("wires a pmtiles vector source and standard base layers", () => {
    const style = detailVectorStyle("pmtiles://https://x/world.pmtiles");
    const layerIds = style.layers.map((l) => l.id);
    expect(layerIds).toEqual(expect.arrayContaining(["earth", "water", "roads", "boundaries"]));
    const water = style.layers.find((l) => l.id === "water") as { "source-layer": string };
    expect(water["source-layer"]).toBe("water");
  });
});
