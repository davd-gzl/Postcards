import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { useVisits } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { useUi } from "../../lib/store/useUi";
import { registerEscape } from "../../lib/store/escapeStack";
import { useSettings } from "../../lib/store/useSettings";
import { countryFlag } from "../../lib/format/format";
import { heritageGlyph } from "../../lib/reference/heritageGlyph";
import type { Visit } from "../../lib/schema/models";
import type { ReferenceData } from "../../lib/reference/types";
import { inScope } from "../../lib/reference/scope";
import { CityLine } from "../../ui/CityLine";
import { ScopeToggle } from "../../ui/ScopeToggle";
import { PhotoGallery } from "./PhotoGallery";
import { StateToggles } from "./StateToggles";
import { PassportScreen } from "../passport/PassportScreen";
import { ExperiencesScreen } from "../experiences/ExperiencesScreen";
import { PhotoWall } from "./PhotoWall";
import { ListPager } from "../../ui/ListPager";
import { useFilters, currentFilters, type FilterStatus } from "../../lib/store/useFilters";
import { placeMatches, sortPlaces, activeChips } from "../filter/applyFilters";
import { FilterPanel } from "../../ui/FilterPanel";
import { FilterSummary } from "../../ui/FilterSummary";
import { useT, type TFunction } from "../../lib/i18n";

// Everything place-shaped lives here, one view each — including Favorites (its
// own view, not a mode that repaints "Visited"), Moments and the Passport.
type View = "visited" | "favorites" | "wishlist" | "countries" | "monuments" | "moments" | "passport" | "photos";
const VIEWS: readonly View[] = ["visited", "favorites", "wishlist", "countries", "monuments", "moments", "passport"];
// The screen unmounts on every tab switch — remember the last view so coming
// back lands where you were, not on "Visited".
const VIEW_KEY = "postcards-places-view";
function loadView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return (VIEWS as readonly string[]).includes(v ?? "") ? (v as View) : "visited";
  } catch {
    return "visited";
  }
}
function saveView(v: View): void {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* private mode: not persisted */
  }
}


/** Map coordinate to fly to (if known) and the secondary "· type · place" label for a visit. */
function placeMeta(
  ref: ReferenceData,
  v: Visit,
  t: TFunction,
): { coord: { lon: number; lat: number } | null; sub: string } {
  const country = ref.countryByIso2(v.place.countryId)?.name ?? v.place.countryId;
  if (v.place.kind === "city") {
    const c = ref.cityById(v.place.id);
    return { coord: c ? { lon: c.lon, lat: c.lat } : null, sub: country };
  }
  if (v.place.kind === "airport") {
    const a = ref.airportById(v.place.id);
    return { coord: a ? { lon: a.lon, lat: a.lat } : null, sub: `${t("places.meta.airport")} · ${country}` };
  }
  if (v.place.kind === "heritage") {
    const h = ref.heritageById(v.place.id);
    const coord = h && (h.lat !== 0 || h.lon !== 0) ? { lon: h.lon, lat: h.lat } : null;
    return { coord, sub: `${t("places.meta.monument")} · ${country}` };
  }
  return {
    coord: null,
    sub: v.place.kind === "custom" ? t("places.meta.yourPlace") : t("places.meta.country"),
  };
}

/** The per-row "more" popover: edit the visit's date, folder and note in one
 *  place, so the row itself stays a clean single column (flag + name). Opens
 *  inline below the row; the folder box suggests folders already in use. */
function RowMenu({
  v,
  onClose,
  triggerRef,
  hideDate = false,
}: {
  v: Visit;
  onClose: () => void;
  /** This row's own ⋯ button — excluded from the outside-click close so its own
   *  onClick (which toggles the menu) isn't fought by the close handler. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  /** Hide the date field (want-list rows: a want-to-go place has no visit date,
   *  and a target date would drift toward trip-planning). */
  hideDate?: boolean;
}) {
  const t = useT();
  const setDetails = useVisits((s) => s.setDetails);
  const removeVisit = useVisits((s) => s.removeVisit);
  const restoreVisit = useVisits((s) => s.restoreVisit);
  const showToast = useToast((s) => s.show);
  const menuRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(v.date ?? "");
  const [folder, setFolder] = useState(v.folder ?? "");
  const [note, setNote] = useState(v.note ?? "");
  // Close on Escape and on a click/tap outside the menu (its own ⋯ trigger is
  // excluded — its onClick toggles it). Opening another row's ⋯ counts as an
  // outside click here, so this menu closes: only one row menu stays open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef?.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [onClose, triggerRef]);
  // Folders already in use, for the datalist — a snapshot when the menu opens.
  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const x of useVisits.getState().visits) if (x.folder) set.add(x.folder);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, []);
  const listId = `visit-folders-${v.visitId}`;
  function save() {
    void setDetails(v.visitId, {
      date: date || null,
      folder: folder.trim() || null,
      note: note.trim() || null,
    });
    onClose();
  }
  return (
    <div
      className="row-menu"
      ref={menuRef}
      role="group"
      aria-label={t("places.rowMenu.aria", { name: v.place.name })}
    >
      {!hideDate && (
        <label className="picker-label">
          <span>{t("places.rowMenu.date")}</span>
          <input
            type="date"
            className="select"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      )}
      <label className="picker-label">
        <span>{t("places.rowMenu.folder")}</span>
        <input
          className="select"
          list={listId}
          value={folder}
          maxLength={80}
          onChange={(e) => setFolder(e.target.value)}
        />
        <datalist id={listId}>
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </label>
      <label className="picker-label row-menu-note">
        <span>{t("places.rowMenu.note")}</span>
        <textarea
          className="select"
          rows={3}
          value={note}
          maxLength={2000}
          placeholder={t("places.rowMenu.notePlaceholder")}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="row-menu-actions">
        <button className="btn" type="button" onClick={save}>
          {t("common.save")}
        </button>
        <button className="btn-ghost" type="button" onClick={onClose}>
          {t("common.cancel")}
        </button>
        {/* Remove lives here now (not inline) so the row itself stays uncluttered
            and the place name keeps its width. Undoable via the toast. */}
        <button
          className="link-danger row-menu-remove"
          type="button"
          aria-label={t("places.row.removeAria", { name: v.place.name })}
          onClick={() => {
            void removeVisit(v.visitId);
            showToast(t("places.row.removedToast", { name: v.place.name }), () =>
              restoreVisit(v),
            );
            onClose();
          }}
        >
          {t("common.remove")}
        </button>
      </div>
    </div>
  );
}

/** One visited or wishlist row — visited adds details, photos and the favorite star.
 *  Memoized: store updates replace only the changed visit object, so after a
 *  toggle the other (up to 100) rows — photo thumbnails included — skip re-render. */
const VisitRow = memo(function VisitRow({ v, wishlist }: { v: Visit; wishlist?: boolean }) {
  const t = useT();
  const ref = useMemo(() => getReferenceData(), []);
  const toggleVisit = useVisits((s) => s.toggleVisit);
  const toggleFavorite = useVisits((s) => s.toggleFavorite);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const { sub } = placeMeta(ref, v, t);
  // A visited monument/airport must NOT read as a city: show its own glyph, not
  // the country flag (cities keep the flag).
  const rowGlyph =
    v.place.kind === "heritage"
      ? heritageGlyph(ref.heritageById(v.place.id)?.category)
      : v.place.kind === "airport"
        ? "✈️"
        : countryFlag(v.place.countryId);

  return (
    <li className={"city-row compact" + (menuOpen ? " menu-open" : "")}>
      <button
        className="city-focus"
        type="button"
        onClick={() =>
          v.place.kind === "country"
            ? useUi.getState().openCountry(v.place.countryId)
            : useUi.getState().openCity(v.place.id)
        }
        aria-label={t("places.row.openAria", { name: v.place.name })}
      >
        <CityLine
          flag={rowGlyph}
          name={v.place.name}
          sub={
            // One clean column: just the region, plus a folder chip when set. The
            // date and note now live in the row's "⋯" menu, not inline.
            <>
              · {sub}
              {v.folder ? <span className="folder-chip">📁 {v.folder}</span> : null}
            </>
          }
        />
      </button>
      {!wishlist && (
        <PhotoGallery visitId={v.visitId} photos={v.photos ?? []} placeName={v.place.name} />
      )}
      {!wishlist && (
        <button
          className={"star-btn" + (v.favorite ? " star-on" : "")}
          type="button"
          aria-pressed={!!v.favorite}
          aria-label={
            v.favorite
              ? t("places.row.unfavoriteAria", { name: v.place.name })
              : t("places.row.favoriteAria", { name: v.place.name })
          }
          onClick={() => void toggleFavorite(v.place)}
        >
          {v.favorite ? "♥" : "♡"}
        </button>
      )}
      {wishlist && (
        <button
          className="mini-btn"
          type="button"
          aria-label={t("places.row.markVisitedAria", { name: v.place.name })}
          onClick={() => void toggleVisit(v.place)}
        >
          ✓ {t("places.row.beenThere")}
        </button>
      )}
      {/* Both visited AND want-list rows get the ⋯ menu (date/folder/note + Remove),
          so a want-to-go place can carry a note ("go in cherry-blossom season") and
          a folder, and both row families share the same trailing controls. */}
      <button
        ref={moreBtnRef}
        className="mini-btn row-more"
        type="button"
        aria-expanded={menuOpen}
        aria-label={t("places.row.moreAria", { name: v.place.name })}
        onClick={() => setMenuOpen((o) => !o)}
      >
        ⋯
      </button>
      {menuOpen && (
        <RowMenu
          v={v}
          triggerRef={moreBtnRef}
          hideDate={wishlist}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </li>
  );
});

/** The "nothing matches" line — with a one-tap Clear when a name search caused it,
 *  so a search for a place you haven't logged isn't a dead end (the native ✕ on a
 *  type=search box is unreliable on Android/Capacitor). */
function NoMatch({ q, onClear }: { q: string; onClear: () => void }) {
  const t = useT();
  return (
    <p className="muted empty">
      {t("places.noMatch")}{" "}
      {q && (
        <button className="link" type="button" onClick={onClear}>
          {t("search.clear")}
        </button>
      )}
    </p>
  );
}

/** Your visited places, your wish-to-go list, monuments, + a checklist of every country. */
export function PlacesScreen() {
  const t = useT();
  const ref = useMemo(() => getReferenceData(), []);
  const visits = useVisits((s) => s.visits);

  const scope = useSettings((s) => s.countryScope);
  const filters = useFilters();
  const [view, setView] = useState<View>(loadView);
  const [filter, setFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [shown, setShown] = useState(100);
  const [groupBy, setGroupBy] = useState<"none" | "country" | "year">("none");
  const q = filter.trim().toLowerCase();

  // Another screen (the map's counter strip) asked for a specific view.
  const request = useUi((s) => s.placesViewRequest);
  useEffect(() => {
    if (!request) return;
    setView(request.view);
    saveView(request.view);
    setFilter("");
    // Consume the request — a plain Places-tab tap later should land on the
    // last-used view, not replay this one forever.
    useUi.setState({ placesViewRequest: null });
  }, [request?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape/Back steps out of a collection (Moments/Photos/Passport are little
  // screens of their own) back to the Visited list, before leaving the tab.
  useEffect(() => {
    return registerEscape(() => {
      if (view === "moments" || view === "photos" || view === "passport") {
        setView("visited");
        saveView("visited");
        setFilter("");
        setShown(100);
        return true;
      }
      return false;
    });
  }, [view]);

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

  // Places owns status via its tabs; every OTHER dimension (date / folder /
  // population / sort / growth) comes from the ONE shared filter store, so the
  // map and Places never disagree (spec 016 US3). The name box is separate.
  const listState = useMemo(
    () => ({ ...currentFilters(filters), status: [] as FilterStatus[] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filters.date,
      filters.folder,
      filters.minPop,
      filters.sort,
      filters.favoritesOnly,
      filters.hasPhoto,
      filters.hasNote,
      filters.continent,
    ],
  );
  const filterVisits = useCallback(
    (list: Visit[]) => {
      const byName = !q ? list : list.filter((v) => v.place.name.toLowerCase().includes(q));
      const narrowed = byName.filter((v) => placeMatches(v, ref, listState));
      const sorted = sortPlaces(narrowed, ref, listState);
      // Keep favourites floated to the top (Places' standing promise) — a stable
      // pass, so the chosen sort still orders within the favourites and the rest.
      return [...sorted].sort((a, b) => Number(b.favorite) - Number(a.favorite));
    },
    [q, ref, listState],
  );
  // Each list view reads its filtered rows three times per render (the slice
  // and two length checks) — filter once, and only when the inputs change.
  const visitedShown = useMemo(() => filterVisits(visited), [filterVisits, visited]);
  const favoritesShown = useMemo(() => filterVisits(favorites), [filterVisits, favorites]);
  const wishlistShown = useMemo(() => filterVisits(wishlist), [filterVisits, wishlist]);

  // "Many ways to see the data": the visited list can also be GROUPED — into
  // expandable country sections (passport-style) or under the year you went. The
  // same filter/sort feeds it, so the groups always agree with the flat list.
  const visitedGroups = useMemo(() => {
    if (groupBy === "none") return null;
    const m = new Map<string, { key: string; label: string; flag: string; visits: Visit[] }>();
    for (const v of visitedShown) {
      const key =
        groupBy === "country" ? v.place.countryId || "ZZ" : v.date?.slice(0, 4) || "—";
      const g = m.get(key);
      if (g) g.visits.push(v);
      else {
        const label =
          groupBy === "country"
            ? (ref.countryByIso2(key)?.name ?? key)
            : key === "—"
              ? t("filter.date.undated")
              : key;
        m.set(key, { key, label, flag: groupBy === "country" ? countryFlag(key) : "", visits: [v] });
      }
    }
    const arr = [...m.values()];
    if (groupBy === "country")
      arr.sort((a, b) => b.visits.length - a.visits.length || a.label.localeCompare(b.label));
    else arr.sort((a, b) => (a.key === "—" ? 1 : b.key === "—" ? -1 : b.key.localeCompare(a.key)));
    return arr;
  }, [groupBy, visitedShown, ref, t]);

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

  // Folders in use, for the shared panel's folder picker.
  const folderOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of visits) if (v.folder) set.add(v.folder);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [visits]);

  // Continents your places sit in, for the growth "continent" picker.
  const continentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of visits) {
      const c = ref.continentOf(v.place.countryId);
      if (c) set.add(c);
    }
    return [...set].sort();
  }, [visits, ref]);

  // The active dimensions Places actually acts on (status + map mode are excluded —
  // status is the tab, mode is map-only). Drives the Filter button's badge.
  const placesFilterChips = useMemo(
    () => activeChips(currentFilters(filters), t).filter((c) => c.field !== "status" && c.field !== "mode"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filters.date,
      filters.folder,
      filters.minPop,
      filters.sort,
      filters.favoritesOnly,
      filters.hasPhoto,
      filters.hasNote,
      filters.continent,
      t,
    ],
  );
  const placesFilterActive = placesFilterChips.length > 0;
  const isListView = view === "visited" || view === "favorites" || view === "wishlist";

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
    { id: "visited", label: t("places.tab.visited", { count: visited.length }) },
    // Favorites earns its spot once you've starred something (it never repaints
    // the Visited tab — that read as the section disappearing).
    ...(favorites.length > 0 || view === "favorites"
      ? [{ id: "favorites" as const, label: t("places.tab.favorites", { count: favorites.length }) }]
      : []),
    { id: "wishlist", label: t("places.tab.wishlist", { count: wishlist.length }) },
    { id: "monuments", label: t("places.tab.monuments") },
    { id: "countries", label: t("places.tab.countries") },
  ];
  // Moments and the Passport aren't list views of your places — they're little
  // screens of their own. They get a separate cluster so they don't blend into
  // the view switcher above.
  const COLLECTIONS: { id: View; label: string; emoji: string }[] = [
    { id: "moments", label: t("places.collection.moments"), emoji: "✨" },
    { id: "photos", label: t("places.collection.photos"), emoji: "📷" },
    { id: "passport", label: t("places.collection.passport"), emoji: "🛂" },
  ];

  function switchView(id: View) {
    setView(id);
    saveView(id);
    setFilter("");
    setShown(100);
  }

  const clearSearch = () => {
    setFilter("");
    setShown(100);
  };

  return (
    <section aria-label={t("places.aria")}>
      <div className="section-head">
        <h2>{t("places.title")}</h2>
        <div className="segmented wrap" role="group" aria-label={t("places.viewAria")}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={view === t.id}
              className={view === t.id ? "seg-on" : ""}
              onClick={() => switchView(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          className="segmented wrap places-collections"
          role="group"
          aria-label={t("places.collectionsAria")}
        >
          {COLLECTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={view === c.id}
              className={view === c.id ? "seg-on" : ""}
              onClick={() => switchView(c.id)}
            >
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      {(view === "visited" || view === "favorites" || view === "wishlist" || view === "monuments") &&
        (view !== "visited" || visited.length > 0) &&
        (view !== "favorites" || favorites.length > 0) &&
        (view !== "wishlist" || wishlist.length > 0) &&
        (view !== "monuments" || heritageAvailable) && (
          <div className="search">
            <input
              type="search"
              className="search-input places-filter has-clear"
              placeholder={
                view === "monuments"
                  ? t("places.filter.monumentsPlaceholder")
                  : t("places.filter.placesPlaceholder")
              }
              aria-label={
                view === "monuments"
                  ? t("places.filter.monumentsAria")
                  : t("places.filter.placesAria")
              }
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {filter && (
              <button
                type="button"
                className="search-clear"
                aria-label={t("search.clear")}
                title={t("search.clear")}
                onClick={clearSearch}
              >
                ✕
              </button>
            )}
          </div>
        )}

      {/* The ONE Filter (spec 016 US3): the same panel the map uses, minus status
          (the tabs above own it) and mode (map-only). Date / folder / population /
          sort / growth are shared, so both screens agree. */}
      {isListView && (
        <div className="places-filter-row">
          <button
            type="button"
            className={"chip filter-open-chip" + (placesFilterActive ? " chip-on" : "")}
            aria-haspopup="dialog"
            aria-expanded={filterOpen}
            aria-label={
              placesFilterActive
                ? `${t("filter.open")} · ${t("filter.activeAria", { count: placesFilterChips.length })}`
                : t("filter.open")
            }
            onClick={() => setFilterOpen(true)}
          >
            ⚙ {t("filter.open")}
            {placesFilterActive ? ` · ${placesFilterChips.length}` : ""}
          </button>
          {/* Group-by lives on the SAME line as Filter (visited list only) so the
              two controls read as one toolbar, not two stacked rows. */}
          {view === "visited" && visitedShown.length > 0 && (
            <div className="places-groupby btn-row" role="group" aria-label={t("places.groupBy")}>
              {(["none", "country", "year"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  className={"mini-btn" + (groupBy === g ? " mini-on" : "")}
                  aria-pressed={groupBy === g}
                  onClick={() => setGroupBy(g)}
                >
                  {t(`places.groupBy.${g}` as const)}
                </button>
              ))}
            </div>
          )}
          <FilterSummary exclude={["status", "mode"]} />
        </div>
      )}

      {view === "visited" && (
        <>
          {visited.length === 0 && (
            <p className="muted empty">
              <span className="empty-emoji" aria-hidden>
                🧳
              </span>
              {t("places.visited.empty")}
            </p>
          )}
          {visited.length > 0 && visitedShown.length === 0 && (
            <NoMatch q={q} onClear={clearSearch} />
          )}
          {visitedGroups ? (
            <div className="places-groups">
              {visitedGroups.map((grp) => (
                <details
                  key={grp.key}
                  className="journal-place-group"
                  open={visitedGroups.length <= 6}
                >
                  <summary className="journal-place-summary">
                    <span className="journal-place-name">
                      {grp.flag ? `${grp.flag} ` : ""}
                      {grp.label}
                    </span>
                    <span className="muted small journal-place-meta">
                      {grp.visits.length} {t.plural("noun.place", grp.visits.length)}
                    </span>
                  </summary>
                  <ul className="city-list">
                    {grp.visits.map((v) => (
                      <VisitRow key={v.visitId} v={v} />
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          ) : (
            <>
              <ul className="city-list">
                {visitedShown.slice(0, shown).map((v) => (
                  <VisitRow key={v.visitId} v={v} />
                ))}
              </ul>
              {visitedShown.length > shown && (
                <ListPager
                  shown={shown}
                  total={visitedShown.length}
                  step={100}
                  onMore={() => setShown((n) => n + 100)}
                />
              )}
            </>
          )}
        </>
      )}

      {view === "favorites" && (
        <>
          {favorites.length === 0 && (
            <p className="muted empty">
              <span className="empty-emoji" aria-hidden>
                ♥
              </span>
              {t("places.favorites.empty")}
            </p>
          )}
          {favorites.length > 0 && favoritesShown.length === 0 && (
            <NoMatch q={q} onClear={clearSearch} />
          )}
          <ul className="city-list">
            {favoritesShown.slice(0, shown).map((v) => (
              <VisitRow key={v.visitId} v={v} />
            ))}
          </ul>
          {favoritesShown.length > shown && (
            <ListPager
              shown={shown}
              total={favoritesShown.length}
              step={100}
              onMore={() => setShown((n) => n + 100)}
            />
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
              {t("places.wishlist.empty")}
            </p>
          )}
          {wishlist.length > 0 && wishlistShown.length === 0 && (
            <NoMatch q={q} onClear={clearSearch} />
          )}
          <ul className="city-list">
            {wishlistShown.slice(0, shown).map((v) => (
              <VisitRow key={v.visitId} v={v} wishlist />
            ))}
          </ul>
          {wishlistShown.length > shown && (
            <ListPager
              shown={shown}
              total={wishlistShown.length}
              step={100}
              onMore={() => setShown((n) => n + 100)}
            />
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
              {t("places.monuments.emptyBuildPre")}
              <code>scripts/build-heritage-full.mjs</code>
              {t("places.monuments.emptyBuildPost")}
            </p>
          ) : (
            <>
              <div className="countries-head">
                <p className="muted small" style={{ margin: 0 }}>
                  {t("places.monuments.desc")}
                </p>
                <button
                  type="button"
                  className={"chip" + (hideSeen ? " chip-on" : "")}
                  aria-pressed={hideSeen}
                  onClick={() => setHideSeen((v) => !v)}
                >
                  {t("places.monuments.hideSeen")}
                </button>
              </div>
              {monuments.length === 0 && (
                <NoMatch q={q} onClear={clearSearch} />
              )}
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
                        aria-label={t("places.row.openAria", { name: h.name })}
                      >
                        <CityLine flag={countryFlag(h.countryIso2)} name={h.name} sub={<>· {country}</>} />
                      </button>
                      <StateToggles place={place} />
                    </li>
                  );
                })}
              </ul>
              {monuments.length > shown && (
                <ListPager
                  shown={shown}
                  total={monuments.length}
                  step={100}
                  onMore={() => setShown((n) => n + 100)}
                />
              )}
            </>
          )}
        </>
      )}

      {view === "countries" && (
        <>
          <div className="countries-head">
            <ScopeToggle />
            <span className="muted small">{t("places.countries.count", { count: countryRows.length })}</span>
          </div>
          <p className="muted small" style={{ margin: "0 0 6px" }}>
            {t("places.countries.desc")}
          </p>
          <div className="search">
            <input
              type="search"
              className="search-input has-clear"
              placeholder={t("places.countries.filterPlaceholder")}
              aria-label={t("places.countries.filterAria")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {filter && (
              <button
                type="button"
                className="search-clear"
                aria-label={t("search.clear")}
                title={t("search.clear")}
                onClick={clearSearch}
              >
                ✕
              </button>
            )}
          </div>
          {countryRows.length === 0 && (
            <NoMatch q={q} onClear={clearSearch} />
          )}
          <ul className="city-list" style={{ marginTop: 8 }}>
            {/* Paged like every other long list here — 250 country rows (each
                with its toggles) re-reconciled per keystroke janked filtering.
                Visited countries sort first, so they always sit on page one. */}
            {countryRows.slice(0, shown).map((c) => {
              const subCount = countryVisited.sub.get(c.iso2) ?? 0;
              const explicit = countryVisited.explicit.has(c.iso2);
              const isVisited = subCount > 0 || explicit;
              const place = { kind: "country" as const, id: c.iso2, name: c.name, countryId: c.iso2 };
              return (
                <li key={c.iso2} className="city-row compact dense">
                  <button
                    className="city-focus"
                    type="button"
                    title={t("places.row.openAria", { name: c.name })}
                    onClick={() => useUi.getState().openCountry(c.iso2)}
                  >
                    <CityLine
                      flag={countryFlag(c.iso2)}
                      name={c.name}
                      sub={
                        isVisited && subCount > 0 ? (
                          <>· {t.plural("places.country.via", subCount)}</>
                        ) : undefined
                      }
                    />
                  </button>
                  {isVisited && subCount > 0 && (
                    // Visited through its cities/monuments — already counted; the
                    // chip says so, and ⚑ Want-to-go is suppressed (you've been).
                    <span className="chip chip-on" aria-label={t("places.country.visitedAria", { name: c.name })}>
                      ✓ {t("places.country.visitedChip")}
                    </span>
                  )}
                  <StateToggles place={place} derivedVisited={isVisited && subCount > 0} />
                </li>
              );
            })}
          </ul>
          {countryRows.length > shown && (
            <ListPager
              shown={shown}
              total={countryRows.length}
              step={100}
              onMore={() => setShown((n) => n + 100)}
            />
          )}
        </>
      )}

      {view === "moments" && <ExperiencesScreen embedded />}

      {view === "photos" && <PhotoWall />}

      {view === "passport" && <PassportScreen embedded />}

      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        folders={folderOptions}
        years={years}
        showStatus={false}
        showGrowth
        continents={continentOptions}
      />
    </section>
  );
}
