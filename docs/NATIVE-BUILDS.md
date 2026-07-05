# Native iOS & Android builds (Capacitor)

Place'Been is one web codebase shipped as a **PWA** and wrapped natively with
[Capacitor](https://capacitorjs.com). The web build in `dist/` is the app; the native projects are
thin shells that load it.

## What's in the repo

- `capacitor.config.ts` — appId `coop.samourai.placebeen`, appName `Place'Been`, `webDir: dist`.
- `@capacitor/core` + `@capacitor/cli` + `@capacitor/android` + `@capacitor/ios` (installed).
- `android/` — the Android project, **scaffolded and committed** (`npx cap add android`). Build
  outputs (`*.apk`, `build/`, `.gradle`, copied web assets) are git-ignored; only source is tracked.
- npm scripts: `cap:sync`, `cap:copy`, `cap:add:ios`, `cap:open:android`, `cap:open:ios`,
  `native:android`, `native:ios`.

> **Not verified on device here.** The Android project was generated in a Linux CI container which
> has **no Android SDK**, and iOS needs **macOS + Xcode**, so no signed `.apk`/`.ipa` was produced.
> The steps below are the standard Capacitor workflow to build and run on your machine.

## Android

Requires Android Studio (or the Android SDK + JDK 17).

```bash
pnpm --filter placebeen build          # produce dist/
pnpm --filter placebeen cap:sync       # copy dist/ into android/ + update plugins
pnpm --filter placebeen cap:open:android   # open in Android Studio → Run / Build APK/AAB
# or the one-shot:
pnpm --filter placebeen native:android
```

If `android/` is ever missing or you want to regenerate it: `pnpm --filter placebeen cap:add:android`
(takes ~milliseconds; it re-copies the template).

## iOS (macOS only)

Requires Xcode + CocoaPods. The `ios/` project isn't committed because it can't be generated off
macOS — create it once on a Mac:

```bash
pnpm --filter placebeen build
pnpm --filter placebeen cap:add:ios    # generates ios/ (Xcode project + pods)
pnpm --filter placebeen cap:open:ios   # open in Xcode → set a signing team → Run
# or, after ios/ exists:
pnpm --filter placebeen native:ios
```

## Notes

- **Offline-first carries over.** The PWA already precaches the app shell + reference data; inside
  the native shell the same assets load with no network. The opt-in online OSM basemap needs a
  connection; the offline overview and (when installed) the offline PMTiles streets pack do not.
- **Vite `base`** is `/` (default), which is correct for the native shell (served from root). Only
  change it if you also host the PWA under a sub-path.
- **Native file export.** On device, the browser download used by *Your data → Export* should be
  swapped for `@capacitor/filesystem` + `@capacitor/share` to write/share the portable JSON. Add
  those plugins when implementing native export; the web path is unchanged.
- **Shared Offline Map Store.** The `OfflineMapStore` seam (see
  [`OFFLINE-MAPS.md`](OFFLINE-MAPS.md)) is where a native `SharedOfflineMapStore` plugin (iOS App
  Group / Android SAF) plugs in, so map packs are device-global across the ecosystem.
- **CI.** Building signed binaries belongs in a macOS runner (iOS) / SDK-equipped runner (Android),
  not this container.
