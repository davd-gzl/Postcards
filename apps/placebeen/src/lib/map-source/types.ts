import type { StyleSpecification } from "maplibre-gl";

// The map consumes tiles/base ONLY through this seam. The MVP backs it with a
// bundled, offline base style; a future device-global shared Offline Map Store
// (App Group / SAF / shared filesystem) implements the same interface with no
// app-facing change (Constitution: Ecosystem & shared offline maps).
// Contract: contracts/map-source.md

export interface MapPackRef {
  id: string;
  label: string;
  scope: string;
}

export interface ResolvedMapStyle {
  style: StyleSpecification;
  attribution: string;
}

export interface MapSource {
  listPacks(): Promise<MapPackRef[]>;
  isAvailableOffline(packId: string): Promise<boolean>;
  resolveStyle(packId: string): Promise<ResolvedMapStyle>;
}
