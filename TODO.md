# TODO

Onze gezamenlijke takenlijst voor de Kader app.
We kunnen hier dingen aan toevoegen en afvinken terwijl we werken.

## Hoe werkt dit? (voor noobs 👍)

Dit is gewoon een tekstbestand. Elke taak is een regel die begint met `- [ ]`.

- `- [ ]` = nog te doen (leeg vakje)
- `- [x]` = klaar (afgevinkt)

Afvinken doe je door de spatie tussen de blokhaken te vervangen door een `x`.
Op GitHub en in veel editors zie je dan een echt aanvinkbaar vakje. ✅

Voeg gerust nieuwe taken toe onderaan de juiste sectie. Geen verkeerde manier, typ
gewoon een nieuwe regel die begint met `- [ ]`.

---

## 🔥 Nu mee bezig

_(Verplaats hier de taak waar we op dit moment aan werken, zodat we het overzicht houden.)_

## 💡 Ideeën / wensen

_(Dingen die je leuk of handig zou vinden, nog niet ingepland.)_

- [ ] Inloggen? Zo ja, database?

### 🎯 Kevins kernvisie voor Kader
_(Wat de app uiteindelijk moet zijn, de rode draad achter alle keuzes)_

- [ ] **Zo makkelijk mogelijk kopen/verkopen**: vanuit de aanbeveling direct door naar de trade, zo min mogelijk stappen tussen "ziet er goed uit" en "gekocht". Koppeling met eToro of een exchange-API is het einddoel.
- [ ] **Short/long met leverage**: ook hefboomposities ondersteunen in de analyse en het uitvoerscherm, niet alleen spot. Kader moet aangeven of een coin beter geschikt is voor long of short op dat moment.
- [ ] **Grote whales kopiëren (Trump, Saylor, etc.)**: toon wat bekende grote spelers op dit moment kopen of houden, en maak het met één tik mogelijk om hetzelfde te doen. Niet alleen informatief, maar direct uitvoerbaar. Dit is het onderscheidende idee van Kader t.o.v. andere apps. Gebruik eToro API.

### 💡 Inspiratie van Market Mirror (concurrent)
_(Gevonden op marketmirror.com, functies die het overwegen waard zijn voor Kader)_

- [ ] **Liquidatiekaart**: visualiseer waar de grote liquidatieniveaus liggen (longs vs. shorts), geeft aan waar cascade-bewegingen kunnen starten. Nuttig als extra context bij een kans-signaal. Databron: Coinglass API (gratis tier beschikbaar).
- [ ] **Marktpulsscore uitbreiden**: Market Mirror weegt 8 live-inputs in één score (whale-activiteit, liquidaties, funding rates, Fear & Greed, ETF-flows, crowd-consensus). Kader heeft al een eigen score (0-100), die kunnen we verrijken met funding rate en Fear & Greed als extra inputs.
- [ ] **ETF-flow tracking**: toon of er netto geld in- of uitstroomt bij BTC/ETH ETF's (bijv. BlackRock IBIT). Sterke institutionele instroom is een bullish signaal. Databron: bijv. The Block of Farside Investors (scrapeable).
- [ ] **Whale-wallettracking**: volg bekende grote wallets (bijv. Michael Saylor, exchange cold wallets) en toon wat ze kopen/verkopen. Nuttig als bevestiging bij een signaal. Databron: Etherscan / blockchain.info API.
- [ ] **Social sentimentscore per coin**: aggregeer sentiment van X/Twitter en Reddit tot één score per coin. Geeft aan of retail bullish of bearish is, handig als contra-indicator. Mogelijke API: LunarCrush.
- [ ] **Pushmelding bij grote whale-trade**: stuur een notificatie als een bekende wallet of exchange een grote positie opent in een coin die je volgt. Market Mirror doet dit live ("Whale opened $112K ETH LONG").
- [ ] **Freemium-model als referentie**: Market Mirror rekent gratis / $9,99 / $29,99 per maand. Als Kader ooit betaald wordt, is dit een realistische bandbreedte voor crypto-apps.

## 🔔 Meldingen

_(Alles wat achtergrond-sync en pushmeldingen nodig heeft, hoort hier samen.)_

- [ ] **Meldingen als er een hele sterke koop is**
- [ ] Prijsalerts instellen: notificatie als een coin een zelf gekozen prijs bereikt. Achtergrond sync nodig dus.
- [ ] **Trade-bewuste pushmeldingen bouwen**: nu stuurt `notifications/meldingen.ts` alleen één dagelijkse herinnering. Gewenst: periodiek (bijv. elke ~10 min) de open trades checken en een melding sturen om take-profit te verhogen (prijs dicht bij TP, momentum sterk) of stop-loss aan te trekken / eerder uit te stappen (in winst maar momentum vlakt af). Dezelfde melding hooguit eens per ~6u herhalen, tenzij het voorgestelde niveau meer dan 2% verschuift.

## 🛠️ Te doen

### Functioneel / inhoud
- [ ] **Sterker maken van het analyse algoritme**: hoe kan dit algoritme nog sterker en beter worden en zich echt onderscheiden?

### Kwaliteit & stabiliteit
- [ ] Handmatige smoke-test uitvoeren na elke grote wijziging

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

- [ ] **Tab-wisseling knippert ipv animeert**: refresh-rate-afhankelijk — op 120Hz (Thom S25 Ultra) opgelost, op 60Hz (Kevin) knippert het nog steeds. Permanente structurele oplossing nodig die beide refresh rates ondersteunt.

## ✅ Klaar

_(Afgevinkte taken mogen hierheen verhuizen, zodat we kunnen terugzien wat we al gedaan hebben.)_

### Bugfixes
- [x] **Balk over kaarten**: onderste tradekaart werd afgekapt boven een dode grijze strook (zie "balk over kaarten.jpeg"). Oorzaak: de tab-schermen (Markt, Kansen, Portfolio, Traders) pasten via `SafeAreaView` de bottom-inset toe binnen het scherm, en `BottomNav` deed dat er nogmaals onder overheen. Inset wordt nu alleen nog door `BottomNav` toegepast; de schermen zelf padden alleen top/left/right.
- [x] **Tabwisseling-animatie hapert op S25 Ultra**: de cross-fade was in werkelijkheid fade-out → scherm wisselen (unmount/mount) → fade-in, met de dure mount van een FlatList-scherm precies in het gat waarin alles onzichtbaar was, plus een root-container zonder achtergrondkleur (liet het venster erdoorheen schijnen). Nu blijft elk bezocht tabscherm gemount en faden we het nieuwe scherm over het vorige heen in (opacity-only), zodat er nooit een leeg frame is. Bonus: scan-resultaten en filters per tab blijven nu ook behouden bij het wisselen.

### eToro-koppeling
- [x] Portfolio uit eToro halen: live API-koppeling onder Instellingen, importknop op Mijn Trades
- [x] Trade-historie ophalen uit eToro en verwerken in portfolio bij sluiten trade (open posities automatisch afgesloten met echte exitprijs, historische gesloten posities met terugwerkende kracht toegevoegd)
- [x] Sync-status / "loop ik achter?": sync-icoon en importwolkje kleuren mee (grijsgroen/oranje/rood), tijdstip laatste sync zichtbaar en bewaard tussen app-starts, automatische sync bij terugkeer uit de achtergrond
- [x] eToro API onderzocht voor tradable coins: opgelost via statische `_ETORO_TRADABLE`-set
- [x] Copy trading stappen vereenvoudigd: stappenplan in de app hoe je een signaal op eToro uitvoert
- [x] Stop-loss validatie voor eToro: waarschuwt als de voorgestelde stop-loss buiten eToro's limiet valt, gebouwd tegen het eligibility-endpoint (`engine/etoroLimieten.ts`, `state/useStopLossLimiet.ts`)
- [x] eToro-koppeling gaf 422 "X-Request-Id header is not a valid GUID": opgelost met een echte GUID-helper in `engine/etoro.ts`
- [x] Importwolkje meekleuren met sync-status (was los van de rest van de sync-indicatie)
- [x] API-refresh bij elke app-start: portfolio doet nu ook buiten cooldown een volledige sync bij terugkeer uit de achtergrond
- [x] Trade-formulier verliest ingevulde waarden bij wisselen naar eToro-app: concept wordt nu bewaard in AsyncStorage terwijl het formulier open staat

### Marktscherm & filters
- [x] Favorietenlijst: vaste coins markeren zodat ze altijd bovenaan de analyse staan, met filtertabs "Alle coins" / "Favorieten"
- [x] Filteren op RSI, Score en R/R op het Marktscherm: filtersheet met snelkeuzes, te combineren met Alle coins/Favorieten
- [x] Uitleg toevoegen over de Fear & Greed Index en het marktsentiment: uitklapbare toelichting op het Marktscherm
- [x] Schuivende marktbalk (zoals Market Mirror): schuifknop van HEAVY SELL naar HEAVY BUY op basis van de Kader-score
- [x] "Wat moet ik nu kopen?": kaart bovenaan het Marktscherm met de best scorende koopkans, houdt rekening met actieve tab- en filterkeuzes
- [x] Fear & Greed Index (Alternative.me) prominenter tonen naast de Kader-score
- [x] Uitbreiden van de coin-searchbase: universum naar de eToro-lijst (57 coins), dode tickers opgevangen met een alias-map, `topN` naar 20
- [x] Versnellen van de analyse: coins worden nu in blokken van 6 parallel opgehaald i.p.v. één voor één
- [x] Naar beneden swipen op Marktpagina was te gevoelig: refresh gebeurt nu op de achtergrond zonder de lijst te legen, met een herhaal-blokkade

### Portfolio & trades
- [x] **Compact view in portfolio**: keuze-switch tussen meer info en compact, zoals eToro's eigen portfolio-view. Compacte regel toont symbool, kort advies, live prijs, resultaat en een dunne stop-doel-balk; acties (Gewonnen/Verloren/Aanpassen/Verwijderen) via een kebab-menu.
- [x] Live prijs-polling op de Mijn Trades-pagina: automatisch vernieuwen elke 60 seconden
- [x] Portfoliosamenvatting: totale inleg, huidige waarde en winst/verlies zichtbaar op het Mijn Trades-scherm
- [x] Mogelijkheid om een gemaakte trade aan te passen: stop-loss en take-profit wijzigen, R/R herberekend
- [x] Coin detail-scherm full screen met grafieken: koersgrafiek, entry/stop/take-profit-lijnen, indicatoren, onderbouwing van het advies
- [x] Meer informatie over de status van de trade: afstand tot stop/doel voor open trades, exitprijs/slotdatum/resultaat voor gesloten trades
- [x] Meer informatie op Grote Kansen-scherm: kaarten tonen marktcap, trend, MACD en kansscore
- [x] Historisch overzicht gesloten trades met winst/verlies-statistieken (trefferpercentage, gem. R/R, totaal resultaat)
- [x] Geen mogelijkheid om trade op te slaan vanuit Grote Kansen: nu identiek aan Markt
- [x] Geen mogelijkheid om waarde in $ of aantal gekochte coins aan te geven in je trades
- [x] Trades in het portfolio venster hadden geen meekleurende zijkant zoals in Markt venster
- [x] Verlies in dollars werd zonder minteken getoond: één gedeelde `fmtResultaatUsd()` in `engine/format.ts`
- [x] Import-knop leek op downloaden: vervangen door `CloudDownload` (wolk met pijl)
- [x] Instellingen en andere sheets sluiten nu ook door ernaast te tikken, niet alleen via het kruisje (gedeelde `BottomSheet`-component)

### Huisstijl, navigatie & algemeen
- [x] Dark/light mode: systeem/licht/donker via een tandwiel-icoon in de header, opgeslagen op het toestel
- [x] Changelog in app: knop onder Instellingen, plus een pop-up bij eerste start na een update, met `changelog.ts` als bron
- [x] Achtergrond informatie in app: uitleg-scherm bereikbaar via een los boek-icoon in de schermheader (niet onder Instellingen)
- [x] Smooth geanimeerde overgangen tussen de schermen: cross-fade in `App.tsx` i.p.v. een flits bij tabwissel
- [x] Tabbalk onderaan viel onder de menu/home/terug-knop op sommige Android-devices: opgelost met `useSafeAreaInsets()`
- [x] EM-dashes verwijderd uit alle app-teksten
- [x] Teksten en naamgeving aangepast op basis van `docs/huisstijl-kader.md`
- [x] Kader-logo gegenereerd en in `app/assets/` geplaatst, later vervangen door logo v2 (open kader-mark, geen gradient/trendlijn)
- [x] App-icoon werd niet aangepast na een update: generatorscript stond nog op v1, nu herschreven naar v2 en alle assets/mipmaps opnieuw gegenereerd

### Kwaliteit & stabiliteit
- [x] Error boundary toevoegen zodat één kapotte component niet de hele app neergooit
- [x] Offline-modus: nette foutmelding als de telefoon geen internet heeft i.p.v. een lege pagina
- [x] Laadbalk toevoegen: visuele voortgangsbalk tijdens het analyseren en scannen

### Vroege opzet
- [x] TODO-lijst aangemaakt 🎉
- [x] Techniekkeuze native app onderzocht, React Native + Expo
- [x] Kale Expo-app gebouwd en via ADB geverifieerd op emulator
- [x] Analyse-engine geport naar TypeScript (`app/src/engine/`)
- [x] Navigatiestructuur opgezet: tab-navigatie met Markt, Grote Kansen, Mijn Trades, Traders
- [x] Alle vijf schermen gebouwd en functioneel
- [x] Lokale opslag aangesloten (AsyncStorage) voor traders en posities
- [x] Pushmeldingen ingeschakeld (`expo-notifications`)
- [x] Branding: app hernoemd naar Kader, package-id `com.kader.app`
- [x] Toetsenbord bedekte invulvelden (v0.0.2): gedeelde hook meet toetsenbord-hoogte en past die toe als padding
