/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Self-hosted font packages are CSS side-effect imports with no type declarations.
declare module "@fontsource-variable/*";

// App version, injected at build time from package.json via Vite `define`.
declare const __APP_VERSION__: string;
