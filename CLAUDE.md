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
```

Building the APK needs JDK 17+ (Android Studio's JBR volstaat) and the Android SDK (platform 35+). Set `JAVA_HOME` and `ANDROID_HOME` before building. Project must be on a local drive without spaces (e.g. `C:\dev`).

There is **no test suite** and no linter configured.

## Architecture (`app/src/`)

- `engine/analyzer.ts` -- the main engine. Fetches OHLCV from **Binance** public klines (multiple base URLs for geo-redundancy) with a **CoinGecko fallback**; no API keys. Indicators (RSI, EMA 20/50, MACD, ATR, volume spikes) are computed by hand so the tool keeps working if external indicator libs change. `analyseerMarkt()` returns a ranked list of trade objects. Also contains the "grote kansen" scanner over a wider coin set.
- `engine/auditor.ts` -- scores an eToro trader (consistency, drawdown/return ratio, portfolio concentration) and outputs a 🟢/🟡/🔴 verdict + recommended Copy Stop Loss %.
- `engine/coinInfo.ts` -- per-coin descriptions + a technical buy-advice badge derived from live indicators.
- `engine/marketData.ts` -- data-fetching layer (Binance + CoinGecko via native `fetch`).
- `engine/indicators.ts` -- indicator maths (RSI, EMA, MACD, ATR, volume).
- `engine/opportunities.ts` -- grote-kansen scanner.
- `engine/coinDetailData.ts` -- data assembly for the coin-detail screen; `engine/format.ts` -- number/currency formatting; `engine/types.ts` -- shared engine types.
- `screens/` -- five screens: MarktScreen, KansenScreen, PortfolioScreen, TradersScreen, OnboardingScreen.
- `components/` -- reusable UI (TradeCard, PrijsGrafiek, ScoreBadge, AdviceBadge, AngstHebzucht/Fear&Greed, FoutGrens error boundary, OfflineMelding, ChangelogSheet, InstellingenSheet) plus two full-screen views: `CoinDetailScherm.tsx` and `AchtergrondScherm.tsx` (uitleg over score en indicatoren).
- `state/` -- MarktProvider, PortfolioProvider (React Context); `advies.ts`, `statistieken.ts` (portfolio stats), `useFavorieten.ts`, `portfolioTypes.ts`.
- `storage/opslag.ts` -- AsyncStorage wrapper for traders and portfolio.
- `notifications/meldingen.ts` -- push notifications via `expo-notifications`.
- `theme/` -- tokens, typography, ThemeProvider (system/light/dark mode).

### Key tunables (`app/src/engine/analyzer.ts`)
`STANDAARD_UNIVERSUM` (coins analysed), `ATR_STOP_MULTIPLIER` (1.5, stop distance), `REWARD_MULTIPLIER` (3.0, take-profit), `MIN_RISK_REWARD` (2.0), `HIGH_CONVICTION_SCORE` (75). Stop = `entry - 1.5xATR`, take-profit = `entry + 3xATR`, giving R/R >= 1:2; coins below the R/R threshold are filtered out. Score 0-100 rewards uptrend (EMA20>EMA50), price above EMA20, healthy RSI, bullish MACD and volume spikes.

## App specifics

- Market-data requests use native `fetch` (no CORS issues in React Native).
- App id / name: `com.kader.app` / "Kader".
- Push notifications via `expo-notifications`: every ~10 min the app checks open trades and notifies to raise take-profit (price near TP, momentum strong) or raise stop-loss / exit early (in profit but momentum flattening). Same alert repeats at most once per ~6h unless the suggested level moves >2%.
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

## Version control & releases

Claude is in charge of version numbering and the changelog for this project.

- **Always update the changelog when a user-facing change lands**, both `CHANGELOG.md` (repo root) and the in-app source `app/src/changelog.ts` (used by the changelog screen and the "nieuw in deze versie" popup). Keep them in sync, newest entry first, Dutch text.
- **Claude decides the version number** (`app/app.json`, `version` field) for the next release, following the existing `0.0.x` scheme unless told otherwise.
- **Only build and publish a release APK to GitHub when explicitly asked.** Finishing a feature or a batch of fixes does not by itself warrant a release. If work has accumulated that would make a sensible release, ask the user whether they want one, don't just make it.

## Writing and language rules

These rules apply everywhere: code comments, UI strings, generated reports, documentation, and any other text in this project.

**No em-dashes.** Never use an em-dash (--) as punctuation. Use a comma, colon, semicolon, or plain hyphen instead. This includes output generated by code.

**No generic AI text.** Avoid hollow filler phrases like "Certainly!", "Great question!", "It's worth noting that...", "In conclusion...", or any other phrasing that reads like a template. Write like a person who knows what they're talking about and gets to the point.

Keep text direct, human, and in Dutch where the user sees it.
