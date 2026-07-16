import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { initReferenceData } from "./lib/reference/referenceData";
import { useUpdate } from "./lib/store/useUpdate";
import "@fontsource-variable/inter"; // self-hosted (OFL) — no font CDN
import "@fontsource-variable/space-grotesk"; // display face for the wordmark, headings & figures (OFL)
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

// Keep open tabs off a stale cached build. We register the generated service
// worker ourselves (no workbox-window dependency): when a NEW build installs and
// waits, we surface a "new version — reload" banner (see UpdateBanner) rather
// than swapping code under the user. Tapping Reload posts SKIP_WAITING (the SW
// listens for it), which activates the new worker; `controllerchange` then
// reloads the page once into the fresh build. A 30-min poll lets an always-open
// tab discover a deploy without a manual reload. The very first install (no
// existing controller) never prompts — it just primes the offline cache.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    const offerIfWaiting = (worker: ServiceWorker | null) => {
      if (worker && worker.state === "installed" && navigator.serviceWorker.controller) {
        useUpdate.getState().announce(() => worker.postMessage({ type: "SKIP_WAITING" }));
      }
    };
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((reg) => {
        offerIfWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          nw?.addEventListener("statechange", () => offerIfWaiting(nw));
        });
        setInterval(() => void reg.update(), 30 * 60 * 1000);
      })
      .catch(() => {
        /* registration unavailable (insecure context / unsupported): app still works */
      });
  });
}

const el = document.getElementById("root");
if (!el) throw new Error("Root element not found");

// Load the bundled reference gazetteer (local, SW-cached) before first render
// so every screen can read it synchronously.
void initReferenceData().then(() => {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // Merge any installed community data packs into the reference set (off the
  // critical path; fires the gazetteer event so screens refresh when it lands).
  void import("./lib/packs/store").then((m) => m.useDataPacks.getState().load());
});

// Warm the code-split MapScreen chunk (~1 MB, mostly MapLibre) while the
// reference data downloads — the map is the default tab, so it's always needed
// next. Vite dedupes dynamic imports by URL: App's React.lazy resolves from
// this same in-flight request, and the code split stays intact.
void import("./features/map/MapScreen");
