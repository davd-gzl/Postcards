// A tiny registry that lets a screen "catch" an unobstructed Escape / Back to
// step out of a LOCAL sub-view before the app walks its tab/page history.
//
// The problem: tabs and detail pages live in useUi's history, so Escape backs
// through them correctly. But a screen's own inner views — the Journal's
// calendar/timeline/map, the Places collections (Moments/Photos/Passport) — are
// plain component state the history never saw. Without this, Escape from one of
// them jumps straight to the previous TAB instead of first returning to the
// screen's home view, which felt like it "skipped a step".
//
// A mounted screen registers an interceptor; App's Escape (and Back) handler
// runs them, most-recent-first, BEFORE goBack(). The first one that handles the
// press (returns true) wins and history is left untouched. Interceptors run only
// for an UNOBSTRUCTED Escape — a modal/lightbox/dirty-composer layer is detected
// and short-circuited earlier — so they never fire behind an open dialog.

type EscapeInterceptor = () => boolean;

const interceptors = new Set<EscapeInterceptor>();

/** Register an interceptor; returns an unsubscribe to call on unmount. */
export function registerEscape(fn: EscapeInterceptor): () => void {
  interceptors.add(fn);
  return () => {
    interceptors.delete(fn);
  };
}

/**
 * Run registered interceptors most-recent-first. Returns true as soon as one
 * handles the Escape (so the caller skips history navigation); false if none did.
 */
export function runEscapeInterceptors(): boolean {
  // Most-recently-registered gets first refusal (a freshly-mounted screen owns
  // the press over a stale one, though in practice only one screen is mounted).
  const fns = [...interceptors].reverse();
  for (const fn of fns) {
    try {
      if (fn()) return true;
    } catch {
      // A broken interceptor must never trap Escape — fall through to the next.
    }
  }
  return false;
}
