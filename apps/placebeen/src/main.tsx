import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { initReferenceData } from "./lib/reference/referenceData";
import "@fontsource-variable/inter"; // self-hosted (OFL) — no font CDN
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
