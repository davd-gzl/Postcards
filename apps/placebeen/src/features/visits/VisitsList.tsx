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
    <div className="panel">
      <h2>Your visits ({visits.length})</h2>
      {visits.length === 0 && (
        <p className="muted">No visits yet. Add one from the “Add” tab (shortcut: A).</p>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {sorted.map((v) => {
          const country = ref.countryByIso2(v.place.countryId)?.name ?? v.place.countryId;
          return (
            <li key={v.visitId} className="visit-row">
              <div className="grow">
                <div>
                  <strong>{v.place.name}</strong>{" "}
                  <span className="muted">
                    · {v.place.kind === "city" ? country : "country"}
                    {v.date ? ` · ${formatDate(v.date)}` : ""}
                  </span>
                </div>
                {v.note && <div className="muted">{v.note}</div>}
              </div>
              <button
                className="btn danger"
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
    </div>
  );
}
