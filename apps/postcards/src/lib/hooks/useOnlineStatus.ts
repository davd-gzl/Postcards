import { useSyncExternalStore } from "react";

// Reactive connectivity from the browser signal ONLY — navigator.onLine plus the
// window online/offline events. No probe request, no telemetry: it works fully
// offline and leaks nothing (Constitution: privacy by default, local-first).
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** `true` when the browser reports a network connection. SSR/test-safe. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
    () => true,
  );
}
