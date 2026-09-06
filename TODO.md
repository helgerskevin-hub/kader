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
Fase 1 is waar we nu aan werken.

### Fase 1: portfolio-dashboard (nu mee bezig)
Van "lijst met trades" naar "overzicht van je geld". Alles op basis van data die we al binnenhalen.

- [ ] Dashboard bovenaan Portfolio met: beschikbaar geld, totale portfoliowaarde, waarde open posities,
      aantal open posities, en een ingang naar je historie
- [ ] Beschikbaar geld uit eToro halen (`haalVrijSaldo()` bestaat al, wordt nu alleen in de kooporder
      gebruikt) en meenemen in de totale waarde
- [ ] Cirkeldiagram van de verdeling: per positie het percentage en het bedrag
- [ ] "Mijn trades" heet vanaf nu Portfolio, "Open traders" heet Open posities

### Fase 2: doelstelling en projectie
Een doel invullen en zien hoe je ervoor staat. Nog steeds alleen crypto, nog geen nieuwe databron nodig.

- [ ] Doelverdeling instellen: welk percentage wil je waar in hebben (bijv. 60% BTC, 20% ETH, 20% alt)
- [ ] Afwijking tonen: waar zit je te zwaar of te licht ten opzichte van je doel
- [ ] Bijstortplan: vul in wat je maandelijks inlegt, Kader rekent uit waar dat geld heen moet om
      richting je doel te bewegen. **Nooit "advies" noemen**, het is een rekensom op basis van jouw doel
- [ ] Projectie: verwachte waarde over X jaar op basis van inleg per maand plus een zelf ingevuld
      verwacht rendement. Toon expliciet dat dit een rekensom is en geen voorspelling

### Fase 3: aandelen en index-fondsen erbij
Hier komt de eerste echte uitbreiding: een tweede activaklasse en dus een tweede databron.

- [ ] **Eerst uitzoeken: welke gratis databron voor aandelen en ETF's?** Binance en CoinGecko doen geen
      aandelen. Kandidaten om te vergelijken op dekking, limieten en betrouwbaarheid: Stooq (gratis, geen
      key), Financial Modeling Prep (gratis tier), Alpha Vantage (25 calls/dag, waarschijnlijk te krap).
      Zonder een bron die de S&P500-ETF's dekt heeft de rest van deze fase geen zin
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

### Fase 5: Kader bewaakt je posities zelf
Het einddoel. Verlies minimaliseren, winst maximaliseren, zonder dat jij hoeft te kijken.

- [ ] **Eerst een besluit nemen: hoeveel mag Kader zonder te vragen?** In `engine/etoro.ts` staat nu een
      harde invariant dat orders alleen na een expliciete bevestiging per stuk mogen. Automatisch de stop
      verhogen breekt die regel. Voorstel om over te beslissen: stop verhogen mag automatisch (kan alleen
      je verlies verkleinen), doel verzetten en verkopen blijft een melding met een knop
- [ ] Stop automatisch meetrekken als de trade in de winst loopt. **Verlagen mag nooit**, ook niet als de
      analyse dat zou suggereren. De trailing-berekening zit al in `stopAfstandStructuur()`, en
      `useStopLossLimiet.ts` moet toetsen of eToro het niveau accepteert voordat het verstuurd wordt
- [ ] Doel meebewegen: blijft het momentum sterk, dan het doel verhogen op basis van de verse analyse
- [ ] Verkoopsignaal als de analyse zegt dat het op is, ook als het doel nog niet geraakt is
- [ ] Deze bewaking moet in de achtergrondtaak passen. Android's ondergrens is 15 minuten en het systeem
      kiest zelf het moment, dus dit wordt "een paar keer per dag", niet "continu"

---

## 🔨 Nu mee bezig

- [ ] Portfolio-dashboard (fase 1 hierboven)
- [ ] Skeleton-laadanimaties op alle schermen die data ophalen
- [ ] Bevestigingspopup na een order: bij verkoop met resultaat, percentage en bedrag erbij
- [ ] Pop-ups en meldingen in de Kader-huisstijl trekken
- [ ] Adviesrand op de kaarten herontwerpen

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
- [ ] Trailing stop: het voorgestelde niveau is nu alleen tekst. Zodra er een knop komt die de stop bij
      eToro zet, moet die eerst langs `useStopLossLimiet.ts`

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

_(Leeg. Werkt iets niet, schrijf het hier op, ook als je nog niet weet waarom.)_
