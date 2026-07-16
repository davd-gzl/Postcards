import { useEffect } from "react";
import { useSettings } from "../store/useSettings";
import { useVisits } from "../store/useVisits";
import { useTrips } from "../store/useTrips";
import { useStories } from "../store/useStories";
import { createSyncScheduler } from "../sync/scheduler";
import { isApplyingSync } from "../sync/applyMark";
import { readRemoteConfig, isConfigured } from "../sync/syncConfig";

// OPT-IN auto-sync (spec 013). Off by default: enabling the toggle ONCE is the
// user's explicit, informed consent for the app to reach their git remote in the
// background — which preserves the constitution's "data leaves the device only on
// explicit user action" (the action is the opt-in, not each individual sync). When
// the toggle is off this hook wires up nothing at all.
//
// When on + a remote is configured + the browser is online, it runs the SAME
// `syncOnce` engine as the manual button, triggered by:
//   • app launch, regaining focus/visibility, and coming back online → pull;
//   • local edits (debounced) and backgrounding (visibilitychange→hidden /
//     pagehide) → push.
// All of it funnels through one scheduler that holds a single in-flight lock and
// coalesces bursts, so the API is never hammered.

/** Idle period after the last local edit before auto-sync pushes it. A few seconds
 *  so a flurry of quick toggles/edits collapses into one push. */
const AUTO_SYNC_DEBOUNCE_MS = 4000;

export function useAutoSync(): void {
  // Offline mode is the master override — background sync never wires up while
  // it's on, whatever the auto-sync toggle says (a manual push is still a
  // deliberate button in Settings, which Offline mode leaves to the user).
  const autoSync = useSettings((s) => s.autoSync && !s.offlineMode);

  useEffect(() => {
    if (!autoSync) return; // opt-in: do nothing until explicitly enabled
    if (typeof window === "undefined") return;

    let disposed = false;

    // Only sync once the stores have finished loading from IndexedDB. Syncing with
    // an un-loaded (empty) local snapshot could push emptiness / drop not-yet-loaded
    // records — gate on `loaded` so local truly reflects the device first.
    const ready = () =>
      useVisits.getState().loaded &&
      useTrips.getState().loaded &&
      useStories.getState().loaded;

    const scheduler = createSyncScheduler({
      debounceMs: AUTO_SYNC_DEBOUNCE_MS,
      canRun: () =>
        !disposed &&
        (typeof navigator === "undefined" || navigator.onLine) &&
        isConfigured(readRemoteConfig()) &&
        ready(),
      // Import the runner lazily so the engine/codec stay off the boot path even
      // with auto-sync mounted; a run only pays for them when it actually fires.
      run: async () => {
        const { runDeviceSync } = await import("../sync/runSync");
        await runDeviceSync(readRemoteConfig());
      },
    });

    // Launch pull (services once the stores are ready; a no-op until then, and the
    // stores' load below re-triggers it as a change).
    scheduler.requestImmediate();

    // Regaining the app or the network → pull the latest.
    const onFocus = () => scheduler.requestImmediate();
    const onOnline = () => scheduler.requestImmediate();
    // Visibility handles BOTH directions: visible → pull, hidden → push before the
    // OS can suspend us. pagehide is the last-chance backstop on real teardown.
    const onVisibility = () => scheduler.requestImmediate();
    const onPageHide = () => scheduler.requestImmediate();

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    // Local edits → debounced push. Ignore changes caused by our OWN persisted pull
    // (bracketed by markApplyingSync) so a merged result never re-triggers a sync.
    const onData = () => {
      if (isApplyingSync()) return;
      scheduler.requestDebounced();
    };
    const unsubVisits = useVisits.subscribe((s, p) => {
      if (s.visits !== p.visits) onData();
    });
    const unsubTrips = useTrips.subscribe((s, p) => {
      if (s.trips !== p.trips) onData();
    });
    const unsubStories = useStories.subscribe((s, p) => {
      if (s.stories !== p.stories) onData();
    });

    return () => {
      disposed = true;
      scheduler.dispose();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubVisits();
      unsubTrips();
      unsubStories();
    };
  }, [autoSync]);
}
