import { useMemo, useState } from "react";
import { countryFlag } from "../../lib/format/format";
import { LAND_OUTLINE } from "../../lib/publish/landOutline";
import { useT } from "../../lib/i18n";
import type { MyPlace } from "./myPlaces";

// Pick trip stops from the places you've BEEN — a tappable list, or a lightweight
// offline SVG map of your places (no MapLibre/tiles). One tap adds a stop. Built for
// speed: flags for instant recognition, no gazetteer typing (spec 019).

const W = 720;
const H = 380;
const PAD = 34;
const MIN_SPAN = 0.35;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));

export function MyPlacesPicker({
  places,
  addedKeys,
  onPick,
}: {
  places: MyPlace[];
  addedKeys: Set<string>;
  onPick: (p: MyPlace) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<"list" | "map">("list");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? places.filter((p) => p.name.toLowerCase().includes(s)) : places;
  }, [places, q]);

  if (places.length === 0) {
    return <p className="muted empty">{t("trip.compose.noPlaces")}</p>;
  }

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
            placeholder={t("trip.compose.filterPlaces")}
            aria-label={t("trip.compose.filterPlaces")}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="myplaces-list">
            {filtered.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  className="myplaces-pick"
                  aria-label={t("trip.compose.pickAria", { name: p.name })}
                  onClick={() => onPick(p)}
                >
                  <span className="flag" aria-hidden>
                    {p.place.kind === "airport" ? "✈️" : countryFlag(p.countryId)}
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
        </>
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
  onPick: (p: MyPlace) => void;
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
          <g key={p.key} className="storymap-pin" aria-hidden onClick={() => onPick(p)}>
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
              onClick={() => onPick(p)}
            >
              {p.place.kind === "airport" ? "✈️" : countryFlag(p.countryId)} {p.name}
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
