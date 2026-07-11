import { useMemo, useRef, useState } from "react";
import { useModalKeys } from "../../lib/hooks/useModalKeys";
import { useToast } from "../../lib/store/useToast";
import { useSettings } from "../../lib/store/useSettings";
import { saveAreaOffline } from "../map/offlineTiles";
import { OFFLINE_REGIONS, REGION_MAX_TILES, estimateRegion, type OfflineRegion } from "./regions";
import { ScopeToggle } from "../../ui/ScopeToggle";
import { Backup } from "../backup/Backup";
import { Attribution } from "../../ui/Attribution";
import { formatInt } from "../../lib/format/format";

/**
 * Settings: what counts as a country, offline map packs (with honest tile counts
 * and size estimates — you see how big a region is BEFORE downloading), and your
 * data (export/import, front and centre).
 */
export function SettingsScreen() {
  const showToast = useToast((s) => s.show);
  const autoLoadGuides = useSettings((s) => s.autoLoadGuides);
  const setAutoLoadGuides = useSettings((s) => s.setAutoLoadGuides);
  const onlineMap = useSettings((s) => s.onlineMap);
  const setOnlineMap = useSettings((s) => s.setOnlineMap);
  const [progress, setProgress] = useState<Record<string, number | undefined>>({});
  // Downloads are cancelable, and each region remembers when it was last saved
  // (so the button honestly reads "Re-download" instead of pretending it's new).
  const controllers = useRef<Record<string, AbortController | undefined>>({});
  const [savedAt, setSavedAt] = useState<Record<string, string | undefined>>(() => {
    const out: Record<string, string | undefined> = {};
    for (const r of OFFLINE_REGIONS) {
      try {
        out[r.id] = localStorage.getItem(`postcards-region-saved:${r.id}`) ?? undefined;
      } catch {
        /* private mode */
      }
    }
    return out;
  });
  const estimates = useMemo(
    () => Object.fromEntries(OFFLINE_REGIONS.map((r) => [r.id, estimateRegion(r)])),
    [],
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const resetRef = useRef<HTMLDivElement>(null);
  useModalKeys(resetRef, () => setConfirmReset(false), { enabled: confirmReset });

  // Deletes ONLY map caches and map view preferences. Your places, journal and
  // backups are untouched (they live in IndexedDB, not the tile cache).
  async function resetMaps() {
    for (const r of OFFLINE_REGIONS) controllers.current[r.id]?.abort();
    try {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("osm-tiles")).map((n) => caches.delete(n)),
      );
    } catch {
      /* cache API unavailable: nothing stored anyway */
    }
    try {
      for (const r of OFFLINE_REGIONS) localStorage.removeItem(`postcards-region-saved:${r.id}`);
      for (const k of ["postcards-basemap", "postcards-globe", "postcards-towns", "postcards-countries", "postcards-map-mode", "postcards-city-filter", "postcards-hint-offline"])
        localStorage.removeItem(k);
    } catch {
      /* private mode */
    }
    setSavedAt({});
    setConfirmReset(false);
    showToast("Map caches and view settings were reset.");
  }

  async function download(r: OfflineRegion) {
    if (progress[r.id] != null) return;
    const ctl = new AbortController();
    controllers.current[r.id] = ctl;
    setProgress((p) => ({ ...p, [r.id]: 0 }));
    try {
      const res = await saveAreaOffline(r.bounds, r.baseZoom, {
        levels: r.levels,
        maxTiles: REGION_MAX_TILES,
        signal: ctl.signal,
        onProgress: (p) => setProgress((s) => ({ ...s, [r.id]: p.total ? p.done / p.total : 1 })),
      });
      if (ctl.signal.aborted) {
        showToast(`${r.name}: download cancelled.`);
      } else {
        const now = new Date().toISOString().slice(0, 10);
        try {
          localStorage.setItem(`postcards-region-saved:${r.id}`, now);
        } catch {
          /* private mode */
        }
        setSavedAt((sv) => ({ ...sv, [r.id]: now }));
        showToast(
          res.failed === 0
            ? `${r.name}: saved ${formatInt(res.saved)} map tiles for offline use.`
            : `${r.name}: saved ${formatInt(res.saved)} tiles (${formatInt(res.failed)} failed — try again on a better connection).`,
        );
      }
    } catch {
      showToast(`Couldn't download ${r.name} — check your connection.`);
    } finally {
      controllers.current[r.id] = undefined;
      setProgress((p) => ({ ...p, [r.id]: undefined }));
    }
  }

  return (
    <section aria-label="Settings">
      <div className="section-head">
        <h2>Settings</h2>
      </div>

      <section className="settings-section">
        <h3>What counts as a country</h3>
        <p className="muted small">
          Used everywhere a country is counted: totals, the passport, per-continent progress.
        </p>
        <ScopeToggle />
      </section>

      <section className="settings-section">
        <h3>Detailed map</h3>
        <p className="muted small">
          The detailed OpenStreetMap map is on by default; it fetches map tiles from OpenStreetMap
          when you're online. Turn it off to use the plain offline map only, so the app makes no
          network requests at all. Either way, no personal data ever leaves your device.
        </p>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={onlineMap}
            onChange={(e) => setOnlineMap(e.target.checked)}
          />
          <span>Use the detailed online map (OpenStreetMap)</span>
        </label>
      </section>

      <section className="settings-section">
        <h3>Offline maps</h3>
        <p className="muted small">
          Save the detailed OpenStreetMap map for offline use: download the whole world or a single
          region, with the real size shown up front. Packs cover overview zoom (countries, big
          cities); street-level areas you browse online are kept offline automatically. Tiles come
          from OpenStreetMap and are fetched only when you tap Download.
        </p>
        <ul className="region-list">
          {OFFLINE_REGIONS.map((r) => {
            const est = estimates[r.id]!;
            const p = progress[r.id];
            return (
              <li key={r.id} className="region-row">
                <span className="region-emoji" aria-hidden>
                  {r.emoji}
                </span>
                <span className="region-name">
                  {r.name}
                  <span className="muted small">
                    {" "}
                    {formatInt(est.tiles)} tiles · ≈{est.mb} MB
                    {est.capped ? " (capped)" : ""}
                    {savedAt[r.id] ? ` · saved ${savedAt[r.id]}` : ""}
                  </span>
                </span>
                {p == null ? (
                  <button className="mini-btn" type="button" onClick={() => void download(r)}>
                    {savedAt[r.id] ? "⟳ Re-download" : "⬇ Download"}
                  </button>
                ) : (
                  <>
                    <span className="region-progress" role="status">
                      {Math.round(p * 100)}%
                    </span>
                    <button
                      className="link-danger"
                      type="button"
                      onClick={() => controllers.current[r.id]?.abort()}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <p className="muted small">
          Sizes are estimates (~18 KB per tile). Tiles live in your browser's cache for ~30 days of
          non-use; browsing an area on the online map also keeps it available offline.
        </p>
        <button className="link-danger" type="button" onClick={() => setConfirmReset(true)}>
          Reset offline maps…
        </button>
        {confirmReset && (
          <div className="modal-backdrop" onClick={() => setConfirmReset(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="Reset offline maps"
              ref={resetRef}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Reset offline maps?</h2>
              <p className="muted">
                This deletes all downloaded map tiles and resets the map view settings (basemap,
                globe, towns). Your places, photos, journal and backups are not touched.
              </p>
              <div className="trip-form-actions">
                <button className="btn" type="button" autoFocus onClick={() => void resetMaps()}>
                  Reset maps
                </button>
                <button className="btn-ghost" type="button" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="settings-section">
        <h3>Travel guides</h3>
        <p className="muted small">
          When you open a place, a short overview and photo can load from Wikivoyage and Wikipedia.
          Opening a place is your own action, so this is on by default; turn it off to load guides
          only when you tap. Nothing else leaves your device.
        </p>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={autoLoadGuides}
            onChange={(e) => setAutoLoadGuides(e.target.checked)}
          />
          <span>Load guide overviews automatically when online</span>
        </label>
      </section>

      <section className="settings-section">
        <Backup />
        <p className="muted small">
          Cloud sync (Nextcloud, Google Drive, …) is planned; for now, export the file and drop it
          in any synced folder.
        </p>
      </section>

      <Attribution />
    </section>
  );
}
