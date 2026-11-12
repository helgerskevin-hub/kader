# Review: de analyse achter Kansen en Markt na kosten (12 nov 2026)

Voor Kevin, van Thom (geschreven met Claude Code). Over PR #115 (analyse Kansen, meting M),
#116 (koopknop terug) en #118 (Markt na kosten, meting N).

## Oordeel

Sterk werk. De beslisregels lagen vast voor er gemeten werd, afstellen en toetsen zijn gescheiden,
en wat afviel staat erbij. De besluiten (geen KOOP op Kansen, kooplabels uit op Markt) volgen uit
je eigen lat en blijven staan. Er zijn geen blokkerende fouten gevonden.

Nagelopen en in orde:

- **Geen look-ahead** in `meting-kansen.ts`: kenmerken uit candles[0..i], instap op de open van
  i+1, bij een candle die stop en doel allebei raakt telt de stop, kosten over aankoop- en
  verkoopbedrag.
- **De poort in het script** is gelijk aan `bepaalKlimaat` (BTC boven EMA50, breedte hoger dan 20
  dagen terug).
- **Reproduceerbaar.** Met verse historie (t/m 11 nov) geven `meting-kansen.ts toets` en
  `meting-markt.ts toets` exact de cijfers van M4 en N4 (op één trade na in een bijregel).
- **tsc** schoon en alle self-checks geslaagd, op main en op `feat/markt-kosten`.
- **De labels op Markt** staan overal achter `LABEL_KOOP_BEWEZEN`; "Sterke koop" in `coinInfo.ts`
  komt alleen in beeld als de schakelaar aan staat.

## Bevindingen

### 1. De lezing van M4 klopt maar half (middel, alleen tekst)

"Het komt uit de opzet, niet uit de keuze van de coin." Met hetzelfde plan en dezelfde poort in de
toetsjaren:

| | n | netto | basis van de dag | excess |
|---|---|---|---|---|
| elke coin | 1952 | +0,099 | +0,110 | -0,010 |
| radar 70 | 691 | +0,290 | +0,250 | +0,040 |

Opzet en poort geven +0,10 R. De radar zit daar +0,19 R boven (90%-interval -0,10 tot +0,45), vooral
omdat hij op betere dagen iets toont. Excess R meet alleen de keuze binnen een dag, dus de lat zag
dat deel niet. Het besluit verandert niet: niet aantoonbaar, en de toetsjaren zijn op. Wel een
hypothese voor het live trackrecord. Aangevuld onder M4 in `docs/metingen.md`.

### 2. De Koop-knop op Kansen (middel, product)

#116 zette de knop terug als hoofdknop, ook bij de drie coins van een lege radar (onder de drempel,
nooit gemeten) en bij een gemengd of ongunstig klimaat (waar de meting niet voor geldt; 2025 en 2026
waren verliesjaren). Aangepast: geen knop op een lege radar (kaart en detailscherm), en buiten een
gunstig klimaat een gewone knop in plaats van de hoofdknop, op de kaart en in het detailscherm.

**Besluit van Kevin, 12 nov 2026:** de knop blijft ook op een lege radar, als gewone knop. Handelen
gebeurt vanuit Kader, dus kopen kan bij elke coin met een plan. Koop is alleen de hoofdknop bij een
radar-coin in een gunstig klimaat.

### 3. Trailing-stopadvies botst met het nieuwe plan (middel, vervolgpunt #118)

`tradeChecks.ts` en het afbouwadvies stellen bij winst en afvlakkende MACD voor de stop naar
break-even of 1x ATR te trekken. Bij een trade met stop 3x ATR maakt dat er een krappe stop van, de
opzet die M en N hebben afgewezen, en de metingen trekken de stop nooit bij. Niet gefixt: dat is een
keuze (advies uitzetten bij dit plan, of meten). Vastgelegd in `docs/markt-kosten-plan.md` §10.

### 4. Copy-trades kregen een krappe stop op CoinGecko-data (middel, #118, gevonden in ronde 2)

`state/kaderNiveaus.ts` zette het plan 3x ATR ook op de vier-uurs candles van de CoinGecko-terugval.
Daar is 3x ATR ongeveer 1,2x de dag-ATR, precies de krappe stop die de kosten niet draagt, en deze
niveaus worden de echte stop van een copy-trade. `scoorVoorMarkt` in `analyzer.ts` vermeed dit al.
Nu alleen op Binance-dagcandles; anders blijven de niveaus van `scoorCandles`.

### 5. De toetsjaren zijn op (middel, regel bij de schakelaars)

2023 t/m 2026 zijn in M en N als toets bekeken. Een label mag alleen terug op signalen van na
11 nov 2026. Toegevoegd bij de schakelaars in `engine/drempels.ts`.

### 6. Kleinere punten

- Eis 3b vergeleek Kansen nieuw met Markts KOOP op Markts oude plan: dat meet plan en keuze samen.
  Met hetzelfde plan wint de radar nog steeds (+0,29 tegen +0,13). Benoemd in de aanvulling.
- "Een willekeurige coin op dezelfde dag" is in de code het gemiddelde van alle coins die dag.
  Tekst in `metingen.md` en het script aangepast; de kaarttekst mag zo blijven.
- Het doel ligt bij een mediane stop van 17% zo'n 50% boven de instap. In de toets haalde 21% het
  doel, 41% de stop en 38% liep na 30 dagen af. Lees het doel als plafond.
- Het volglijst-trackrecord kon uitkomsten vastleggen op de vier-uurs candles van de
  CoinGecko-terugval, terwijl het in dagen rekent. Werkt nu alleen bij op Binance-dagcandles. Zelfde
  aanpassing in het signaalboek van Markt (#118).
- `metingen.md` en het plan zeiden nog "geen koopknop". Bijgewerkt.
- Bootstrap per maand in plaats van per dag wijkt af van regel 6, maar is strenger en staat erbij.
  Akkoord.
- `export { splitsLopendeDag }` in `opportunities.ts` stond tussen de imports en werd nergens
  gebruikt. Weggehaald.

## Waar de fixes staan

- `fix/kansen-review` (vanaf main): punten 1, 2, de kleinere punten onder 6, dit rapport,
  changelog.
- `fix/markt-kosten-review` (vanaf `feat/markt-kosten`, PR naar die branch): punten 3, 4, 5, het
  signaalboek op Binance-candles en de export.
