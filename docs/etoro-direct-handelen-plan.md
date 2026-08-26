# Plan: direct handelen via de eToro API in Kader

## Context

Kader leest vandaag alleen uit eToro: posities, historie en stop-loss-limieten via een Real + Read-sleutel. De gebruiker ziet een signaal met entry, stop en doel, drukt op "Getrade" en typt dat handmatig over in eToro. Dat is dubbel werk en een bron van fouten: overtikken kost tijd, de prijs is inmiddels verschoven, en de stop belandt op een ander niveau dan Kader berekende.

Doel: kopen kan direct vanuit de analyse (Markt, Kansen, CoinDetail), verkopen vanuit het portfolio, en stop-loss/take-profit aanpassen op een lopende positie. Testen gebeurt eerst met een eToro DEMO-sleutel; echt geld komt pas in de laatste fase in beeld.

Dit is een geldpad. De hele opzet is fail-closed: bij twijfel gebeurt er niets, en er wordt nooit automatisch een order herhaald.

## Beslissingen die vastliggen

| Vraag | Keuze |
|---|---|
| Omvang | Kopen + verkopen + SL/TP wijzigen |
| Sleutels | ~~Aparte demo-sleutels naast de bestaande echte~~, plus een Demo/Echt-schakelaar. Standaard demo. **Achterhaald door de meting in 9a: eToro geeft een sleutel uit die in beide omgevingen werkt. Teruggedraaid naar een gedeeld sleutelpaar.** |
| Koopknop | Op TradeCard (Markt), OpportunityCard (Kansen) en CoinDetailScherm |
| Verkoopknop | Op PortfolioScreen, ter vervanging van Gewonnen/Verloren bij eToro-rijen |
| Demo-filter | Portfolio, statistieken en historie tonen alleen de actieve omgeving. Handmatige trades altijd |
| Optimistische lokale trade na een order | Nee. De sync levert de trade; alleen onopgeloste orders worden bewaard |
| Nieuwe `PortfolioTrade.status` | Nee. `status === 'open'` wordt in ~8 bestanden vergeleken |

## Geverifieerd API-contract

Host voor beide omgevingen: `https://public-api.etoro.com`. **De omgeving zit in het PAD, niet in een header.** ~~Demo- en echte sleutels zijn niet uitwisselbaar.~~

> **Correctie, na de meting van 2026-08-06 (zie 9a).** Die laatste zin klopt niet. eToro geeft een sleutel uit; `/api/v1/me` levert voor die ene sleutel zowel `etoro-public:trade.demo:read/write` als `etoro-public:trade.real:read/write`, en zowel een demo-pad als een echt pad wordt erdoor geaccepteerd. Het pad is daarmee het enige dat speelgeld van echt geld scheidt. De opslag van twee losse sleutelparen die uit deze aanname volgde is teruggedraaid naar een gedeeld paar: de gebruiker vulde zijn sleutel anders twee keer in, en stond hij in het andere vakje dan de actieve omgeving, dan was hij zonder melding niet gekoppeld.

- Openen: `POST /api/v2/trading/execution/orders` (demo: `/api/v2/trading/execution/demo/orders`)
  Body: `{ action: "open", transaction: "buy", instrumentId, settlementType, orderType: "mkt", leverage, amount, orderCurrency: "usd", stopLossRate, takeProfitRate, stopLossType: "fixed" }`. `stopLossRate` en `takeProfitRate` zijn **absolute koersen**, geen percentages.
  Antwoord 200: `{ token, orderId, referenceId }`, waarbij `referenceId` je `x-request-id` echoot.
- Sluiten: `POST /api/v1/trading/execution/market-close-orders/positions/{positionId}`, body `{ InstrumentId, UnitsToDeduct }` (`null` = volledig). Demo: `/api/v1/trading/execution/demo/market-close-orders/positions/{positionId}`.
- Niveaus wijzigen: `PATCH /api/v2/trading/positions/{positionId}`, body `{ stopLossRate, takeProfitRate, stopLossType, clearStopLoss, clearTakeProfit }`, antwoord 202. **Niet bevestigd, en waarschijnlijk onjuist.** Dit endpoint staat niet in eToro's gecureerde endpoint-index, de guide over marktorders kent alleen SL/TP bij het openen, en de pagina over positie-informatie noemt zichzelf expliciet read-only. Fase 4 hangt hier volledig op en moet empirisch beslist worden (`scripts/etoro-demo-order.ts --patch`) voor er iets gebouwd wordt.
- Symbool naar id: `GET /api/v1/market-data/search?internalSymbolFull=BTC` -> `{ items: [{ internalSymbolFull, instrumentId }] }`. Geeft ook gedeeltelijke treffers terug. Onderscheidende velden voor spot/CFD/aandeel zijn `instrumentTypeID`, `internalCryptoTypeId`, `isDelisted`, `internalAssetClassName`.
- Eligibility: demo heeft een eigen pad, `POST /api/v2/trading/info/demo/eligibility`. Het minimumbedrag per instrument zit in `leverageConfigs[].minPositionAmount`, een veld dat `etoroLimieten.ts` vandaag niet uitleest.
- Account: `GET /api/v1/me` -> `{ gcid, realCid, demoCid, username, scopes }`.
- `orderCurrency` accepteert uitsluitend `"usd"`, dus `amount` is in dollars. `settlementType` is een enum (`cfd`, `real`, `realFutures`, `marginTrade`); eToro's eigen BTC-voorbeeld laat het veld weg.
- Quota: trading execution 20/60s, **gedeeld over demo en echt samen**. Market-data en portfolio 60/60s (niet 120). Eligibility heeft zijn eigen 20/60s.

## 1. `etoroFetch` uitbreiden (`app/src/engine/etoro.ts`)

```ts
export type EtoroOmgeving = 'real' | 'demo';

export interface EtoroSleutels {
  apiKey: string;
  userKey: string;
  omgeving?: EtoroOmgeving;   // ontbreekt = 'real', bestaande aanroepen blijven werken
}

interface FetchOpties {
  versie?: 'v1' | 'v2';
  body?: unknown;
  methode?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  verzoekId?: string;   // aanroeper levert 'm, zodat een herhaling dezelfde id hergebruikt
  schrijft?: boolean;   // langere timeout en andere foutafhandeling
}
```

Methode blijft afgeleid van de body-aanwezigheid tenzij `methode` meekomt: alle zes bestaande aanroepen blijven ongewijzigd.

**Demo-pad via een expliciete tabel, gooien bij een onbekend pad.** Waar het `/demo/`-segment staat verschilt per endpointgroep en is niet uit één regel af te leiden. Verkeerd gokken betekent een echte order op een echt account, dus een pad dat niet in `DEMO_PADEN` staat levert een fout op in plaats van stilzwijgend het echte pad.

**Echte `AbortController`** in plaats van de huidige `Promise.race` (die de fetch niet afbreekt). Lezen 15s, schrijven 30s.

**Een afgebroken schrijfactie is nooit "mislukt".** Het afbreken van de client annuleert niets bij eToro. Dat wordt `onbekend`, en de app verzoent, hij herhaalt niet.

```ts
export type OrderUitkomst =
  | { soort: 'ok'; orderId?: number; token?: string }
  | { soort: 'fout'; bericht: string }                        // zeker niet uitgevoerd
  | { soort: 'onbekend'; bericht: string; verzoekId: string }; // kan uitgevoerd zijn

export function duidOrderStatus(status: number): 'ok' | 'fout' | 'onbekend';
```
200/201/202 -> ok. 400/401/403/404/422/429 -> fout (eToro wees hem af). >=500, netwerkfout, abort -> onbekend.

## 2. Nieuwe functies in `etoro.ts`

```ts
export async function haalAccountInfo(sleutels: EtoroSleutels): Promise<EtoroAccount>;
export function magHandelenVolgensScopes(scopes: string[]): boolean;
export async function haalVrijSaldo(sleutels: EtoroSleutels): Promise<number | null>;
export async function zoekInstrumentId(symbool: string, sleutels: EtoroSleutels): Promise<number | null>;

export async function plaatsKooporder(invoer: KooporderInvoer, sleutels: EtoroSleutels, verzoekId: string): Promise<OrderUitkomst>;
export async function sluitPositie(positionId: number, instrumentId: number, unitsToDeduct: number | null, sleutels: EtoroSleutels, verzoekId: string): Promise<OrderUitkomst>;
export async function wijzigNiveaus(positionId: number, wijziging: NiveauWijziging, sleutels: EtoroSleutels, verzoekId: string): Promise<OrderUitkomst>;

export function bouwKooporderBody(invoer: KooporderInvoer): Record<string, unknown>;  // puur, self-checkbaar
```

`verzoekId` is bewust verplicht en heeft geen default: op een geldpad mag je 'm niet kunnen vergeten.

`haalVrijSaldo` gebruikt `clientPortfolio.credit`, dat vandaag al geparsed wordt maar nergens gebruikt.

**Invariant, als commentaar bovenaan het orderblok:** deze drie functies mogen uitsluitend vanuit een expliciete gebruikersbevestiging aangeroepen worden. Nooit vanuit `setInterval`, de `AppState`-listener of `achtergrondtaak.ts`.

`app/src/state/useInstrumentId.ts`: zelfde vorm als `useStopLossLimiet.ts` (modulegeheugen + AsyncStorage + single-flight), maar **zonder TTL**. Symbool naar id verandert nooit en is identiek in demo en echt.

## 3. Opslag (`app/src/storage/opslag.ts`)

Zes platte sleutels erbij, geen migratie van bestaande namen:
```
etoroApiKey / etoroUserKey        ONGEWIJZIGD, dit zijn de ECHTE sleutels
etoroRealSchrijven                vlag uit /api/v1/me scopes
etoroDemoApiKey / etoroDemoUserKey / etoroDemoSchrijven
etoroOmgeving                     'demo' | 'real', standaard 'demo'
etoroInstrumentIds / onbekendeOrders
```

**`expo-secure-store` voor alle vier de sleutelparen**, met eenmalige migratie vanuit AsyncStorage bij eerste gebruik. Reden: `allowBackup="true"` betekent dat Android Auto Backup de AsyncStorage-database naar Google Drive stuurt. Een leessleutel daar is vervelend, een schrijfsleutel die echt geld kan verplaatsen is een andere categorie. Het is een first-party Expo-module, ongeveer 30 regels code inclusief migratie, en de native rebuild kost niets omdat verificatie toch al via `run-android` gaat. Zet daarnaast `allowBackup: false` in `app.json`, want het portfolio zelf blijft in AsyncStorage staan.

Nieuw: `app/src/state/etoroSleutels.ts`, want sleutels worden vandaag op zes plekken los van schijf gelezen en dat zou verdubbelen:
```ts
export async function actieveSleutels(): Promise<EtoroSleutels | null>;
export async function sleutelsVan(omgeving: EtoroOmgeving): Promise<EtoroSleutels | null>;
export async function bewaarSleutels(omgeving, s): Promise<void>;
export async function wisSleutels(omgeving): Promise<void>;
export async function haalOmgeving(): Promise<EtoroOmgeving>;
export async function zetOmgeving(o: EtoroOmgeving): Promise<void>;
export async function magHandelen(): Promise<boolean>;
```
Vervang de zes aanroepplekken (`App.tsx`, `useStopLossLimiet.ts:35`, `PortfolioProvider.tsx:327`, `PortfolioScreen.tsx:771`, `InstellingenSheet.tsx`, `EtoroKoppelingWizard.tsx:59`) door `actieveSleutels()`.

**Bug die dit onderweg oplost:** `useStopLossLimiet.ts` leest nu direct de echte sleutels. Bij een demo-opzet geeft dat een 401, dus `null` limieten, en dan zegt `bepaalStop` "ok" tegen elke stop. De stopvalidatie zou dood zijn op precies het pad waar hij het hardst nodig is.

## 4. Veiligheid

**Idempotentie.** De order-sheet maakt bij openen één `verzoekId` met `guid()` en hergebruikt die bij een handmatige herhaling. Sluiten en heropenen levert een nieuwe id op: dat is een bewuste nieuwe order. Of eToro werkelijk ontdubbelt op `x-request-id` of het alleen echoot is onbevestigd, dus leun er niet op.

**Nooit automatisch herhalen bij een schrijfactie.** Geen retry-lus, geen backoff. Bij `onbekend`:
1. De sheet blijft open en toont neutraal: "We weten niet of je order is doorgegaan. Kader kijkt nu bij eToro."
2. De order gaat **eerst** naar `onbekendeOrders` op schijf, zodat een app-kill op dat moment hem niet kwijtraakt.
3. `synchroniseer()` draait direct, daarna nog eens na ~5s.
4. Verschijnt er een passende positie, dan verdwijnt het record en toont de sheet de bevestiging.
5. Na 15 minuten zonder resultaat: een banner boven de portfoliolijst met de tijd van de order en één knop, **"Opnieuw controleren"**. Er is nergens een "opnieuw versturen".

**Bevestiging die je niet per ongeluk doet.** De koopknop op een kaart plaatst nooit een order, hij opent de sheet: minimaal twee bewuste handelingen. Eén gedeelde `OrderBevestigKnop` zodat alle drie de sheets identiek gedrag hebben. Boven de knop een samenvatting in gewoon Nederlands, opgebouwd uit de waarden die daadwerkelijk verstuurd worden, niet uit de formuliervelden: "Je koopt voor $250 aan BTC tegen de marktprijs. Stop-loss $92.400, doel $118.000." In **echt**-modus is de knop rood getint, staat er "Dit is een echte order met echt geld." bij, en moet je 'm ~800ms ingedrukt houden. In demo is het een gewone tik. Dubbele indiening geblokkeerd op twee niveaus: de `bezig`-state in de sheet plus een single-flight-guard op moduleniveau in `etoro.ts`.

**Verzoening.** Het orderantwoord bevat `orderId`, geen `positionId`. De positie bestaat pas in `/trading/info/portfolio` als de marktorder gevuld is. Dus bij `ok`: sheet sluiten, Nederlandse bevestiging, en na ~2s `synchroniseer()`. Geen lokale trade schrijven, want die heeft geen `etoroPositionID` en ontdubbeling gaat juist op dat veld: gegarandeerd dubbele rijen. `synchroniseer()` respecteert `HERSYNC_COOLDOWN_MS` niet (die cooldown zit alleen in de `AppState`-listener), dus een directe aanroep is al goed.

**Demo-badge en het omgekeerde.** De gevaarlijke toestand is vergeten dat je in **echt** staat. Dus allebei: een oranje `DEMO`-pil in `ScreenHeader` op elk scherm zolang demo actief is, en de luide waarschuwing in de sheet voor echt.

**Betaalbaarheidscontrole.** `haalVrijSaldo()` bij het openen van de sheet. Toont "Beschikbaar: $1.240", blokkeert bevestigen bij `bedragUsd > credit` met een inline rode melding in de `SluitTradeModal`-stijl, en bewijst meteen dat de sleutels van de actieve omgeving werken voordat er een order uitgaat.

**`bepaalStop` ongewijzigd hergebruiken.** De sheet gebruikt `useStopLossLimiet(symbool)` + `bepaalStop(entry, stop, limiet)` precies zoals `GetradeFormulier.tsx:77-85` dat doet:

| `advies.soort` | wat er verstuurd wordt | UI |
|---|---|---|
| `ok` | `stopLossRate = stop` | geen kader |
| `aangepast` | `stopLossRate = advies.stop` | bestaand waarschuwingskader |
| `vast` | `stopLossRate` **weggelaten** | kader: eToro zet zijn eigen stop |
| `waarschuwing` | niets, **bevestigen uitgeschakeld** | rode melding |

**De juiste positie verkopen.** `sluitPositie` heeft een `instrumentId` nodig, en een echt `positionId` naar het demo-endpoint sturen is een slechte afloop. Dus: `naarPortfolioTrade` schrijft voortaan `etoroInstrumentID` en `etoroOmgeving` mee. De verkoopknop verschijnt alleen als `bron === 'etoro'` **en** `etoroPositionID` **en** `etoroInstrumentID` bestaan **en** `(etoroOmgeving ?? 'real')` gelijk is aan de actieve omgeving. Oude opgeslagen trades missen die velden en herstellen zichzelf bij de volgende sync, want `importeerEtoroTrades` overschrijft geïmporteerde trades elke keer. Tot dan is de knop er simpelweg niet.

## 5. Statemodel

`app/src/state/portfolioTypes.ts` krijgt twee optionele velden: `etoroInstrumentID?: number` en `etoroOmgeving?: 'real' | 'demo'` (ontbreekt = `'real'`, alles van vóór deze versie).

Nieuw `app/src/state/lopendeOrders.ts`, puur en self-checkbaar:
```ts
export interface OnbekendeOrder { verzoekId; soort: 'koop'|'verkoop'|'niveaus'; symbool; omgeving; bedragUsd?; positionId?; tijd }
export function ruimOnbekendeOrdersOp(orders, trades, nu): { open: OnbekendeOrder[]; verlopen: OnbekendeOrder[] };
```

`PortfolioProvider` krijgt erbij: `omgeving`, `setOmgeving`, `magHandelen`, `onbekendeOrders`, `noteerOnbekendeOrder`, `controleerOnbekendeOrders`. Plus één filter, één keer bij de bron zodat elke consument het erft:
```ts
const zichtbareTrades = trades.filter(t => bronVan(t) === 'handmatig' || (t.etoroOmgeving ?? 'real') === omgeving);
```
Dat gaat als `trades` de context in. `tradesRef`, `importeerEtoroTrades` en `verwerkEtoroHistorie` blijven tegen de **volledige** lijst werken.

## 6. UI

**Nieuwe bestanden**
| Bestand | Wat |
|---|---|
| `components/OrderBevestigKnop.tsx` | Gedeelde bevestigknop: `bezig`, uitgeschakeld, kleur per omgeving, ingedrukt houden bij echt |
| `components/KooporderSheet.tsx` | `BottomSheet` + veldindeling van `GetradeFormulier` + `bepaalStop`-kader + vrij saldo + samenvatting |
| `components/VerkoopOrderSheet.tsx` | Naar het model van `SluitTradeModal` (`PortfolioScreen.tsx:506-585`) |
| `components/NiveausSheet.tsx` | Twee voorgevulde prijsvelden + `bepaalStop`-kader + wis-schakelaars |
| `state/etoroSleutels.ts`, `state/lopendeOrders.ts`, `state/useInstrumentId.ts` | zie boven |

**Gewijzigde bestanden**
- `TradeCard.tsx` — voetrij van 2 naar 3: Info | Getrade | Koop. Nieuwe optionele prop `onKoop?`; zonder schrijfsleutel is de kaart identiek aan vandaag.
- `KansenScreen.tsx` — `Koop` naast Getrade/Waarom, `KooporderSheet` naast de bestaande `GetradeFormulier` (regel 394).
- `CoinDetailScherm.tsx` — de sticky balk (285-297) van één knop naar twee: Getrade (secundair) + Koop via eToro (primair).
- `MarktScreen.tsx` — `onKoop` doorgeven (regel 127), sheet monteren (regel 185).
- `PortfolioScreen.tsx` — eToro-rijen in de actieve omgeving krijgen **Verkopen | SL/TP | Verwijder**. Handmatige rijen houden Gewonnen | Verloren | Aanpassen | Verwijder. Plus de banner voor onopgeloste orders boven de lijst.
- `TradeActiesSheet.tsx` — twee rijen erbij: Verkopen bij eToro, Stop-loss en doel aanpassen.
- `InstellingenSheet.tsx` — segmented control Demo | Echt in de stijl van de bestaande themakiezer. Naar Echt schakelen vraagt een native `Alert` om bevestiging en triggert een sync. De eToro-regel splitst in twee: demo-sleutels en echte sleutels, elk met eigen status (Niet ingesteld / Alleen lezen / Lezen en handelen).
- `EtoroKoppelingWizard.tsx` — prop `omgeving`. `testVerbinding()` gaat van `haalEtoroPortfolio` naar `haalAccountInfo` zodat hij de scope kan melden en `magHandelen` kan opslaan. Een leessleutel wordt nog steeds bewaard, hij ontgrendelt alleen het handelen niet.
- `ScreenHeader.tsx` — optionele DEMO-pil.

**Teksten die niet meer kloppen** en herschreven moeten: `EtoroKoppelingWizard.tsx:29-34` (`HOE_STAPPEN`, nu "Read niet Write" en "Real niet Demo"), `:174` ("Kader kan niets kopen, verkopen of wijzigen"), `:179`, `AchtergrondScherm.tsx:214`, `EtoroPromptSheet.tsx:25`.
**`changelog.ts:145` blijft staan.** Dat is de historische vermelding van wat 0.1.7 deed; die herschrijven vervalst de geschiedenis. Er komt een nieuwe changelog-regel bij.

## 7. Volgorde

**Fase 0, leidingwerk, geen orders, geen UI.** `etoroFetch` (`methode`, `verzoekId`, `schrijft`, omgeving, `demoPad`, AbortController), `duidOrderStatus`, `haalAccountInfo`, `haalVrijSaldo`, opslagsleutels, `etoroSleutels.ts`, secure-store-migratie, alle zes aanroepplekken om. Bewijst dat er niets stuk is.

**Fase 1, het kleinste dat bewijst dat het demo-order-endpoint werkt.** Een wegwerpscript, **geen app-code**: `app/scripts/etoro-demo-order.ts`, gedraaid met `npx tsx`, sleutels uit omgevingsvariabelen. Achter elkaar: `/api/v1/me` (scopes printen) -> `market-data/search?internalSymbolFull=BTC` (instrumentId) -> demo-portfolio (`credit`) -> demo-order met het kleinst denkbare bedrag (rauw antwoord printen) -> demo-portfolio opnieuw (units, `openRate`, `stopLossRate`, `takeProfitRate`). Past bij het bestaande patroon (`scripts/backtest.ts` draait al onder tsx), geen rebuild, itereert in seconden, en beantwoordt in één run het meeste uit §9. Bewust het eerste dat gebouwd wordt, want alles daarna hangt van de antwoorden af.

**Fase 2, kopen, alleen demo.** `zoekInstrumentId` + cache, `plaatsKooporder`, `KooporderSheet`, `OrderBevestigKnop`, koopknop op de drie plekken, `onbekend`-afhandeling + banner, demo-pil, omgevingsschakelaar, demo-wizard.

**Fase 3, verkopen.** `etoroInstrumentID` + `etoroOmgeving` op `PortfolioTrade`, het omgevingsfilter in de provider, `sluitPositie`, `VerkoopOrderSheet`, voetrij van `PortfolioScreen` en `TradeActiesSheet`.

**Fase 4, SL/TP wijzigen.** `wijzigNiveaus`, `NiveausSheet`, plus het demo-pad voor het PATCH-endpoint achterhalen (script uit fase 1 uitbreiden).

**Fase 5, echt.** Wizard voor de echte schrijfsleutel, bevestig-Alert bij omschakelen, ingedrukt-houden, alle alleen-lezen-teksten herschreven, changelog-regel, en tot slot één echte order op het minimumbedrag.

**Geschrapt:** het annuleer-endpoint (`DELETE /orders/{orderId}`), want marktorders vullen direct en er is niets in de wacht. En een rate limiter: 20 requests per 60 seconden tegenover een mens die twee keer per minuut een knop ingedrukt houdt; de single-flight-guard volstaat.

## 8. Verificatie

Er is geen testsuite; verificatie loopt via de `run-android`-skill op de emulator, plus `require.main === module`-zelfchecks onder `npx tsx`.

- **Fase 0:** `npx tsx app/src/engine/etoro.ts` slaagt. App starten met de bestaande echte leessleutel, pull-to-refresh op Portfolio: posities importeren nog steeds, syncstatus groen. Daarna sleutels wissen en opnieuw invoeren om het secure-store-pad te raken.
- **Fase 1:** script draaien. In eToro's eigen demo-account op het web staat een nieuwe BTC-positie met exact de units en niveaus die je stuurde. Noteer: minimaal geaccepteerd `amount`, welk `settlementType` werkte, of `leverage: 1` verplicht was, of `stopLossRate` geaccepteerd werd, het exacte demo-portfoliopad, en of dezelfde `x-request-id` twee keer sturen één of twee posities oplevert.
- **Fase 2:** in demo BTC kopen vanaf MarktScreen voor het minimumbedrag. Controleer: vrij saldo in de sheet komt overeen met eToro's demo Available; de samenvattingsregel komt overeen met wat er verstuurd wordt; de positie verschijnt binnen één sync in Kader en staat met dezelfde units en niveaus in eToro. Forceer daarna het onbekende pad: vliegtuigmodus direct na het bevestigen, en controleer dat de banner verschijnt, dat er nooit een tweede order uitgaat, en dat de banner zichzelf opruimt zodra de verbinding terug is.
- **Fase 3:** die positie verkopen vanuit de app. Hij verdwijnt na een sync uit de open lijst en staat in de historie met eToro's `netProfit` als `resultaatUsd`. Test de fail-closed-poort: schakel naar echt en controleer dat de verkoopknop bij de demo-positie weg is.
- **Fase 4:** stop verzetten op een open demo-positie, nieuw niveau controleren in eToro en in Kader na een sync. Controleer dat een stop buiten eToro's limieten door `bepaalStop` geblokkeerd wordt **voordat** er een request uitgaat.
- **Fase 5:** één echte order op het minimumbedrag, direct weer sluiten. Controleer dat ingedrukt-houden niet met een losse tik af te vuren is.

**Zelfchecks om toe te voegen:** in `etoro.ts` dat `demoPad()` elk bekend pad mapt en **gooit** bij een onbekend pad, dat `duidOrderStatus` 400/429 naar `fout` en 500 naar `onbekend` mapt, en dat `bouwKooporderBody` `stopLossRate` weglaat bij een lege stop. In `lopendeOrders.ts` dat `ruimOnbekendeOrdersOp` een koop oplost zodra de positie verschijnt, hem vasthoudt zolang dat niet gebeurt, en na 15 minuten laat verlopen. Voor `bepaalStop` niets nieuws: `etoroLimieten.ts:118-191` dekt dat al.

## 9a. Gemeten op 2026-08-06 met een echte sleutel (leesronde, geen order)

**De belangrijkste uitkomst: er bestaan geen aparte demo- en echte sleutels.** eToro geeft één sleutel uit die alle vier de rechten draagt: `etoro-public:trade.demo:read`, `trade.demo:write`, `trade.real:read`, `trade.real:write`. De omgeving zit uitsluitend in het PAD. Daarmee vervalt de aanname uit §11 dat een verkeerd pad "gewoon" een 401 geeft: een demo-pad en een echt pad worden allebei geaccepteerd door dezelfde sleutel, en het pad is het enige dat echt geld van speelgeld scheidt. `demoPad()` die gooit bij een onbekend pad is daarmee geen nette extra maar de kern van de beveiliging.

Verder beantwoord:

- **Vraag 1, settlementType.** Voor BTC x1 **long** is het `real`, met `allowEditStopLoss: true`, `allowStopLossTakeProfit: true`, `minStopLossPercentage: 10`, `maxStopLossPercentage: 100`. Een stop-loss wordt dus wél geaccepteerd op een niet-CFD cryptopositie. De grootste onbekende in het plan valt de goede kant op. (`cfd` hoort bij **short**, wat Kader niet doet.)
- **Vraag 2, minimumbedrag.** `minPositionAmount: 10` en `minPositionExposure: 10`, dus $10. Ook `maxUnitsPerOrder: 41` en `unitsQuantityType: "fractional"`.
- **Vraag 7, meerduidige tickers.** `internalSymbolFull=BTC` gaf **53** treffers: crosses (BTCA, BTCEUR, BTCJPY), en futures (BTC.APR27 tot en met BTC.DEC29). De spot-BTC is `internalSymbolFull === "BTC"` exact, `instrumentId 100000`. Alleen een exacte match is bruikbaar; velden om op te filteren zijn `internalAssetClassName: "Crypto"`, `internalCryptoTypeName`, `isBuyEnabled` en `isDelisted`.
- **Vraag 9, rechten.** Eén sleutel geeft lezen én schrijven, in beide omgevingen. Er is dus geen tweede sleutelpaar per omgeving nodig; de opslagvorm uit §3 kan simpeler.
- **Demo-paden bevestigd:** `/api/v1/trading/info/demo/portfolio` en `/api/v2/trading/info/demo/eligibility` geven allebei 200.
- **Eligibility-parsing klopt.** De echte respons gebruikt `direction: "long"` en `leverageValues: [1]`, precies wat `kiesLimiet()` verwacht.

Praktisch gevolg dat aandacht verdient: eToro eist voor BTC x1 een stop van **minimaal 10% onder de entry**. Kaders eigen stop (0,5x-3x ATR rond een swing low) ligt daar vaak binnen, dus `bepaalStop` zal regelmatig naar 10% opschuiven. Dat verandert het werkelijke risico per trade en dus de R/R die de gebruiker ziet.

### Uit de demo-order zelf (BTC, $10, positionID 3576802030)

Body die werkte, met `settlementType` **weggelaten**:
```json
{"action":"open","transaction":"buy","instrumentId":100000,"orderType":"mkt","leverage":1,
 "amount":10,"orderCurrency":"usd","stopLossRate":51592.8,"takeProfitRate":83838.3,"stopLossType":"fixed"}
```
Antwoord 200: `{"token":"...","orderId":371855197,"referenceId":"<onze x-request-id>"}`.

- **Vraag 1 definitief.** De positie kwam binnen met `stopLossRate: 51592.8` en `takeProfitRate: 83838.3`, exact zoals verstuurd, en `isNoStopLoss: false`. Een stop-loss werkt dus echt op een spot-cryptopositie. `settlementType` mag weg; eToro koos zelf `settlementTypeID: 1`.
- **Vraag 3, valuta.** `credit` ging van 74750,04 naar 74739,96, dus ruim $10 eraf voor een `amount` van 10, en de positie kreeg `amount: 9.98`. `amount` is dollars, en er gaat een klein bedrag aan kosten af bovenop je inleg. De betaalbaarheidscontrole moet dus niet op `bedrag <= credit` maar op iets van `bedrag * 1,02 <= credit`.
- **Vraag 4.** `leverage: 1` werkt.
- **Vraag 5, demo-pad van de PATCH.** Het endpoint **bestaat wel**, in tegenstelling tot wat de documentatie-index suggereerde: `PATCH /api/v2/trading/demo/positions/{positionId}` geeft **202** met `{operationId, positionId, referenceId}`. De stop verschoof daadwerkelijk van 51592,8 naar 54000 en `stopLossVersion` liep van 1 naar 2. De take-profit bleef ongemoeid toen we die niet meestuurden, dus een gedeeltelijke wijziging kan. **Let op de plaatsing:** `/demo/` zit hier direct achter `trading`, niet achter `positions`. De drie andere plaatsingen gaven `RouteNotFound`. Fase 4 is dus niet geblokkeerd.
- **Vraag 8, vultijd. Dit is het antwoord dat het plan raakt.** Het portfolio-endpoint toonde de positie **niet** na 0 seconden en **ook niet na 5 seconden**, terwijl de positie blijkens `openDateTime` op hetzelfde moment als de order al bestond. Bij een controle een paar minuten later stond hij er wel. Het portfolio-endpoint loopt dus achter op de werkelijkheid. De "na ~2s `synchroniseer()`"-opzet uit §4 gaat daarmee bijna altijd te vroeg kijken, en de gebruiker ziet ten onrechte niets. De verzoening moet herhaald kijken over een langere periode in plaats van één keer na twee seconden.

**Nog open:** ontdubbeling op `x-request-id` (vraag 6). `referenceId` echoot de meegestuurde id exact, maar of een tweede verzoek met dezelfde id een tweede positie oplevert is niet getest.

## 9. Openstaande vragen, alleen te beantwoorden met een echte demo-sleutel

1. **`settlementType` voor crypto**, `real` of `cfd`. Kader is x1 long zonder hefboom, dat wijst op `real`, maar het is niet zeker dat `stopLossRate` überhaupt geaccepteerd wordt op een niet-CFD cryptopositie. Als dat niet zo is verandert het hele stop-loss-verhaal en wordt `bepaalStop` alleen nog adviserend. **Grootste onbekende in dit plan.**
2. **Minimumbedrag per trade.** eToro's cryptominimum is meestal $10, maar demo kan afwijken en er bestaan minima per instrument. Tot dat bekend is heeft de sheet geen minimumvalidatie en krijg je een ondoorzichtige 400.
3. **Valuta van `amount`.** `orderCurrency: 'usd'` suggereert dollars, maar het account kan in euro's staan. Als `amount` de accountvaluta blijkt te zijn, klopt de betaalbaarheidscontrole niet en klopt elk "$"-label in de sheet niet.
4. **`leverage`**: verplicht of optioneel, en is `1` geldig bij `settlementType: 'real'`?
5. **Demo-pad voor de PATCH en voor market-close.** Alleen voor `orders` is de plek van het `/demo/`-segment geverifieerd. `demoPad` gooit bij een onbekend pad, dus dit faalt veilig, maar het blokkeert fase 4 tot het beantwoord is.
6. **Ontdubbelt `x-request-id` werkelijk bij eToro, of is het puur een echo?** Expliciet testen in demo. Zo niet, dan is de "nooit automatisch herhalen"-regel de enige bescherming en moet dat zo in het commentaar staan.
7. **Meerduidige tickers** in `market-data/search`: een symbool kan naar spot, CFD en een aandeel met dezelfde ticker wijzen. Tot de echte respons bekend is geeft `zoekInstrumentId` `null` bij twijfel en is kopen geblokkeerd.
8. **Vultijd:** verschijnt een marktorder binnen de ~2s-sync in het portfolio? Bepaalt de vertraging en de 15-minutengrens.
9. **Geeft een schrijfsleutel ook leesrechten?** Zo niet, dan heeft elke omgeving twee sleutelparen nodig en verdubbelt de opslagvorm uit §3.

## Aanbeveling voor uitvoering

- Fase 0 en 1: **Opus, hoge effort.** Fase 0 raakt de gedeelde `etoroFetch` waar elke bestaande aanroep doorheen loopt, en fase 1 bepaalt de antwoorden waar de rest op bouwt.
- Fase 2: **Opus, hoge effort.** Het geldpad, de onbekend-afhandeling en de bevestiging.
- Fase 3 en 4: **Sonnet, normale effort.** Zelfde patroon als fase 2, andere endpoints.
- Fase 5: **Opus, hoge effort.** Eerste echte order, en alle teksten die vandaag beloven dat de app niet kan handelen.

## 10. Meting shorts (26 aug 2026), voor fase 4 van het bearmarkt-plan

Gemeten tegen het demo-account met `npx tsx scripts/etoro-demo-order.ts` (alleen lezen, geen order).
Vraag was: kan Kader via deze API shorten, en is hefboom daarbij verplicht? In `TODO.md` stond de
aanname "crypto shorten kan bij eToro alleen als CFD en dus met hefboom". Die is half waar, en de
helft die niet klopt is de belangrijkste.

`POST /api/v2/trading/info/demo/eligibility` geeft per instrument twee `leverageConfigs`, en dat is
voor BTC, ETH, SOL, XRP en ADA identiek:

| richting | hefboom | settlementType | min SL | max SL | allowEditStopLoss | minPositionAmount |
|---|---|---|---|---|---|---|
| long | [1] | `real` | 10% | 100% | true | 10 |
| short | [1] | `cfd` | 10% | **50%** | true | 10 |

**Het is inderdaad een CFD, maar de hefboom is x1.** Kader hoeft zijn uitgangspunt (altijd zonder
hefboom rekenen) dus niet los te laten om te kunnen shorten. Daarmee vervalt de zorg die in het
bearmarkt-plan als duurste onderdeel van fase 4 stond: er zijn geen afwijkende marginregels en geen
ander risicoprofiel, alleen een ander `settlementType` in de orderbody.

Wat wel per richting verschilt, en wat dus gebouwd moet worden:

1. **De stop-loss-grens is de helft.** Short mag maximaal 50% van de entry af, long 100%. Vandaag
   pakt `kiesLimiet()` in `engine/etoroLimieten.ts` altijd de Buy-config, dus een short met een stop
   van 60% zou door Kader goedgekeurd worden en door eToro geweigerd. `kiesLimiet()` moet de config
   per richting kiezen en `StopLossLimiet` moet die richting meedragen.
2. **`bepaalStop()` rekent de afstand onder de entry.** Bij een short ligt de stop erboven, dus de
   hele functie moet gespiegeld worden, inclusief de teksten ("boven je aankoopprijs").
3. **`settlementType` moet mee in de orderbody**: `real` voor een long, `cfd` voor een short.
   `bouwKooporderBody()` heeft `transaction` en `leverage` nu hardgecodeerd.

Nog niet gemeten: of een demo-sell-order daadwerkelijk doorgaat en of `PATCH` op een shortpositie
werkt. Dat vraagt een echte order en is de laatste stap voor de UI af is.
