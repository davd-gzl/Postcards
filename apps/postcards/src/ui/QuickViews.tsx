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
        aria-label={t("quick.showFavorites")}
        title={t("quick.favorites")}
        onClick={() => openPlaces("favorites")}
      >
        <span aria-hidden>⭐ {t("quick.favorites")}</span>
      </button>
      <button
        type="button"
        className="quick-chip"
        aria-label={t("quick.showWishlist")}
        title={t("quick.wishlist")}
        onClick={() => openPlaces("wishlist")}
      >
        <span aria-hidden>♡ {t("quick.wishlist")}</span>
      </button>
      <button
        type="button"
        className="quick-chip"
        aria-label={t("quick.showMonuments")}
        title={t("quick.monuments")}
        onClick={() => openPlaces("monuments")}
      >
        <span aria-hidden>🏛 {t("quick.monuments")}</span>
      </button>
      {hasTrips && (
        <button
          type="button"
          className="quick-chip"
          aria-label={t("quick.showTrips")}
          title={t("quick.trips")}
          onClick={() => setTab("trips")}
        >
          <span aria-hidden>🧭 {t("quick.trips")}</span>
        </button>
      )}
    </div>
  );
}
