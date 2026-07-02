# TODO

Onze gezamenlijke takenlijst voor de Kader app.
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

## 🎨 Huisstijl & Branding

- [x] EM-dashes verwijderd uit alle app-teksten (`App.tsx`, `README.md`)
- [x] Teksten en naamgeving aangepast op basis van `docs/huisstijl-kader.md` — slogan, tone of voice
- [x] Kader-logo gegenereerd en in `app/assets/` geplaatst (icon.png 1024×1024, splash-icon.png, adaptive icons, favicon)

## 💡 Ideeën / wensen

_(Dingen die je leuk of handig zou vinden, nog niet ingepland.)_

- [ ] Inloggen? Zo ja, database?
- [ ] Wens: portfolio uit eToro kunnen halen zodat je je trades niet zelf hoeft in te vullen
- [ ] Prijsalerts instellen: notificatie als een coin een zelf gekozen prijs bereikt
- [x] Favorietenlijst: vaste coins markeren zodat ze altijd bovenaan de analyse staan
- [ ] Historisch overzicht gesloten trades met winst/verlies-statistieken (trefferpercentage, gem. R/R behaald)
- [x] Dark/light mode: systeem/licht/donker via een tandwiel-icoon in de header, opgeslagen op het toestel
- [ ] Op het niet fullscreen scherm meer informatie bieden over waarom kopen.
- [ ] **Coin detail-scherm full screen met grafieken**: Bij klikken op een coin opent een full-screen detail-pagina met veel meer informatie en grafieken (inspiratie: Market Mirror). Ook gewenst op portfolio kaart, oppakken samen met meer informatie over de status idee.
- [ ] **Meer informatie op Grote Kansen-scherm**: Het huidige scherm mist nog details. Voeg relevante info toe voor betere besluitvorming
- [ ] **Meer informatie over de status van de trade met onderbouwing op vast houden/verkopen in je portfolio**: Bij het klikken op de trade in portfolio zie je in het full screen venster meer gedailteerde informatie
- [ ] **Changelog in app**: Onder het settings menu een knop om de changelog bij te houden wat er allemaal veranderd is per versie. Plus bij de eerste keer opstarten van de app een pop-up window met informatie wat er nieuw is in deze versie. Direct meenemen dat er een uitgebreide changelog wordt bijgehouden in project folder als changelog.md

### 🎯 Kevins kernvisie voor Kader
_(Wat de app uiteindelijk moet zijn — de rode draad achter alle keuzes)_

- [x] **Schuivende marktbalk (zoals Market Mirror)** — een horizontale balk van rood naar groen (HEAVY SELL → BALANCED → HEAVY BUY) met een schuifknop die de huidige Kader-score aangeeft. In één oogopslag zie je waar de markt staat. Zit al in de huisstijlkleuren, hoeft alleen gebouwd te worden op het marktscherm.
- [ ] **"Wat moet ik nu kopen?"** — één duidelijk scherm dat simpel zegt welke coins op dit moment slim zijn om in te stappen. Geen ruis, geen uitleg, gewoon een aanbeveling + reden in één zin.
- [ ] **Zo makkelijk mogelijk kopen/verkopen** — vanuit de aanbeveling direct door naar de trade. Zo min mogelijk stappen tussen "ziet er goed uit" en "gekocht". Koppeling met eToro of een exchange-API is het einddoel.
- [ ] **Short/long met leverage** — ook hefboomposities ondersteunen in de analyse en het uitvoerscherm. Niet alleen spot. Kader moet aangeven of een coin beter geschikt is voor long of short op dat moment.
- [ ] **Grote whales kopiëren (Trump, Saylor, etc.)** — toon wat bekende grote spelers op dit moment kopen of houden, en maak het met één tik mogelijk om hetzelfde te doen. Niet alleen informatief, maar direct uitvoerbaar. Dit is het onderscheidende idee van Kader t.o.v. andere apps.

### 💡 Inspiratie van Market Mirror (concurrent)
_(Gevonden op marketmirror.com — functies die het overwegen waard zijn voor Kader)_

- [ ] **Liquidatiekaart**: visualiseer waar de grote liquidatieniveaus liggen (longs vs. shorts) — geeft aan waar cascade-bewegingen kunnen starten. Nuttig als extra context bij een kans-signaal. Databron: Coinglass API (gratis tier beschikbaar).
- [ ] **Marktpulsscore uitbreiden**: Market Mirror weegt 8 live-inputs in één score (whale-activiteit, liquidaties, funding rates, Fear & Greed, ETF-flows, crowd-consensus). Kader heeft al een eigen score (0–100) — die kunnen we verrijken met funding rate en Fear & Greed als extra inputs.
- [ ] **ETF-flow tracking**: toon of er netto geld in- of uitstroomt bij BTC/ETH ETF's (bijv. BlackRock IBIT). Sterke institutionele instroom = bullish signaal. Databron: bijv. The Block of Farside Investors (scrapeable).
- [x] **Fear & Greed Index**: prominenter tonen op het marktscherm als extra context naast de Kader-score. API van Alternative.me is gratis.
- [ ] **Whale-wallettracking**: volg bekende grote wallets (bijv. Michael Saylor, exchange cold wallets) en toon wat ze kopen/verkopen. Nuttig als bevestiging bij een signaal. Databron: Etherscan / blockchain.info API.
- [ ] **Social sentimentscore per coin**: aggregeer sentiment van X/Twitter en Reddit tot één score per coin. Geeft aan of retail bullish of bearish is — handig als contra-indicator. Mogelijke API: LunarCrush.
- [ ] **Pushmelding bij grote whale-trade**: stuur een notificatie als een bekende wallet of exchange een grote positie opent in een coin die je volgt. Market Mirror doet dit live ("Whale opened $112K ETH LONG").
- [ ] **Freemium-model als referentie**: Market Mirror rekent gratis / $9,99 / $29,99 per maand. Als Kader ooit betaald wordt, is dit een realistische bandbreedte voor crypto-apps.

## 🛠️ Te doen

### Functioneel / inhoud
- [x] **Live prijs-polling** op de Mijn Trades-pagina: automatisch vernieuwen elke 60 seconden
- [x] **eToro API** onderzoeken: kunnen we tradable coins automatisch ophalen zodat de Grote Kansen-scan alleen beschikbare coins toont? (opgelost via statische _ETORO_TRADABLE-set)
- [x] **Copy trading stappen** vereenvoudigen: stappenplan in de app hoe je een signaal op eToro uitvoert
- [x] **Portfoliosamenvatting**: totale inleg, huidige waarde en winst/verlies zichtbaar op het Mijn Trades-scherm
- [x] **Mogelijkheid om een gemaakte trade aan te passen in portfolio**: Knop met **aanpassen** waar je je stoploss en takeprofit kan aanpassen

### Kwaliteit & stabiliteit
- [ ] Handmatige smoke-test uitvoeren na elke grote wijziging
- [x] Error boundary toevoegen zodat één kapotte component niet de hele app neergooit
- [x] Offline-modus: nette foutmelding als de telefoon geen internet heeft i.p.v. een lege pagina (Markt en Kansen delen nu één OfflineMelding-component)

### Smoke-test checklist (Kader app)
_(Doorloop dit na elke grote wijziging om regressies te voorkomen.)_
- [ ] App start zonder crash op device/emulator
- [ ] Marktscherm laadt trade-kaarten (of nette leeg-melding zonder internet)
- [ ] Grote Kansen-scherm toont coins met stop loss en take profit
- [ ] Mijn Trades: trade toevoegen, prijs ververst automatisch, trade sluiten en verwijderen werkt
- [ ] Traders-scherm: trader toevoegen, oordeel GROEN/GEEL/ROOD zichtbaar, verwijderen werkt
- [ ] Pushmeldingen komen door bij bereiken stop loss / take profit

## 🐛 Bugs / dingen die kapot zijn

_(Werkt iets niet zoals verwacht? Schrijf het hier op, ook al weet je nog niet waarom.)_

## ✅ Klaar

_(Afgevinkte taken mogen hierheen verhuizen, zodat we kunnen terugzien wat we al gedaan hebben.)_

- [x] TODO-lijst aangemaakt 🎉
- [x] Techniekkeuze native app onderzocht → **React Native + Expo**
- [x] Kale Expo-app gebouwd en via ADB geverifieerd op emulator. Project staat in `app/`, gebouwd vanuit `D:\dev\crypto-market`.
- [x] Analyse-engine geport naar TypeScript (`app/src/engine/`)
- [x] Navigatiestructuur opgezet: tab-navigatie met Markt, Grote Kansen, Mijn Trades, Traders
- [x] Alle vijf schermen gebouwd en functioneel (Markt, Kansen, Portfolio, Traders, Onboarding)
- [x] Lokale opslag aangesloten (AsyncStorage) voor traders en posities
- [x] Pushmeldingen ingeschakeld (`expo-notifications`)
- [x] Branding: app hernoemd naar Kader, package-id `com.kader.app`, EM-dashes verwijderd, officieel logo gegenereerd
- [x] 9 bugs gevonden en opgelost (zie git log voor details)
- [x] **Toetsenbord bedekt invulvelden** (v0.0.2): op Android deed `KeyboardAvoidingView` niks binnen de modal-formulieren. Opgelost met een gedeelde hook die de toetsenbord-hoogte meet en als padding toepast op het bottom-sheet
