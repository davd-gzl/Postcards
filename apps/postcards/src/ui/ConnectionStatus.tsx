import { useOnlineStatus } from "../lib/hooks/useOnlineStatus";

/**
 * A small, always-visible chip telling you whether the app is online or offline.
 * Non-interactive — it only reports state. The label (not colour alone) plus an
 * aria-live region keep it accessible (WCAG 1.4.1 / 4.1.3).
 */
export function ConnectionStatus() {
  const online = useOnlineStatus();
  const label = online ? "Online" : "Offline";
  return (
    <span
      className={"conn-status " + (online ? "conn-online" : "conn-offline")}
      role="status"
      aria-live="polite"
      title={label}
      aria-label={label}
    >
      <span className="dot" aria-hidden>
        {online ? "●" : "○"}
      </span>
      <span className="conn-label">{label}</span>
    </span>
  );
}
