# Architectuur van de Kader-app

Naslag voor wie aan de code werkt. De valkuilen die altijd gelden staan in `CLAUDE.md`; dit bestand heeft het overzicht per map.
Lees het voor je aan een onbekend deel van `app/src/` begint.

## Mappen (`app/src/`)

- **`engine/`**: alle marktlogica, geen UI. `analyzer.ts` (`analyseerMarkt()`, de hoofdanalyse) en `opportunities.ts` (`zoekKansen()`, de "grote kansen"-scanner over een breder coin-set) zijn losse bestanden, niet hetzelfde. `auditor.ts` scoort een eToro-trader (consistentie, drawdown/return, concentratie) naar een 🟢/🟡/🔴-oordeel. `etoro.ts` en `etoroLimieten.ts` zijn de eToro API-client, zie hieronder. `indicators.ts` (RSI/EMA/MACD/ATR/volume, met de hand geschreven zodat de tool blijft werken als een externe indicator-lib breekt) en `marketData.ts` (Binance klines + CoinGecko-fallback via native `fetch`, geen API-keys) zijn de databasis. Verder `coinInfo.ts`, `coinDetailData.ts`, `format.ts`, `types.ts`. `index.ts` is een barrel-export.
- **`screens/`**: MarktScreen, KansenScreen, PortfolioScreen, TradersScreen, OnboardingScreen. `BottomNav.tsx` (in `components/`) is de tabbalk; de tabs zitten in een swipebare pager in `App.tsx` (vinger-gestuurd, met een glijdende pil-indicator in de tabbalk).
- **`components/`**: herbruikbare UI. `BottomSheet.tsx` is de gedeelde sheet-basis (sleepbaar dicht aan de bovenrand, sluit ook op backdrop-tik, houdt rekening met de Android-gesturebalk). `PodiumScherm.tsx` is de gedeelde basis voor full-screen views (transparante Modal die met een card-grow vanuit `bronRect` opent en met swipe-terug vanaf de linkerrand sluit), zie `CoinDetailScherm.tsx`, `AchtergrondScherm.tsx` en `HistorieScherm.tsx`. `ScreenHeader.tsx` draagt het boek- en tandwiel-icoon op elk scherm. Verder `FoutGrens.tsx` (error boundary).
- **`state/`**: MarktProvider en PortfolioProvider (React Context). PortfolioProvider regelt ook de eToro-sync (bij app-start buiten een cooldown, bij swipe, bij de eToro-knop). Verder `advies.ts`, `statistieken.ts` (portfolio stats), `syncStatus.ts`, `useFavorieten.ts`, `useStopLossLimiet.ts`, `portfolioTypes.ts`.
- **`storage/opslag.ts`**: AsyncStorage-wrapper voor traders, portfolio en formulierconcepten (`laadObject`/`bewaarObject`).
- **`notifications/meldingen.ts`**: push notifications via `expo-notifications`.
- **`theme/`**: tokens, typography, ThemeProvider (system/light/dark mode), plus `useToetsenbordHoogte`. `beweging.ts` heeft de motion-tokens (veren, duren, curves, stagger); `useReduceMotion`/`useBeweging` geven automatisch het Apple-gedrag bij Android's "Minder beweging". `haptiek.ts` heeft benoemde momenten zoals `tik`, `succes`, `drempel`. `lijstBeweging.ts` levert de layout-overgangen voor lijsten en uitklappers (Reanimated, niet `LayoutAnimation`).
- **`changelog.ts`**: in-app changelogbron voor het changelog-scherm en de "nieuw in deze versie"-popup.

## Analyse-instellingen (`app/src/engine/analyzer.ts`)

`STANDAARD_UNIVERSUM` (57 coins, dezelfde lijst als op eToro handelbaar is), `SWING_PERIODE` (10, lookback voor de swing-low stop), `REWARD_MULTIPLIER` (3.0, take-profit), `MIN_RISK_REWARD` (2.0), `HIGH_CONVICTION_SCORE` (75). Default `topN` in `analyseerMarkt()` is 20. De scan haalt coins op in parallelle blokken van 6 (`GELIJKTIJDIG`), niet een voor een.

De stop komt net onder de recente swing low (`stopAfstandStructuur`), geclamped op een 0.5x-3x ATR-band zodat hij niet ruis-krap en niet absurd ver is; take-profit = `entry + 3xATR`. R/R = reward / stop-afstand verschilt daarom **per coin**, en coins onder `MIN_RISK_REWARD` worden gefilterd. Score 0-100 beloont uptrend (EMA20>EMA50), koers boven EMA20, gezonde RSI, bullish MACD en volumepieken.

## eToro-koppeling

De gebruiker koppelt een eToro API-sleutel via de wizard in `app/src/components/EtoroKoppelingWizard.tsx`. eToro geeft precies een sleutel uit die zowel demo als echt bestuurt (gemeten, zie `docs/etoro-direct-handelen-plan.md` 9a), dus Kader bewaart een sleutelpaar; de Demo/Echt-schakelaar kiest alleen het PAD. Het schrijfrecht blijft per omgeving, want de scopes kunnen per omgeving verschillen. Sleutels lopen via `app/src/state/etoroSleutels.ts`; de keuzelogica staat als pure functie in `app/src/engine/sleutelKeuze.ts`.

Naast lezen kan de app orders plaatsen, altijd pas na een expliciete bevestiging per order. `engine/etoro.ts` is de client: `importeerEtoroAlles()` haalt open posities en de handelshistorie van het afgelopen jaar op. `engine/etoroLimieten.ts` valideert een voorgestelde stop-loss tegen eToro's eligibility-endpoint (eigen quotum van 20 requests/minuut), daarom cachet `useStopLossLimiet.ts` de limieten een dag in AsyncStorage.

## Meldingen

`app/src/notifications/meldingen.ts` doet de dagelijkse herinnering en `stuurTradeMelding()`. De trade-bewuste logica zit in `tradeChecks.ts` (`checkOpenTrades()`): per open trade verse candles via `haalData` + `scoorCandles({ minRR: 0 })`, plus de MACD-histogram-helling voor "momentum sterk / vlakt af".

Twee aanroepers delen die functie en dus ook de herhaal-suppressie in AsyncStorage (`SLEUTELS.meldingSuppressie`, een hard venster van zes uur per trade+trigger; de oude uitzondering bij >2% niveau-drift is weg omdat die op ruis steeds opnieuw meldde): de prijs-poll in `PortfolioProvider` (elke 5 min, alleen op de voorgrond) en de `expo-background-task`-taak in `achtergrondtaak.ts`. Android's ondergrens is 15 minuten en het systeem kiest zelf het moment. De checks gaan uit van long: `PortfolioTrade` heeft geen richting-veld.
