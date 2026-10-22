# CLAUDE.md

Guidance for Claude Code in this repository. Loaded every session, so it holds only always-needed facts and rules.
Architecture overview per folder: **`docs/architectuur.md`**, read it before working in an unfamiliar part of `app/src/`.

## What this is

**Kader** is a personal crypto copy-trading analysis tool (not financial advice; it produces technical signals). It analyses free public market data and outputs concrete trades with a pre-computed entry, stop-loss and take-profit (minimum 1:2 risk/reward), plus an eToro "Popular Investor" auditor. **All user-facing text is Dutch**: keep UI strings, generated output and comments in Dutch.

Single Android app: React Native + Expo in `app/`, app id `com.kader.app`.

## Commands

From `app/`:
```bash
npm install          # eerste keer
npx expo start       # Metro bundler + dev-client
npm run android      # bouw en installeer op device/emulator
npm run release:apk  # release-APK, alleen via de release-apk skill
```

Building needs JDK 17+ (Android Studio's JBR volstaat), the Android SDK (platform 35+), `JAVA_HOME` and `ANDROID_HOME`, and a local path without spaces (e.g. `C:\dev`).

Stack: Expo SDK 56, React Native 0.85, React 19, TypeScript 6. Read the version-specific Expo docs linked from [app/AGENTS.md](app/AGENTS.md) before writing Expo code. Reanimated, worklets, Skia, gesture-handler, expo-haptics and expo-clipboard are native deps: after pulling code that adds or updates them, run `npm run android` once (full rebuild).

**No test suite, no linter.** The only verification is the **`run-android`** skill on the emulator.

## Pitfalls (always apply)

- **New sheet:** reuse `components/BottomSheet.tsx`, never a bare `Modal`. **New full-screen view:** reuse `components/PodiumScherm.tsx`, never a bare `Modal`.
- **Animations** take their values from `theme/beweging.ts` (no loose ms values); list transitions via `theme/lijstBeweging.ts` (Reanimated, not `LayoutAnimation`). **Haptics** only through `theme/haptiek.ts`.
- **`etoroFetch` must send a real GUID in `x-request-id`** (use `guid()`, not `nieuweId()`: base36 gave a 422).
- **eToro keys live in expo-secure-store**, never AsyncStorage (that goes into Android's backup). The Demo/Echt switch only picks the API path, and that path is the only thing separating play money from real money. Orders only after an explicit confirmation per order.
- **Stop-loss limits:** without an eToro link or on an API error, show no warning. An invented limit is worse than none.
- **`TaskManager.defineTask` must stay at module level** in `notifications/achtergrondtaak.ts`, and `App.tsx` must import that file at the top, otherwise the task does not exist when Android wakes the app. Android's minimum interval is 15 minutes.
- Market data uses native `fetch` (no CORS in React Native, no API keys).

## Design

For any UI or design work, use the **`kader-design`** skill: it points to the house style, screen descriptions, design system and logo.
Tone: sober, helpful, Dutch, never hype-y. Always carry the disclaimer "Geen financieel advies. De koers op eToro kan afwijken."

## Team and Git workflow

Thom and Kevin both work on this project via Claude Code; both write features, neither is a programmer. Full workflow: `docs/github-werkwijze.md`.

- **`main` is always stable and installable.** Never commit work-in-progress to main.
- **One branch per task**, merge via Pull Request.
- **Coordinate first** (chat/WhatsApp) about what you pick up: two sessions on the same files cause hard merge conflicts.
- A SessionStart hook runs `git fetch origin` and shows recent commits from all branches. Look at them before starting.

## Model and effort

If the current model or effort clearly does not fit the task (Opus on high for a typo, Haiku for a subtle bug), say so in one line before starting, with the reason. Otherwise say nothing about it. Plan mode only for large or risky changes.

## Version control & releases

Claude is in charge of version numbering and the changelog.

- **Update the changelog with every user-facing change**: both `CHANGELOG.md` (repo root) and `app/src/changelog.ts`. Keep them in sync, newest first, Dutch.
- **Claude decides the version number** (`app/app.json`, `version`), following the existing scheme. **Bump it only when a release build is actually built**; between releases only the changelog grows.
- **Only build and publish a release APK when explicitly asked.** If enough work has piled up for a sensible release, ask; don't just do it.
- **Always build via the `release-apk` skill**, never a bare `expo run:android` or `gradlew assembleRelease`: `app/android/` is gitignored and a bare build reuses a stale `versionCode`, which broke installability of 0.1.1 and 0.1.3.
- **Never change the signing key.** Every installed copy uses the Expo debug key (`app/android/app/debug.keystore`, regenerated identically by prebuild). A new key forces every user to uninstall and lose their local data.

## Writing rules

Apply everywhere: code comments, UI strings, generated reports, documentation, code output.

- **No em-dashes** (the long dash, U+2014). Use a comma, colon, semicolon or plain hyphen instead.
- **No generic AI filler** ("Certainly!", "It's worth noting that...", "In conclusion..."). Get to the point.
