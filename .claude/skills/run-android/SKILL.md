---
name: run-android
description: Build, install, and drive the Kader Android app (Expo/React Native, in app/) via ADB. Use when asked to start, build, run, screenshot, or interact with the Kader app, or to verify a UI/behavior change on the Android emulator.
---

Kader is an Expo/React Native Android app in `app/`. There is no
project-specific driver script — the app is driven directly with ADB
shell commands against a running emulator. Package: `com.kader.app`,
main activity: `com.kader.app.MainActivity`.

**This skill is for the emulator/dev-client only. For a release APK
that gets uploaded to GitHub, use the `release-apk` skill instead** —
`expo run:android` below skips prebuild whenever `android/` already
exists, so the native `versionCode` silently falls behind `app.json`
after a version bump. That drift is exactly what broke installability
of a real release once (see `release-apk`'s SKILL.md for the story);
never build a release APK with the commands in this file.

## Prerequisites

- An Android emulator already running (check with
  `adb devices` — needs a `device` line, not `offline`). This skill
  does not start one; ask the user or use Android Studio's AVD manager
  if none is running. List AVDs with
  `"$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -list-avds`.
- **JDK 17 exactly** — not whatever JBR ships with the installed
  Android Studio (often JDK 21+ and this build will not compile with
  it). Gradle's Kotlin DSL toolchain resolution in this project
  requires `languageVersion=17`. If no JDK 17 is present:
  `winget install --id EclipseAdoptium.Temurin.17.JDK --silent --accept-package-agreements --accept-source-agreements`
  then set `JAVA_HOME` to the resulting
  `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`.
- `ANDROID_HOME` = `$env:LOCALAPPDATA\Android\Sdk` (not always set
  globally — export it per session).

### Gotcha: Gradle toolchain auto-provisioning is broken here

A clean build with the wrong `JAVA_HOME` fails with:
```
NoSuchFieldError: Class org.gradle.jvm.toolchain.JvmVendorSpec does not have member field ... IBM_SEMERU
```
This comes from `org.gradle.toolchains.foojay-resolver-convention:0.5.0`
(pinned inside `node_modules/@react-native/gradle-plugin`), which is
incompatible with the Gradle version this project's wrapper downloads
(9.3.x). It fires whenever Gradle can't find a local JDK 17 and tries
to auto-provision one via foojay. Fix is two-part and both parts are
needed:

1. Point `JAVA_HOME` at a real JDK 17 (see above) so Gradle never
   needs to auto-provision.
2. Also disable auto-provisioning/detection globally so Gradle doesn't
   even attempt the buggy code path, in
   `~/.gradle/gradle.properties` (create if absent):
   ```
   org.gradle.java.installations.auto-detect=false
   org.gradle.java.installations.auto-download=false
   org.gradle.java.installations.fromEnv=JAVA_HOME
   ```

If you change `JAVA_HOME` or these properties, stop stale daemons
first: `cd app/android && ./gradlew.bat --stop`.

## Build & install

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Set-Location C:\dev\app
npx expo run:android
```

- First run does `expo prebuild` (generates the gitignored `android/`
  folder) then a full Gradle build — several minutes, no cached
  daemon. Subsequent runs are much faster.
- Do **not** pass `--device <adb-serial>` (e.g. `emulator-5554`) —
  `expo run:android --device` expects an **AVD name** (e.g.
  `Pixel_8`), not the adb serial, and errors with "Could not find
  device". Omit `--device` entirely when exactly one emulator/device
  is attached; Expo auto-selects it.
- Successful install auto-launches the app on the emulator.

## Driving the app via ADB

No Playwright/driver script exists for this native app — use raw
`adb shell input` + `adb exec-out screencap`.

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices                                   # confirm target
& $adb shell dumpsys window | Select-String "mCurrentFocus"   # confirm Kader is foreground
& $adb exec-out screencap -p > shot.png          # screenshot
& $adb shell input tap <x> <y>                   # tap, native pixels
& $adb shell input swipe <x1> <y1> <x2> <y2> 300  # scroll (swipe up = scroll down)
& $adb shell input keyevent 111                  # ESC — dismiss keyboard
& $adb shell input keyevent 4                    # Android back button
```

### Critical: coordinate scaling

`adb exec-out screencap -p` on the default `Pixel_8` AVD produces a
**1080x2400** image. When you view that screenshot through the `Read`
tool it gets downscaled for display (observed: to 900x2000) and the
tool reports a multiplier (e.g. "multiply by 1.20") to map the
displayed image back to native pixels. **Always tap using native
pixel coordinates**, i.e. `displayed_coord × multiplier`. Forgetting
this is the single most common cause of "tap did nothing" — you'll
land ~17% too high/left of the intended target.

### App navigation map (fresh install)

1. Onboarding carousel opens first. Tap "Sla over" (skip), top-right,
   roughly `(940, 202)` native on a 1080x2400 screen.
2. A system "Allow Kader to send you notifications?" dialog may
   appear (expo-notifications). "Allow" button center ≈ `(540, 1348)`
   native. This is a one-time OS dialog, not app UI.
3. Bottom tab bar (Markt / Kansen / Portfolio / Traders) sits at
   native y ≈ `2326` on a 1080x2400 screen; x centers roughly
   `135 / 400 / 690 / 960` for the four tabs respectively.
4. The three data-entry modals (all bottom-sheets, same structure —
   see `app/src/components/GetradeFormulier.tsx`,
   `app/src/screens/TradersScreen.tsx`,
   `app/src/screens/PortfolioScreen.tsx`) open via a "+" / "Eerste …
   toevoegen" button and close via the X top-right or Android back.

## Troubleshooting

- **`Could not find device with name: emulator-5554`** — you passed
  the adb serial as `--device`. Drop the flag (see above).
- **`NoSuchFieldError ... IBM_SEMERU`** or
  **`Cannot find a Java installation ... languageVersion=17`** — see
  the Gotcha section above; you need both a real JDK 17 in
  `JAVA_HOME` AND the `~/.gradle/gradle.properties` overrides.
- **Build hangs with no output for minutes** — normal for the first
  clean build (Gradle daemon start + full compile). Don't kill it;
  poll `Get-Process | Where-Object ProcessName -match "java|gradle"`
  to confirm it's still working before assuming it's stuck.
- **Tap "did nothing"** — you almost certainly used displayed-image
  coordinates instead of native ones; re-check the scaling factor.
