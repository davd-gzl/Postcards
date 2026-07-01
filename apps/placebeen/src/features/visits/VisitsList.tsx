import { useMemo } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { getReferenceData } from "../../lib/reference/referenceData";
import { formatDate } from "../../lib/format/format";

export function VisitsList() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const removeVisit = useVisits((s) => s.removeVisit);

  const sorted = useMemo(
    () => [...visits].sort((a, b) => a.place.name.localeCompare(b.place.name)),
    [visits],
  );

  return (
    <section aria-label="Your places">
      <div className="section-head">
        <h2>Your places</h2>
        <span className="muted">{visits.length}</span>
      </div>

      {visits.length === 0 && (
        <p className="muted empty">
          Nothing yet. Add places from the map — search, or tap a city in the list.
        </p>
      )}

      <ul className="city-list">
        {sorted.map((v) => {
          const country = ref.countryByIso2(v.place.countryId)?.name ?? v.place.countryId;
          return (
            <li key={v.visitId} className="city-row">
              <div className="city-focus" style={{ cursor: "default" }}>
                <span className="city-name">{v.place.name}</span>
                <span className="city-sub">
                  {v.place.kind === "city" ? country : "Country"}
                  {v.date ? ` · ${formatDate(v.date)}` : ""}
                  {v.note ? ` · ${v.note}` : ""}
                </span>
              </div>
              <button
                className="link-danger"
                type="button"
                onClick={() => removeVisit(v.visitId)}
                aria-label={`Remove ${v.place.name}`}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
