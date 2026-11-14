# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Kader** is a personal crypto copy-trading analysis tool (not financial advice; it produces technical signals). It analyses free public market data and outputs concrete trades with a pre-computed entry, ATR-based stop-loss and take-profit (minimum 1:2 risk/reward), plus an eToro "Popular Investor" auditor. **All user-facing text is Dutch**: keep generated output, UI strings and comments in Dutch to match the existing code.

The project is a single Android app: React Native + Expo, located in `app/`. App id: `com.kader.app`.

## Commands

App (from `app/`):
```bash
npm install          # eerste keer
npx expo start       # Metro bundler + dev-client
npm run android      # bouw en installeer op aangesloten device/emulator
npx tsc --noEmit     # typecheck (de enige statische controle)
npm run release:apk  # release-APK, altijd via de release-apk skill, zie onder
```

Building the APK needs **JDK 17 exactly** (niet de JBR van Android Studio, die is nieuwer en daar compileert de build niet mee; Gradle eist `languageVersion=17`, zie de `run-android` skill) and the Android SDK with compileSdk/targetSdk 36 and NDK 27.1.12297006 (de waarden van React Native 0.85.3, `node_modules/react-native/gradle/libs.versions.toml`; `app.json` zet ze niet zelf). Set `JAVA_HOME` and `ANDROID_HOME` before building. Project must be on a local drive without spaces (e.g. `D:\dev`). Zie de skills `run-android` en `release-apk` voor de stappen en valkuilen.

Stack: Expo SDK 56, React Native 0.85, React 19, TypeScript 6. Expo's API is recent, dus [app/AGENTS.md](app/AGENTS.md) verwijst naar de versie-specifieke docs op `docs.expo.dev/versions/v56.0.0/`, lees die voor je Expo-code schrijft. Reanimated, worklets, Skia, gesture-handler, expo-haptics, expo-clipboard en de widget-bibliotheek (`react-native-android-widget`) zijn native deps: na het pullen van code die ze toevoegt of bijwerkt is één keer `npm run android` nodig (volledige rebuild), daarna volstaat hot reload weer.

There is **no test suite** and no linter configured. Verification is `npx tsc --noEmit` in `app/` plus de **`run-android`** skill om een wijziging op de emulator te verifiëren. Losse scripts in `app/scripts/` doen metingen en self-checks; het zijn geen suites: `backtest.ts` (`npm run backtest`), `meting-algoritme.ts`, `meting-kansen.ts`, `meting-markt.ts`, de `etoro-*.ts`-metingen (`npm run etoro:demo` plaatst een demo-order), `etoro-mock-server.ts` en `test-traderChecks.ts` (speelt `checkFavorieteTraders` na met nagebootste opslag; draaien met `npx tsx scripts/test-traderChecks.ts`). `bouw-release.mjs` is de release-build achter `npm run release:apk`.

## Architecture (`app/src/`)

Per map, alleen de bestanden die je moet kennen. De rest vind je met `ls`.

- **`engine/`**: alle marktlogica, geen UI. `index.ts` is een barrel-export.
  - Analyse: `analyzer.ts` (`analyseerMarkt()`, de hoofdanalyse), `opportunities.ts` (`zoekKansen()`, de "grote kansen"-scanner over een breder coin-set; losse bestanden, niet hetzelfde), `momentum.ts`, `drempels.ts` (alle score-drempels), `indicators.ts` (RSI/EMA/MACD/ATR/volume, met de hand geschreven zodat de tool blijft werken als een externe indicator-lib breekt), `bevestigingen.ts`, `correlatie.ts`, `relatieveSterkte.ts`, `marktklimaat.ts`, `naloopRustig.ts` (het Kader-mandje), `gemisteKansen.ts`, `signaalLog.ts`, `volglijstLog.ts`.
  - Data en weergave: `marketData.ts` (Binance klines + CoinGecko-fallback via native `fetch`, geen API-keys), `kaarsen.ts`, `grafiekBereik.ts`, `coinInfo.ts`, `coinDetailData.ts`, `format.ts`, `valuta.ts`, `spread.ts`, `planInGeld.ts`, `verdeling.ts`, `types.ts`.
  - eToro: `etoro.ts` (API-client), `etoroLimieten.ts`, `etoroSymbolen.ts`, `sleutelKeuze.ts`, `sleutelVorm.ts`, `koppelTest.ts`, `platforms.ts`; zie de eigen sectie hieronder.
  - Copy en traders: `copyTrading.ts`, `etoroTraders.ts`, `auditor.ts` (scoort een eToro-trader op consistentie, drawdown/return en concentratie naar een groen/geel/rood-oordeel).
- **`screens/`**: MarktScreen, KansenScreen, PortfolioScreen, CopyScreen (de Copy-tab), plus TradersScreen en OnboardingScreen. De vier tabs staan in `components/BottomNav.tsx` (`Tab = 'markt' | 'kansen' | 'portfolio' | 'copy'`, `TAB_VOLGORDE`); `App.tsx` toont ze in een swipebare pager (vinger-gestuurd, met een glijdende pil-indicator in de tabbalk). Een tab blijft gemount zodra hij bezocht is; niet-bezochte tabs worden vooruit gemount als de app na het opstarten stil is. Kansen start zijn scan pas als het scherm echt in beeld komt (`useTabZichtbaar`).
- **`components/`**: herbruikbare UI, met submappen `copy/` (Copy-tab: trader-kaarten, profiel, kopieer-flow), `grafiek/`, `informatie/` (uitleg-visualisaties; de teksten staan in `src/informatie/hoofdstukken.ts`), `lijst/` en `order/`. Drie die je moet kennen voor nieuwe schermen: `BottomSheet.tsx` is de gedeelde sheet-basis (sleepbaar dicht aan de bovenrand, sluit ook op backdrop-tik, houdt rekening met de Android-gesturebalk) en moet hergebruikt worden voor elke nieuwe sheet in plaats van een kale `Modal`; `PodiumScherm.tsx` is de gedeelde basis voor full-screen views (transparante Modal die met een card-grow vanuit `bronRect` opent en met swipe-terug vanaf de linkerrand sluit) en moet hergebruikt worden voor elk nieuw full-screen scherm in plaats van een kale `Modal`, zie `CoinDetailScherm.tsx`, `AchtergrondScherm.tsx` en `HistorieScherm.tsx`; `ScreenHeader.tsx` draagt het boek- en tandwiel-icoon op elk scherm. Verder `FoutGrens.tsx` (error boundary).
- **`state/`**: de data-providers (React Context) zijn genest in `App.tsx`: `MarktProvider` > `KansenProvider` > `PortfolioProvider` > `DialoogProvider` > `CopyProvider` (naast `ThemeProvider` en `NavigatieProvider`). PortfolioProvider regelt ook de eToro-sync (bij app-start buiten een cooldown, bij swipe, bij de eToro-knop); CopyProvider koppelt kopieën aan je eToro-posities. De rest zijn helpers per thema: portfolio (`portfolioTypes.ts`, `statistieken.ts`, `portfolioWaarde.ts`, `syncStatus.ts`, `advies.ts`), risico en kapitaal (`openRisico.ts`, `handelskapitaal.ts`, `verliesRem.ts`, `bearModus.ts`), eToro (`etoroSleutels.ts`, `useStopLossLimiet.ts`, `lopendeOrders.ts`), copy (`copyOpslag.ts`, `mijnCopies.ts`, `useCopyPlafond.ts`), widget (`widgetStand.ts`, `widgetWeergave.ts`), meldingen (`meldingSchakelaar.ts`, `meldingVoorkeur.ts`, `prijsalerts.ts`) en `use*`-hooks zoals `useFavorieten.ts`.
- **`widget/`**: Android-homescreen-widget (`react-native-android-widget`): `KaderWidget.tsx` (de weergave), `widgetTaak.ts` (de taak-handler) en `widgetVerversen.ts`. De widget is geregistreerd in `app.json` onder de plugins.
- **`storage/opslag.ts`**: AsyncStorage-wrapper voor traders, portfolio, eToro-sleutels en formulierconcepten (`laadObject`/`bewaarObject`), met de `SLEUTELS`.
- **`notifications/`**: push notifications via `expo-notifications`: `meldingen.ts`, `tradeChecks.ts`, `traderChecks.ts` (meldingen over gevolgde traders), `achtergrondtaak.ts`, `weekrapport.ts`; zie hieronder.
- **`theme/`**: tokens, typography, ThemeProvider (system/light/dark mode), plus `useToetsenbordHoogte`. `beweging.ts` heeft de motion-tokens (veren, duren, curves, stagger) waar elke animatie uit hoort te putten in plaats van losse ms-waarden; `useReduceMotion`/`useBeweging` (beide in `useReduceMotion.ts`) geven daarbovenop automatisch het Apple-gedrag bij Android's "Minder beweging" terug. `haptiek.ts` is de enige plek die `expo-haptics` rechtstreeks aanroept (benoemde momenten zoals `tik`, `succes`, `drempel`). `lijstBeweging.ts` levert de layout-overgangen voor lijsten en uitklappers (Reanimated, niet `LayoutAnimation`).
- **`changelog.ts`**: in-app changelogbron voor het changelog-scherm en de "nieuw in deze versie"-popup, moet in sync blijven met `CHANGELOG.md`.

### Key tunables (`app/src/engine/analyzer.ts`, drempels in `app/src/engine/drempels.ts`)
`STANDAARD_UNIVERSUM` (148 coins: alles wat eToro als koopbaar opgeeft en een Binance-USDT-paar heeft; de klimaatbreedte en de meetscripts gebruiken `KLIMAAT_UNIVERSUM`, de oorspronkelijke 57), `SWING_PERIODE` (10, lookback voor de swing-low stop), `REWARD_MULTIPLIER` (3.0, take-profit), `MIN_RISK_REWARD` (2.0). De default `topN` in `analyseerMarkt()` is 20. De scan haalt coins op in parallelle blokken van 6 (`GELIJKTIJDIG`), niet één voor één. De stop wordt net onder de recente swing low geplaatst (`stopAfstandStructuur`, swing low minus een buffer van 0,1x ATR), geclamped op een 0.5x-3x ATR-band zodat hij niet ruis-krap en niet absurd ver is; take-profit = `entry + 3xATR`. R/R = reward / stop-afstand verschilt daarom **per coin**, en coins onder `MIN_RISK_REWARD` worden gefilterd. Score 0-100 beloont uptrend (EMA20>EMA50), koers boven EMA20, gezonde RSI, bullish MACD en volumepieken. De drempels staan op een plek in `drempels.ts`: `DREMPEL_KOOP` 55, `DREMPEL_STERK_KOOP` 72, `HIGH_CONVICTION_SCORE` 75. High conviction is score 75+ samen met R/R >= minimum, EMA20>EMA50, bullish MACD en volume >= `HIGH_CONVICTION_VOLUME_MIN` (1,3x het gemiddelde), alleen in het momentum-profiel. Het omkeerprofiel (alleen de backtest) gebruikt `REWARD_MULTIPLIER_OMKEER` (2x ATR) en `STOP_CAP_OMKEER` (1x ATR).

**Sinds november 2026 (meting M en N in `docs/metingen.md`):** de niveaus hierboven zijn wat `scoorCandles()` teruggeeft, en daar rekenen `scripts/backtest.ts` en de checks op open posities nog mee. Wat de app op Markt en Kansen TOONT is iets anders: `analyseerMarkt()` en `zoekKansen()` rekenen de score op de laatste afgesloten dag (`splitsLopendeDag`) en zetten daar het plan op dat eToro's kosten van 1% per kant draagt, stop 3x ATR en doel 3R (`radarNiveaus` in `momentum.ts`, `metPlan` in `analyzer.ts`). Kooplabels (KOOP, STERK KOOP, BEVESTIGD) staan uit via `LABEL_KOOP_BEWEZEN` en `LABEL_STERK_BEWEZEN` in `drempels.ts`, omdat ze na kosten hun lat niet haalden; het ruwe signaal blijft in `ruwSignaal` voor het trackrecord. **De koopknop blijft altijd**: handelen vanuit Kader is het doel, advies alleen waar het bewezen is. Nieuwe metingen horen in `scripts/meting-kansen.ts` of `scripts/meting-markt.ts`, met kosten en een aparte toetsperiode, en met de beslisregels vooraf vastgelegd (zie `docs/markt-kosten-plan.md`).

## App specifics

- Market-data requests use native `fetch` (no CORS issues in React Native).
- App id / name: `com.kader.app` / "Kader".
- **eToro API-koppeling**: de gebruiker koppelt een eToro API-sleutel via de wizard in [EtoroKoppelingWizard.tsx](app/src/components/EtoroKoppelingWizard.tsx). **eToro geeft precies een sleutel uit die zowel demo als echt bestuurt** (gemeten, zie `docs/etoro-direct-handelen-plan.md` 9a), dus Kader bewaart een sleutelpaar; de Demo/Echt-schakelaar kiest alleen het PAD, en dat pad is het enige dat speelgeld van echt geld scheidt. Het schrijfrecht blijft wel per omgeving, want de scopes kunnen per omgeving verschillen. Sleutels lopen via [etoroSleutels.ts](app/src/state/etoroSleutels.ts) en staan in expo-secure-store (niet in AsyncStorage, dat gaat mee in Android's back-up); de keuzelogica staat puur (zonder React of opslag) in [sleutelKeuze.ts](app/src/engine/sleutelKeuze.ts), maar is niet door een testscript gedekt. Naast lezen kan de app ook orders plaatsen, altijd pas na een expliciete bevestiging per order. [engine/etoro.ts](app/src/engine/etoro.ts) is de client: `importeerEtoroAlles()` haalt zowel open posities als de handelshistorie van het afgelopen jaar op. **`etoroFetch` moet een echte GUID sturen in de `x-request-id`-header** (via de `guid()`-helper, niet `nieuweId()`, dat laatste is base36 en gaf een 422). [engine/etoroLimieten.ts](app/src/engine/etoroLimieten.ts) valideert een voorgestelde stop-loss tegen eToro's eligibility-endpoint; dat endpoint heeft een eigen quotum van 20 requests/minuut, dus [useStopLossLimiet.ts](app/src/state/useStopLossLimiet.ts) cachet de limieten een dag in AsyncStorage. Zonder koppeling of bij een API-fout: geen waarschuwing tonen, een verzonnen grens is erger dan geen grens.
- Push notifications via `expo-notifications`: [meldingen.ts](app/src/notifications/meldingen.ts) doet de dagelijkse herinnering en `stuurTradeMelding()`. De trade-bewuste logica zit in [tradeChecks.ts](app/src/notifications/tradeChecks.ts) (`checkOpenTrades()`): per open trade verse candles via `haalData` + `scoorCandles({ minRR: 0 })`, plus de MACD-histogram-helling voor "momentum sterk / vlakt af". Twee aanroepers delen die functie en dus ook de herhaal-suppressie in AsyncStorage (`SLEUTELS.meldingSuppressie` (in `storage/opslag.ts`), een hard venster van zes uur per trade+trigger; de oude uitzondering bij >2% niveau-drift is weg omdat die op ruis steeds opnieuw meldde): de prijs-poll in `PortfolioProvider` (elke 5 min, alleen op de voorgrond) en de `expo-background-task`-taak in [achtergrondtaak.ts](app/src/notifications/achtergrondtaak.ts). **`TaskManager.defineTask` moet op module-niveau blijven staan** en `App.tsx` moet dat bestand bovenaan importeren, anders bestaat de taak niet als Android de app ervoor wakker maakt. Android's ondergrens is 15 minuten en het systeem kiest zelf het moment, dus "elke 10 minuten" is niet haalbaar. De checks gaan uit van long: `PortfolioTrade` heeft geen richting-veld. [traderChecks.ts](app/src/notifications/traderChecks.ts) doet hetzelfde voor de traders die je volgt (meldingen over hun nieuwe posities en sluitingen).
- The APK is signed with the default debug key (fine for personal sideloading; Play Store would need a release keystore).

## Design context

Before any UI or design work, always read the following files first:

- `docs/app-beschrijving-voor-claude-design.md`: screen-by-screen description, user flows, and copy
- `docs/huisstijl-kader.md`: brand identity, colour palette, typography, tone of voice
- `Design system voor React Native app.zip` (repo root): component library, spacing tokens, UI patterns
- `docs/Logo.zip`: official logo assets and usage rules

Tone: sober, helpful, Dutch, never hype-y; always carry the disclaimer "Geen financieel advies. De koers op eToro kan afwijken." (Kader uses public market data, eToro has its own price plus spread, so the disclaimer says why to check, not just that you should).

## Team and Git workflow

Thom and Kevin both work on this project via Claude Code: both write code and app features, not just design. Neither is a programmer; the AI does the writing.

See `docs/github-werkwijze.md` for the full agreed workflow. Key points:

- **`main` is always stable and installable.** Never commit work-in-progress directly to main. Branch altijd af van `main`; de branch `development` op origin is verouderd en uiteengelopen (laatste commit 25 sep 2026, 286 commits achter op main, 12 eigen commits die niet in main zitten); gebruik hem niet als basis.
- **One branch per task.** Create a branch before starting, merge via Pull Request when done.
- **Coordinate first.** Tell each other (chat/WhatsApp) what you're picking up before starting, because two Claude Code sessions working on the same files simultaneously creates hard-to-fix merge conflicts.
- **Before starting any session:** run `git fetch origin` and check `git log --all --oneline --graph` to see what the other person may have pushed.

## Version control & releases

Claude is in charge of version numbering and the changelog for this project.

- **Always update the changelog when a user-facing change lands**, both `CHANGELOG.md` (repo root) and the in-app source `app/src/changelog.ts` (used by the changelog screen and the "nieuw in deze versie" popup). Keep them in sync, newest entry first, Dutch text.
- **Claude decides the version number** (`app/app.json`, `version` field), following the existing `0.1.x` scheme unless told otherwise. **Bump the version number only when a release build is actually built**, not while features are still landing. Between releases, keep the version as-is and just keep the changelog up to date; assign the new number at build time.
- **Only build and publish a release APK to GitHub when explicitly asked.** Finishing a feature or a batch of fixes does not by itself warrant a release. If work has accumulated that would make a sensible release, ask the user whether they want one, don't just make it.
- **Always build the release APK via the `release-apk` skill (`npm run release:apk` in `app/`), never with a bare `expo run:android` or `gradlew assembleRelease`.** `app/android/` is gitignored and only regenerated by `expo prebuild`; a bare Gradle build reuses whatever is already there, so the native `versionCode` silently drifts behind `app.json` after a version bump. That drift broke installability of the 0.1.1 and 0.1.3 releases (see `CHANGELOG.md` 0.1.4) before anyone building locally would necessarily notice, since it only bites once someone else already has a newer versionCode installed. The `release-apk` skill forces a clean prebuild and verifies versionCode/versionName and the signing key before the APK is allowed to ship.
- **Never change the release signing key.** Every installed copy of Kader is signed with the same Expo debug key (`app/android/app/debug.keystore`, regenerated identically by every prebuild). Switching to a real release keystore would force every user to uninstall the app first, losing their local portfolio and traders data.

## Writing and language rules

These rules apply everywhere: code comments, UI strings, generated reports, documentation, and any other text in this project. (Het verbod op em-dashes staat in de globale instructies en geldt ook voor tekst die code genereert.)

**No generic AI text.** Avoid hollow filler phrases like "Certainly!", "Great question!", "It's worth noting that...", "In conclusion...", or any other phrasing that reads like a template. Write like a person who knows what they're talking about and gets to the point.

Keep text direct, human, and in Dutch where the user sees it.
