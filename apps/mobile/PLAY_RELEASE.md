# Don Bosco College Android release

Every Play App Bundle is built from this app, not from a one-off change to a single version.

## Build

From `apps/mobile`:

```
npm run preflight:play
npm run build:aab
```

`build:aab` runs `expo prebuild --clean`, then the config plugins, then a signed release bundle. Do not assemble a release AAB from a hand-edited `android/` tree. Prebuild regenerates that tree.

Upload `DonBoscoCollege-Tura-v<version>-vc<versionCode>.aab` from the Desktop copy. Upload the matching `mapping.txt` in Play Console so crash reports stay readable.

Raise `package.json` version, `app.config.ts` `version` / `android.versionCode` / `ios.buildNumber`, `src/constants/release.ts`, and `scripts/build-local-aab.js` `versionCode` together. Play production of 19 Oct 2026 is versionCode 57. The 1.0.38 / versionCode 58 bundle was built before these Play fixes. The first bundle that contains them is 1.0.39 / versionCode 59.

## What the release build always applies

- `plugins/with-android-target-sdk-36.js` sets compile/target SDK 36, `enableEdgeToEdge()` on `MainActivity`, R8 full mode, PNG crunch, resource shrinking, and removes orientation locks including the ML Kit barcode activity.
- The same plugin rewrites `react-native-edge-to-edge` so it no longer sets status-bar or navigation-bar colors. That rewrite runs on every prebuild, including EAS.
- `app.config.ts` keeps `edgeToEdgeEnabled`, `orientation: 'default'`, and R8 rules that do not disable method inlining.
- `app/_layout.tsx` mounts `SystemBars` inside `SafeAreaProvider` so insets apply on auth, student, staff, and principal screens.
- Splash and other `res` bitmaps over 40 KB are converted to WebP. The build fails if any packaged bitmap stays over 200 KB.
- `npm run preflight:play` fails if the version, R8 rules, edge-to-edge injection, or large-screen override are missing.

## Remaining Play warning

React Native 0.79.6 `StatusBarModule` still contains `Window.setStatusBarColor`. Expo SDK 53 pins that React Native version. The app does not call that API itself. Play can keep the deprecated-API recommendation until a React Native release used by this Expo SDK removes it. Do not hide the call with reflection.

`react-native-edge-to-edge` 1.8.2 still ships the same deprecated calls. The prebuild patch removes them from the copy that Gradle compiles. Re-check the patch if that package's `applyEdgeToEdge` method is renamed.
