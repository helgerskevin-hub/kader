# Plan: het Markt-algoritme aan de testbank (meting O)

Branch: `meting/markt-algoritme`, afgetakt van `fix/markt-kosten-review` op 12 nov 2026 (bovenop
PR #118 en #120). Kansen valt erbuiten: daar staan eigen PR's voor open.

Deze ronde levert een meting en een voorstel op. Aan de app verandert niets tot Thom en Kevin over
de uitkomst beslist hebben. Dit bestand stond in de repo voordat het meetscript voor het eerst
draaide; wat hieronder staat is niet achteraf aangepast.

---

## 1. Aanleiding

Na meting M en N staat er dit:

- Na kosten (1% per kant) kiest de score niet: coins onder de 55 deden het met de poort open even
  goed als KOOP, STERK KOOP en BEVESTIGD.
- Wat wel werk doet is de klimaatpoort en het ruime plan (stop 3x ATR, doel 3R).
- Alles is gemeten als gemiddelde R per trade. Hoeveel geld er na een jaar staat, hoe diep het
  onderweg zakt en of het beter is dan gewoon BTC houden, is nooit gemeten.
- Uitstappen zonder vast doel is nooit gemeten. Meting K en L toetsten alleen aanvullingen die in
  1 tot 2% van de trades vuurden.
- De toetsjaren 2023 t/m 2026 zijn al bekeken. Op de 57 coins is geen schone toetsdata meer.

De vraag van Thom: wat is het sterkste algoritme, en hoe haal je na kosten de meeste winst?

## 2. Nieuwe toetsdata: coins die nooit in een meting zaten

`scripts/haal-holdout.mjs` haalt alle Binance-USDT-paren op die niet in `STANDAARD_UNIVERSUM` staan,
ook gedelistte. Filters, vooraf vast: geen stablecoins, fiat, goud, wrapped of leveraged tokens,
geen oude of nieuwe ticker van een universumcoin, minstens 400 dagcandles, mediane dagomzet
minstens 1 miljoen USDT.

- **Afstellen** op de 57 coins, alle jaren. Die zijn toch al bekeken.
- **Toetsen** op de holdout-coins, alle jaren, **één keer**, aan het einde, met hoogstens vier
  regels (zie paragraaf 6).
- De klimaatpoort komt voor beide sets uit BTC en de breedte van de 57 coins, zoals in de app.

Wat de holdout wel en niet bewijst: hij toetst onafhankelijk welke coin je kiest en hoe je uitstapt.
De poort zelf niet, want BTC loopt in beide sets hetzelfde pad. Voor de poort blijft het signaalboek
van na 11 nov 2026 het enige schone bewijs.

## 3. De maatstaf: geld, niet alleen R

Naast netto R per trade een portefeuille-simulatie:

- startvermogen 1, dagelijkse boekhouding op het slot, cash rendeert niets;
- hoogstens N posities tegelijk (standaard 10), elk 1/N van het vermogen bij instap;
- instap op de open na het signaal, 1% kosten over het aankoopbedrag en over het verkoopbedrag;
- meer signalen dan vrije plekken: hoogste score eerst (zoals de app sorteert), tenzij de variant
  een eigen rangorde heeft;
- per coin hoogstens één positie.

Uitvoer: jaarrendement (CAGR), maximale terugval (max drawdown), Sharpe op dagbasis, tijd in de
markt, trades per jaar, rendement per kalenderjaar. Altijd met de ijklijnen ernaast:

- **BTC houden**: op dag één kopen, nooit verkopen.
- **BTC met de poort**: BTC houden als de poort open is, anders cash.
- **BTC boven EMA200**: BTC houden als BTC boven zijn EMA200 slot, anders cash.
- **Nu**: score 55 of hoger, huidige poort, stop 3x ATR, doel 3R, hoogstens 30 dagen.

De ijklijnen worden niet gekozen of afgesteld; ze staan er alleen naast.

## 4. Drie families, afgesteld op de 57 coins

**Ronde 1, uitstap** (instap blijft Nu):

| code | uitstap |
|---|---|
| U0 | doel 3R, hoogstens 30 dagen (Nu) |
| U1 | doel 3R, hoogstens 90 dagen |
| U2 | geen doel, stop loopt mee: hoogste slot sinds instap min 3x ATR |
| U3 | geen doel, verkopen op de open na een slot onder de EMA50 |
| U4 | geen doel, stop loopt mee met het laagste punt van de laatste 20 dagen |
| U5 | vaste stop tot +3R, daarna loopt de stop mee zoals U2 |
| U6 | geen doel, verkopen op de open na een dag dat de poort dicht is |

Overal blijft de beginstop 3x ATR staan en mag een stop alleen omhoog. Een meelopende stop wordt op
het slot bepaald en geldt vanaf de volgende dag. Zonder doel hoogstens 365 dagen.

**Ronde 2, instap** (met de beste uitstap uit ronde 1):

| code | instap, steeds met de poort open |
|---|---|
| I0 | score 55 of hoger (Nu) |
| I1 | elke coin (ijk) |
| I2 | slot boven het hoogste punt van de 50 dagen ervoor |
| I3 | slot boven het hoogste punt van de 100 dagen ervoor |
| I4 | EMA50 boven EMA200 en slot boven EMA50 |
| I5 | 90-dagenrendement positief en slot boven EMA50 |

**Ronde 3, selectie en spreiding** (met de beste instap en uitstap):

- rangorde bij te veel signalen: score, 90-dagenrendement hoog, 30-dagenrendement laag
  (achterblijver), laagste volatiliteit (ATR/koers), vaste willekeur;
- aantal plekken N: 3, 5, 10;
- grootte: gelijk gewicht (1/N), of gelijk risico (raakt de stop, dan kost het 2% van het
  vermogen, nooit meer dan 1/N).

**Ronde 4, combinatie**: de winnaars van 1 tot 3 samen, op de 57 coins.

## 5. Hoe er per ronde gekozen wordt (alleen op de 57 coins)

Per ronde gaan hoogstens twee varianten door: de hoogste CAGR onder de varianten waarvan de max
drawdown niet slechter is dan die van BTC houden over dezelfde periode. Gelijk spel (minder dan 1
procentpunt CAGR verschil): de hoogste Sharpe, dan de eenvoudigste.

## 6. De toets op de holdout, één keer

Hoogstens vier regels: Nu, de beste uitstap met Nu-instap, de beste instap met die uitstap, en de
volledige combinatie. Een regel is **beter dan Nu** als alles klopt:

1. minstens 150 trades op de holdout;
2. CAGR hoger dan Nu;
3. 90%-interval van het verschil in maandrendement met Nu boven nul (bootstrap per kalendermaand,
   2000 trekkingen, vaste seed);
4. in de meerderheid van de kalenderjaren een hoger rendement dan Nu;
5. max drawdown niet slechter dan BTC houden over dezelfde periode.

Daarnaast, los van "beter dan Nu", de vraag uit meting N opnieuw: houdt de regel na kosten
aantoonbaar geld over? Netto R per trade met een 90%-interval boven nul.

Gevoeligheid op de gekozen regel (geen extra eisen): 1,5% per kant, en stop minimaal 10%.

### 6a. Aanvulling na de review, vóór de toets (12 nov 2026)

Een onafhankelijke review van het script vond, zonder rendementen op de holdout te berekenen,
ongecorrigeerde redenominaties en datagaten in de holdout-data (COCOS x1000, SUN /1000, BNX /100,
VIDT, STRAX en BTCST /10, LUNA met een hergebruikte ticker, FTT met 311 dagen zonder candles).
Daarom, vastgelegd voordat de toets draait:

- Een reeks wordt geknipt waar twee candles meer dan 3 dagen uit elkaar liggen of waar de open
  buiten 0,2 tot 5 keer het slot ervoor ligt. Elk stuk telt als een eigen coin; een positie gaat
  uit op het laatste slot van zijn stuk, zoals bij een delisting. Stukken korter dan 400 candles
  vallen af. Dezelfde regel geldt voor de 57 coins (daar knipt hij niets).
- Eis 1 en de netto R per trade tellen de trades die de portefeuille werkelijk nam, niet alle
  signalen per coin. Bij 5 plekken is dat een ander getal dan bij 10.
- Een signaal telt alleen als de volgende candle de dag erna is.
- Extra gevoeligheid (geen eis): een stop die op een crashcandle geraakt wordt vult op het midden
  van stop en dagbodem als de bodem meer dan 20% onder de stop ligt.

## 7. Wat er niet in zit

- Geen shorts (in okt 2026 uit de app gehaald) en geen hefboom.
- Geen intraday: alles op het dagslot.
- Funding, Fear & Greed en taker-koopdruk niet: één familie tegelijk, en deze drie zijn in de
  eerste metingen al zonder resultaat bekeken.
- Kansen.

## 8. Oplevering

Meting O in `docs/metingen.md`, een rapport in `docs/review-markt-algoritme.md` met pijnpunten,
winpunten en een voorstel voor de app, en een PR. Bouwen in de app pas na een besluit van Thom en
Kevin.
