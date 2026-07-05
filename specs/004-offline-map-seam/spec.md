# Feature Specification: Offline Detail Basemap Seam (PMTiles + Offline Map Store)

**Feature Directory**: `specs/004-offline-map-seam`

**Created**: 2026-07-05

**Status**: Draft

**Input**: Maintainer request: "Offline street maps + shared Offline Map Store." Provide a
street-level **offline** basemap option, delivered the constitutional way — through the device-
global, cross-app **Offline Map Store**, never bundled into app-private storage.

## Clarifications

### Session 2026-07-05

- Q: Do we bundle a world street-map pack in the app? → A: **No.** The constitution requires
  offline maps to be device-global / cross-app, never app-private, and a world street pack is far
  too large to ship in-app anyway. The deliverable is the **seam**: the app reads a PMTiles pack
  *if the Offline Map Store reports one*, via the `pmtiles://` protocol.
- Q: What pack format/schema? → A: **PMTiles** (single-file, offline, `pmtiles://` protocol on
  MapLibre). The default style targets the **Protomaps "basemap"** flavor (OpenStreetMap/ODbL),
  the recommended free world pack; a different schema only needs its own style.
- Q: What if no pack is installed? → A: The offline-detail option is **hidden**, and the app keeps
  its always-available bundled overview (and opt-in online OSM). Zero behavior change without a pack.
- Q: How does the future shared store fit? → A: A Capacitor `SharedOfflineMapStore` plugin (iOS
  App Group / Android SAF) implements the same `OfflineMapStore` interface with no app change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use an installed offline street basemap (Priority: P1)

When a PMTiles basemap pack is available on the device (through the Offline Map Store), the map
offers a **Streets (offline)** basemap that renders street-level detail with no network.

**Independent Test**: With a pack reported by the store, the basemap cycle includes "Streets
(offline)" and selecting it resolves a `pmtiles://`-backed vector style; with no pack, the option
is absent and the map is unchanged.

**Acceptance Scenarios**:

1. **Given** the Offline Map Store reports a detail pack, **When** the map screen loads, **Then**
   the basemap toggle includes an offline "Streets" option.
2. **Given** the offline detail basemap is selected, **When** the style resolves, **Then** it uses
   a `pmtiles://` vector source and needs no network.
3. **Given** no pack is installed, **When** the map screen loads, **Then** the offline-detail
   option is not offered and the bundled overview + opt-in online OSM behave exactly as before.
4. **Given** a pack that later disappears, **When** the detail style is requested, **Then** the app
   falls back to the always-available offline overview rather than erroring.

### User Story 2 - Packs come only from the store, never hard-coded paths (Priority: P2)

The app never reads tiles by an app-private path; it asks the `OfflineMapStore` for a pack URL, so
a shared cross-app store can back the same seam later.

**Independent Test**: The map source consults the injected `OfflineMapStore`; swapping the store
implementation changes pack availability with no other code change.

**Acceptance Scenarios**:

1. **Given** an `OfflineMapStore` implementation, **When** the map source lists/resolves packs,
   **Then** it uses only URLs from the store.
2. **Given** the bundled store, **When** it probes for a pack, **Then** it does so by a store-owned
   location (HEAD request), returning null when absent or offline.

## Requirements *(mandatory)*

- **FR-040**: The app MUST support an offline, street-level vector basemap read via the
  `pmtiles://` protocol, behind the existing `MapSource` seam.
- **FR-041**: No street-map pack is bundled in the app; packs are obtained only through an
  `OfflineMapStore` abstraction (today a bundled probe; later a device-global shared store).
- **FR-042**: The offline-detail basemap MUST be offered only when a pack is actually available,
  and selecting it MUST require no network.
- **FR-043**: With no pack installed, all existing basemaps (bundled overview default, opt-in
  online OSM) MUST behave unchanged; a vanished pack MUST fall back to the overview, not error.
- **FR-044**: Tiles MUST never be read by hard-coded app-private paths (device-global / cross-app
  ecosystem constraint).

## Success Criteria *(mandatory)*

- **SC-001**: Dropping a `world-detail.pmtiles` pack where the store looks lights up the offline
  street basemap with no code change.
- **SC-002**: With no pack, there is zero user-visible or network change vs. before.
- **SC-003**: The seam is unit-tested with injected store/fetch; existing suites stay green.

## Out of Scope (this increment)

- Bundling or generating a world PMTiles pack (device-global; produced/installed out of app).
- The native `SharedOfflineMapStore` plugin implementation (App Group / SAF) — this ships its
  interface; the plugin is a later, native deliverable.
- Downloadable map-pack management UI.
