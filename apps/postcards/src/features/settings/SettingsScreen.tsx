import { useMemo, useRef, useState } from "react";
import { useToast } from "../../lib/store/useToast";
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
        <h3>Offline maps</h3>
        <p className="muted small">
          Download a whole region of the detailed OpenStreetMap basemap for offline use — with the
          real download size up front. Tiles come from OpenStreetMap and are fetched only when you
          tap Download.
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
      </section>

      <section className="settings-section">
        <Backup />
        <p className="muted small">
          Cloud sync (Nextcloud, Google Drive, …) is planned — for now, export the file and drop it
          in any synced folder.
        </p>
      </section>

      <Attribution />
    </section>
  );
}
