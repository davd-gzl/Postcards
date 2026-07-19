# Native iOS & Android builds (Capacitor)

Postcards is one web codebase shipped as a **PWA** and wrapped natively with
[Capacitor](https://capacitorjs.com). The web build in `dist/` is the app; the native projects are
thin shells that load it.

## What's in the repo

- `capacitor.config.ts` — appId `coop.samourai.postcards`, appName `Postcards`, `webDir: dist`.
- `@capacitor/core` + `@capacitor/cli` + `@capacitor/android` + `@capacitor/ios` (installed).
- `android/` — the Android project, **scaffolded and committed** (`npx cap add android`). Build
  outputs (`*.apk`, `build/`, `.gradle`, copied web assets) are git-ignored; only source is tracked.
- npm scripts: `cap:sync`, `cap:copy`, `cap:add:ios`, `cap:open:android`, `cap:open:ios`,
  `native:android`, `native:ios`, **`apk:debug`** (headless APK, below).

## Android — get an APK

### Easiest: download a debug APK from CI (no local Android toolchain)

The [`Android APK (debug)`](../.github/workflows/android-apk.yml) workflow builds an installable debug
APK on every push (and on demand) and uploads it as an artifact:

1. Push to `main` or any `claude/**` branch — or run the workflow manually (Actions → **Android APK
   (debug)** → *Run workflow*).
2. Open the finished run and download the **`postcards-debug-apk`** artifact.
3. Unzip and install: `adb install app-debug.apk` (or copy to the phone and open it; you'll need
   "install unknown apps" enabled since it's a debug build).

The APK is **debug-signed** with the auto-generated Android debug keystore (fine for sideloading, not
for the Play Store) — the signing cert differs per machine/run, so uninstall an older copy if Android
refuses to update over it.

### Build the APK locally, headless (no Android Studio)

Needs **JDK 17** + the **Android SDK / command-line tools** with `ANDROID_HOME` (or
`ANDROID_SDK_ROOT`) set — but *not* Android Studio:

```bash
pnpm --filter postcards apk:debug
# = pnpm build → cap sync android → android/ ./gradlew assembleDebug
# → apps/postcards/android/app/build/outputs/apk/debug/app-debug.apk
```

### With Android Studio (interactive)

```bash
pnpm --filter postcards native:android   # build → cap sync android → cap open android → Run / Build APK/AAB
```

If `android/` is ever missing or you want to regenerate it: `pnpm --filter postcards cap:add:android`.

> **APK size (~25 MB).** `cap sync` copies all of `dist/` into the app assets, including the 17 MB
> full gazetteer (`reference/cities-all.json`). On the web that file is downloaded on demand to keep
> the install small; bundling it into the native app is harmless — it just means the native app is
> **fully offline out of the box**. A leaner APK would need a dedicated build variant that excludes it
> *and* verifies the on-demand fetch works inside the Capacitor `https` scheme — a separate change.

## iOS (macOS only)

Requires Xcode + CocoaPods. The `ios/` project isn't committed because it can't be generated off
macOS — create it once on a Mac:

```bash
pnpm --filter postcards build
pnpm --filter postcards cap:add:ios    # generates ios/ (Xcode project + pods)
pnpm --filter postcards cap:open:ios   # open in Xcode → set a signing team → Run
# or, after ios/ exists:
pnpm --filter postcards native:ios
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
- **CI.** The `Android APK (debug)` workflow produces an installable **debug** APK on GitHub's
  Ubuntu runners (JDK 17 + the runner's Android SDK; `gradlew` self-bootstraps Gradle). A **release**
  AAB/APK still needs a signing key (store it as an encrypted secret) and, for iOS, a macOS runner
  with an Apple signing team — out of scope for the debug artifact above.
