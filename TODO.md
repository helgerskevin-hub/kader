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

### 🐻 Plan: Kader bruikbaar maken in een bearmarkt

_(Het probleem: in een stijgende markt levert Kader elke dag concrete trades. Zodra `bepaalKlimaat()` in [marktklimaat.ts](app/src/engine/marktklimaat.ts) op ONGUNSTIG staat, sluit de poort en zegt de app in feite alleen nog "niet kopen". Dat klopt inhoudelijk, de backtest is er duidelijk over, maar het maakt de app maandenlang een leeg scherm. Kader moet in een dalende markt iets te doen hebben in plaats van alleen iets te verbieden.)_

**Stand van zaken (25 aug 2026)**: fase 1 en 2 staan in `feature/bearmarkt-modus`, geverifieerd op de emulator. Fase 3 en 4 staan bewust stil tot fase 0 gedraaid is; ze bouwen zonder die meting zou ingaan tegen de regel hieronder.

**Uitgangspunt dat niet ter discussie staat**: we verlagen nooit `DREMPEL_KOOP`, `MIN_RISK_REWARD` of de klimaatpoort om in een bearmarkt tóch signalen te kunnen tonen. Dat is precies de fout die geld kost. De app moet iets anders gaan doen, niet hetzelfde met soepelere drempels.

#### Fase 0: eerst meten, dan bouwen
- [ ] `npm run backtest` draaien en meting C/D/E/F opschrijven in dit bestand, zodat we per fase een nulmeting hebben. Zonder cijfers is elke keuze hieronder een gok.
- [ ] Meting F (shorts) is er al maar staat geparkeerd: score < 40 met BTC onder EMA200, doel 2x ATR, 20 dagen. Uitkomst per jaar bekijken: werkten shorts in 2018 en 2022 óók, of was 2025-26 toeval? Dit is de go/no-go voor fase 4.
- [ ] Nieuwe meting toevoegen: presteren mean-reversion-longs (diep oversold RSI, capitulatievolume, kort doel) beter dan momentum-longs in de jaren waarin de poort dicht stond? Dit is de go/no-go voor fase 3.

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

#### Fase 3: een tweede scoreprofiel voor bearmarktrally's
- [ ] De huidige scoring beloont trend, prijs boven EMA20, bullish MACD en volumepieken. Dat is een momentumprofiel en dat werkt in een dalende markt structureel slecht. Wat daar wél werkt is mean reversion: diep oversold, capitulatievolume, eerste hogere bodem, klein doel, korte houdtijd.
- [ ] `scoorCandles()` krijgt een profielparameter (`momentum` of `omkeer`) in plaats van een tweede kopie van de functie, zodat de backtest beide profielen door dezelfde engine kan draaien. Bij ONGUNSTIG kiest `analyseerMarkt()` het omkeerprofiel.
- [ ] Andere niveaus voor dat profiel: doel rond 1,5x ATR in plaats van 3x ATR en een kortere maximale houdtijd. Meting E laat al zien dat doel en houdtijd samen horen te bewegen. `MIN_RISK_REWARD` blijft staan, het doel wordt kleiner dus de stop moet krapper, niet de eis lager.
- [ ] Bouwen alleen als de meting uit fase 0 het steunt. Zo niet, dan is de eerlijke uitkomst dat de app in een bearmarkt geen longs geeft en blijft het bij fase 1 en 2.

#### Fase 4: shorts (het echte antwoord, maar ook het duurste)
- [ ] `PortfolioTrade` heeft geen richting-veld. Dat raakt meer dan het lijkt: [tradeChecks.ts](app/src/notifications/tradeChecks.ts) gaat overal uit van long, en de eToro-import slaat shortposities nu stilzwijgend over (zie de melding in [PortfolioScreen.tsx](app/src/screens/PortfolioScreen.tsx)). Het richting-veld toevoegen is stap één en heeft op zichzelf al waarde, ook zonder short-signalen: je ziet je eToro-shorts dan tenminste terug in de app.
- [ ] `scoorCandles()` gespiegeld voor short: stop net boven de recente swing high in plaats van onder de swing low, doel onder de entry, scoring op afwaartse trend. `stopAfstandStructuur()` krijgt daarvoor een richtingparameter.
- [ ] eToro-beperking uitzoeken voordat we UI bouwen: crypto shorten kan daar alleen als CFD en dus met hefboom, wat andere marginregels en andere stop-loss-limieten betekent. [etoroLimieten.ts](app/src/engine/etoroLimieten.ts) haalt de `Sell`-configs al op maar `kiesLimiet()` filtert nu bewust op hefboom x1 en richting Buy. Die data hebben we dus, we gebruiken hem alleen niet.
- [ ] Pas daarna de UI: richtingkeuze in de kooporder-sheet, en in het marktscherm per coin aangeven of long of short op dit moment het betere idee is.

#### Waar we vanaf blijven
- [ ] Geen drempelverlaging om het scherm te vullen. Een leeg marktscherm met uitleg is beter dan een verzonnen signaal, hetzelfde principe als bij de eToro-stoplimieten.
- [ ] Geen "koop de dip"-taal zonder gemeten onderbouwing. In een bearmarkt is elke dip er één te vroeg.

## 🔔 Meldingen

_(Alles wat achtergrond-sync en pushmeldingen nodig heeft, hoort hier samen.)_

- [ ] Prijsalerts instellen: notificatie als een coin een zelf gekozen prijs bereikt. De achtergrond-sync hiervoor staat er nu (`notifications/achtergrondtaak.ts`), dus dit is nog een kwestie van een prijs per coin kunnen instellen en die in `tradeChecks.ts` meenemen.
- [ ] Meldingen aan/uit kunnen zetten in Instellingen: nu staan de trade-meldingen altijd aan zodra je meldingen toestaat. `stopAchtergrondtaak()` in `notifications/achtergrondtaak.ts` bestaat al, er is alleen nog geen knop die 'm aanroept.
- [ ] Shorts in de meldingen: `PortfolioTrade` heeft geen richting-veld, dus de trade-checks gaan uit van long (stop onder entry, doel erboven) en slaan de rest over.

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
