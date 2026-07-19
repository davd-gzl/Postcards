import { useMemo } from "react";
import { useVisits } from "../../lib/store/useVisits";
import { useUi } from "../../lib/store/useUi";
import { useT } from "../../lib/i18n";

/**
 * A grid of every postcard photo across your places — your travels as one wall of
 * images. Tap a tile to open its place. Photos live only in-app (stored locally,
 * downscaled on capture); this view never fetches anything.
 */
export function PhotoWall() {
  const t = useT();
  const visits = useVisits((s) => s.visits);

  const tiles = useMemo(() => {
    const out: { key: string; src: string; alt: string; id: string }[] = [];
    for (const v of visits) {
      // Countries have no place page of photos; everything else does.
      if (v.place.kind === "country" || !v.photos) continue;
      v.photos.forEach((p, i) => {
        out.push({ key: `${v.visitId}:${i}`, src: p.src, alt: p.caption || v.place.name, id: v.place.id });
      });
    }
    return out;
  }, [visits]);

  if (tiles.length === 0) {
    return (
      <p className="muted empty">
        <span className="empty-emoji" aria-hidden>
          📷
        </span>
        {t("places.photos.empty")}
      </p>
    );
  }

  return (
    <div className="photo-wall">
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          className="photo-wall-tile"
          title={tile.alt}
          aria-label={t("places.photos.openAria", { name: tile.alt })}
          onClick={() => useUi.getState().openCity(tile.id)}
        >
          <img src={tile.src} alt={tile.alt} loading="lazy" />
        </button>
      ))}
    </div>
  );
}
