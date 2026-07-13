# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Kader** is a personal crypto copy-trading analysis tool (not financial advice; it produces technical signals). It analyses free public market data and outputs concrete trades with a pre-computed entry, ATR-based stop-loss and take-profit (minimum 1:2 risk/reward), plus an eToro "Popular Investor" auditor. **All user-facing text is Dutch** -- keep generated output, UI strings and comments in Dutch to match the existing code.

The project is a single Android app: React Native + Expo, located in `app/`. App id: `com.kader.app`.

## Commands

App (from `app/`):
```bash
npm install          # eerste keer
npx expo start       # Metro bundler + dev-client
npm run android      # bouw en installeer op aangesloten device/emulator
npm run release:apk  # release-APK, altijd via de release-apk skill, zie onder
```

Building the APK needs JDK 17+ (Android Studio's JBR volstaat) and the Android SDK (platform 35+). Set `JAVA_HOME` and `ANDROID_HOME` before building. Project must be on a local drive without spaces (e.g. `C:\dev`).

Stack: Expo SDK 56, React Native 0.85, React 19, TypeScript 6. Expo's API is recent, dus [app/AGENTS.md](app/AGENTS.md) verwijst naar de versie-specifieke docs op `docs.expo.dev/versions/v56.0.0/`, lees die voor je Expo-code schrijft.

There is **no test suite** and no linter configured. Gebruik de **`run-android`** skill om een wijziging op de emulator te verifiëren, dat is de enige verificatie die er is.

## Architecture (`app/src/`)

- **`engine/`** -- alle marktlogica, geen UI. `analyzer.ts` (`analyseerMarkt()`, de hoofdanalyse) en `opportunities.ts` (`zoekKansen()`, de "grote kansen"-scanner over een breder coin-set) zijn losse bestanden, niet hetzelfde. `auditor.ts` scoort een eToro-trader (consistentie, drawdown/return, concentratie) naar een 🟢/🟡/🔴-oordeel. `etoro.ts` en `etoroLimieten.ts` zijn de eToro API-client, zie de eigen sectie hieronder. `indicators.ts` (RSI/EMA/MACD/ATR/volume, met de hand geschreven zodat de tool blijft werken als een externe indicator-lib breekt) en `marketData.ts` (Binance klines + CoinGecko-fallback via native `fetch`, geen API-keys) zijn de databasis. Verder `coinInfo.ts`, `coinDetailData.ts`, `format.ts`, `types.ts`. `index.ts` is een barrel-export.
- **`screens/`** -- MarktScreen, KansenScreen, PortfolioScreen, TradersScreen, OnboardingScreen. `BottomNav.tsx` (in `components/`) is de tabbalk; de cross-fade tussen tabs zit in `App.tsx`.
- **`components/`** -- herbruikbare UI. Twee die je moet kennen voor nieuwe schermen: `BottomSheet.tsx` is de gedeelde sheet-basis (sluit op backdrop-tik, houdt rekening met de Android-gesturebalk) en moet hergebruikt worden voor elke nieuwe sheet in plaats van een kale `Modal`; `ScreenHeader.tsx` draagt het boek- en tandwiel-icoon op elk scherm. Verder full-screen views (`CoinDetailScherm.tsx`, `AchtergrondScherm.tsx`, `HistorieScherm.tsx`) en `FoutGrens.tsx` (error boundary).
- **`state/`** -- MarktProvider en PortfolioProvider (React Context). PortfolioProvider regelt ook de eToro-sync (bij app-start buiten een cooldown, bij swipe, bij de eToro-knop). Verder `advies.ts`, `statistieken.ts` (portfolio stats), `syncStatus.ts`, `useFavorieten.ts`, `useStopLossLimiet.ts`, `portfolioTypes.ts`.
- **`storage/opslag.ts`** -- AsyncStorage-wrapper voor traders, portfolio, eToro-sleutels en formulierconcepten (`laadObject`/`bewaarObject`).
- **`notifications/meldingen.ts`** -- push notifications via `expo-notifications`.
- **`theme/`** -- tokens, typography, ThemeProvider (system/light/dark mode), plus `useReduceMotion` en `useToetsenbordHoogte`.
- **`changelog.ts`** -- in-app changelogbron voor het changelog-scherm en de "nieuw in deze versie"-popup, moet in sync blijven met `CHANGELOG.md`.

### Key tunables (`app/src/engine/analyzer.ts`)
`STANDAARD_UNIVERSUM` (57 coins, dezelfde lijst als op eToro handelbaar is), `SWING_PERIODE` (10, lookback voor de swing-low stop), `REWARD_MULTIPLIER` (3.0, take-profit), `MIN_RISK_REWARD` (2.0), `HIGH_CONVICTION_SCORE` (75). Default `topN` in `analyseerMarkt()` is 20. De scan haalt coins op in parallelle blokken van 6 (`GELIJKTIJDIG`), niet één voor één. De stop wordt net onder de recente swing low geplaatst (`stopAfstandStructuur`), geclamped op een 0.5x-3x ATR-band zodat hij niet ruis-krap en niet absurd ver is; take-profit = `entry + 3xATR`. R/R = reward / stop-afstand verschilt daarom **per coin**, en coins onder `MIN_RISK_REWARD` worden gefilterd. Score 0-100 beloont uptrend (EMA20>EMA50), koers boven EMA20, gezonde RSI, bullish MACD en volumepieken.

## App specifics

- Market-data requests use native `fetch` (no CORS issues in React Native).
- App id / name: `com.kader.app` / "Kader".
- **eToro API-koppeling**: de gebruiker koppelt een read-only eToro API-sleutel via de wizard in [EtoroKoppelingWizard.tsx](app/src/components/EtoroKoppelingWizard.tsx); sleutels staan lokaal via [opslag.ts](app/src/storage/opslag.ts). [engine/etoro.ts](app/src/engine/etoro.ts) is de client: `importeerEtoroAlles()` haalt zowel open posities als de handelshistorie van het afgelopen jaar op. **`etoroFetch` moet een echte GUID sturen in de `x-request-id`-header** (via de `guid()`-helper, niet `nieuweId()`, dat laatste is base36 en gaf een 422). [engine/etoroLimieten.ts](app/src/engine/etoroLimieten.ts) valideert een voorgestelde stop-loss tegen eToro's eligibility-endpoint; dat endpoint heeft een eigen quotum van 20 requests/minuut, dus [useStopLossLimiet.ts](app/src/state/useStopLossLimiet.ts) cachet de limieten een dag in AsyncStorage. Zonder koppeling of bij een API-fout: geen waarschuwing tonen, een verzonnen grens is erger dan geen grens.
- Push notifications via `expo-notifications`: [meldingen.ts](app/src/notifications/meldingen.ts) currently only schedules a single daily reminder. The richer trade-aware logic (periodically check open trades and notify to raise take-profit / tighten stop-loss / exit early, with a repeat-suppression window) is **not built yet** -- see TODO.md.
- The APK is signed with the default debug key (fine for personal sideloading; Play Store would need a release keystore).

## Design context

Before any UI or design work, always read the following files first:

- `docs/app-beschrijving-voor-claude-design.md` -- screen-by-screen description, user flows, and copy
- `docs/huisstijl-kader.md` -- brand identity, colour palette, typography, tone of voice
- `Design system voor React Native app.zip` (repo root) -- component library, spacing tokens, UI patterns
- `docs/Logo.zip` -- official logo assets and usage rules

Tone: sober, helpful, Dutch, never hype-y; always carry the "not financial advice / check the live price on eToro" disclaimer.

## Team and Git workflow

Thom and Kevin both work on this project via Claude Code -- both write code and app features, not just design. Neither is a programmer; the AI does the writing.

See `docs/github-werkwijze.md` for the full agreed workflow. Key points:

- **`main` is always stable and installable.** Never commit work-in-progress directly to main.
- **One branch per task.** Create a branch before starting, merge via Pull Request when done.
- **Coordinate first.** Tell each other (chat/WhatsApp) what you're picking up before starting -- two Claude Code sessions working on the same files simultaneously creates hard-to-fix merge conflicts.
- **Before starting any session:** run `git fetch origin` and check `git log --all --oneline --graph` to see what the other person may have pushed.

## Plan mode

When using `/plan` to design a feature or task:
- **During exploration:** once it's clear what needs to be done, provide a model and effort recommendation for the next phase (further analysis, planning, implementation)
- **At plan completion:** always end the plan with a **model and effort recommendation** for execution

This ensures the chosen tools and reasoning depth match the complexity at each phase. See the global `CLAUDE.md` for guidance on the recommendation format.

## Version control & releases

Claude is in charge of version numbering and the changelog for this project.

- **Always update the changelog when a user-facing change lands**, both `CHANGELOG.md` (repo root) and the in-app source `app/src/changelog.ts` (used by the changelog screen and the "nieuw in deze versie" popup). Keep them in sync, newest entry first, Dutch text.
- **Claude decides the version number** (`app/app.json`, `version` field), following the existing `0.1.x` scheme unless told otherwise. **Bump the version number only when a release build is actually built**, not while features are still landing. Between releases, keep the version as-is and just keep the changelog up to date; assign the new number at build time.
- **Only build and publish a release APK to GitHub when explicitly asked.** Finishing a feature or a batch of fixes does not by itself warrant a release. If work has accumulated that would make a sensible release, ask the user whether they want one, don't just make it.
- **Always build the release APK via the `release-apk` skill (`npm run release:apk` in `app/`), never with a bare `expo run:android` or `gradlew assembleRelease`.** `app/android/` is gitignored and only regenerated by `expo prebuild`; a bare Gradle build reuses whatever is already there, so the native `versionCode` silently drifts behind `app.json` after a version bump. That drift broke installability of the 0.1.1 and 0.1.3 releases (see `CHANGELOG.md` 0.1.4) before anyone building locally would necessarily notice, since it only bites once someone else already has a newer versionCode installed. The `release-apk` skill forces a clean prebuild and verifies versionCode/versionName and the signing key before the APK is allowed to ship.
- **Never change the release signing key.** Every installed copy of Kader is signed with the same Expo debug key (`app/android/app/debug.keystore`, regenerated identically by every prebuild). Switching to a real release keystore would force every user to uninstall the app first, losing their local portfolio and traders data.

## Writing and language rules

These rules apply everywhere: code comments, UI strings, generated reports, documentation, and any other text in this project.

**No em-dashes.** Never use an em-dash (--) as punctuation. Use a comma, colon, semicolon, or plain hyphen instead. This includes output generated by code.

**No generic AI text.** Avoid hollow filler phrases like "Certainly!", "Great question!", "It's worth noting that...", "In conclusion...", or any other phrasing that reads like a template. Write like a person who knows what they're talking about and gets to the point.

Keep text direct, human, and in Dutch where the user sees it.
