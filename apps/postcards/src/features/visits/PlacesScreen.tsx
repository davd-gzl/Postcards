import { useEffect, useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { useSettings } from "../../lib/store/useSettings";
import { countryFlag, formatDate } from "../../lib/format/format";
import type { Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { inScope } from "../../lib/reference/scope";
import { CityLine } from "../../ui/CityLine";
import { ScopeToggle } from "../../ui/ScopeToggle";
import { PhotoGallery } from "./PhotoGallery";
import { StateToggles } from "./StateToggles";
import { GuideButton } from "../guides/GuideButton";
import { PassportScreen } from "../passport/PassportScreen";
import { ExperiencesScreen } from "../experiences/ExperiencesScreen";

// Everything place-shaped lives here, one view each — including Favorites (its
// own view, not a mode that repaints "Visited"), Moments and the Passport.
type View = "visited" | "favorites" | "wishlist" | "countries" | "monuments" | "moments" | "passport";


/** Map coordinate to fly to (if known) and the secondary "· type · place" label for a visit. */
function placeMeta(ref: ReferenceData, v: Visit): { coord: { lon: number; lat: number } | null; sub: string } {
  const country = ref.countryByIso2(v.place.countryId)?.name ?? v.place.countryId;
  if (v.place.kind === "city") {
    const c = ref.cityById(v.place.id);
    return { coord: c ? { lon: c.lon, lat: c.lat } : null, sub: country };
  }
  if (v.place.kind === "airport") {
    const a = ref.airportById(v.place.id);
    return { coord: a ? { lon: a.lon, lat: a.lat } : null, sub: `Airport · ${country}` };
  }
  if (v.place.kind === "heritage") {
    const h = ref.heritageById(v.place.id);
    const coord = h && (h.lat !== 0 || h.lon !== 0) ? { lon: h.lon, lat: h.lat } : null;
    return { coord, sub: `Monument · ${country}` };
  }
  return { coord: null, sub: v.place.kind === "custom" ? "Your place" : "Country" };
}

/** One visited or wishlist row — visited adds details, photos and the favorite star. */
function VisitRow({ v, wishlist }: { v: Visit; wishlist?: boolean }) {
  const ref = useMemo(() => getReferenceData(), []);
  const removeVisit = useVisits((s) => s.removeVisit);
  const toggleVisit = useVisits((s) => s.toggleVisit);
  const toggleFavorite = useVisits((s) => s.toggleFavorite);
  const setAll = useVisits((s) => s.setAll);
  const showToast = useToast((s) => s.show);
  const flyTo = useUi((s) => s.flyTo);
  const { coord, sub } = placeMeta(ref, v);

  function removeWithUndo() {
    const prev = useVisits.getState().visits;
    void removeVisit(v.visitId);
    showToast(`Removed ${v.place.name}`, () => setAll(prev));
  }

  return (
    <li className="city-row compact">
      <button
        className="city-focus"
        type="button"
        onClick={() =>
          v.place.kind === "country"
            ? useUi.getState().openCountry(v.place.countryId)
            : v.place.kind === "airport"
              ? coord && flyTo(coord.lon, coord.lat)
              : useUi.getState().openCity(v.place.id)
        }
        aria-label={`Open ${v.place.name}`}
      >
        <CityLine
          flag={countryFlag(v.place.countryId)}
          name={v.place.name}
          sub={
            wishlist ? (
              <>· {sub}</>
            ) : (
              <>
                · {sub}
                {v.date ? ` · ${formatDate(v.date)}` : ""}
                {v.note ? ` · ${v.note}` : ""}
              </>
            )
          }
        />
      </button>
      <GuideButton place={v.place} />
      {!wishlist && (
        <PhotoGallery visitId={v.visitId} photos={v.photos ?? []} placeName={v.place.name} />
      )}
      {!wishlist && (
        <button
          className={"star-btn" + (v.favorite ? " star-on" : "")}
          type="button"
          aria-pressed={!!v.favorite}
          aria-label={v.favorite ? `Unfavorite ${v.place.name}` : `Favorite ${v.place.name}`}
          onClick={() => void toggleFavorite(v.place)}
        >
          {v.favorite ? "★" : "☆"}
        </button>
      )}
      {wishlist && (
        <button
          className="mini-btn"
          type="button"
          aria-label={`Mark ${v.place.name} visited`}
          onClick={() => void toggleVisit(v.place)}
        >
          ✓ Been there
        </button>
      )}
      <button
        className="link-danger"
        type="button"
        onClick={removeWithUndo}
        aria-label={`Remove ${v.place.name}`}
      >
        Remove
      </button>
    </li>
  );
}

/** Your visited places, your wish-to-go list, monuments, + a checklist of every country. */
export function PlacesScreen() {
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);

  const scope = useSettings((s) => s.countryScope);
  const [view, setView] = useState<View>("visited");
  const [filter, setFilter] = useState("");
  const [year, setYear] = useState<string | null>(null); // e.g. "2024"; null = all
  const [shown, setShown] = useState(100);
  const q = filter.trim().toLowerCase();

  // Another screen (the map's counter strip) asked for a specific view.
  const request = useUi((s) => s.placesViewRequest);
  useEffect(() => {
    if (!request) return;
    setView(request.view);
    setFilter("");
    // Consume the request — a plain Places-tab tap later should land on the
    // default view, not replay this one forever.
    useUi.setState({ placesViewRequest: null });
  }, [request?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const heritageAvailable = useMemo(() => ref.allHeritage().length > 0, [ref]);

  const visited = useMemo(
    () =>
      visits
        .filter((v) => v.status === "visited")
        .sort(
          (a, b) =>
            Number(b.favorite) - Number(a.favorite) || a.place.name.localeCompare(b.place.name),
        ),
    [visits],
  );
  const favorites = useMemo(() => visited.filter((v) => v.favorite), [visited]);
  const wishlist = useMemo(
    () =>
      visits
        .filter((v) => v.status === "wishlist")
        .sort((a, b) => a.place.name.localeCompare(b.place.name)),
    [visits],
  );

  // Visited places grouped for the Countries checklist: how many sub-places
  // (cities/airports/monuments) sit in each country, and which countries carry an
  // explicit country record. A country counts as visited if EITHER is true — so a
  // country is "visited" simply by visiting a city in it (no per-country record).
  const countryVisited = useMemo(() => {
    const sub = new Map<string, number>();
    const explicit = new Set<string>();
    for (const v of visits) {
      if (v.status === "wishlist") continue;
      if (v.place.kind === "country") explicit.add(v.place.countryId);
      // Airports don't make a country visited: changing planes there is not
      // being there (matches visitedCountryIds in Stats/Passport).
      else if (v.place.kind !== "airport" && v.place.countryId !== "ZZ")
        sub.set(v.place.countryId, (sub.get(v.place.countryId) ?? 0) + 1);
    }
    return { sub, explicit };
  }, [visits]);

  const filterVisits = (list: Visit[]) => {
    const byName = !q ? list : list.filter((v) => v.place.name.toLowerCase().includes(q));
    if (!year) return byName;
    if (year === "undated") return byName.filter((v) => !v.date);
    return byName.filter((v) => v.date?.startsWith(year));
  };

  // The years your visits span, newest first, for the date filter chips.
  const years = useMemo(() => {
    const ys = new Set<string>();
    let undated = false;
    for (const v of visits) {
      if (v.status === "wishlist") continue;
      if (v.date) ys.add(v.date.slice(0, 4));
      else undated = true;
    }
    return { list: [...ys].sort().reverse(), undated };
  }, [visits]);

  const countryRows = useMemo(() => {
    const all = ref.countries.filter((c) => inScope(c.sovereignty, scope));
    const list = !q ? [...all] : all.filter((c) => c.name.toLowerCase().includes(q));
    // Your countries first; the rest stay alphabetical below them.
    const seen = (c: (typeof list)[number]) =>
      (countryVisited.sub.get(c.iso2) ?? 0) > 0 || countryVisited.explicit.has(c.iso2) ? 0 : 1;
    return list.sort((a, b) => seen(a) - seen(b) || a.name.localeCompare(b.name));
  }, [ref, q, scope, countryVisited]);

  const [hideSeen, setHideSeen] = useState(false);
  const seenHeritage = useMemo(
    () =>
      new Set(
        visits
          .filter((v) => v.place.kind === "heritage" && v.status !== "wishlist")
          .map((v) => v.place.id),
      ),
    [visits],
  );
  const monuments = useMemo(() => {
    // A search keeps the ranker's best-match-first order; only the full
    // unfiltered list reads better alphabetically.
    const base = q
      ? ref.searchHeritage(q, 200)
      : [...ref.allHeritage()].sort((a, b) => a.name.localeCompare(b.name));
    return hideSeen ? base.filter((h) => !seenHeritage.has(h.id)) : base;
  }, [ref, q, hideSeen, seenHeritage]);

  const TABS: { id: View; label: string }[] = [
    { id: "visited", label: `Visited (${visited.length})` },
    // Favorites earns its spot once you've starred something (it never repaints
    // the Visited tab — that read as the section disappearing).
    ...(favorites.length > 0 || view === "favorites"
      ? [{ id: "favorites" as const, label: `★ Favorites (${favorites.length})` }]
      : []),
    { id: "wishlist", label: `Wishlist (${wishlist.length})` },
    { id: "monuments", label: "Monuments" },
    { id: "countries", label: "Countries" },
    { id: "moments", label: "Moments" },
    { id: "passport", label: "Passport" },
  ];

  return (
    <section aria-label="Your places">
      <div className="section-head">
        <h2>Places</h2>
        <div className="segmented wrap" role="group" aria-label="Places view">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={view === t.id}
              className={view === t.id ? "seg-on" : ""}
              onClick={() => {
                setView(t.id);
                setFilter("");
                setYear(null);
                setShown(100);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {(view === "visited" || view === "favorites" || view === "wishlist" || view === "monuments") &&
        (view !== "visited" || visited.length > 0) &&
        (view !== "favorites" || favorites.length > 0) &&
        (view !== "wishlist" || wishlist.length > 0) &&
        (view !== "monuments" || heritageAvailable) && (
          <input
            type="search"
            className="search-input places-filter"
            placeholder={view === "monuments" ? "Search monuments…" : "Filter your places…"}
            aria-label={view === "monuments" ? "Search monuments" : "Filter your places"}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}

      {view === "visited" && (
        <>
          {(years.list.length > 1 || (years.list.length === 1 && years.undated)) && (
            <div className="segmented wrap year-filter" role="group" aria-label="Filter by year">
              {[null, ...years.list, ...(years.undated ? ["undated"] : [])].map((y) => (
                <button
                  key={y ?? "all"}
                  type="button"
                  aria-pressed={year === y}
                  className={year === y ? "seg-on" : ""}
                  onClick={() => {
                    setYear(y);
                    setShown(100);
                  }}
                >
                  {y === null ? "All years" : y === "undated" ? "No date" : y}
                </button>
              ))}
            </div>
          )}
          {visited.length === 0 && (
            <p className="muted empty">
              <span className="empty-emoji" aria-hidden>
                🧳
              </span>
              Nothing yet. Add places from the map or the search bar — visiting a city also
              collects its country.
            </p>
          )}
          <ul className="city-list">
            {filterVisits(visited)
              .slice(0, shown)
              .map((v) => (
                <VisitRow key={v.visitId} v={v} />
              ))}
          </ul>
          {filterVisits(visited).length > shown && (
            <div className="list-pager">
              <span className="muted small">
                Showing {shown} of {filterVisits(visited).length}
              </span>
              <button className="mini-btn" type="button" onClick={() => setShown((n) => n + 100)}>
                Show 100 more
              </button>
            </div>
          )}
        </>
      )}

      {view === "favorites" && (
        <>
          {favorites.length === 0 && (
            <p className="muted empty">
              <span className="empty-emoji" aria-hidden>
                ★
              </span>
              No favorites yet. Star a visited place and it lands here.
            </p>
          )}
          <ul className="city-list">
            {filterVisits(favorites)
              .slice(0, shown)
              .map((v) => (
                <VisitRow key={v.visitId} v={v} />
              ))}
          </ul>
          {filterVisits(favorites).length > shown && (
            <div className="list-pager">
              <span className="muted small">
                Showing {shown} of {filterVisits(favorites).length}
              </span>
              <button className="mini-btn" type="button" onClick={() => setShown((n) => n + 100)}>
                Show 100 more
              </button>
            </div>
          )}
        </>
      )}

      {view === "wishlist" && (
        <>
          {wishlist.length === 0 && (
            <p className="muted empty">
              <span className="empty-emoji" aria-hidden>
                ⚑
              </span>
              No wishes yet. Find a place and tap the ⚑ to add it to your someday list.
            </p>
          )}
          <ul className="city-list">
            {filterVisits(wishlist)
              .slice(0, shown)
              .map((v) => (
                <VisitRow key={v.visitId} v={v} wishlist />
              ))}
          </ul>
          {filterVisits(wishlist).length > shown && (
            <div className="list-pager">
              <span className="muted small">
                Showing {shown} of {filterVisits(wishlist).length}
              </span>
              <button className="mini-btn" type="button" onClick={() => setShown((n) => n + 100)}>
                Show 100 more
              </button>
            </div>
          )}
        </>
      )}

      {view === "monuments" && (
        <>
          {!heritageAvailable ? (
            <p className="muted empty">
              <span className="empty-emoji" aria-hidden>
                🏛️
              </span>
              The monuments dataset isn't loaded in this build. Run{" "}
              <code>scripts/build-heritage-full.mjs</code> to add the full UNESCO World Heritage list.
            </p>
          ) : (
            <>
              <div className="countries-head">
                <p className="muted small" style={{ margin: 0 }}>
                  UNESCO World Heritage Sites; mark the ones you've seen. They count toward each
                  country's coverage in Stats.
                </p>
                <button
                  type="button"
                  className={"chip" + (hideSeen ? " chip-on" : "")}
                  aria-pressed={hideSeen}
                  onClick={() => setHideSeen((v) => !v)}
                >
                  Hide seen
                </button>
              </div>
              <ul className="city-list">
                {monuments.slice(0, shown).map((h) => {
                  const country = ref.countryByIso2(h.countryIso2)?.name ?? h.countryIso2;
                  const place = {
                    kind: "heritage" as const,
                    id: h.id,
                    name: h.name,
                    countryId: h.countryIso2,
                  };
                  return (
                    <li key={h.id} className="city-row compact">
                      <button
                        className="city-focus"
                        type="button"
                        onClick={() => useUi.getState().openCity(h.id)}
                        aria-label={`Open ${h.name}`}
                      >
                        <CityLine flag={countryFlag(h.countryIso2)} name={h.name} sub={<>· {country}</>} />
                      </button>
                      <GuideButton place={place} />
                      <StateToggles place={place} />
                    </li>
                  );
                })}
              </ul>
              {monuments.length > shown && (
                <div className="list-pager">
                  <span className="muted small">
                    Showing {shown} of {monuments.length}
                  </span>
                  <button
                    className="mini-btn"
                    type="button"
                    onClick={() => setShown((n) => n + 100)}
                  >
                    Show 100 more
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {view === "countries" && (
        <>
          <div className="countries-head">
            <ScopeToggle />
            <span className="muted small">{countryRows.length} shown</span>
          </div>
          <p className="muted small" style={{ margin: "0 0 6px" }}>
            A country lights up when you've visited a place inside it — there's nothing to check
            off here. ⚑ marks the ones you dream of.
          </p>
          <input
            type="search"
            className="search-input"
            placeholder="Filter countries…"
            aria-label="Filter countries"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <ul className="city-list" style={{ marginTop: 8 }}>
            {countryRows.map((c) => {
              const subCount = countryVisited.sub.get(c.iso2) ?? 0;
              const explicit = countryVisited.explicit.has(c.iso2);
              const isVisited = subCount > 0 || explicit;
              const place = { kind: "country" as const, id: c.iso2, name: c.name, countryId: c.iso2 };
              return (
                <li key={c.iso2} className="city-row compact dense">
                  <button
                    className="city-focus"
                    type="button"
                    title={`Open ${c.name}`}
                    onClick={() => useUi.getState().openCountry(c.iso2)}
                  >
                    <CityLine
                      flag={countryFlag(c.iso2)}
                      name={c.name}
                      sub={
                        isVisited && subCount > 0 ? (
                          <>
                            · via {subCount} place{subCount === 1 ? "" : "s"}
                          </>
                        ) : undefined
                      }
                    />
                  </button>
                  {isVisited && subCount > 0 && (
                    // Visited through its cities/monuments — already counted; the
                    // chip says so, and the toggles keep ⚑/★ reachable.
                    <span className="chip chip-on" aria-label={`${c.name} visited`}>
                      ✓ Visited
                    </span>
                  )}
                  <StateToggles place={place} />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {view === "moments" && <ExperiencesScreen embedded />}

      {view === "passport" && <PassportScreen embedded />}
    </section>
  );
}
