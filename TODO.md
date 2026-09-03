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

### 📣 Thom, lees dit even (25 aug 2026)

- [x] **PR #33 is gemerged zonder dat jij ernaar gekeken hebt.** Kevin heeft daar bewust voor gekozen, maar volgens `docs/github-werkwijze.md` hoor jij er eerst even overheen te kijken. Kijk er dus alsnog naar als je tijd hebt: het gaat om de bear-modus (Kader bruikbaar maken in een dalende markt) en aanklikbare meldingen. Zie de PR-beschrijving voor wat er in zit en hoe het getest is.
- [x] **0.1.15 is gepubliceerd (26 aug 2026).** Fase 4 is af, dus de blokkade was weg: https://github.com/helgerskevin-hub/kader/releases/tag/v0.1.15 met de APK erbij. Gebouwd via de `release-apk` skill, beide controles (versionCode/versionName en de handtekening) groen.
- [x] **versionCode staat nu op 24, niet 23.** Er is een lokale 0.1.15-APK rondgegaan met versionCode 23, en die is van vóór de shorts. Met 24 installeert de release daar gegarandeerd overheen en is er geen twijfel welke build de nieuwste is. Voor een volgende release moet versionCode dus hoger zijn dan 24.
- [ ] **Nog te bewijzen: een short plaatsen via de app.** Short-signalen tonen en shorts bijhouden werkt, maar er is nooit een echte demo-sell-order geplaatst. Dat `settlementType: cfd` in de orderbody hoort is afgeleid uit de eligibility-respons, niet gemeten. Draaien met: `ETORO_DEMO_API_KEY=... ETORO_DEMO_USER_KEY=... npx tsx scripts/etoro-demo-order.ts --order` vanuit `app/` (let op: die vlag plaatst echt een order op het demo-account).

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

### 🐻 Plan: Kader bruikbaar maken in een bearmarkt

_(Het probleem: in een stijgende markt levert Kader elke dag concrete trades. Zodra `bepaalKlimaat()` in [marktklimaat.ts](app/src/engine/marktklimaat.ts) op ONGUNSTIG staat, sluit de poort en zegt de app in feite alleen nog "niet kopen". Dat klopt inhoudelijk, de backtest is er duidelijk over, maar het maakt de app maandenlang een leeg scherm. Kader moet in een dalende markt iets te doen hebben in plaats van alleen iets te verbieden.)_

**Stand van zaken (25 aug 2026)**: fase 1 en 2 staan op main, geverifieerd op de emulator. Fase 0 is gedraaid, de cijfers staan hieronder. Uitkomst: **fase 3 gaat niet door** (de meting steunt het niet) en **fase 4 (shorts) krijgt groen licht** (meting F werkt in alle drie de bearmarkten). Zie de onderbouwing per fase.

**Uitgangspunt dat niet ter discussie staat**: we verlagen nooit `DREMPEL_KOOP`, `MIN_RISK_REWARD` of de klimaatpoort om in een bearmarkt tóch signalen te kunnen tonen. Dat is precies de fout die geld kost. De app moet iets anders gaan doen, niet hetzelfde met soepelere drempels.

#### Fase 0: eerst meten, dan bouwen - GEDAAN (25 aug 2026)
_(Alle cijfers uit `npm run backtest` over 57 coins, 9 jaar Binance-historie tot 12 juli 2026. Getallen zijn gemiddelde R per trade. Ruwe data in `data/backtest/`.)_

- [x] **Meting C, het algoritme per jaar**: de app zoals hij nu draait (KOOP + R/R-filter) haalt +0,083 over 3170 trades, tegen +0,032 voor een willekeurige instap. High conviction is het sterkst met +0,154. Per jaar valt op dat 2018 (-0,66), 2022 (-0,47), 2025 (-0,32) en 2026 (-0,29) de verliesjaren zijn, precies de bearmarkten. Dat is het hele probleem dat dit plan moet oplossen.
- [x] **Meting D, de poorten**: "BTC boven EMA50 en breedte stijgt" blijft de beste poort met +0,200 tegen +0,154 zonder poort. Dat is de poort die nu in `bepaalKlimaat()` zit, dus daar hoeft niets aan te veranderen.
- [x] **Meting E, doel en houdtijd**: doel 3x ATR met 30 dagen wint over de hele periode (+0,154). Kortere doelen geven een hoger trefferpercentage (1,5x ATR haalt 67%) maar minder R. `REWARD_MULTIPLIER` van 3,0 blijft dus staan.
- [x] **Meting F, shorts: dit is de go voor fase 4.** Short op score < 40, doel 2x ATR, 20 dagen: +0,064 over 5377 trades. Belangrijker is het jaarpatroon, want dat was de vraag: 2018 **+0,15**, 2022 **+0,19**, 2025 **+0,13**, 2026 **+0,10**. Alle drie de bearmarkten positief, dus 2025-26 was geen toeval. Verliesjaren zijn juist de bulljaren (2020 -0,16, 2024 -0,04), wat logisch is en precies waarom shorts achter de klimaatpoort horen. Let op: de extra filter "BTC onder EMA200" maakt het **slechter** (+0,054), en score < 25 nog slechter (+0,026). De simpele regel is de beste.
- [x] **Meting G, mean-reversion-longs: dit is de no-go voor fase 3.** Zie de onderbouwing onder fase 3 hieronder.

#### Fase 1: de bear-modus als eigen toestand van de app (geen nieuwe databron nodig) - GEBOUWD
- [x] **Marktscherm krijgt een echte bear-modus**: bij ONGUNSTIG toont het scherm niet dezelfde lijst met alles op WATCH, maar een andere indeling: bovenaan wat je met je open posities moet doen, daaronder de relatieve-sterktelijst, en pas onderaan de gewone analyse ter informatie. De copy in [MarktBalk.tsx](app/src/components/MarktBalk.tsx) legt nu wel uit waarom er niets is, maar biedt geen alternatief.
- [x] **Relatieve sterkte t.o.v. BTC**: rangschik het universum op prestatie over 30 dagen versus BTC over dezelfde periode. In een dalende markt is dat de enige long-informatie die iets waard is: wie standhoudt tijdens de daling zijn doorgaans de leiders van de volgende cyclus. De data hebben we al, `analyseerMarkt()` haalt alle 57 coins toch al binnen en gooit de candles nu weg na de breedteberekening. Kost dus geen extra requests.
- [x] **Maximale blootstelling per klimaat**: toon een expliciet plafond in plaats van een impliciet verbod. GUNSTIG geen plafond, GEMENGD ongeveer de helft, ONGUNSTIG een klein deel. Met de portfoliowaarde uit [statistieken.ts](app/src/state/statistieken.ts) kan de app zeggen "je zit nu op 80% terwijl 20% past bij dit klimaat".
- [x] **Cash als zichtbare positie**: laat zien wat niet-handelen heeft opgeleverd. "Kader staat 34 dagen in bear-modus, de markt is in die periode 18% gedaald." Wachten wordt zo een meetbaar resultaat in plaats van een leeg scherm.

#### Fase 2: kapitaalbescherming voor wat je al hebt (grootste waarde, minste risico) - GEBOUWD
- [x] **Afbouwadvies per open trade** in Mijn Trades: staat deze coin nog boven zijn EMA50, is het momentum aan het afvlakken, ligt de stop nog logisch? [tradeChecks.ts](app/src/notifications/tradeChecks.ts) rekent de MACD-histogramhelling al uit, die conclusie staat nu alleen in een melding en niet in het scherm.
- [x] **Trailing stop meebewegen**: als een trade in de winst staat en het klimaat draait, stel dan een opgetrokken stop voor (bijvoorbeeld naar break-even of onder de laatste swing low). Rekenwerk zit al in `stopAfstandStructuur()`, moet alleen op een bestaande trade toegepast worden in plaats van op een nieuwe entry. Let op: [useStopLossLimiet.ts](app/src/state/useStopLossLimiet.ts) moet valideren of eToro die stop toestaat.
  - [ ] Nog open: het voorgestelde niveau wordt nu alleen als tekst getoond en niet langs [useStopLossLimiet.ts](app/src/state/useStopLossLimiet.ts) gehaald. Zodra er een knop bij komt die de stop meteen bij eToro zet, moet die controle eerst.
- [x] **Portfoliobrede risicomelding**: nu gaat elke melding over één trade. Voeg een melding toe over het geheel: "het klimaat is omgeslagen naar ongunstig en 4 van je 6 posities staan onder hun EMA50". Dat is in een bearmarkt de melding die er echt toe doet. Hergebruikt de bestaande suppressielogica in `SLEUTELS.meldingSuppressie`.
- [x] **Klimaatomslag als pushmelding, beide kanten op**: melden zodra `bepaalKlimaat()` van GEMENGD naar ONGUNSTIG gaat (afbouwen) en zodra hij van ONGUNSTIG naar GEMENGD of GUNSTIG gaat (de poort opent weer). Die tweede is in een bearmarkt de belangrijkste melding die de app kan sturen, want daar wacht je maandenlang op. De achtergrondtaak in [achtergrondtaak.ts](app/src/notifications/achtergrondtaak.ts) draait al, alleen het klimaat wordt daar nog niet berekend en er is nog geen vorige-toestand in AsyncStorage.

#### Fase 3: een tweede scoreprofiel voor bearmarktrally's - GEMETEN EN AFGEVOERD (25 aug 2026)

_(De eerlijke uitkomst die het plan hierboven zelf voorschreef: "bouwen alleen als de meting het steunt". De meting steunt het niet, dus de app geeft in een bearmarkt geen longs en blijft het bij fase 1 en 2.)_

Het omkeerprofiel is wel gebouwd en gemeten. `scoorCandles()` heeft nu een profielparameter (`momentum` of `omkeer`) die diep oversold RSI, capitulatievolume, de eerste hogere bodem en een oplopend MACD-histogram scoort, met doel 2x ATR en een stop-clamp van 0,5 tot 1x ATR. **Die parameter blijft in de code staan als meetgereedschap** (standaard `momentum`, `analyseerMarkt()` gebruikt hem niet, dus de app verandert er niet van). Zo is de meting later te herhalen op verse data zonder alles opnieuw te bouwen, en meting G in `app/scripts/backtest.ts` blijft draaien.

Wat de meting zei, op de dagen dat de klimaatpoort dicht stond (doel 2x ATR, 20 dagen):

| regel | n | treffer% | gem R |
|---|---|---|---|
| willekeurige instap | 6720 | 30 | -0,075 |
| momentum (KOOP + R/R) | 532 | 34 | -0,085 |
| omkeer (KOOP + R/R) | 1327 | 38 | **+0,156** |

Dat ziet er goed uit, en in de strengste doorsnede (poort dicht **en** BTC onder EMA200) nog beter: omkeer +0,234 tegen -0,175 voor momentum. Het probleem zit in het jaarpatroon. Die winst komt uit scherpe correcties die weer omhoog gingen (2023 +0,94, 2024 +1,47, 2025 +0,93), niet uit de bearmarkten zelf: **2019 -0,48, 2022 -0,08, 2026 -0,34**.

Vooraf was afgesproken dat fase 3 alleen doorging als het profiel in minstens twee van de drie bearmarkten standhield. Dat haalt het niet: van de vier meetbare dalende periodes is er één positief (2025) en zijn er drie negatief. Doorslaggevend is 2026: **in de markt waar we nu in zitten verliest dit profiel 0,34 R per trade.** Iets uitbrengen dat vandaag geld kost is precies de fout die de kop "waar we vanaf blijven" hieronder beschrijft.

- [ ] Eventueel later: het profiel werkt wél op scherpe correcties binnen een opgaande markt. Dat is een ander idee dan dit ("koop de dip in een bullmarkt", niet "wat doe je in een bearmarkt") en hoort niet in het bearmarkt-plan thuis. Alleen oppakken als iemand er expliciet voor kiest, en dan opnieuw meten op verse data.

#### Fase 4: shorts (het echte antwoord, maar ook het duurste) - GROEN LICHT

_(Meting F uit fase 0 is de go: shorts op score < 40 leverden in alle drie de bearmarkten geld op (2018 +0,15, 2022 +0,19, 2025 +0,13, 2026 +0,10) en verloren alleen in bulljaren. Nu fase 3 is afgevoerd is dit het enige overgebleven antwoord op "wat doet Kader in een dalende markt". Het is ook het duurste, vooral door eToro: crypto shorten kan daar alleen als CFD met hefboom.)_

- [x] **Richting-veld op `PortfolioTrade`: gedaan.** `richting?: 'long' | 'short'` met een `richtingVan()`/`tekenVan()`-helper ernaast, optioneel zodat bestaande trades zonder veld gewoon long blijven (zelfde patroon als `bron`). De eToro-import slaat shorts niet meer over, en winst, verlies, R/R, de positiebalk, het afbouwadvies en de meldingen weten nu welke kant een positie op staat. Een short krijgt een goud SHORT-label; bij een long staat er niets, want vrijwel alles is long. Geverifieerd op de emulator met een short naast een long op dezelfde coin: +18,5% tegen -18,5% bij dezelfde koers. Twee dingen blijven bewust staan tot de rest van fase 4: de "verhoog je doel"-melding slaat shorts over (`scoorCandles()` maakt nog geen short-niveaus) en de eToro-stoplimiet wordt bij een short niet getoetst (`kiesLimiet()` is nog Buy-only).
- [x] **Short-signalen in de engine: gedaan.** `stopAfstandStructuur()` heeft een richtingparameter (stop naar de swing high in plaats van de swing low) en `scoorCandles()` een `richting`-optie die de niveaus spiegelt: stop boven de entry, doel 2x ATR eronder. De score blijft ongewijzigd, een short vuurt op `score < DREMPEL_SHORT` (40). `poortOpenShort()` naast `poortOpen()` opent alleen bij ONGUNSTIG en is bewust fail-closed: zonder klimaatdata geen short, precies andersom dan bij koop. `analyseerMarkt()` levert de shorts in een eigen lijst, niet tussen de longs, want de sortering is omgekeerd (laagste score is het sterkste short-signaal) en elk bestaand scherm leest `alle` als long. De duplicaat `shortNiveaus()` in de backtest is opgeheven, die roept nu de engine aan.
  - **Meting: de stop-cap uit het plan is afgevallen.** Het plan stelde een `STOP_CAP_SHORT` van 1x ATR voor om de R/R boven de drempel te krijgen. Drie varianten naast elkaar gemeten (staan alle drie in meting F, dus reproduceerbaar):

| regel | n | gem R | 2018 | 2022 | 2025 | 2026 |
|---|---|---|---|---|---|---|
| cap 3x ATR, zoals oorspronkelijk gemeten | 5377 | +0,064 | +0,15 | +0,19 | +0,13 | +0,10 |
| cap 1x ATR (het plan) | 7054 | +0,076 | +0,34 | +0,22 | **+0,02** | +0,28 |
| **cap 3x ATR + de bestaande R/R-drempel** | 2017 | **+0,155** | +0,13 | +0,10 | **+0,30** | **+0,24** |

  De stop knijpen houdt alle signalen maar verschuift de stop, en dat kostte juist 2025 (van +0,13 naar +0,02). De gewone stop houden en in plaats daarvan signalen laten afvallen op de R/R-drempel die er al stond geeft +0,155, ruim het dubbele van het oorspronkelijke cijfer, met alle vier de dalende jaren positief en 8 van de 9 jaren positief. Er is dus geen nieuwe constante nodig: de discipline die al in de app zat doet het werk. `STOP_CAP_SHORT` is weer verwijderd.
  - Controle op regressie: meting C reproduceert exact (+0,083 over 3170 trades, high conviction +0,154), dus aan het long-pad is niets veranderd.
- [x] **eToro-beperking uitgezocht (26 aug 2026): meevaller, hefboom is niet verplicht.** Gemeten tegen het demo-account. eToro geeft per crypto twee configs: long op `settlementType: real` met hefboom x1 en een stop tot 100% van de entry, en short op `settlementType: cfd` **ook met hefboom x1** maar met een stop tot maximaal 50%. Voor BTC, ETH, SOL, XRP en ADA identiek. Het is dus wel een CFD, maar niet met hefboom, dus Kader hoeft zijn uitgangspunt "altijd x1, nooit hefboom" niet los te laten en er zijn geen afwijkende marginregels. Daarmee valt het duurste deel van fase 4 weg. Wat wel moet: `kiesLimiet()` de config per richting laten kiezen (anders keurt Kader een short met een stop van 60% goed die eToro weigert), `bepaalStop()` spiegelen, en `settlementType` meesturen in de orderbody. Volledige meting in [docs/etoro-direct-handelen-plan.md](docs/etoro-direct-handelen-plan.md) paragraaf 10.
- [x] **UI: gedaan.** Nieuwe kaart "Short-signalen" op het marktscherm, alleen zichtbaar zolang er short-signalen zijn (en dus alleen bij een ongunstig klimaat), met een gouden accent zodat hij niet met een koopkaart te verwarren is. Per coin de score, de gespiegelde niveaus (doel links, stop rechts) en de R/R, plus knoppen Getrade en Short. De kooporder-sheet kan nu ook een short plaatsen, met een gouden balk onder de titel die uitlegt dat je opent door te verkopen, en die balk staat buiten de scrollruimte zodat hij niet weg te scrollen is. De bevestiging per order is ongewijzigd streng gebleven. Verder een hoofdstuk Shorts onder het boek-icoon en een changelogregel.
  - Geverifieerd op de emulator: bij het echte klimaat (gunstig, breedte 88%) is de lijst leeg, precies zoals de poort voorschrijft. Met de poort en de drempel tijdelijk geforceerd verschijnt de kaart met kloppende niveaus (ETH: doel 2283,21 onder entry 2470,04 onder stop 2556,12, R/R 1:2,2). Beide tijdelijke wijzigingen zijn daarna teruggedraaid.
  - ~~Bewust NIET gedaan: een short opent geen coin-detailscherm.~~ **Alsnog gedaan.** `genereerShortadvies()` staat naast `genereerKoopadvies()` in `engine/coinInfo.ts`, met een eigen self-check: dalende trend en bearish MACD zijn daar een plus, diep oversold RSI een waarschuwing (de val is dan grotendeels geweest), en de labelgrens is `DREMPEL_SHORT` zelf, zodat het label nooit groen staat waar de engine niet vuurt. Bewust twee functies en geen vlag in de bestaande: elke regel draait om. `vanTrade()` neemt de richting van de trade over in plaats van 'long' te hardcoden, en het detailscherm draagt een SHORT-badge, de kop "Waarom short" en de knop "Short via eToro". Geverifieerd op de emulator met de short-poort en de R/R-drempel tijdelijk geforceerd, allebei teruggedraaid.
  - **Nog niet gemeten: er is nog geen echte demo-short geplaatst.** Dat `settlementType: cfd` in de orderbody hoort is afgeleid uit de eligibility-respons, niet bewezen met een order. Dat staat ook als zodanig in de code.

#### Waar we vanaf blijven
- [ ] Geen drempelverlaging om het scherm te vullen. Een leeg marktscherm met uitleg is beter dan een verzonnen signaal, hetzelfde principe als bij de eToro-stoplimieten.
- [ ] Geen "koop de dip"-taal zonder gemeten onderbouwing. In een bearmarkt is elke dip er één te vroeg.

## 🔔 Meldingen

- [x] **Meldingen aantikbaar**: tik in het meldingenoverzicht op een melding en je komt uit bij de trade in Mijn trades of de coin op het marktscherm. Onder elke melding staat waar je uitkomt. Oude meldingen zonder verwijzing blijven leesbaar maar zijn geen knop.
_(Alles wat achtergrond-sync en pushmeldingen nodig heeft, hoort hier samen.)_

- [x] **Prijsalerts instellen: gedaan.** Belletje in de header van het coinscherm, een sheet met een prijsveld en snelknoppen voor 5/10 procent, en een lijst van je alerts per coin. De regels staan puur en getoetst in `state/prijsalerts.ts`; `checkPrijsalerts()` in `tradeChecks.ts` haalt alleen koersen op voor coins met een wachtende alert en staat bewust BUITEN de uur-cooldown van `checkOpenTrades`, want de gebruiker koos dat niveau zelf. Een alert vuurt precies een keer. Geverifieerd op de emulator, inclusief de eenmaligheid en het uitzetten.
- [x] **Meldingen aan/uit in Instellingen: gedaan.** Een Aan/Uit-keuze in dezelfde vorm als Weergave en Valuta. Uit wist de geplande dagelijkse herinnering (die staat al bij Android in de wachtrij en gaat anders gewoon door) en schrijft de achtergrondtaak uit; de vlag staat in `state/meldingVoorkeur.ts` en wordt bovenaan `checkOpenTrades` en `checkPrijsalerts` gelezen. Let op: dat bestand importeert met opzet niets uit `notifications/`, anders ontstaat er een require-cycle via `achtergrondtaak.ts`, en dat is precies het bestand dat op module-niveau de Android-taak registreert. Het daadwerkelijke schakelen staat daarom in `state/meldingSchakelaar.ts`.
- [x] Shorts in de meldingen: de trade-checks zijn richting-bewust. Een short trailt zijn stop omlaag in plaats van omhoog, en een open short onderdrukt geen koopsignaal meer op dezelfde coin. De "verhoog je doel"-melding blijft bij een short nog achterwege tot er short-niveaus zijn.

## 🛠️ Te doen

### Functioneel / inhoud
- [ ] **Sterker maken van het analyse algoritme**: hoe kan dit algoritme nog sterker en beter worden en zich echt onderscheiden?

#### Meting H (2 sep 2026): de sterkste vondst tot nu toe, en er moet een keuze over gemaakt worden

_(Nieuw in `app/scripts/backtest.ts`, meting H. Reproduceerbaar met `node scripts/haal-historie.mjs 9` en `npm run backtest` vanuit `app/`. De basis reproduceert de bekende cijfers: 3251 trades, +0,088 gemiddelde R, high conviction +0,158. Dat is iets hoger dan de +0,083 in meting C omdat er zeven weken data bij zijn gekomen.)_

Getoetst zijn drie filters op de COIN zelf, waar de poorten uit meting D allemaal naar de MARKT kijken. Twee vielen af, een is groot.

**Afgevallen: boven de eigen EMA100.** +0,195 tegen +0,192 basis, dus niets. De tegenproef laat zien waarom: de helft die het filter wegGOOIT (onder de EMA100) doet +0,143, bijna even goed. Het filter sorteert dus niet. Erger nog, het maakt 2025 slechter (-0,14 naar -0,61).

**Afgevallen: niet te ver uitgerekt boven EMA20.** Bij 2 ATR gebeurt er letterlijk niets (geen enkel KOOP-signaal staat daarboven), bij 1 ATR is het +0,197 tegen +0,192. Op high conviction geeft 2 ATR wel +0,210 tegen +0,193, maar dat kost een derde van de trades en maakt 2026 slechter. Te mager.

**De vondst: relatieve sterkte versus BTC werkt, maar ANDERSOM dan verwacht.** Binnen de koopsignalen van Kader doen coins die de afgelopen 30 dagen zijn ACHTERGEBLEVEN op BTC het fors beter dan coins die BTC al voorbij zijn gelopen.

| relatieve sterkte 30d | n | treffer% | gem R |
|---|---|---|---|
| < -20% | 337 | 53 | **+0,775** |
| -20% tot -10% | 458 | 42 | +0,406 |
| -10% tot 0% | 732 | 33 | +0,132 |
| 0% tot +10% | 521 | 25 | -0,146 |
| +10% tot +25% | 342 | 24 | -0,146 |
| +25% tot +50% | 188 | 24 | -0,122 |
| > +50% | 146 | 32 | +0,168 |

Dat is een monotone helling over vrijwel het hele bereik, geen staarteffect: hoe verder achter, hoe beter. Alleen de laatste emmer wijkt af en die is met n=146 de kleinste. Dezelfde vorm komt terug op high conviction (rs < -10%: +0,555, rs 0 tot +25%: +0,045).

Belangrijker nog, het houdt stand **zonder** de marktpoort, dus het is geen artefact van die smalle doorsnede:

| regel | n | gem R | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| basis (KOOP + R/R) | 3251 | +0,088 | -0,34 | 0,07 | 0,59 | 0,41 | -0,33 | 0,30 | -0,01 | -0,24 | -0,05 |
| + zwakker dan BTC | 1879 | **+0,168** | -0,69 | -0,10 | 0,90 | 0,53 | -0,27 | 0,34 | 0,16 | -0,18 | 0,04 |
| + sterker dan BTC | 1862 | -0,032 | -0,11 | 0,07 | 0,24 | 0,34 | -0,45 | 0,21 | -0,19 | -0,36 | -0,23 |

Dat is het verschil tussen een strategie die werkt en een die niet werkt, over de halve steekproef en negen jaar.

**Hoe het te lezen:** een KOOP-signaal eist al een opwaartse trend en bullish MACD. Een coin die daarbij ook nog eens 25% harder is gestegen dan BTC in een maand, heeft het makkelijke deel gehad. Een coin met hetzelfde signaal die juist is achtergebleven, is een terugval binnen een opgaande trend. Kader koopt dus beter de dip in een sterke coin dan de doorgeschoten winnaar.

**Wat er nu mee is gedaan:** het cijfer is per coin zichtbaar gemaakt op het marktscherm en het coin-detailscherm, met de meting erbij. Het telt bewust NIET mee in de 0-100 score en filtert niets weg.

- [ ] **Keuze voor Kevin en Thom: moet dit in de strategie?** De meting steunt het ruim, en anders dan een drempelverlaging is dit een AANSCHERPING. Optie (a) laten zoals nu (alleen zichtbaar) en ~~(b) een filter dat je zelf aanzet~~ **is gebouwd en staat standaard uit**. Blijft over: (c) het in de engine zetten. Meting H2e is er specifiek voor gedraaid, zie hieronder.

#### H2e: wat optie (c) precies kost en oplevert

_(Zelfde run, `npm run backtest`. De laatste kolom is nieuw en het belangrijkst: hoeveel dagen houdt de app nog iets te melden? Gemiddelde R zegt niets over of het scherm nog gevuld is.)_

| variant | n | gem R | 2022 | 2025 | 2026 | dagen met signaal |
|---|---|---|---|---|---|---|
| **wat de app vandaag doet** | 1919 | +0,192 | -0,46 | -0,14 | +0,09 | 714 |
| zonder voorlopers boven +25% | 1703 | +0,207 | -0,41 | -0,11 | +0,10 | 686 |
| **zonder voorlopers boven +10%** | 1512 | **+0,243** | -0,34 | -0,07 | +0,10 | **670** |
| alleen achterblijvers (-10% of meer) | 666 | **+0,574** | **+0,01** | **+0,73** | +0,20 | 468 |

Twee dingen springen eruit.

**De grens van +10% is bijna gratis.** Hij tilt het gemiddelde met een kwart op (+0,192 naar +0,243) en kost 44 van de 714 signaaldagen, dus 6 procent. Dat is een betere ruil dan de +25% die eerder werd voorgesteld; die is nauwelijks strenger dan niets.

**"Alleen achterblijvers" repareert precies de jaren die stuk zijn.** 2022 van -0,46 naar +0,01, 2025 van -0,14 naar +0,73. Dat zijn de bearmarkten waar dit hele project al twee plannen aan besteed heeft. Maar het kost een derde van de signaaldagen (714 naar 468), en in een jaar waarin de poort toch al vaak dicht staat is dat het verschil tussen weinig signalen en geen signalen.

Zonder de marktpoort (H2f) wijst het dezelfde kant op: "alleen achterblijvers" geeft +0,362 tegen +0,088, met 2025 op +0,03 en 2026 op +0,14 in plaats van -0,24 en -0,05.

**Aanbeveling:** de +10%-grens als harde regel (dus voorlopers boven +10% krijgen geen KOOP meer), en "alleen achterblijvers" laten waar het nu staat, als filter dat je zelf aanzet. Dan pakt de app de goedkope winst zonder dat het scherm een derde van de tijd leeg blijft, en wie strenger wil kan dat met een tik. Maar dit verandert wel elk signaal dat de app geeft, dus het wacht op jullie akkoord.

- [ ] **Kanttekening bij het bovenstaande:** dit is één harness op één dataset, zonder aparte out-of-sample-periode. Wat het geloofwaardig maakt is dat de helling monotoon is over zeven emmers, dat hij standhoudt zonder de marktpoort, en dat hij in acht van de negen jaren dezelfde kant op wijst. Wat het niet wegneemt: er zijn nu drie hypotheses en een handvol drempels getoetst op dezelfde negen jaar. Voordat (c) erin gaat is het de moeite waard om de meting één keer opnieuw te draaien op verse data.

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

- [x] **Flikkering van animaties op bepaalde devices**: Kevin heeft last van flikkering op zijn OnePlus 13R, zelfs op 60Hz. Op Thom's Samsung S25 Ultra (120Hz) leek dit opgelost, maar de oorzaak zat dieper: de zichtbaarheids-state voor de cross-fade werd in een `useEffect` gezet, dus React tekende altijd eerst één leeg beeldje (oude scherm al verborgen, nieuwe scherm nog niet gemount) voordat de fade begon. Op 120Hz is dat beeldje ~8ms en amper te zien, op 60Hz ~16ms en wel. Gefixt in 0.1.7 door de zichtbaarheid in dezelfde render als de tabwissel te zetten, plus de vier tabschermen memoized zodat de 60s-prijzenpoll ze niet meer onnodig hertekent tijdens een fade. Bevestigd op OnePlus 13R.

## ✅ Klaar

_(Afgevinkte taken mogen hierheen verhuizen, zodat we kunnen terugzien wat we al gedaan hebben.)_

### Meldingen
- [x] **Notificatiewaslijst bij openen app (0.1.8)**: trade-meldingen hadden geen totaalplafond, dus als meerdere open trades tegelijk een trigger raakten (typisch na een tijdje afwezigheid, zodra de voorgrond-poll voor het eerst weer draait) kwamen ze allemaal los binnen, dit voelde als spam. Krijg je niet als de telefoon vergrendeld is en blijft dicht, want dan draait de poll niet en de achtergrondtaak nauwelijks. Screenshot in `bugs/notificatiewaslijst.jpeg`. Opgelost met een totaalplafond van drie meldingen per ronde in `notifications/tradeChecks.ts`; bij meer dan één worden ze gebundeld tot één samenvattende melding (native Android-groepering bestaat niet in `expo-notifications`).
- [x] **Trade-bewuste pushmeldingen bouwen**: `notifications/tradeChecks.ts` checkt de open trades op verse candles en meldt twee dingen: doel in zicht met sterk momentum (voorstel om TP te verhogen naar het verse ATR-doel) en in winst terwijl het momentum afvlakt (voorstel om de stop naar break-even of een ATR onder de koers te trekken). Herhaal-suppressie van zes uur per trade + trigger, doorbroken als het voorgestelde niveau meer dan 2% verschuift.
- [x] **Meldingen als er een hele sterke koop is**: high conviction-kansen in coins die je nog niet hebt, hooguit drie per ronde, scan hooguit eens per uur. Leunt op `analyseerMarkt()` en erft daarmee de marktklimaat-poort.
- [x] Achtergrond-sync: `expo-background-task` + `expo-task-manager`, taak in `notifications/achtergrondtaak.ts`. Draait ook als de app dicht is (Android-ondergrens een kwartier, systeem kiest het moment); de prijs-poll in `PortfolioProvider` doet dezelfde check elke vijf minuten zolang de app open staat.

### Bugfixes
- [x] **Tegenstrijdige stop-loss op trade-toevoegen scherm**: `valideerStopLoss` waarschuwde alleen en liet de afgekeurde waarde staan. Vervangen door `bepaalStop()` in `engine/etoroLimieten.ts` met vier uitkomsten: niets aan de hand, eToro stelt de stop zelf in (het formulier toont hem dan als "STOP (KADER)", niet als iets om in te vullen), stop bijgesteld naar eToro's minimum of maximum, of alleen een waarschuwing als er geen grens is om op te clampen. De getoonde stop en de herberekende R/R zijn ook wat er opgeslagen wordt, want `notifications/tradeChecks.ts` bewaakt precies die niveaus.
- [x] **Overlay-animatie voor pop-ups**: `BottomSheet` gebruikte `Modal animationType="slide"`, waarbij de overlay de root-child is en dus als één geheel met het vel omhoog schoof. Nu `animationType="fade"` voor de overlay (ook bij sluiten, zonder eigen mount-boekhouding) plus een eigen opacity/translateY op het vel via `Animated`, met `useReduceMotion`. Het vel is zelf de geanimeerde component: een wrapper eromheen brak de `maxHeight` in procenten die vijf sheets gebruiken.
- [x] **Melding voor analyse komt ochtends dubbel (0.1.10)**: een dagelijkse melding die een oudere app-versie ooit onder een andere identifier insplande werd bij het opruimen nooit geraakt en bleef naast de nieuwe afgaan. `stelDagelijkseMeldingIn()` wist nu alle ingeplande meldingen voordat de herinnering opnieuw wordt ingepland (`notifications/meldingen.ts`). Bonus: de uurrem in `checkOpenTrades` (`notifications/tradeChecks.ts`) wordt nu vóór het werk geclaimd i.p.v. erna, zodat een overlap tussen voorgrondcheck en achtergrondtaak ook geen trade-melding meer dubbel kan sturen.
- [x] **Geen melding-context in app (0.1.10)**: belletje-icoon met ongelezen-teller in `ScreenHeader.tsx`, opent `MeldingenSheet.tsx` met het meldingenlog (titel, uitleg, tijdstip). Verstuurde trade-meldingen worden gelogd in `SLEUTELS.meldingLog` (`notifications/tradeChecks.ts`).
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
- [x] **Bron per positie op Portfolio**: open trades staan gegroepeerd per bron (eToro of handmatig), met een inklapbare balk per groep waarvan de stand bewaard blijft (`SLEUTELS.portfolioBronDicht`). Bij één bron geen balken. Kevin vroeg om een filter-dropdown, het zijn groepen geworden: je ziet zo alles tegelijk in plaats van steeds te moeten wisselen. "Gekoppelde apps" is overgeslagen zolang eToro de enige koppeling is.
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
- [x] **Hamburger/kebab menu voor systeem-knoppen (0.1.11)**: belletje, boek en tandwiel in de header waren drie losse knoppen en maakten de balk te vol. Samengevoegd tot één kebab-icoon (drie puntjes, `SysteemMenu.tsx`) dat als dropdown onder het icoon uitklapt; een rood bolletje op het icoon toont ongelezen meldingen, het aantal staat op de "Meldingen"-regel binnenin.
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
