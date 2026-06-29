# Techniekkeuze: native mobile app voor Crypto Copy-Trading

> Onderzoeksdocument (geen implementatieplan). Vraag van Thom: uitzoeken welke
> taal/technologie geschikt is om hier een echte **native** Android-app van te
> maken. Kevin pakt de UX/UI-keuzes.

## De situatie (wat de keuze stuurt)

- **Doel:** Android-only, één codebase, "voelt native" (weg van de huidige
  Capacitor/WebView-schil).
- **Team:** Thom en Kevin zijn **geen programmeurs** — dit is een AI-geassisteerd
  "vibecode" hobbyproject. De code wordt in de praktijk door de AI geschreven.
- **Bestaande bouwstenen:** de hele analyse-engine bestaat al twee keer — in
  **Python** (`src/`) en als **JavaScript** (`engine.js`, de versie die de huidige
  APK draait): marktdata ophalen (Binance/CoinGecko), RSI/EMA/MACD/ATR, scoring,
  grote-kansen-scanner, eToro-auditor.
- **Wrijving die we al raakten:** lokaal bouwen liep vast (geen JDK op PATH). Een
  route die het bouwen van een installeerbare APK simpel maakt, is veel waard.

➡️ Doorslaggevend voor een hobby-/vibecode-project zijn dus niet de "puurste"
prestaties, maar: **hoe goed kan de AI er code voor schrijven**, **hoe simpel is
bouwen/installeren**, en **hoeveel bestaand werk hergebruiken we**.

## De kandidaten

| Optie | Taal | Eén codebase? | Native gevoel | AI-geschiktheid | Hergebruik bestaande code |
|---|---|---|---|---|---|
| **React Native + Expo** | JS/**TypeScript** | Ja (Android nu, iOS later) | Goed (echt native widgets, geen WebView) | **Beste** (meeste trainingsdata) | **Hoog** — `engine.js` is al JS |
| **Flutter** | **Dart** | Ja | Zeer goed (UI-sterkste) | Goed, maar minder dan JS | Laag — herschrijven in Dart |
| Kotlin + Jetpack Compose | Kotlin | Nee (Android-only echt native) | Maximaal | Goed | Laag — herschrijven in Kotlin |
| Kotlin Multiplatform | Kotlin | Ja, maar complex | Maximaal | Matig (nieuwer) | Laag |
| .NET MAUI | C# | Ja | Redelijk | Zwakker (kleinere community) | Laag |

## Aanbeveling: **React Native + Expo** (met TypeScript)

Voor júllie specifieke situatie is dit de duidelijke winnaar. Waarom:

1. **Beste match met AI-geassisteerd werken.** JavaScript/TypeScript heeft veruit de
   meeste trainingsdata; AI schrijft hier de betrouwbaarste code. Voor een
   vibecode-project is dat de belangrijkste factor — het bepaalt hoe vaak het "in
   één keer goed" is. Dart (Flutter) heeft die voorsprong niet.
2. **Hergebruik van wat er al is.** De analyse-engine staat al in JavaScript
   (`engine.js`). In React Native (ook JS/TS) is dat **bijna 1-op-1 over te nemen**;
   bij Flutter/Kotlin moet alles opnieuw in een andere taal. Dat scheelt enorm veel
   werk én foutkansen.
3. **Bouwen is gratis en onbeperkt — lokaal.** Een Expo/RN-app bouw je lokaal met
   `npx expo run:android` of `gradlew assembleDebug`: **€0, geen wachtrij, geen
   limiet, offline**. Enige eenmalige horde: **JDK 17** installeren (de Android-SDK
   staat er al). De cloud-dienst **EAS** is optioneel: gratis tot 15 Android-builds
   p/m (lage-prioriteit-wachtrij), daarna betaald ($19/mnd+). EAS is dus alleen een
   uitwijk (lokale setup hapert, of later iOS bouwen zonder Mac) — niet de default.
4. **Echt native, geen WebView.** RN rendert echte native Android-componenten
   (geen `<div>` in een browser-schil). Met de moderne "New Architecture" (Hermes,
   Fabric) voelt en presteert het native — een echte stap vooruit t.o.v. nu.
5. **Eén codebase, iOS blijft open.** Android-only kan nu, maar dezelfde code draait
   later op iOS als jullie ooit willen (dan wel een Mac + Apple-account nodig).
6. **Officieel de aanbevolen startroute.** Expo is sinds 2025/2026 de door React
   Native zelf aanbevolen manier om een nieuw project te starten, met de grootste
   bibliotheek-ecosystem voor wat jullie nodig hebben.

### Past dit op jullie concrete behoeften?
- **Marktdata ophalen** (Binance/CoinGecko): standaard `fetch` in JS — werkt direct,
  geen CORS-gedoe meer zoals in de WebView.
- **Grafieken/candlesticks** (voor Kevin's UI): volwassen libraries beschikbaar
  (bv. `victory-native`, `react-native-wagmi-charts`).
- **Pushmeldingen** (de ~10-min trade-checks): `expo-notifications` (lokale
  notificaties) dekt precies de huidige functionaliteit.
- **Lokale opslag** (traders/trades): `expo-sqlite` of `react-native-mmkv`.

## Eerlijke kanttekeningen

- **Flutter is geen foute keuze** — als pixel-perfecte, zware UI/animaties later
  hét verkoopargument worden, levert Flutter de mooiste resultaten. Maar de prijs is:
  nieuwe taal (Dart), minder AI-vlotheid, en de bestaande JS-engine opnieuw
  schrijven. Voor een hobbyproject weegt dat niet op tegen de RN-voordelen.
- **"Native gevoel" is bij RN zeer goed, niet 100% puur.** Wil je het absolute
  maximum aan Android-integratie en kan iOS je niets schelen, dan is Kotlin +
  Jetpack Compose technisch superieur — maar dat is voor niet-programmeurs de
  steilste leercurve en levert geen iOS-optie op.
- **Het blijft een herbouw.** Welke optie dan ook: de UI wordt opnieuw gebouwd. Het
  goede nieuws is dat bij RN de *logica* (engine.js) grotendeels mee kan, dus de
  herbouw beperkt zich vooral tot de schermen — precies het stuk dat Kevin oppakt.

## Voorgestelde vervolgstappen (klein, hobby-passend)

1. **Beslissing bevestigen:** React Native + Expo + TypeScript (dit document met
   Kevin doornemen).
2. **Kale Expo-app opzetten** ("Hello world" → installeerbare APK, **lokaal
   gebouwd**), zodat de bouw-/sideload-loop werkt vóórdat we features bouwen.
   Eenmalig JDK 17 installeren (Android-SDK is er al). EAS alleen als uitwijk.
3. **Analyse-engine porten:** `engine.js` overzetten naar de Expo-app (grotendeels
   kopiëren + opschonen naar TS). De Python `src/` blijft de referentie/"bron van
   waarheid" voor de berekeningen.
4. **Schermen bouwen** op basis van Kevin's UX/UI-keuzes (Marktanalyse, Grote
   kansen, Mijn Trades, eToro-traders, onboarding).
5. **Pushmeldingen + lokale opslag** aansluiten (`expo-notifications`,
   `expo-sqlite`).

> Belangrijke afspraak die behouden blijft: alle gegenereerde tekst/UI in het
> **Nederlands**, sobere toon, en altijd de "geen financieel advies"-disclaimer
> (zie `CLAUDE.md`).

## Pointers voor Kevin (UX/UI)

Hoi Kevin — jij pakt de UX/UI. Een paar dingen die helpen nu we naar **React
Native** gaan (echte native componenten i.p.v. de WebView van nu):

- **Begin met de bestaande designcontext.** Lees `CONTEXT.md` en
  `docs/app-beschrijving-voor-claude-design.md`: daar staan het donkere
  "fintech/dashboard"-thema, de kleur-tokens en de schermen al beschreven. Die
  blijven het uitgangspunt; we herbouwen alleen de techniek eronder.
- **Stijl-/componentlaag kiezen** (bepaalt hoe "Android-native" het voelt):
  - *React Native Paper* — kant-en-klare Material Design 3 / "Material You"
    componenten, voelt het meest native op Android. Goede default.
  - *NativeWind* — Tailwind-achtig snel stylen met eigen tokens, meer vrijheid in
    de look. Fijn als je het dashboard-gevoel volledig zelf wil vormgeven.
  - (We hoeven dit niet nu te beslissen — maar het is dé eerste UX-keuze.)
- **Navigatie:** waarschijnlijk `react-navigation` met **bottom tabs** voor de
  hoofdschermen — Marktanalyse, Grote kansen, Mijn Trades, eToro-traders — plus
  een onboarding-flow ervoor. Native tab/stack-patronen i.p.v. zelfgebouwde tabs.
- **Schermen die herbouwd worden** (zelfde functies als nu): Marktanalyse, Grote
  kansen, Mijn Trades, eToro-traders, en (nieuw uit de TODO) **onboarding**.
- **Per scherm aan te leveren** (dit maakt AI-bouwen vlot en voorspelbaar):
  - de vier states: **leeg / laden / fout / gevuld**;
  - **tokens als concrete waarden** (kleuren-hex, spacing, font-sizes, radii) zodat
    ze 1-op-1 in code kunnen — Figma is top, maar nette schetsen + een tokenlijst
    volstaan ook;
  - iconenset/stijl.
- **Cijferleesbaarheid** is hier UX-kritisch: prijzen, R/R, percentages en de
  score (0–100). Denk aan tabulaire cijfers, consistente groen/rood-codering en
  duidelijke hiërarchie tussen entry-zone, 🛑 stop-loss en 🎯 take-profit.
- **Grafieken:** candlestick/lijn met de trade-niveaus erop (entry-zone, stop,
  take-profit). Bepaal welke datapunten écht nodig zijn — niet alles hoeft.
- **UX-kansen die al op de TODO staan** en mooi meegenomen kunnen worden:
  onboarding, copy-trading in makkelijkere stappen, en de **score (0–100)
  begrijpelijk uitleggen** in de UI.
- **Vaste kaders** (niet onderhandelbaar): UI-taal **Nederlands**, sobere/heldere
  toon (geen "to the moon"), en overal de **"geen financieel advies"**-disclaimer
  met verwijzing naar de live prijs op eToro.

## Bronnen
- React Native vs Flutter vs Expo (2026 vergelijking): https://www.groovyweb.co/blog/react-native-vs-flutter-vs-expo-vs-lynx-2026
- Flutter vs React Native 2026: https://www.bolderapps.com/blog-posts/flutter-vs-react-native-in-2026-why-the-new-architecture-and-impeller-2-0-changed-everything
- EAS Build (cloud-builds, geen lokale SDK nodig): https://docs.expo.dev/build/introduction/
- APK's bouwen met EAS: https://docs.expo.dev/build-reference/apk/
