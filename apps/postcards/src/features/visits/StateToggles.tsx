import { useVisits, findByPlace, visitIndex } from "../../lib/store/useVisits";
import { useToast } from "../../lib/store/useToast";
import { placeKey } from "../../lib/schema/helpers";
import type { PlaceRef } from "../../lib/schema/models";

/**
 * Inline states: Been (✓) always; Want (⚑) only until you've been (a wishlist
 * for a place you've visited is meaningless); Favorite (♥) only once you've
 * been (or while it's already set, so it can be unset). Rows show at most two
 * buttons — one tap each, no menus.
 */
export function StateToggles({ place }: { place: PlaceRef }) {
  // Subscribe to this place's record only — record identities are stable across
  // unrelated updates, so untouched rows don't re-render on every store change.
  // O(1) via the shared index: with hundreds of rows mounted, per-row linear
  // scans on every store change added up to real jank on a phone.
  const key = placeKey(place);
  const rec = useVisits((s) => visitIndex(s.visits).get(key));
  const toggleVisit = useVisits((s) => s.toggleVisit);
  const toggleWish = useVisits((s) => s.toggleWish);
  const toggleFavorite = useVisits((s) => s.toggleFavorite);
  const addVisit = useVisits((s) => s.addVisit);
  const restoreVisit = useVisits((s) => s.restoreVisit);
  const show = useToast((s) => s.show);

  const been = rec?.status === "visited";
  const want = rec?.status === "wishlist";
  const fav = !!rec?.favorite;

  function onBeen() {
    // Only this place's record changes — snapshot it alone, so undo puts one
    // record back instead of rewriting the whole visits table.
    const prev = findByPlace(useVisits.getState().visits, place);
    void toggleVisit(place);
    // Silent on add; a removal (which can delete photos/notes) gets an undoable toast.
    if (prev?.status === "visited") show(`Removed ${place.name}`, () => restoreVisit(prev));
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

  // A country is never "visited" by itself — you visit a country by visiting a
  // place inside it (coverage is derived; see the constitution). Countries keep
  // ⚑ Want-to-go, and ✓ only to UNDO a legacy direct record.
  const countryCheck = place.kind === "country";

  return (
    <div className="states" role="group" aria-label={`${place.name} status`}>
      {(!countryCheck || been) && (
        <button
          className={"state been" + (been ? " on" : "")}
          type="button"
          aria-pressed={been}
          aria-label={been ? `Remove ${place.name} from visited` : `Mark ${place.name} visited`}
          onClick={onBeen}
        >
          ✓
        </button>
      )}
      {!been && (
        <button
          className={"state want" + (want ? " on" : "")}
          type="button"
          aria-pressed={want}
          aria-label={want ? `Remove ${place.name} from wishlist` : `Add ${place.name} to wishlist`}
          title={want ? "On your wishlist" : "Want to go"}
          onClick={onWant}
        >
          ⚑
        </button>
      )}
      {(been || fav) && (
        <button
          className={"state fav" + (fav ? " on" : "")}
          type="button"
          aria-pressed={fav}
          aria-label={fav ? `Unfavorite ${place.name}` : `Favorite ${place.name}`}
          title={fav ? "Favorite" : "Mark as a favorite"}
          onClick={onFav}
        >
          ♥
        </button>
      )}
    </div>
  );
}
