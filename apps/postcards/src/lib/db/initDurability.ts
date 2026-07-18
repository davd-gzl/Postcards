import { useVisits } from "../store/useVisits";
import { useStories } from "../store/useStories";
import { useTrips } from "../store/useTrips";
import { usePersistence } from "../store/usePersistence";
import { requestPersistence, getPersistenceState } from "./persistence";

// Long-term memory: request PERSISTENT storage the first time there is real data,
// so the browser won't silently evict it (the "browser reset ate everything"
// failure). Requested on first data — not cold load — and only once. Backup
// timing/nudges live in lib/backupReminder.ts; this only handles persistence.
// Set up ONCE, early (from main.tsx), before the stores hydrate.

let started = false;
let requested = false;

async function ensurePersistence() {
  if (requested) return;
  requested = true;
  usePersistence.getState().setPersistence(await requestPersistence());
}

export function initDurability(): void {
  if (started) return;
  started = true;

  // Reflect the current (pre-request) state in the indicator.
  void getPersistenceState().then((s) => usePersistence.getState().setPersistence(s));

  // Any store that has data → make storage durable. Fired on the hydration
  // transition (existing data) and on the first real create.
  useVisits.subscribe((s, p) => {
    if (s.visits.length && (s.visits !== p.visits || (!p.loaded && s.loaded))) void ensurePersistence();
  });
  useStories.subscribe((s, p) => {
    if (s.stories.length && (s.stories !== p.stories || (!p.loaded && s.loaded))) void ensurePersistence();
  });
  useTrips.subscribe((s, p) => {
    if (s.trips.length && (s.trips !== p.trips || (!p.loaded && s.loaded))) void ensurePersistence();
  });

  // Cover the race where a store hydrated before this ran.
  if (
    useVisits.getState().visits.length > 0 ||
    useStories.getState().stories.length > 0 ||
    useTrips.getState().trips.length > 0
  ) {
    void ensurePersistence();
  }
}
