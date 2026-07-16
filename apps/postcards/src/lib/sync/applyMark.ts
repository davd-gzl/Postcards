// A tiny cross-module flag so auto-sync can tell its OWN writes apart from the
// user's edits (spec 013).
//
// When a sync run persists a merged pull it calls the stores' setState, which
// fires their subscribers. Auto-sync subscribes to those same stores to push
// changes — so without this flag a persisted pull would look like a fresh local
// edit and trigger another sync, which persists again… an endless no-op loop that
// hammers the remote. `markApplyingSync` brackets the persist's synchronous
// setState burst; auto-sync's subscriber ignores any change seen while the flag
// is raised. Reentrant (a counter) so nested/overlapping applies are safe.

let applying = 0;

/** True while a sync run is applying a merged result to the local stores. */
export function isApplyingSync(): boolean {
  return applying > 0;
}

/** Run `fn` (the synchronous store writes) with the "applying" flag raised. */
export function markApplyingSync<T>(fn: () => T): T {
  applying++;
  try {
    return fn();
  } finally {
    applying--;
  }
}
