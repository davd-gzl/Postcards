import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { initReferenceData } from "./lib/reference/referenceData";
import "@fontsource-variable/inter"; // self-hosted (OFL) — no font CDN
import "@fontsource-variable/space-grotesk"; // display face for the wordmark, headings & figures (OFL)
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

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
});

// Warm the code-split MapScreen chunk (~1 MB, mostly MapLibre) while the
// reference data downloads — the map is the default tab, so it's always needed
// next. Vite dedupes dynamic imports by URL: App's React.lazy resolves from
// this same in-flight request, and the code split stays intact.
void import("./features/map/MapScreen");
