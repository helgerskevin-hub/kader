# Plan: copy trading in Kader

Status: concept, 8 november 2026. Nog niets gebouwd.

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
| Ranglijst van traders | `GET /api/v2/portfolios/rankings?period=...` met filters `popularInvestor`, `riskScoreMin/Max`, `copiersMin`, `gainMin`, sortering `-gain` of `-copiers`, paginering `page`/`pageSize` | te meten |
| Ranglijst voor bekende namen | `POST /api/v2/portfolios/rankings/multiple?period=...`, body `{ usernames: [...] }`, max 100 | te meten |
| Kant-en-klare selecties | `GET /api/v2/portfolios/rankings/presets/{type}` (bijv. `low-risk`) | te meten |
| Open posities van een trader | `GET /api/v1/user-info/people/{username}/portfolio/live` | te meten |
| Rendementsverloop | User Stats: "Get investor gain time-series" en Users Info: "Get user performance history" | te meten, pad nog opzoeken |
| Verdeling over markten | User Stats: "Get asset allocation history" (om crypto-traders te herkennen) | te meten, pad nog opzoeken |
| Volledig kopiëren via eToro | Copy Trading: "Start copying an investor", met een demo-variant en een pre-check | te meten, pad nog opzoeken |

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
│ ▍ [ Houd vast om te kopiëren          ]   │
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
- Knop: de copy-variant van `OrderBevestigKnop` (zie 2). Raakdoel minimaal 44px.

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
- Sluiten gaat via de bestaande `VerkoopOrderSheet`. Niets nieuws.
- Sluit een trader een positie die jij van hem kopieerde, dan krijg je een melding (zie 5) en
  verschijnt op de kaart de badge `LET OP` met "cryptojan is uitgestapt".

### 1.6 Instellingen

Lucide `settings` rechts in de segmentrij opent een `BottomSheet`. Wordt één keer gevraagd bij het
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

**De ene druk.** Op de kaart staat de complete order al: coin, bedrag, stop, doel en hefboom. Daarom
is de knop op de kaart zelf de bevestiging, zonder sheet ertussen:

- Demo: één tik.
- Echt: één keer vasthouden (800 ms, `HOUD_VAST_MS`), met de rode regel "Dit is een echte order met
  echt geld." boven de knop. Dat is de bestaande `OrderBevestigKnop`, ingebouwd in de kaart.

Knoptekst: "Kopieer voor $50" (demo) en "Houd vast om te kopiëren" (echt).

Boven de knop staat de samenvatting die de bestaande regel voorschrijft, opgebouwd uit wat
daadwerkelijk verstuurd wordt: "Je koopt voor $50 aan BTC tegen de marktprijs. Stop-loss $66.900,
doel $72.000."

> **Let op, dit is een afwijking die we samen moeten goedkeuren.** Het handelsplan zegt nu: een knop
> op een kaart plaatst nooit een order, hij opent een sheet. Voor copy trading stellen we voor dat de
> vasthoud-knop op de kaart wel mag, omdat de kaart dezelfde samenvatting toont als de sheet en het
> vasthouden in echt-modus een bewuste handeling blijft. Zeggen Thom en Kevin nee, dan opent de knop
> de bestaande `KooporderSheet`, vooringevuld, en kost het twee handelingen.

Na de order:

- `haptiek('succes')` en het vinkje zodra eToro de order aanneemt, zoals nu.
- De kaart krijgt de regel "Gekopieerd · $50" met `check-circle` en de knop verdwijnt, zodat dubbel
  kopiëren niet kan. Daarnaast de bestaande single-flight-guard in `etoro.ts`.
- De positie verschijnt na de volgende sync in Portfolio en in Mijn copies.

Een copy wordt gekoppeld aan de trader in `copyHerkomst` (opslag): `{ etoroPositieId, trader,
bronPositieId }`. Zo weet Kader wie hij moet volgen voor de uitstapmelding.

## 3. De Kader-score voor traders

De ranglijst van eToro sorteert op rendement of copiers. Rendement alleen trekt gokkers omhoog: een
gelukstreffer met hoge hefboom. De Kader-score (0 tot 100) hergebruikt de bestaande
`engine/auditor.ts` en voedt die met API-data in plaats van overgetikte cijfers:

| Onderdeel | Bron | Auditor-functie |
|---|---|---|
| Consistentie | Maandrendementen uit de gain time-series | `analyseConsistentie()` |
| Risico | eToro risk score en grootste daling uit de gain time-series | `analyseRisico()` |
| Spreiding | Verdeling over coins uit de live portfolio | `analysePortfolio()` |

Harde drempels om in Ontdek te komen:

- Popular Investor (`popularInvestor=true`).
- Minimaal 12 maanden historie.
- Minimaal 50% van de portefeuille in crypto, uit de asset allocation history. Dit is wat "crypto
  trader" betekent; de exacte grens volgt uit fase 0.
- eToro risk score van hooguit 6.

Het oordeel volgt de bestaande grenzen van de auditor: groen wordt `KOPIEER`, geel `VOLG`, rood
`VERMIJD`. De aanbevolen Copy Stop Loss uit de auditor blijft zichtbaar in het profiel, want die
hoort bij "Kopieer alles via eToro".

Verversen: de ranglijst hooguit eens per zes uur, de gain time-series per trader hooguit eens per
dag, beide gecachet in AsyncStorage met dezelfde aanpak als `useStopLossLimiet.ts`.

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

Uitleg in de sheet, onder het bedrag: "Bij een short of hefboom kan een positie meer verliezen dan
de inzet. De Copy Stop Loss stopt de hele copy als die grens wordt geraakt."

Dit staat in fase 3 omdat de endpoints nog gemeten moeten worden.

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

## 8. Open vragen voor Thom en Kevin

1. Akkoord met de copyknop op de kaart (2), of toch via de sheet?
2. Traders-tab vervangen door Copy (1), of als vijfde tab ernaast?
3. Startwaarde copybedrag: $50 goed?
4. Wat liet de Instagram-reel zien dat hier nog mist?

## 9. Aanbeveling voor uitvoering

| Fase | Model | Effort | Waarom |
|---|---|---|---|
| 0. Meten | Sonnet | middel | Scripts en documentatie, weinig risico |
| 1. Volgen | Opus | hoog | Nieuwe tab, veel bestaande componenten die precies hergebruikt moeten worden |
| 2. Eén druk | Opus | hoog | Geldpad: daarna een aparte review door een agent die het werk niet zelf schreef, zoals bij `security-review-2026-07-13.md` |
| 3. Alles kopiëren | Opus | middel | Kleiner, maar ook een geldpad |

*Geen financieel advies. De koers op eToro kan afwijken.*
