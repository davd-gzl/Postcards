import { useSettings } from "../lib/store/useSettings";
import { useT } from "../lib/i18n";

/**
 * The online/offline switch in the top bar. Clicking it flips the app's master
 * Offline mode — the self-contained switch that gates ALL optional egress (map
 * tiles, place photos, guides, data-pack fetches). The label and dot follow the
 * mode so the toggle is always visibly responsive, and the tooltip states what a
 * click will do. Accessible: a real button with aria-pressed for the toggle
 * state and a title (WCAG 4.1.2, keyboard-first).
 */
export function ConnectionStatus() {
  const t = useT();
  const offlineMode = useSettings((s) => s.offlineMode);
  const setOfflineMode = useSettings((s) => s.setOfflineMode);
  const online = !offlineMode;
  const label = online ? t("conn.online") : t("conn.offline");
  const hint = online ? t("conn.goOffline") : t("conn.goOnline");
  return (
    <button
      type="button"
      className={"conn-status conn-toggle " + (online ? "conn-online" : "conn-offline")}
      aria-pressed={offlineMode}
      aria-label={`${label} — ${hint}`}
      title={hint}
      onClick={() => setOfflineMode(!offlineMode)}
    >
      <span className="dot" aria-hidden>
        {online ? "●" : "○"}
      </span>
      <span className="conn-label">{label}</span>
    </button>
  );
}
