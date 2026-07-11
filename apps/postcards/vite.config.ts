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
        name: "Postcards",
        short_name: "Postcards",
        description: "Remember the places you've been — local-first, private, offline.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache the app shell + bundled reference/basemap assets for offline use.
        globPatterns: ["**/*.{js,css,html,json,geojson,pmtiles,woff2}"],
        // The full world gazetteer (~17 MB) must precache for offline use.
        maximumFileSizeToCacheInBytes: 24 * 1024 * 1024,
        // Runtime-cache OSM raster tiles the user actually views, so areas they've
        // browsed on the online basemap remain available OFFLINE (opt-in: no tile
        // is ever fetched until the user turns on the OpenStreetMap basemap).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith("tile.openstreetmap.org"),
            handler: "CacheFirst",
            options: {
              // v2: the old cache may hold opaque "Referer required" error tiles
              // (status 0) from before the Referrer-Policy fix; a new name drops them.
              cacheName: "osm-tiles-v2",
              // Must exceed the offline seam's REGION_MAX_TILES (40k) with browsing
              // headroom — a lower LRU cap would silently evict tiles the user
              // explicitly downloaded as a region pack.
              expiration: { maxEntries: 50_000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              // Only cache real successes now that tiles are fetched with CORS —
              // never poison the cache with error/opaque responses.
              cacheableResponse: { statuses: [200] },
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
