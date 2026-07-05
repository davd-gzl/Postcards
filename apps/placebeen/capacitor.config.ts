import type { CapacitorConfig } from "@capacitor/cli";

// Native wrap for the same web build (Constitution: one codebase → PWA + native).
// The Android project (android/) is scaffolded and committed; add iOS on a Mac
// with `pnpm cap:add:ios`. Build steps: docs/NATIVE-BUILDS.md. Plugin wiring
// (Filesystem/Share for native backup export, and the shared Offline Map Store)
// is layered on when building natively; the web/PWA build runs standalone.
const config: CapacitorConfig = {
  appId: "coop.samourai.placebeen",
  appName: "Place'Been",
  webDir: "dist",
};

export default config;
