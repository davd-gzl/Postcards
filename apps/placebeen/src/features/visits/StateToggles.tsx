import { useVisits, findByPlace } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import type { PlaceRef } from "../../lib/schema/models";

/**
 * The three inline states from Places Been: Been (✓) · Want (⚑) · Favorite (★).
 * Always visible, one tap each — no menus.
 */
export function StateToggles({ place }: { place: PlaceRef }) {
  const visits = useVisits((s) => s.visits);
  const toggleVisit = useVisits((s) => s.toggleVisit);
  const toggleWish = useVisits((s) => s.toggleWish);
  const toggleFavorite = useVisits((s) => s.toggleFavorite);
  const addVisit = useVisits((s) => s.addVisit);
  const setAll = useVisits((s) => s.setAll);
  const show = useToast((s) => s.show);

  const rec = findByPlace(visits, place);
  const been = rec?.status === "visited";
  const want = rec?.status === "wishlist";
  const fav = !!rec?.favorite;

  function onBeen() {
    const prev = useVisits.getState().visits;
    const wasVisited = findByPlace(prev, place)?.status === "visited";
    void toggleVisit(place);
    show(wasVisited ? `Removed ${place.name}` : `Added ${place.name}`, () => setAll(prev));
  }
  function onWant() {
    void toggleWish(place);
  }
  async function onFav() {
    if (!findByPlace(useVisits.getState().visits, place)) {
      await addVisit({ place, status: "wishlist" });
    }
    await toggleFavorite(place);
  }

  return (
    <div className="states" role="group" aria-label={`${place.name} status`}>
      <button
        className={"state been" + (been ? " on" : "")}
        type="button"
        aria-pressed={been}
        aria-label={been ? `Remove ${place.name} from visited` : `Mark ${place.name} visited`}
        onClick={onBeen}
      >
        ✓
      </button>
      <button
        className={"state want" + (want ? " on" : "")}
        type="button"
        aria-pressed={want}
        aria-label={want ? `Remove ${place.name} from wishlist` : `Add ${place.name} to wishlist`}
        onClick={onWant}
      >
        ⚑
      </button>
      <button
        className={"state fav" + (fav ? " on" : "")}
        type="button"
        aria-pressed={fav}
        aria-label={fav ? `Unfavorite ${place.name}` : `Favorite ${place.name}`}
        onClick={onFav}
      >
        ★
      </button>
    </div>
  );
}
