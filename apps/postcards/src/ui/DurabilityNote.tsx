import { usePersistence } from "../lib/store/usePersistence";
import { useVisits } from "../lib/store/useVisits";
import { useStories } from "../lib/store/useStories";
import { daysSinceBackup } from "../lib/backupReminder";
import { useT } from "../lib/i18n";

/**
 * Long-term-memory status: whether this device's storage is durable (the browser
 * granted persistence, so it won't silently evict your data) plus a compact
 * last-backup read. When storage is NOT guaranteed durable, the portable backup
 * file is the safety net — so this leans on "keep a backup." Shown only once
 * there's data worth protecting. Backup ACTIONS live right below in the Backup UI.
 */
export function DurabilityNote() {
  const t = useT();
  const persistence = usePersistence((s) => s.persistence);
  const hasVisits = useVisits((s) => s.visits.length > 0);
  const hasStories = useStories((s) => s.stories.length > 0);
  if (!hasVisits && !hasStories) return null;

  const protectedOk = persistence === "granted";
  const days = daysSinceBackup(Date.now());
  const backup =
    days == null
      ? t("durability.neverBackedUp")
      : days === 0
        ? t("durability.backedUpToday")
        : t("durability.backedUpDays", { days });

  return (
    <p className={"durability-note " + (protectedOk ? "is-ok" : "is-warn")} role="status">
      <span aria-hidden>{protectedOk ? "🛡️" : "⚠️"}</span>{" "}
      {protectedOk ? t("durability.protected") : t("durability.atRisk")} · {backup}
    </p>
  );
}
