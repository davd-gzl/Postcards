import { useDeferredValue, useMemo, useState } from "react";
import { getReferenceData } from "../../lib/reference/referenceData";
import { searchPlaces } from "../visits/search";
import { countryFlag } from "../../lib/format/format";
import { LAND_OUTLINE } from "../../lib/publish/landOutline";
import { useT } from "../../lib/i18n";
import type { PlaceRef } from "../../lib/schema/models";
import type { MyPlace } from "./myPlaces";

// Pick trip stops fast. Two ways:
//  • List — the places you've BEEN (visited + past trips) as instant taps, AND a
//    search that reaches ANY airport or city in the gazetteer (airports are central
//    to reconstructing flights, and most people never log them as visits).
//  • Map — a lightweight offline SVG map of your places (no MapLibre/tiles); tap a pin.
// Flags everywhere for instant recognition (spec 019).

const W = 720;
const H = 380;
const PAD = 34;
const MIN_SPAN = 0.35;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));

const flagFor = (p: PlaceRef) => (p.kind === "airport" ? "✈️" : countryFlag(p.countryId));

export function MyPlacesPicker({
  places,
  addedKeys,
  onPick,
}: {
  places: MyPlace[];
  addedKeys: Set<string>;
  onPick: (place: PlaceRef) => void;
}) {
  const t = useT();
  const ref = useMemo(() => getReferenceData(), []);
  const [mode, setMode] = useState<"list" | "map">("list");
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);

  // With a query, search the whole gazetteer for airports + cities (any airport is
  // reachable); with no query, the instant list is the places you've been.
  const searchRows = useMemo(() => {
    const s = dq.trim();
    if (!s) return null;
    return searchPlaces(ref, s, 12)
      .filter((r) => r.place.kind === "airport" || r.place.kind === "city")
      .map((r) => ({ place: r.place, detail: r.detail }));
  }, [ref, dq]);

  return (
    <div className="myplaces-picker">
      <div className="segmented" role="group" aria-label={t("trip.compose.pickModeAria")}>
        <button
          type="button"
          aria-pressed={mode === "list"}
          className={mode === "list" ? "seg-on" : ""}
          onClick={() => setMode("list")}
        >
          ☰ {t("trip.compose.pickList")}
        </button>
        <button
          type="button"
          aria-pressed={mode === "map"}
          className={mode === "map" ? "seg-on" : ""}
          onClick={() => setMode("map")}
        >
          🗺 {t("trip.compose.pickMap")}
        </button>
      </div>

      {mode === "list" ? (
        <>
          <input
            type="search"
            className="search-input"
            value={q}
            placeholder={t("trip.compose.searchPlaceholder")}
            aria-label={t("trip.compose.searchPlaceholder")}
            onChange={(e) => setQ(e.target.value)}
          />
          {searchRows ? (
            searchRows.length === 0 ? (
              <p className="muted small">{t("trip.compose.noMatch")}</p>
            ) : (
              <ul className="myplaces-list">
                {searchRows.map((r) => (
                  <li key={`${r.place.kind}:${r.place.id}`}>
                    <button
                      type="button"
                      className="myplaces-pick"
                      aria-label={t("trip.compose.pickAria", { name: r.place.name })}
                      onClick={() => onPick(r.place)}
                    >
                      <span className="flag" aria-hidden>
                        {flagFor(r.place)}
                      </span>
                      <span className="myplaces-name">{r.place.name}</span>
                      <span className="muted small myplaces-detail">{r.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : places.length === 0 ? (
            <p className="muted small">{t("trip.compose.searchPrompt")}</p>
          ) : (
            <ul className="myplaces-list">
              {places.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    className="myplaces-pick"
                    aria-label={t("trip.compose.pickAria", { name: p.name })}
                    onClick={() => onPick(p.place)}
                  >
                    <span className="flag" aria-hidden>
                      {flagFor(p.place)}
                    </span>
                    <span className="myplaces-name">{p.name}</span>
                    {addedKeys.has(p.key) && (
                      <span className="myplaces-added" aria-hidden>
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : places.length === 0 ? (
        <p className="muted empty">{t("trip.compose.noPlaces")}</p>
      ) : (
        <PickMap places={places} addedKeys={addedKeys} onPick={onPick} />
      )}
    </div>
  );
}

/** The offline SVG map: your places as pins, tap to add. Pins are decorative for
 *  assistive tech; the legend list below is the keyboard/AT path (WCAG). */
function PickMap({
  places,
  addedKeys,
  onPick,
}: {
  places: MyPlace[];
  addedKeys: Set<string>;
  onPick: (place: PlaceRef) => void;
}) {
  const t = useT();
  const layout = useMemo(() => {
    const X = places.map((p) => (p.lon * Math.PI) / 180);
    const Y = places.map((p) => mercY(p.lat));
    let minX = Math.min(...X);
    let maxX = Math.max(...X);
    let minY = Math.min(...Y);
    let maxY = Math.max(...Y);
    if (maxX - minX < MIN_SPAN) {
      const c = (minX + maxX) / 2;
      minX = c - MIN_SPAN / 2;
      maxX = c + MIN_SPAN / 2;
    }
    if (maxY - minY < MIN_SPAN) {
      const c = (minY + maxY) / 2;
      minY = c - MIN_SPAN / 2;
      maxY = c + MIN_SPAN / 2;
    }
    let spanX = maxX - minX;
    let spanY = maxY - minY;
    minX -= spanX * 0.16;
    maxX += spanX * 0.16;
    minY -= spanY * 0.2;
    maxY += spanY * 0.2;
    spanX = maxX - minX;
    spanY = maxY - minY;
    const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const sx = (x: number) => W / 2 + (x - midX) * scale;
    const sy = (y: number) => H / 2 - (y - midY) * scale;
    let land = "";
    for (const ring of LAND_OUTLINE) {
      for (const off of [-360, 0, 360]) {
        let seg = "";
        let any = false;
        let unwrapped = 0;
        let prevRaw: number | null = null;
        for (let i = 0; i < ring.length; i++) {
          const llon = ring[i]![0];
          const llat = ring[i]![1];
          if (prevRaw === null) unwrapped = llon + off;
          else {
            let d = llon - prevRaw;
            if (d > 180) d -= 360;
            else if (d < -180) d += 360;
            unwrapped += d;
          }
          prevRaw = llon;
          const Lx = sx((unwrapped * Math.PI) / 180);
          const Ly = sy(mercY(llat));
          seg += (i === 0 ? "M" : "L") + Lx.toFixed(1) + " " + Ly.toFixed(1);
          if (Lx > -60 && Lx < W + 60 && Ly > -60 && Ly < H + 60) any = true;
        }
        if (any) land += seg + "Z";
      }
    }
    const dots = places.map((p) => ({ ...p, x: sx((p.lon * Math.PI) / 180), y: sy(mercY(p.lat)) }));
    return { land, dots };
  }, [places]);

  return (
    <div className="myplaces-map">
      <svg className="storymap-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("trip.compose.mapAria")}>
        {layout.land && <path className="storymap-land" d={layout.land} />}
        {layout.dots.map((p) => (
          <g key={p.key} className="storymap-pin" aria-hidden onClick={() => onPick(p.place)}>
            <circle cx={p.x} cy={p.y} r={addedKeys.has(p.key) ? 8 : 6} className="storymap-pin-dot" />
          </g>
        ))}
      </svg>
      <ul className="storymap-legend myplaces-legend">
        {layout.dots.map((p) => (
          <li key={p.key}>
            <button
              type="button"
              className="link"
              aria-label={t("trip.compose.pickAria", { name: p.name })}
              onClick={() => onPick(p.place)}
            >
              {flagFor(p.place)} {p.name}
              {addedKeys.has(p.key) && (
                <span className="myplaces-added" aria-hidden>
                  {" "}
                  ✓
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
