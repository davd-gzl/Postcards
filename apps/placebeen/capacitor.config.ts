import type { CapacitorConfig } from "@capacitor/cli";

// Scaffolded for the native iOS/Android wrap. Native platforms (ios/, android/)
// and plugin wiring (Filesystem, Share, and the future shared Offline Map Store)
// are added in a follow-up; the web build runs standalone without them.
const config: CapacitorConfig = {
  appId: "coop.samourai.placebeen",
  appName: "Place'Been",
  webDir: "dist",
};

export default config;
