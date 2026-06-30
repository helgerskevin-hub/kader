# TODO

Onze gezamenlijke takenlijst voor de Crypto Copy-Trading app.
We kunnen hier dingen aan toevoegen en afvinken terwijl we werken.

## Hoe werkt dit? (voor noobs 👍)

Dit is gewoon een tekstbestand. Elke taak is een regel die begint met `- [ ]`.

- `- [ ]` = nog te doen (leeg vakje)
- `- [x]` = klaar (afgevinkt)

Afvinken doe je door de spatie tussen de blokhaken te vervangen door een `x`.
Op GitHub en in veel editors zie je dan een echt aanvinkbaar vakje. ✅

Voeg gerust nieuwe taken toe onderaan de juiste sectie. Geen verkeerde manier — typ
gewoon een nieuwe regel die begint met `- [ ]`.

---

## 🔥 Nu mee bezig

_(Verplaats hier de taak waar we op dit moment aan werken, zodat we het overzicht houden.)_

- [ ] **Analyse-engine porten:** `engine.js` overzetten naar de Expo-app (`app/`) in TypeScript.
  Python `src/` blijft de referentie/"bron van waarheid" voor de berekeningen.

## 🎨 Huisstijl & Branding

- [x] EM-dashes verwijderd uit alle app-teksten (`App.tsx`, `README.md`)
- [x] App hernoemd naar **Kader** in alle bestanden (naam, slug, package-id `com.kevinhelgers.kader`)
- [x] Teksten en naamgeving aangepast op basis van `docs/huisstijl-kader.md` — slogan, tone of voice
- [x] Kader-logo gegenereerd en in `app/assets/` geplaatst (icon.png 1024×1024, splash-icon.png, adaptive icons, favicon)

## 💡 Ideeën / wensen

_(Dingen die je leuk of handig zou vinden, nog niet ingepland.)_

- [ ] Inloggen? Zo ja, database?
- [ ] Wens: portfolio uit eToro kunnen halen zodat je je trades niet zelf hoeft in te vullen
- [ ] Prijsalerts instellen: notificatie als een coin een zelf gekozen prijs bereikt
- [ ] Favorietenlijst: vaste coins markeren zodat ze altijd bovenaan de analyse staan
- [ ] Historisch overzicht gesloten trades met winst/verlies-statistieken (trefferpercentage, gem. R/R behaald)
- [ ] Dark/light mode

### 🎯 Kevins kernvisie voor Kader
_(Wat de app uiteindelijk moet zijn — de rode draad achter alle keuzes)_

- [ ] **"Wat moet ik nu kopen?"** — één duidelijk scherm dat simpel zegt welke coins op dit moment slim zijn om in te stappen. Geen ruis, geen uitleg, gewoon een aanbeveling + reden in één zin.
- [ ] **Zo makkelijk mogelijk kopen/verkopen** — vanuit de aanbeveling direct door naar de trade. Zo min mogelijk stappen tussen "ziet er goed uit" en "gekocht". Koppeling met eToro of een exchange-API is het einddoel.
- [ ] **Short/long met leverage** — ook hefboomposities ondersteunen in de analyse en het uitvoerscherm. Niet alleen spot. Kader moet aangeven of een coin beter geschikt is voor long of short op dat moment.
- [ ] **Grote whales kopiëren (Trump, Saylor, etc.)** — toon wat bekende grote spelers op dit moment kopen of houden, en maak het met één tik mogelijk om hetzelfde te doen. Niet alleen informatief, maar direct uitvoerbaar. Dit is het onderscheidende idee van Kader t.o.v. andere apps.

### 💡 Inspiratie van Market Mirror (concurrent)
_(Gevonden op marketmirror.com — functies die het overwegen waard zijn voor Kader)_

- [ ] **Liquidatiekaart**: visualiseer waar de grote liquidatieniveaus liggen (longs vs. shorts) — geeft aan waar cascade-bewegingen kunnen starten. Nuttig als extra context bij een kans-signaal. Databron: Coinglass API (gratis tier beschikbaar).
- [ ] **Marktpulsscore uitbreiden**: Market Mirror weegt 8 live-inputs in één score (whale-activiteit, liquidaties, funding rates, Fear & Greed, ETF-flows, crowd-consensus). Kader heeft al een eigen score (0–100) — die kunnen we verrijken met funding rate en Fear & Greed als extra inputs.
- [ ] **ETF-flow tracking**: toon of er netto geld in- of uitstroomt bij BTC/ETH ETF's (bijv. BlackRock IBIT). Sterke institutionele instroom = bullish signaal. Databron: bijv. The Block of Farside Investors (scrapeable).
- [ ] **Fear & Greed Index**: prominenter tonen op het marktscherm als extra context naast de Kader-score. API van Alternative.me is gratis.
- [ ] **Whale-wallettracking**: volg bekende grote wallets (bijv. Michael Saylor, exchange cold wallets) en toon wat ze kopen/verkopen. Nuttig als bevestiging bij een signaal. Databron: Etherscan / blockchain.info API.
- [ ] **Social sentimentscore per coin**: aggregeer sentiment van X/Twitter en Reddit tot één score per coin. Geeft aan of retail bullish of bearish is — handig als contra-indicator. Mogelijke API: LunarCrush.
- [ ] **Pushmelding bij grote whale-trade**: stuur een notificatie als een bekende wallet of exchange een grote positie opent in een coin die je volgt. Market Mirror doet dit live ("Whale opened $112K ETH LONG").
- [ ] **Freemium-model als referentie**: Market Mirror rekent gratis / $9,99 / $29,99 per maand. Als Kader ooit betaald wordt, is dit een realistische bandbreedte voor crypto-apps.

## 🛠️ Te doen

### Migratie naar native app (React Native + Expo)
- [x] Kale Expo-app opzetten + lokaal een installeerbare APK bouwen (bewijs dat de gratis bouw-/sideload-loop werkt). JDK 17 bleek niet nodig — Android Studio's JBR (OpenJDK 21) volstaat. Project staat in `app/`, gebouwd vanuit `D:\dev\crypto-market`.
- [x] Analyse-engine porten: Python-logica uit `src/` overzetten naar TypeScript-modules in `app/`. Prioriteit: `cryptoAnalyzer.ts`, `etoroAuditor.ts`, `coinInfo.ts`.
- [x] Navigatiestructuur opzetten (React Navigation): Tab-navigatie met Marktanalyse, Grote kansen, Mijn Trades, Traders.
- [x] Schermen bouwen — volledig functioneel:
  - [x] **Marktanalyse-scherm** — lijst met trade-kaarten (entry / stop / take profit / score)
  - [x] **Grote Kansen-scherm** — momentum-scanner resultaten
  - [x] **Mijn Trades-scherm** — open posities met live prijs + advies (HOUD/VERKOOP/WINST)
  - [x] **eToro Traders-scherm** — traders toevoegen, beoordelen (GROEN/GEEL/ROOD) en hun posities bekijken
  - [x] **Onboarding-scherm** — eerste-keer uitleg: wat is de app, hoe werkt een stop loss, disclaimer
- [x] Lokale opslag aansluiten (AsyncStorage) voor traders en eigen posities
- [x] Pushmeldingen inschakelen (`expo-notifications`): seintje als stop loss of take profit van een eigen trade geraakt wordt
- [ ] Desktop-versie (Python `app.py` + `app_ui.py`) uitfaseren zodra de native app alle functies overneemt

### Functioneel / inhoud
- [x] **Live prijs-polling** op de Mijn Trades-pagina: automatisch vernieuwen elke 60 seconden (net als desktop-versie)
- [x] **eToro API** onderzoeken: kunnen we tradable coins automatisch ophalen zodat de Grote Kansen-scan alleen beschikbare coins toont? (opgelost via statische _ETORO_TRADABLE-set)
- [x] **Copy trading stappen** vereenvoudigen: stappenplan in de app hoe je een signaal op eToro uitvoert
- [x] **Portfoliosamenvatting**: totale inleg, huidige waarde en winst/verlies zichtbaar op het Mijn Trades-scherm

### Kwaliteit & stabiliteit
- [x] Bugrapport opgesteld + alle 9 bugs gefixed (zie `docs/bugrapport-2026-06-28.md`)
- [ ] Handmatige smoke-test checklist uitvoeren na elke grote wijziging (zie hieronder)
- [ ] Error boundary toevoegen in de Expo-app zodat één kapotte component niet de hele app neergooit
- [ ] Offline-modus: nette foutmelding als de telefoon geen internet heeft i.p.v. een lege pagina

### Smoke-test checklist (desktop web-UI)
_(Doorloop dit na elke wijziging aan `src/` om regressies te voorkomen.)_
- [ ] `python src/app.py` start zonder fouten, browser opent op `http://localhost:8765`
- [ ] Tab "Analyse" → "Start Analyse" geeft trade-kaarten terug (of nette leeg-melding)
- [ ] Tab "Analyse" → "Grote kansen" geeft coins terug met stop loss en take profit
- [ ] Tab "Analyse" → "Traders kopiëren" toont posities voor opgeslagen traders
- [ ] Tab "Analyse" → "Hoe werkt dit?" — score-simulator: RSI-opties en volume-opties sluiten elkaar uit
- [ ] Tab "Mijn Trades" → trade toevoegen, auto-vernieuwen, trade sluiten, verwijderen
- [ ] Tab "eToro Traders" → trader toevoegen, oordeel GROEN/GEEL/ROOD zichtbaar, verwijderen
- [ ] `python src/daily_report.py` schrijft een geldig markdown-bestand in `reports/`

## 🐛 Bugs / dingen die kapot zijn

_(Werkt iets niet zoals verwacht? Schrijf het hier op, ook al weet je nog niet waarom.)_

- _(geen open bugs — alle gevonden bugs zijn opgelost, zie `docs/bugrapport-2026-06-28.md`)_

## ✅ Klaar

_(Afgevinkte taken mogen hierheen verhuizen, zodat we kunnen terugzien wat we al gedaan hebben.)_

- [x] TODO-lijst aangemaakt 🎉
- [x] Techniekkeuze native app onderzocht → **React Native + Expo** ([`docs/native-app-techniekkeuze.md`](docs/native-app-techniekkeuze.md))
- [x] Kale Expo-app gebouwd en via ADB geverifieerd op emulator ("Hallo wereld — Crypto Markt — app werkt!"). Project verplaatst naar `D:\dev\crypto-market` (lokaal, geen netwerkdrive).
- [x] **Analyse-uitleg voor de gebruiker** (`feat/analyse-uitleg-ui`) — "📖 Hoe werkt dit?" subtab in `src/app_ui.py` met scorekaart, interactieve score-simulator, ATR-rekenmachine en visuele scorebalk + signaal-badges op elke analysekaart.
- [x] **Bugrapport + alle fixes** (`feat/analyse-uitleg-ui`) — 9 bugs gevonden en opgelost: race condition, dode R/R-filter, ongebruikte dependency, verkeerd kleur-veld, simulator-inconsistentie, niet-atomaire schrijfacties, NaN-check, gedupliceerde functie, deprecated mobile-map.
