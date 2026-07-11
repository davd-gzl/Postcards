import { useEffect, useMemo, useState } from "react";
import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";
import { StateToggles } from "../visits/StateToggles";
import { CityLine } from "../../ui/CityLine";
import { countryFlag } from "../../lib/format/format";
import type { PlaceRef } from "../../lib/schema/models";

/**
 * Moments: world experiences you can live once and remember forever (see the
 * northern lights, meet Santa in Lapland, cross the equator). V0: a small
 * bundled starter list (public/reference/experiences.json, CC0); the plan is a
 * community dataset later, same file shape. Each moment is stored as a normal
 * "custom" record in your portable file, so backups and sharing already work;
 * "XX"-style country codes are not needed because moments carry the neutral
 * "ZZ" code and never count toward country stats. Each moment links to a few real
 * places where it can be lived — tapping one flies the map there.
 */
interface Spot {
  name: string;
  lat: number;
  lon: number;
  cc?: string;
}
interface Experience {
  id: string;
  emoji: string;
  name: string;
  hint: string;
  where?: Spot[];
}

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

/** A moment's stable PlaceRef: kind custom, neutral country (not a real place). */
function placeOf(e: Experience): PlaceRef {
  return { kind: "custom", id: e.id, name: e.name, countryId: "ZZ" };
}

export function ExperiencesScreen() {
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

  return (
    <section aria-label="Moments">
      <div className="section-head">
        <h2>Moments</h2>
        <span className="list-head-meta muted">
          {lived} of {list.length} lived
        </span>
      </div>
      <p className="muted small">
        World moments, not places: things you can only live somewhere. Check the ones you have
        lived; flag the ones you dream of. Each links to a few places where it happens; tap one to
        see it on the map. This starter list is V0; a fuller shared dataset is planned.
      </p>
      <ul className="city-list">
        {list.map((e) => (
          <li key={e.id} className="city-row compact moment-row">
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
        ))}
      </ul>
    </section>
  );
}
