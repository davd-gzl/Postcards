import { useSettings } from "../lib/store/useSettings";

/**
 * "What counts as a country" — a two-option segmented toggle (replaces the old
 * dropdown): UN member states vs everything incl. territories. One glance, one tap.
 */
export function ScopeToggle() {
  const scope = useSettings((s) => s.countryScope);
  const setScope = useSettings((s) => s.setCountryScope);
  return (
    <div className="segmented scope-toggle" role="group" aria-label="What counts as a country">
      <button
        type="button"
        aria-pressed={scope === "un"}
        className={scope === "un" ? "seg-on" : ""}
        onClick={() => setScope("un")}
        title="Count only the 193 UN member states"
      >
        UN · 193
      </button>
      <button
        type="button"
        aria-pressed={scope === "all"}
        className={scope === "all" ? "seg-on" : ""}
        onClick={() => setScope("all")}
        title="Count all countries and territories"
      >
        All · 250
      </button>
    </div>
  );
}
