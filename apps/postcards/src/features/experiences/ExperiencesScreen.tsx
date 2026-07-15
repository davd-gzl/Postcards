import { useEffect, useMemo, useState } from "react";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";
import { getReferenceData } from "../../lib/reference/referenceData";
import { StateToggles } from "../visits/StateToggles";
import { CityLine } from "../../ui/CityLine";
import { countryFlag } from "../../lib/format/format";
import type { Experience } from "./grouping";
import { groupExperiences, placeOf } from "./grouping";

/**
 * Moments: world experiences you can live once and remember forever (see the
 * northern lights, meet Santa in Lapland, cross the equator). The bundled list
 * (public/reference/experiences.json) is an AGGREGATE — anchor coordinates come
 * from Wikidata (CC0) / GeoNames (CC BY 4.0) and the concepts from UNESCO /
 * Wikivoyage (CC BY-SA), each carrying per-item provenance; only the short
 * name/hint/emoji are app-authored. Each moment is stored as a normal "custom"
 * record in your portable file, so backups and sharing already work; moments
 * carry the neutral "ZZ" code and never count toward country stats. Moments are
 * grouped by their home continent → country (read from the primary anchor's
 * country code, not the stored ZZ); borderless ones sit under "Across the world".
 * Tapping a spot flies the map there.
 */
const EXPERIENCES_URL = `${import.meta.env.BASE_URL}reference/experiences.json`;

// Module cache: the list is tiny and static per build.
let cache: Experience[] | null = null;

async function loadExperiences(): Promise<Experience[]> {
  if (cache) return cache;
  try {
    const res = await fetch(EXPERIENCES_URL);
    if (!res.ok) return [];
    const j = (await res.json()) as { experiences?: Experience[] };
    cache = (j.experiences ?? [])
      .filter(
        (e) => typeof e.id === "string" && e.id.startsWith("xp-") && typeof e.name === "string",
      )
      .map((e) => ({
        ...e,
        where: Array.isArray(e.where)
          ? e.where.filter(
              (s) =>
                s && typeof s.name === "string" &&
                typeof s.lat === "number" && typeof s.lon === "number",
            )
          : undefined,
      }));
    return cache;
  } catch {
    return [];
  }
}

/** One moment row — unchanged whether standalone or grouped. */
function MomentRow({ e }: { e: Experience }) {
  return (
    <li className="city-row compact moment-row">
      <div className="moment-main">
        <CityLine flag={e.emoji} name={e.name} sub={<>· {e.hint}</>} />
        {e.where && e.where.length > 0 && (
          <div className="moment-spots">
            <span className="sr-only">Places for {e.name}:</span>
            {e.where.map((s) => (
              <button
                key={`${s.name}:${s.lat}:${s.lon}`}
                type="button"
                className="chip moment-spot"
                title={`Show ${s.name} on the map`}
                onClick={() => useUi.getState().flyTo(s.lon, s.lat)}
              >
                <span aria-hidden>{s.cc ? countryFlag(s.cc) : "📍"}</span> {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <StateToggles place={placeOf(e)} />
    </li>
  );
}

export function ExperiencesScreen({ embedded }: { embedded?: boolean } = {}) {
  // Safe in a useMemo: reference data is initialized before first render.
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);
  const [list, setList] = useState<Experience[]>(() => cache ?? []);

  useEffect(() => {
    if (!cache) void loadExperiences().then(setList);
  }, []);

  const lived = useMemo(
    () =>
      list.filter((e) => findByPlace(visits, placeOf(e))?.status === "visited").length,
    [list, visits],
  );

  const groups = useMemo(() => groupExperiences(list, ref), [list, ref]);

  // Heading levels shift down one step when embedded inside another screen, so
  // the document outline stays correct (standalone h2→h3→h4; embedded h3→h4→h5).
  const ContinentHeading = (embedded ? "h4" : "h3") as "h3" | "h4";
  const CountryHeading = (embedded ? "h5" : "h4") as "h4" | "h5";

  return (
    <section aria-label="Moments">
      <div className="section-head">
        {embedded ? <h3>Moments</h3> : <h2>Moments</h2>}
        <span className="list-head-meta muted">
          {lived} of {list.length} lived
        </span>
      </div>
      <p className="muted small">
        World moments, not places: things you can only live somewhere. Check the ones you have
        lived; flag the ones you dream of. Each links to a few places where it happens; tap one to
        see it on the map. Grouped by home continent and country; borderless ones sit under "Across
        the world".
      </p>
      {groups.map((cont) => (
        <section key={cont.continent} className="moment-continent">
          <ContinentHeading className="moment-continent-head">{cont.continent}</ContinentHeading>
          {cont.countries.map((group) => (
            <div key={group.cc ?? "world"} className="moment-country-group">
              {group.cc && (
                <CountryHeading className="moment-country">
                  <span className="flag" aria-hidden>
                    {countryFlag(group.cc)}
                  </span>{" "}
                  {group.country ?? group.cc}
                </CountryHeading>
              )}
              <ul className="city-list">
                {group.items.map((e) => (
                  <MomentRow key={e.id} e={e} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </section>
  );
}
