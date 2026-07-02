import { useMemo } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { getReferenceData } from "../../lib/reference/referenceData";
import { CONTINENTS, CONTINENT_COLORS } from "../../lib/reference/continents";

/** Small legend of the continents you've visited (color = map fill). */
export function MapLegend() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);

  const present = useMemo(() => {
    const set = new Set<string>();
    for (const v of visits) {
      const c = ref.continentOf(v.place.countryId);
      if (c) set.add(c);
    }
    return CONTINENTS.filter((c) => set.has(c));
  }, [visits, ref]);

  if (!present.length) return null;

  return (
    <ul className="legend" aria-label="Continents visited">
      {present.map((c) => (
        <li className="legend-item" key={c}>
          <span className="legend-dot" style={{ background: CONTINENT_COLORS[c] }} aria-hidden />
          {c}
        </li>
      ))}
    </ul>
  );
}
