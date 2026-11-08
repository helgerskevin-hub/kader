# Plan: copy trading in Kader

Status: gebouwd op branch `copy-trading`, 8 november 2026. Nog niet gemeten tegen een echte
eToro-sleutel en nog niet op een toestel getest; zie "Wat er gebouwd is" onderaan.

Dit document is de opdracht voor de implementeerder. Alle kleuren zijn tokens uit
`app/src/theme/tokens.ts`, alle tekststijlen komen uit `app/src/theme/typography.ts`, en elk nieuw
scherm of elke nieuwe sheet hergebruikt de bestaande basiscomponenten. Gebruikerstekst in dit
document is letterlijk overneembaar: Nederlands, nuchter, geen em-dashes.

## Context

Vandaag beoordeelt de tab Traders een eToro Popular Investor op basis van cijfers die de gebruiker
zelf van eToro overtikt. Daarna moet hij zelf in de gaten houden wat die trader doet en elke trade
met de hand nadoen. Dat is traag, en tegen de tijd dat je het ziet is de koers al verschoven.

Doel:

1. In Kader zelf een overzicht van de beste crypto traders op eToro, zonder overtikken.
2. Een trader favoriet maken met één tik.
3. Een melding zodra een favoriete trader een crypto-trade opent.
4. Die trade kopiëren met één druk op de knop.

Voor alles geldt: zo min mogelijk tikken, en het scherm blijft rustig en overzichtelijk.

De meegestuurde Instagram-reel kon niet automatisch geopend worden. Laat een van ons beschrijven wat
erin te zien is, dan wordt dat hier aangevuld.

## Beslissingen die vastliggen

| Vraag | Keuze |
|---|---|
| Bron van traders en trades | eToro Public API, met dezelfde sleutel die Kader al heeft. Geen scraping, geen tweede bron. |
| Welke trades | Alleen directe crypto-posities van de trader, binnen de 57 coins van `STANDAARD_UNIVERSUM`. Trades die de trader zelf weer kopieert (`socialTrades`) tellen niet mee. |
| Richting | Alleen long is kopieerbaar. Shorts verschijnen wel in de feed, met de tekst "Short, Kader kopieert alleen long". Reden: `PortfolioTrade` heeft geen richting-veld en alle checks gaan uit van long. |
| Hefboom | Altijd 1x, ook als de trader hefboom gebruikt. De hefboom van de trader staat er wel bij. |
| Bedrag | Eén vast copybedrag in dollars, één keer ingesteld. `orderCurrency` accepteert alleen `"usd"`. |
| Stop-loss | Altijd mee. Heeft de trader er een, dan die; anders de Kader-stop (swing low, geklemd op 0,5x tot 3x ATR). Beide gaan eerst langs de eligibility-check. |
| Demo of echt | Volgt de bestaande Demo/Echt-schakelaar. Standaard demo. |
| Server | Geen, in fase 1 en 2. Zie "Vertraging van meldingen" voor wat dat betekent en wanneer dat heroverwogen wordt. |

## eToro-endpoints

Gevonden in de eToro API-documentatie (api-portal.etoro.com). Status "te meten" betekent: staat in
de documentatie, maar nog niet zelf geprobeerd. Fase 0 meet ze allemaal met de demo-sleutel, net
zoals in `docs/etoro-direct-handelen-plan.md` 9a.

| Doel | Endpoint | Status |
|---|---|---|
| Ranglijst van traders | `GET /api/v2/portfolios/rankings?period=OneYearAgo&popularInvestor=true&riskScoreMax=6&sort=-copiers&pageSize=100` | gebouwd, te meten |
| Ranglijst voor bekende namen | `POST /api/v2/portfolios/rankings/multiple?period=...`, body `{ usernames: [...] }`, max 100 | gebouwd, nog niet gebruikt |
| Open posities van een trader | `GET /api/v1/user-info/people/{username}/portfolio/live` (eigen quotum 60/min) | gebouwd, te meten |
| Maandrendement | `GET /api/v2/portfolios/{username}/gain/monthly?count=12`, `gain` als fractie | gebouwd, te meten |
| Instrument naar coin | `GET /api/v1/market-data/instruments?instrumentIds=...` (bestond al) | bestaand |
| Copy starten | `POST /api/v2/trading/copy`, body `{ parentCID, amount, referenceID }`; demo: `/api/v2/trading/copy/demo` | gebouwd, te meten |
| Copy droogtest | `POST /api/v2/trading/copy/eligibility`; demo: `/api/v2/trading/copy/demo/eligibility` | gebouwd, te meten |
| Uitkomst copy | `GET /api/v2/trading/copy/{referenceId}` (404 = nog bezig); demo: `.../copy/demo/{referenceId}` | gebouwd, te meten |
| Copy stoppen | `POST /api/v2/trading/copy/close`, body `{ mirrorID, unregisterType: "Close" }`; demo: `.../copy/demo/close` | gebouwd, te meten |
| Je eigen copies | `clientPortfolio.mirrors` in je eigen portfolio, met `stopLossPercentage` en `stopLossAmount` | gebouwd, te meten |

De ranglijstregels zijn rijker dan gedacht: naast `gain`, `riskScore` en `copiers` staan er
`peakToValley`, `profitableMonthsPct`, `winRatio`, `highLeveragePct`, `topTradedAssetClassId` en
`topTradedInstrumentPct` in. De Kader-score komt daarom direct uit de ranglijst, zonder extra
verzoeken per trader. Welke velden een fractie zijn en welke een procent is niet gemeten;
`alsPct()` in `engine/copyTrading.ts` leest allebei.

Wat de live portfolio per positie teruggeeft: `positionId`, `openTimestamp`, `openRate`,
`instrumentId`, `isBuy`, `leverage`, `stopLossRate`, `takeProfitRate`, `investmentPct`,
`netProfit`, `parentPositionId`. Geen bedrag in geld en geen symbool: Kader vertaalt `instrumentId`
naar een symbool via een omgekeerde versie van de bestaande `etoroInstrumentIds`-cache, en een id die
niet in de 57 coins zit, telt niet mee.

Quotum: de live portfolio heeft een eigen limiet van 60 verzoeken per 60 seconden, los van handelen.
Elk verzoek stuurt een echte GUID in `x-request-id` via `guid()`.

## 1. De tab

De tab **Traders** wordt **Copy**. Reden: twee tabs over traders naast elkaar is niet overzichtelijk,
en de nieuwe ranglijst levert de cijfers die de gebruiker nu overtikt. De handmatige beoordeling
blijft bestaan voor traders die niet in de ranglijst staan (zie 1.4). Er blijven vier tabs.

In `BottomNav.tsx`:

```ts
{ id: 'copy', label: 'Copy', Icon: Copy },   // lucide 'copy', zoals in de huisstijl-icoonset
```

Bovenaan het scherm staat `ScreenHeader` zoals op elke tab. Daaronder een `SegmentKnop` met drie
standen. De tab opent op **Feed** als er minstens één favoriet is, anders op **Ontdek**.

```
Feed · Ontdek · Mijn copies
```

### 1.1 Feed: wat doen mijn traders nu?

Een lijst `CopyTradeKaart`, nieuwste bovenaan, alleen van favorieten.

```
┌───────────────────────────────────────────┐
│ ▍ (avatar) cryptojan         12 min       │
│ ▍ (BTC)  Bitcoin · LONG                   │
│ ▍                                         │
│ ▍ STOP ────────── ENTRY ──────────── DOEL │   StopDoelBaan
│ ▍ $66.900        $68.420         $72.000  │
│ ▍                                         │
│ ▍ Nu $68.610 · +0,3% sinds de trader      │
│ ▍ Jij: $50 · hefboom 1x                   │
│ ▍ [ Kopieer voor $50                ]   │
└───────────────────────────────────────────┘
```

- Kaart: `colors.kaart`, `radii.kaart`, `shadow.kaart`, padding `spacing.base`. Linkerrand
  (adviesrand uit de huisstijl): `colors.winst` als kopiëren kan, `colors.letOp` bij "Te laat",
  `colors.rand` bij niet kopieerbaar.
- Bovenregel: avatar 24px rond, gebruikersnaam in `Type.sectiekop`, tijd in `Type.caption`
  `colors.tekstGedimd`.
- Coin: `CoinLogo` plus naam in `Type.body`, richting als pill (`radii.pill`) met label `LONG`.
- Niveaus: de bestaande `StopDoelBaan`, met de stip op de live koers.
- Alle getallen in IBM Plex Mono met `tabular-nums`, altijd met teken: `+0,3%`.
- Knop: "Kopieer voor $50", opent de vooringevulde koopsheet (zie 2). Raakdoel minimaal 44px.

Koersverschuiving: Kader vergelijkt de live koers met de `openRate` van de trader.

| Situatie | Wat de kaart toont |
|---|---|
| Koers tot +2% boven de entry van de trader | Knop actief |
| Koers meer dan 2% hoger | Knop uit, regel in `colors.letOp` met `alert-triangle`: "Te laat: de koers staat 3,4% hoger dan bij de trader." |
| Koers onder de stop van de trader | Knop uit: "De koers staat al onder de stop van de trader." |
| Trader heeft de positie al gesloten | Knop uit: "cryptojan heeft deze positie gesloten." |
| Short | Knop uit: "Short, Kader kopieert alleen long." |
| Coin buiten de 57 van Kader | Kaart niet tonen |

De 2% is een startwaarde, net als de drempels in `drempels.ts`. Na een paar weken meten we of hij
klopt en leggen de uitkomst vast in `docs/metingen.md`.

### 1.2 Ontdek: wie is goed?

Een lijst `TraderKaart`, gesorteerd op de Kader-score (zie 3).

```
┌───────────────────────────────────────────┐
│ (ring 78) cryptojan                   ☆   │
│           KOPIEER                          │
│  +34,2% 12 mnd · risico 4 · 1.208 copiers │
└───────────────────────────────────────────┘
```

- `ScoreRing` met de Kader-score rond de avatar, zoals de score rond een coinlogo op Markt.
- Oordeelbadge uit de huisstijl: `KOPIEER` (`colors.winst`), `VOLG` (`colors.letOp`),
  `VERMIJD` (`colors.verlies`). Altijd met label, nooit kleur alleen.
- Ster rechtsboven, lucide `star`: leeg in `colors.tekstGedimd`, gevuld in `colors.goud`.
  `accessibilityLabel`: "Maak cryptojan favoriet" en "Haal cryptojan uit favorieten".
- Boven de lijst drie filterpillen, zoals `MarktFilters`: `Alles` · `Laag risico` · `Meeste copiers`.
  Meer filters zijn er niet.
- Tik op de kaart (niet op de ster) opent het traderprofiel.

### 1.3 Traderprofiel

Een full-screen `PodiumScherm` dat uit de kaart groeit en met swipe-terug sluit, net als
`CoinDetailScherm`.

- Kop: avatar, naam, ster, ScoreRing en oordeel.
- Rendementsgrafiek (12 maanden) met `PrijsGrafiek` of `Sparkline`.
- De drie deelscores van de auditor: consistentie, risico, spreiding.
- Open crypto-posities van de trader, elk als compacte rij met de copyknop.
- Onderaan: "Kopieer alles via eToro" (zie 4) en `Disclaimer`.

### 1.4 Handmatig beoordelen

Het bestaande formulier uit `TradersScreen.tsx` verhuist naar een `BottomSheet` achter een subtiele
knop onder in Ontdek: "Trader niet gevonden? Beoordeel handmatig". Er verandert niets aan de logica.

### 1.5 Mijn copies

- Bovenaan één samenvattingskaart: aantal open copies en het open resultaat in mono, met teken.
- Daaronder de open posities die uit een copy kwamen, met de bestaande `PositieKaart` en per kaart
  een regel in `Type.caption`: "Gekopieerd van cryptojan".
- Een tik op een kopie opent hem in Portfolio, waar verkopen via de bestaande `VerkoopOrderSheet` gaat.
- Sluit een trader een positie die jij van hem kopieerde, dan krijg je een melding (zie 5) en
  verschijnt op de kaart de badge `LET OP` met "cryptojan is uitgestapt".

### 1.6 Instellingen

Lucide `sliders-horizontal` rechts in de kop opent een `BottomSheet` (het tandwiel is al van de app-instellingen). Wordt één keer gevraagd bij het
eerste gebruik van de tab, daarna nooit meer.

| Veld | Standaard | Tekst in de sheet |
|---|---|---|
| Copybedrag | $50 | "Hoeveel zet je per gekopieerde trade in?" |
| Meldingen | aan | "Melding als een favoriet een crypto-trade opent" |
| Stille uren | 23:00 tot 07:00 | "Geen meldingen 's nachts" |

Geen instelling voor hefboom en geen instelling om de stop uit te zetten: die liggen vast.

### 1.7 Vier staten per scherm

| Staat | Feed | Ontdek |
|---|---|---|
| Gevuld | Lijst | Lijst |
| Leeg | `LegeStaatBeeld` met "Nog geen favorieten. Tik op de ster bij een trader en zijn trades verschijnen hier." en de knop "Naar Ontdek" | "Geen traders gevonden met dit filter." |
| Laden | `SkeletonKaart` x3 | `SkeletonKaart` x5 |
| Fout | "Kader kan eToro nu niet bereiken." met knop "Opnieuw" | idem |
| Geen koppeling | "Koppel eToro om traders te zien." met knop die `EtoroKoppelingWizard` opent | idem |

## 2. Kopiëren met één druk

Dit is een geldpad. De regels uit `docs/etoro-direct-handelen-plan.md` hoofdstuk 4 gelden volledig:
fail-closed, nooit automatisch herhalen, een `verzoekId` per order, een onbekende uitkomst wordt
verzoend en niet opnieuw verstuurd.

**Zo is het gebouwd.** Er komt geen tweede orderpad bij. "Kopieer" opent de bestaande
`KooporderSheet`, vooringevuld met het copybedrag, de verse koers, en de stop en het doel van de
trader (of van Kader). Alle bestaande veiligheden gelden dus: saldo, stopcontrole bij eToro,
verliesrem, demo/echt en onbekende uitkomsten.

- **Vanuit een melding:** een tik op de melding opent Copy en meteen de ingevulde sheet. Daarna is
  de bevestigknop de enige handeling: één druk (demo: tik, echt: 800 ms vasthouden).
- **Vanuit de Feed of een profiel:** "Kopieer voor $50", daarna de bevestigknop. Twee handelingen.

Vlak voor de sheet opent, kijkt Kader opnieuw: verse koers, de 2%-grens, de stop van de trader. Is
de trade intussen weggelopen, dan opent de sheet niet en zegt Kader waarom.

> **Nog te beslissen.** De Feed kan naar één druk door de vasthoudknop in de kaart zelf te zetten.
> Dat wijkt af van de regel "een kaartknop opent altijd een sheet", dus dat is bewust niet gebouwd
> zonder jullie akkoord.

Na de order:

- `haptiek('succes')` en het vinkje zodra eToro de order aanneemt, zoals nu.
- De kaart krijgt de regel "Gekopieerd · $50" met `check-circle` en de knop verdwijnt, zodat dubbel
  kopiëren niet kan. Daarnaast de bestaande single-flight-guard in `etoro.ts`.
- De positie verschijnt na de volgende sync in Portfolio en in Mijn copies.

Een copy wordt gekoppeld aan de trader in `copyHerkomst` (opslag): `{ verzoekId, username,
bronPositieId, symbool, omgeving, tijd, etoroPositionID }`. Het `etoroPositionID` vult Kader zelf in
zodra de sync een nieuwe positie in dezelfde coin en omgeving oplevert. Zo weet Kader wie hij moet
volgen voor de uitstapmelding.

## 3. De Kader-score voor traders

De ranglijst van eToro sorteert op rendement of copiers. Rendement alleen trekt gokkers omhoog: een
gelukstreffer met hoge hefboom. De Kader-score (0 tot 100) hergebruikt de bestaande
`engine/auditor.ts` en voedt die met API-data in plaats van overgetikte cijfers:

| Onderdeel | Gewicht | Bron in de ranglijst | Hoe |
|---|---|---|---|
| Consistentie | 35% | `profitableMonthsPct` | 40% winstmaanden is 0, 80% of meer is 100 |
| Risico | 40% | `gain`, `peakToValley`, `riskScore` | letterlijk `analyseRisico()` uit de auditor |
| Spreiding | 25% | `topTradedInstrumentPct`, `highLeveragePct` | punten af boven 20% in één instrument, en bij veel hefboom |

Harde drempels om in Ontdek te komen:

- Popular Investor (`popularInvestor=true`) en een trader, geen Smart Portfolio.
- Minimaal 52 weken actief (`weeksSinceRegistration`).
- Crypto als kern: het meest verhandelde instrument is een van Kaders coins, of de assetclass ervan
  is crypto. Valt geen enkele regel onder de crypto-klasse, dan is de nummering kennelijk anders en
  filtert Kader niet op klasse, liever dan een lege lijst.
- eToro risk score van hooguit 6.

In het profiel staat ook hoeveel van zijn open posities nu in crypto zit.

Het oordeel volgt de bestaande grenzen van de auditor: groen wordt `KOPIEER`, geel `VOLG`, rood
`VERMIJD`. De aanbevolen Copy Stop Loss uit de auditor blijft zichtbaar in het profiel, want die
hoort bij "Kopieer alles via eToro".

Verversen: de ranglijst hooguit eens per zes uur (gecachet), of met trekken-om-te-verversen.

## 4. Kopieer alles via eToro

Naast trade-voor-trade biedt het profiel een tweede manier: eToro's eigen CopyTrader starten via de
Copy Trading-endpoints. eToro voert dan elke trade van de trader zelf uit, zonder vertraging en zonder
dat Kader iets hoeft te doen. Dat is nul tikken per trade.

- Knop in het profiel: "Kopieer alles via eToro".
- Opent een `BottomSheet` met bedrag en Copy Stop Loss (vooringevuld met het advies van de auditor),
  eerst de pre-check, daarna `OrderBevestigKnop`.
- Uitleg in de sheet: "eToro kopieert vanaf nu alle trades van cryptojan, ook die buiten crypto. Je
  stopt het kopiëren in eToro of hier."

### Extra regels, omdat eToro dan alles kopieert

Bij "Kopieer alles" neemt eToro ook shorts en hefboom van de trader over. Een short kan meer
verliezen dan de inzet van die ene positie, en hefboom versnelt elk verlies. Daarom:

1. **Alleen voor rustige traders.** De knop is alleen actief als de trader een lage gemiddelde
   hefboom heeft (hooguit 2x) en weinig shorts (hooguit 20% van zijn open posities). Gemeten op zijn
   live portfolio op het moment dat je de sheet opent. Anders staat er in plaats van de knop: "Deze
   trader gebruikt veel hefboom of shorts. Kopieer zijn trades liever een voor een."
2. **Copy Stop Loss verplicht.** Het veld kan niet leeg en niet op 0. Standaard staat het op het
   advies van de auditor. De gebruiker mag het krapper zetten, niet ruimer dan 50%.

   **Beperking die pas bij het bouwen bleek:** eToro's API heeft bij het starten van een copy geen
   veld voor de Copy Stop Loss. Kader kan hem dus niet zelf zetten. Wat er wel gebouwd is: Kader legt
   de gekozen grens vast, zegt na het starten "Zet in eToro je Copy Stop Loss op X%", en vergelijkt
   in Mijn copies de grens die eToro werkelijk heeft (`stopLossPercentage` uit je eigen portfolio)
   met wat je koos. Staat hij ruimer, dan staat er een LET OP bij met wat je moet doen.

Uitleg in de sheet, onder het bedrag: "Bij een short of hefboom kan een positie meer verliezen dan
de inzet. De Copy Stop Loss stopt de hele copy als die grens wordt geraakt."

Gebouwd, maar de endpoints moeten nog gemeten worden in demo (`scripts/etoro-copy-meting.ts --copy=`).

## 5. Meldingen

### Nieuwe trade herkennen

Nieuw bestand `app/src/notifications/traderChecks.ts` met `checkFavorieteTraders()`:

1. Per favoriet de live portfolio ophalen.
2. Vergelijken met de laatst bekende `positionId`'s per trader (opslag: `traderPosities`).
3. Een nieuwe positie die voldoet aan de regels uit "Beslissingen" wordt een melding.
4. Een verdwenen positie waarvan de gebruiker een copy heeft (`copyHerkomst`) wordt een uitstapmelding.

De eerste keer na het toevoegen van een favoriet worden alle bestaande posities als bekend
opgeslagen, zonder melding. Anders krijg je bij elke nieuwe favoriet een stapel oude trades.

Twee aanroepers, zoals bij `tradeChecks.ts`:

- Op de voorgrond: elke 60 seconden zolang de Copy-tab open is, anders elke 5 minuten. Bij maximaal
  20 favorieten blijft dat ruim onder het quotum van 60 per minuut.
- Op de achtergrond: dezelfde `expo-background-task`-taak in `achtergrondtaak.ts`. Die mag alleen
  lezen en melden, nooit een order plaatsen. Dat is de bestaande invariant.

Herhaal-suppressie: per `positionId` hooguit één melding, opgeslagen zoals `meldingSuppressie`.

### Tekst

Via `stuurTradeMelding()` op het bestaande kanaal:

- Titel: "cryptojan kocht BTC"
- Tekst: "Long op $68.420 · stop $66.900 · doel $72.000. Tik om te kopiëren."
- Uitstap: titel "cryptojan is uit BTC gestapt", tekst "Jij hebt deze trade ook. Tik om je positie
  te bekijken."
- Voettekst zoals elke melding: "Geen financieel advies · de koers op eToro kan afwijken"

Meerdere nieuwe trades van dezelfde trader binnen een check worden één melding: "cryptojan opende 3
trades". Tikken opent de app direct op de Feed, met die kaart bovenaan en kort opgelicht. Daar staat
de knop: melding, dan één druk.

### Vertraging van meldingen

Dit is de belangrijkste beperking van een app zonder server. Android laat een achtergrondtaak
hooguit eens per 15 minuten draaien, en het systeem kiest zelf het moment. Een melding kan dus 15
minuten of later na de trade binnenkomen. Op de voorgrond is het binnen een minuut.

De koersverschuivingscheck uit 1.1 vangt het risico af: is de koers te ver weg, dan staat de knop
uit en zie je waarom.

Wordt dit in de praktijk te traag, dan is de oplossing een kleine "wachter" in de cloud die elke
minuut de favorieten controleert en een push stuurt via de Expo-pushdienst. Dat breekt het principe
"alles op je telefoon, geen server", en de wachter heeft een eToro-leessleutel en de lijst met
favorieten nodig. Dat is een aparte beslissing, pas na een paar weken meten. "Kopieer alles via
eToro" (4) heeft dit probleem niet en is voor sommige traders het betere antwoord.

## 6. Bestanden

Nieuw:

| Bestand | Inhoud |
|---|---|
| `app/src/engine/etoroTraders.ts` | Client voor rankings, live portfolio, gain time-series en asset allocation. Hergebruikt `etoroFetch`. |
| `app/src/engine/traderScore.ts` | Kader-score en drempels, bovenop `auditor.ts`. Puur, zonder UI. |
| `app/src/state/useFavorieteTraders.ts` | Zelfde vorm als `useFavorieten.ts`, eigen sleutel `favorieteTraders`. |
| `app/src/state/CopyProvider.tsx` | Feed, ranglijst, cache en de voorgrond-poll. |
| `app/src/notifications/traderChecks.ts` | `checkFavorieteTraders()`, zie 5. |
| `app/src/screens/CopyScreen.tsx` | De tab, vervangt `TradersScreen.tsx`. |
| `app/src/components/CopyTradeKaart.tsx` | Kaart in de Feed. |
| `app/src/components/TraderKaart.tsx` | Kaart in Ontdek. |
| `app/src/components/TraderProfielScherm.tsx` | Op basis van `PodiumScherm`. |
| `app/src/components/CopyInstellingenSheet.tsx` | Op basis van `BottomSheet`. |

Aanpassen: `BottomNav.tsx` (tab), `App.tsx` (pager, deep link vanuit de melding),
`achtergrondtaak.ts` (tweede check), `opslag.ts` (sleutels `favorieteTraders`, `traderPosities`,
`copyHerkomst`, `copyInstellingen`, `rankingCache`), `OrderBevestigKnop.tsx` (inbouwbare variant),
`CHANGELOG.md` en `app/src/changelog.ts` zodra iets landt.

Geen nieuwe native dependencies nodig.

## 7. Fasering

| Fase | Inhoud | Klaar als |
|---|---|---|
| 0. Meten | Alle endpoints uit de tabel met de demo-sleutel proberen via een script in `scripts/`, uitkomst in `docs/metingen.md`. Vooral: geeft de live portfolio echt de posities van een andere gebruiker terug, hoe snel verschijnt een nieuwe positie, en werkt de rankings-filter op crypto? | Elk endpoint "werkt" of "werkt niet" |
| 1. Volgen | Tab Copy met Ontdek, profiel, ster, Feed en meldingen. Knop opent nog de `KooporderSheet` vooringevuld. | Favoriet maken en een melding krijgen werkt in demo |
| 2. Eén druk | Copyknop in de kaart, `copyHerkomst`, Mijn copies, uitstapmelding | Een copy in demo met één druk, zichtbaar in Mijn copies |
| 3. Alles kopiëren | "Kopieer alles via eToro" | Een CopyTrader-relatie starten en stoppen in demo |
| 4. Beslissen | Na een paar weken: klopt de 2%-grens, is de vertraging acceptabel, is een wachter nodig? | Besluit vastgelegd |

Verifiëren gebeurt per fase op de emulator met de `run-android` skill. Echt geld pas nadat demo een
week zonder fouten heeft gedraaid.

## 8. Gekozen bij het bouwen, nog te bevestigen

1. Kopiëren vanuit de Feed gaat via de bestaande koopsheet (twee handelingen), vanuit een melding is
   het één druk. Liever ook in de Feed één druk? Zie hoofdstuk 2.
2. Traders is vervangen door Copy, er blijven vier tabs. De handmatige beoordeling zit onder Ontdek.
3. Startwaarde copybedrag: $50. Voor "Kopieer alles" staat $200 voor; eToro's droogtest zegt of dat
   kan.
4. De Copy Stop Loss voor "Kopieer alles" zet je zelf in eToro, omdat de API daar geen veld voor
   heeft. Kader waarschuwt als hij ruimer staat dan je koos.
5. Wat liet de Instagram-reel zien dat hier nog mist?

## 9. Aanbeveling voor wat nog moet

| Stap | Model | Effort | Waarom |
|---|---|---|---|
| Meten in demo (`scripts/etoro-copy-meting.ts`) en bevindingen in `docs/metingen.md` | Sonnet | middel | Script draaien en eenheden vastleggen, weinig risico |
| Op de emulator lopen (`run-android` skill) en UI bijschaven | Opus | hoog | Nieuwe tab met veel gedeelde componenten; nog nooit op een toestel gezien |
| Review van het geldpad door een agent die het niet schreef | Opus | hoog | Kopiëren en "Kopieer alles" bewegen geld, zoals bij `security-review-2026-07-13.md` |

## 10. Wat er gebouwd is

| Bestand | Wat |
|---|---|
| `app/src/engine/copyTrading.ts` | Alle regels: score, drempels, nieuwe en gesloten posities, te laat, niveaus, Kopieer alles-toets. Self-check onderaan. |
| `app/src/engine/etoroTraders.ts` | eToro-client: ranglijst, live portfolio, maandrendement, symbolen, copy starten/toetsen/opvragen/stoppen, je eigen mirrors |
| `app/src/state/copyOpslag.ts` | Opslag: favorieten, instellingen, Feed, bekende posities, herkomst, ranglijst-cache, Kopieer alles |
| `app/src/state/CopyProvider.tsx` | Gedeelde stand en de voorgrond-poll |
| `app/src/state/kaderNiveaus.ts` | Kaders stop en doel als de trader er geen zette |
| `app/src/notifications/traderChecks.ts` | Nieuwe en gesloten trades herkennen, Feed bijwerken, melden. Ook in de achtergrondtaak. |
| `app/src/screens/CopyScreen.tsx` | De tab met Feed, Ontdek en Mijn copies |
| `app/src/components/copy/*` | Kaarten, profiel, instellingen, Kopieer alles, Stop copy, Mijn copies en de kopieerflow |
| `app/scripts/etoro-copy-meting.ts` | Meetscript voor fase 0 |
| `app/scripts/test-traderChecks.ts` | Speelt zes rondes van de trader-check na met nagebootste eToro-antwoorden |

Aangepast: `KooporderSheet` (startbedrag, eigen titel, melding na succes), `etoro.ts` (demo-paden
voor copy en openbare endpoints, een paar exports), `auditor.ts` (Copy Stop Loss-regel los),
`BottomNav`, `App.tsx`, `navigatie.tsx`, `meldingDoel.ts`, `MeldingenSheet`, `achtergrondtaak.ts`,
`opslag.ts`, `TradersScreen` (sluitknop), onboarding- en uitlegtekst, beide changelogs.

Getest: TypeScript zonder fouten, de self-checks van `copyTrading.ts` en `etoro.ts`, de nagespeelde
trader-check, en een volledige Android-bundel via `expo export`. Niet getest: tegen echte eToro-data
en op een toestel; daar was in deze omgeving geen sleutel en geen emulator voor.

*Geen financieel advies. De koers op eToro kan afwijken.*
