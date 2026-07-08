# Basemap geometry provenance

`countries-50m.json` — world country boundaries at 1:50m, TopoJSON.

- **Source dataset**: Natural Earth (Admin 0 – Countries), via the `world-atlas` package.
- **License**: Public Domain.
- **Upstream**: https://github.com/topojson/world-atlas / https://www.naturalearthdata.com
- **Use**: bundled, served as a static asset and cached for offline use. Country polygons are
  drawn as the map's base layer and shaded when visited. This is the MVP basemap; a street-level
  PMTiles basemap (OpenStreetMap / ODbL) is a planned follow-up behind the same `MapSource` seam.

This is aggregated reference data — the app does not author or edit it (Constitution I).
