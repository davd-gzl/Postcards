/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Web-first: this same build is the self-hostable website (PWA) and the payload
// Capacitor wraps into native iOS/Android. No Google, no backend.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Place'Been",
        short_name: "Place'Been",
        description: "Remember the places you've been — local-first, private, offline.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        icons: [],
      },
      workbox: {
        // Cache the app shell + bundled reference/basemap assets for offline use.
        globPatterns: ["**/*.{js,css,html,json,geojson,pmtiles,woff2}"],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        // Runtime-cache OSM raster tiles the user actually views, so areas they've
        // browsed on the online basemap remain available OFFLINE (opt-in: no tile
        // is ever fetched until the user turns on the OpenStreetMap basemap).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith("tile.openstreetmap.org"),
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tiles",
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.spec.ts", "tests/unit/**/*.spec.tsx"],
  },
});
