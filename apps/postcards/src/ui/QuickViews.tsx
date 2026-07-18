import { useUi } from "../lib/store/useUi";
import { useTrips } from "../lib/store/useTrips";
import { useT } from "../lib/i18n";

/**
 * One-tap "show a friend" launcher: jump straight to the views you reach for when
 * showing someone your travels — Favorites, your wishlist, monuments, and your
 * trips. A single horizontal row so it's one tap from the home surfaces, no
 * digging through menus (the emotional core of the app: "that's where I've been").
 */
export function QuickViews() {
  const t = useT();
  const openPlaces = useUi((s) => s.openPlaces);
  const setTab = useUi((s) => s.setTab);
  const hasTrips = useTrips((s) => s.trips.length > 0);

  return (
    <div className="quick-views" role="group" aria-label={t("quick.aria")}>
      <button
        type="button"
        className="quick-chip"
        title={t("quick.favorites")}
        onClick={() => openPlaces("favorites")}
      >
        <span aria-hidden>⭐</span> {t("quick.favorites")}
      </button>
      <button
        type="button"
        className="quick-chip"
        title={t("quick.wishlist")}
        onClick={() => openPlaces("wishlist")}
      >
        <span aria-hidden>♡</span> {t("quick.wishlist")}
      </button>
      <button
        type="button"
        className="quick-chip"
        title={t("quick.monuments")}
        onClick={() => openPlaces("monuments")}
      >
        <span aria-hidden>🏛</span> {t("quick.monuments")}
      </button>
      {hasTrips && (
        <button
          type="button"
          className="quick-chip"
          title={t("quick.trips")}
          onClick={() => setTab("trips")}
        >
          <span aria-hidden>🧭</span> {t("quick.trips")}
        </button>
      )}
    </div>
  );
}
