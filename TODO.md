# TODO

Takenlijst voor Kader. `- [ ]` is open, `- [x]` is klaar.

Achtergrond bij de keuzes hieronder staat in [docs/metingen.md](docs/metingen.md) (backtests) en
[docs/github-werkwijze.md](docs/github-werkwijze.md) (branches en PR's). Afgeronde taken staan in
[CHANGELOG.md](CHANGELOG.md), niet hier: deze lijst is alleen wat er nog moet gebeuren.

---

## 🎯 Waar Kader naartoe gaat

Kevins kernvisie: **één dashboard over al je platformen, met een doel en een algoritme dat je ernaartoe
stuurt, en posities die Kader zelf bewaakt.** Je geeft alleen toestemming om te kopen, de rest doet de app.

Dat is te groot voor één sprint, dus het is opgeknipt in vijf fasen. Elke fase is op zichzelf bruikbaar.
Fase 1 is af sinds 0.1.19, fase 2 is waar we nu aan werken.

### Fase 1: portfolio-dashboard ✅ af in 0.1.19
Van "lijst met trades" naar "overzicht van je geld". Alles op basis van data die we al binnenhalen.
Wat het geworden is staat in [CHANGELOG.md](CHANGELOG.md) onder 0.1.19 en 0.1.20.

- [x] Dashboard bovenaan Portfolio met beschikbaar geld, totale portfoliowaarde, waarde open posities,
      aantal open posities en een ingang naar je historie (`components/PortfolioStatusKaart.tsx`)
- [x] Beschikbaar geld uit eToro, inclusief het bedrag dat vastzit in wachtende orders
      (`bepaalSaldoStand()` in `engine/etoro.ts`)
- [x] Cirkeldiagram van de verdeling, per positie het percentage en het bedrag
      (`components/VerdelingKaart.tsx`, rekenwerk in `engine/verdeling.ts`)
- [x] "Mijn trades" heet Portfolio, "Open traders" heet Open posities

### Fase 2: doelstelling en projectie (nu mee bezig)
Een doel invullen en zien hoe je ervoor staat. Nog steeds alleen crypto, nog geen nieuwe databron nodig.

Uitgangspositie (gemeten, september 2026): hier ligt nog niets van. `engine/verdeling.ts` rekent alleen
de HUIDIGE verdeling uit en kent geen doel, en er is geen opslagsleutel voor een doel of een inleg.
Wel bruikbaar als voorbeeld: `engine/verdeling.ts` is het precedent voor een pure rekenmodule met een
self-check, en `state/useHandelskapitaal.ts` plus `SLEUTELS.handelskapitaal` zijn het precedent voor een
bedrag dat de gebruiker zelf invult en dat Kader nooit verzint. Ontwerp staat in
[docs/design-doelstelling-en-projectie.md](docs/design-doelstelling-en-projectie.md).

- [ ] Doelverdeling instellen: welk percentage wil je waar in hebben (bijv. 60% BTC, 20% ETH, 20% alt)
- [ ] Afwijking tonen: waar zit je te zwaar of te licht ten opzichte van je doel
- [ ] Bijstortplan: vul in wat je maandelijks inlegt, Kader rekent uit waar dat geld heen moet om
      richting je doel te bewegen. **Nooit "advies" noemen**, het is een rekensom op basis van jouw doel
- [ ] Projectie: verwachte waarde over X jaar op basis van inleg per maand plus een zelf ingevuld
      verwacht rendement. Toon expliciet dat dit een rekensom is en geen voorspelling

### Fase 3: aandelen en index-fondsen erbij
Hier komt de eerste echte uitbreiding: een tweede activaklasse en dus een tweede databron.

- [x] **Uitgezocht: welke gratis databron voor aandelen en ETF's?** Antwoord: het chart-endpoint van
      Yahoo Finance, `https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOOL}?range=2y&interval=1d`.
      Live getest in september 2026: AAPL, VOO, IVV, SPY, MSFT, VUSA.AS (Amsterdam) en VUAA.L (Londen)
      geven allemaal HTTP 200 met echte OHLCV plus een timestamp-reeks, precies wat `indicators.ts` nodig
      heeft. `interval=1wk` geeft weekcandles, wat fase 3 sowieso wil. Geen API-sleutel, dus niets dat uit
      de APK te lezen valt, hetzelfde principe als Binance en CoinGecko nu. `query2.finance.yahoo.com` is
      dezelfde dienst op een tweede host en dus de retry. Bij een fout is `chart.result` null en staat de
      reden in `chart.error.description`, bruikbaar voor een nette Nederlandse melding.
      Kanttekening om te onthouden: dit endpoint is niet officieel gedocumenteerd en kan zonder
      aankondiging veranderen. Yahoo bedoelt het voor persoonlijk, niet-commercieel gebruik, wat Kader is.
      Let op de beursafkorting per instrument: VUSA noteert op Amsterdam (`.AS`), VUAA alleen op Londen
      (`.L`), `VUAA.AS` bestaat niet. Blind `.AS` plakken gaat dus mis
  - [ ] Afgevallen, met reden, zodat niemand ze opnieuw onderzoekt: **Stooq** zit inmiddels achter een
        JavaScript-bot-check en geeft aan een mobiele client HTML terug in plaats van CSV. **Alpha
        Vantage** (25/dag), **EODHD** (20/dag), **Tiingo** en **FMP** (250/dag) en **Twelve Data**
        (800/dag) eisen allemaal een sleutel, en een sleutel in een client-app is door de gebruiker uit te
        lezen. Voorlopig dus alleen Yahoo, en pas een sleutelbron erbij als Yahoo in de praktijk hapert
- [ ] Universum uitbreiden: meer crypto's, plus aandelen en index-fondsen (in elk geval de Vanguard
      S&P500-ETF's die via DeGiro te kopen zijn)
- [ ] Tweede signaalprofiel voor de lange termijn: aandelen zijn kopen-en-vasthouden, niet swing-traden.
      Andere periode (weekcandles), ander doel, geen take-profit. **Eerst meten, dan bouwen**, zelfde regel
      als bij de shorts: geen profiel uitbrengen dat in de backtest geld kost
- [ ] Verkoopmelding voor lange-termijnposities: alleen als het echt misgaat, niet bij elke dip
- [ ] Verdeling per activaklasse in het dashboard: hoeveel procent crypto, aandelen, index-fondsen

### Fase 4: DeGiro erbij
- [ ] **Eerst uitzoeken: kán dit?** DeGiro heeft geen publieke API. Er bestaat een gereverse-engineerde
      API, maar die is fragiel en waarschijnlijk in strijd met hun voorwaarden. Realistisch alternatief is
      een periodieke import van het transactieoverzicht (CSV-export uit DeGiro). Uitzoeken wat DeGiro
      exporteert en of dat genoeg is om posities en inleg bij te houden
- [ ] Automatische inleg bijhouden: "elke maand 300 euro in de Vanguard S&P500" invoeren, Kader telt mee
      en toont wat het tot nu toe heeft gedaan
- [ ] DeGiro-posities meenemen in het dashboard en de doelverdeling van fase 2

### Fase 4b: kiezen op welk platform je handelt
Volgt uit fase 3 en 4: zodra er meer dan één platform is, moet je kunnen kiezen waar een order heen gaat.

- [x] **Platform-indicatie op de tradekaart.** Rechtsboven op elke kaart staan de logo's van de platforms
      waarop die coin verhandelbaar is, meerdere naast elkaar. Gebouwd in `components/PlatformChip.tsx` en
      `PlatformSheet.tsx`, met het register in `engine/platforms.ts`. De rij groeit vanzelf mee: een nieuw
      platform is een regel in `PLATFORMS` plus een regel in `handelbaarOp()`. Vandaag levert die functie
      alleen eToro op, dus er staat nu altijd hoogstens één merkje
- [ ] **Platformkeuze bij het kopen.** Een dropdown waarin je kiest via welk platform je de order plaatst,
      met het platform waar je het meeste vrije saldo hebt als voorstel. Nu gaat elke order blind naar
      eToro. Randvoorwaarden: per platform een eigen minimumbedrag, een eigen vrij saldo en eigen
      stop-loss-grenzen (`etoroLimieten.ts` is nu eToro-specifiek en moet per platform), en de keuze moet
      op de bevestigingsknop zichtbaar blijven, want een order op het verkeerde account is niet terug te
      draaien
- [ ] **Coins die maar op één platform staan.** De keuze mag dan geen dropdown zijn maar een vaste regel,
      anders kies je een platform dat die coin niet heeft

### Fase 5: Kader bewaakt je posities zelf
Het einddoel. Verlies minimaliseren, winst maximaliseren, zonder dat jij hoeft te kijken.

- [ ] **Eerst een besluit nemen: hoeveel mag Kader zonder te vragen?** In `engine/etoro.ts` staat nu een
      harde invariant dat orders alleen na een expliciete bevestiging per stuk mogen. Automatisch de stop
      verhogen breekt die regel. Voorstel om over te beslissen: stop verhogen mag automatisch (kan alleen
      je verlies verkleinen), doel verzetten en verkopen blijft een melding met een knop
- [ ] Stop automatisch meetrekken als de trade in de winst loopt. **Verlagen mag nooit**, ook niet als de
      analyse dat zou suggereren. De rekenkant is al af: `voorstelTrailingStop()` in `state/afbouw.ts` is
      richting-bewust en geeft null terug als het voorstel geen winst vastzet of aan de verkeerde kant
      zou liggen. De uitvoerkant is er ook al: `wijzigNiveaus()` in `engine/etoro.ts`, met
      `useStopLossLimiet.ts` ervoor om te toetsen of eToro het niveau accepteert. Wat ontbreekt is
      uitsluitend de schakel tussen die twee zonder handmatige tik, en dat is precies wat het besluit
      hierboven blokkeert.
      Correctie op een eerdere aanname in deze lijst: `stopAfstandStructuur()` in `engine/analyzer.ts` is
      NIET de trailing-berekening. Dat is de initiële stopafstand voor de marktscan, en die kijkt niet
      naar een open positie
- [ ] Doel meebewegen: blijft het momentum sterk, dan het doel verhogen op basis van de verse analyse
- [ ] Verkoopsignaal als de analyse zegt dat het op is, ook als het doel nog niet geraakt is
- [ ] Deze bewaking moet in de achtergrondtaak passen. Android's ondergrens is 15 minuten en het systeem
      kiest zelf het moment, dus dit wordt "een paar keer per dag", niet "continu"

---

## 🔨 Nu mee bezig

Fase 2: doelverdeling, afwijking, bijstortplan en projectie. Zie de fase hierboven en het ontwerp in
[docs/design-doelstelling-en-projectie.md](docs/design-doelstelling-en-projectie.md).

De vorige lijst hier is helemaal afgewerkt in 0.1.19 tot en met 0.1.21 en staat in de changelog:
het portfolio-dashboard, skeletons op elk scherm dat data ophaalt, de orderbevestiging met resultaat
in procenten en in geld, de Kader-dialogen in plaats van de systeemvensters, en de herontworpen
kaartindicatie (de gekleurde streep is weg, het niveau zit nu in de kaart zelf).

---

## 📊 Algoritme

- [ ] **Keuze voor Kevin en Thom: gaat de +10%-grens uit meting H in de engine?** Coins die de laatste
      30 dagen meer dan 10% harder zijn gestegen dan BTC krijgen dan geen KOOP meer. De meting steunt het
      ruim (+0,192 naar +0,243) en het kost maar 6% van de signaaldagen. Anders dan een drempelverlaging is
      dit een aanscherping. Cijfers in [docs/metingen.md](docs/metingen.md)
  - [ ] Voor het erin gaat: de meting één keer opnieuw draaien op verse data
- [ ] Nog te bewijzen: een echte short plaatsen via de app. Dat `settlementType: cfd` in de orderbody
      hoort is afgeleid uit de eligibility-respons, niet gemeten. Draaien met
      `ETORO_DEMO_API_KEY=... ETORO_DEMO_USER_KEY=... npx tsx scripts/etoro-demo-order.ts --order` vanuit
      `app/` (die vlag plaatst een echte order op het demo-account)
- [ ] Trailing stop: het voorgestelde niveau uit `voorstelTrailingStop()` staat nu alleen als tekst in
      `components/AfbouwRegel.tsx`. Er is wel al een handmatige weg om een niveau echt te zetten, de
      NiveausSheet, maar die moet je zelf openen en invullen. Een knop "neem dit voorstel over" die het
      niveau meteen invult ontbreekt, en die moet net als de sheet langs `useStopLossLimiet.ts`

### Waar we vanaf blijven
- Geen drempelverlaging om het scherm te vullen. Een leeg marktscherm met uitleg is beter dan een
  verzonnen signaal, hetzelfde principe als bij de eToro-stoplimieten.
- Geen "koop de dip"-taal zonder gemeten onderbouwing. In een bearmarkt is elke dip er één te vroeg.

---

## 💡 Ideeën

Nog niet ingepland, in volgorde van hoe kansrijk ze lijken.

- [ ] **Whales kopiëren (Trump, Saylor, etc.)**: tonen wat bekende grote spelers kopen of houden, met één
      tik hetzelfde doen. Het onderscheidende idee van Kader ten opzichte van andere apps
- [ ] **Marktpulsscore verrijken**: funding rate en Fear & Greed als extra inputs in de bestaande 0-100 score
- [ ] **Liquidatiekaart**: waar liggen de grote liquidatieniveaus (longs vs shorts). Databron: Coinglass gratis tier
- [ ] **ETF-flow tracking**: stroomt er netto geld in of uit bij BTC/ETH-ETF's. Databron: The Block of Farside
- [ ] **Whale-wallettracking**: bekende wallets volgen als bevestiging bij een signaal. Databron: Etherscan
- [ ] **Pushmelding bij een grote whale-trade**
- [ ] **Social sentiment per coin**: X en Reddit tot één score, handig als contra-indicator. Mogelijk via LunarCrush
- [ ] Inloggen en een database? Alleen relevant als Kader ooit van meer dan twee mensen wordt

---

## 🧪 Smoke-test

Doorlopen na elke grote wijziging, er is geen testsuite.

- [ ] App start zonder crash op emulator of toestel
- [ ] Marktscherm laadt kaarten, of toont een nette melding zonder internet
- [ ] Grote Kansen toont coins met stop-loss en take-profit
- [ ] Portfolio: trade toevoegen, prijs ververst, trade sluiten en verwijderen
- [ ] Traders: trader toevoegen, oordeel zichtbaar, verwijderen
- [ ] Pushmeldingen komen door bij het raken van stop-loss of take-profit

---

## 🐛 Bugs

- [ ] **Verifiëren: hoe heet de lijst met wachtende orders in eToro's portfolio-respons?**
      `bepaalSaldoStand()` in `engine/etoro.ts` trekt het gereserveerde bedrag van wachtende orders af
      van je vrije saldo, maar de veldnamen zijn niet tegen een echte respons bevestigd. De code
      probeert `orders`, `entryOrders` en `pendingOrders`, en per order `amount`,
      `initialAmountInDollars`, `investmentAmount` en `totalAmount`. Staat de lijst onder een andere
      naam, dan trekt Kader niets af en zijn we terug bij de oude situatie: hij faalt dus veilig,
      maar de bug is dan niet opgelost. Te toetsen met een echte sleutel en een wachtende order:
      dumpen wat `/trading/info/portfolio` teruggeeft en de namen hier vastleggen.
      Ook nog open: trekt eToro het gereserveerde bedrag misschien zelf al van `credit` af? Dan
      wordt het nu dubbel afgetrokken. De regel onder het bedrag maakt zichtbaar wat er is
      afgetrokken, dus dat valt op zodra iemand met een wachtende order kijkt.

- [ ] **Controleren of PEPE nu wél te kopen is via de app.**
      De melding "Kader kan PEPE niet eenduidig aan een eToro-instrument koppelen" had zeker één
      oorzaak: de sheet toonde die rode regel ook al terwijl het zoeken nog liep, en bij een coin die
      nog niet in de cache stond duurde dat een netwerkbeurt lang. Dat is opgelost, en `kiesInstrumentTreffer()`
      gooit dubbele regels (delisted, niet koopbaar, andere assetclass) nu weg vóór het de eis stelt
      dat er precies één treffer overblijft. Of dat genoeg is, is niet gemeten: daar is een echte
      sleutel voor nodig. Blijft de melding staan nadat het zoeken klaar is, dump dan wat
      `/market-data/search?internalSymbolFull=PEPE` teruggeeft en leg hier vast onder welke naam
      eToro de coin voert. Let op de tegenstelling die dan zichtbaar wordt: het merkje op de kaart
      komt uit Kaders eigen `ETORO_TRADABLE`-lijst, de koopsheet vraagt het live aan eToro. Die twee
      kunnen uit elkaar lopen, en dan is de lijst het ding dat bijgewerkt moet worden.
