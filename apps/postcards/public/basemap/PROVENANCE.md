# Basemap geometry provenance

All three files are **Natural Earth** (Public Domain), bundled and cached for
offline use. They render ONLY on the offline overview base; the online OSM base
draws its own geometry.

- `countries-50m.json` — world country boundaries at 1:50m, TopoJSON. Source:
  Natural Earth (Admin 0 – Countries) via the `world-atlas` package
  (https://github.com/topojson/world-atlas). Drawn as the base land layer and
  shaded when visited.
- `lakes-110m.json` — major lakes at 1:110m, GeoJSON (geometry only). Source:
  Natural Earth (Physical – Lakes), `ne_110m_lakes`
  (https://github.com/nvkelso/natural-earth-vector). Drawn as water over the land.
- `rivers-110m.json` — major rivers & lake centerlines at 1:110m, GeoJSON
  (geometry only). Source: Natural Earth (Physical – Rivers + lake centerlines),
  `ne_110m_rivers_lake_centerlines`.

Upstream: https://www.naturalearthdata.com

This is an OVERVIEW basemap; a street-level PMTiles basemap (OpenStreetMap /
ODbL) remains a planned follow-up behind the same `MapSource` seam (see
`specs/004-offline-map-seam`). This is aggregated reference data — the app does
not author or edit it (Constitution I).
