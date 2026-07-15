import { useSettings } from "../lib/store/useSettings";
import { useT } from "../lib/i18n";

/**
 * "What counts as a country" — a two-option segmented toggle (replaces the old
 * dropdown): UN member states vs everything incl. territories. One glance, one tap.
 */
export function ScopeToggle() {
  const t = useT();
  const scope = useSettings((s) => s.countryScope);
  const setScope = useSettings((s) => s.setCountryScope);
  return (
    <div className="segmented scope-toggle" role="group" aria-label={t("scope.aria")}>
      <button
        type="button"
        aria-pressed={scope === "un"}
        className={scope === "un" ? "seg-on" : ""}
        onClick={() => setScope("un")}
        title={t("scope.unTitle")}
      >
        {t("scope.un")}
      </button>
      <button
        type="button"
        aria-pressed={scope === "all"}
        className={scope === "all" ? "seg-on" : ""}
        onClick={() => setScope("all")}
        title={t("scope.allTitle")}
      >
        {t("scope.all")}
      </button>
    </div>
  );
}
