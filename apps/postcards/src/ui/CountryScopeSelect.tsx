import { useSettings } from "../lib/store/useSettings";
import { COUNTRY_SCOPES, type CountryScope } from "../lib/reference/scope";

/**
 * "What counts as a country" picker — sovereign UN members only, or including
 * dependent territories (Hong Kong, Jersey, …). Backed by the shared, persisted
 * setting so the stats, the map counter, and the checklist all agree.
 */
export function CountryScopeSelect({ id = "country-scope" }: { id?: string }) {
  const scope = useSettings((s) => s.countryScope);
  const setScope = useSettings((s) => s.setCountryScope);
  const hint = COUNTRY_SCOPES.find((o) => o.value === scope)?.hint ?? "";

  return (
    <label className="picker-label scope-select" htmlFor={id}>
      Counting
      <select
        id={id}
        className="select"
        value={scope}
        title={hint}
        onChange={(e) => setScope(e.target.value as CountryScope)}
      >
        {COUNTRY_SCOPES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
