import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

const el = document.getElementById("root");
if (!el) throw new Error("Root element not found");
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
