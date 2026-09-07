# Metingen

Alle backtest-uitkomsten die een keuze in Kader onderbouwen. Reproduceerbaar met
`node scripts/haal-historie.mjs 9` en `npm run backtest` vanuit `app/`. Ruwe data in `data/backtest/`.

Dit bestand is het archief. De openstaande keuzes die eruit volgen staan in [TODO.md](../TODO.md).

---

## Fase 0: de basis (25 aug 2026)

57 coins, 9 jaar Binance-historie tot 12 juli 2026. Getallen zijn gemiddelde R per trade.

- **Meting C, het algoritme per jaar.** De app zoals hij draait (KOOP + R/R-filter) haalt +0,083 over
  3170 trades, tegen +0,032 voor een willekeurige instap. High conviction is het sterkst met +0,154.
  Verliesjaren: 2018 (-0,66), 2022 (-0,47), 2025 (-0,32), 2026 (-0,29), precies de bearmarkten.
- **Meting D, de poorten.** "BTC boven EMA50 en breedte stijgt" blijft de beste poort: +0,200 tegen
  +0,154 zonder poort. Dat is de poort die in `bepaalKlimaat()` zit, dus daar verandert niets aan.
- **Meting E, doel en houdtijd.** Doel 3x ATR met 30 dagen wint over de hele periode (+0,154).
  Kortere doelen geven een hoger trefferpercentage (1,5x ATR haalt 67%) maar minder R.
  `REWARD_MULTIPLIER` blijft 3,0.
- **Meting F, shorts.** Short op score < 40, doel 2x ATR, 20 dagen: +0,064 over 5377 trades. Het
  jaarpatroon was de vraag en dat is overtuigend: 2018 +0,15, 2022 +0,19, 2025 +0,13, 2026 +0,10.
  Alle bearmarkten positief, verliesjaren zijn juist de bulljaren (2020 -0,16, 2024 -0,04). Extra
  filters maken het slechter: "BTC onder EMA200" geeft +0,054, score < 25 geeft +0,026. De simpele
  regel wint.
- **Meting G, mean-reversion-longs.** Afgevoerd, zie fase 3 hieronder.

## Fase 3: het omkeerprofiel, gemeten en afgevoerd (25 aug 2026)

Op de dagen dat de klimaatpoort dicht stond (doel 2x ATR, 20 dagen):

| regel | n | treffer% | gem R |
|---|---|---|---|
| willekeurige instap | 6720 | 30 | -0,075 |
| momentum (KOOP + R/R) | 532 | 34 | -0,085 |
| omkeer (KOOP + R/R) | 1327 | 38 | **+0,156** |

Het gemiddelde ziet er goed uit, maar de winst komt uit scherpe correcties binnen opgaande markten
(2023 +0,94, 2024 +1,47, 2025 +0,93), niet uit de bearmarkten zelf: 2019 -0,48, 2022 -0,08,
2026 -0,34. Vooraf was afgesproken dat het profiel in minstens twee van de drie bearmarkten moest
standhouden. Eén van de vier dalende periodes is positief. Doorslaggevend: in 2026, de markt waar we
nu in zitten, verliest dit profiel 0,34 R per trade.

De profielparameter (`momentum` / `omkeer`) blijft als meetgereedschap in `scoorCandles()` staan,
standaard `momentum`; `analyseerMarkt()` gebruikt hem niet.

## Fase 4: shorts, de stop-cap is afgevallen (26 aug 2026)

Het plan stelde een `STOP_CAP_SHORT` van 1x ATR voor. Drie varianten naast elkaar:

| regel | n | gem R | 2018 | 2022 | 2025 | 2026 |
|---|---|---|---|---|---|---|
| cap 3x ATR, oorspronkelijk | 5377 | +0,064 | +0,15 | +0,19 | +0,13 | +0,10 |
| cap 1x ATR (het plan) | 7054 | +0,076 | +0,34 | +0,22 | **+0,02** | +0,28 |
| **cap 3x ATR + bestaande R/R-drempel** | 2017 | **+0,155** | +0,13 | +0,10 | **+0,30** | **+0,24** |

De stop knijpen houdt alle signalen maar verschuift de stop, en dat kostte juist 2025. De gewone stop
houden en signalen laten afvallen op de R/R-drempel die er al stond geeft ruim het dubbele, met alle
vier de dalende jaren positief en 8 van de 9 jaren positief. Er was dus geen nieuwe constante nodig.
`STOP_CAP_SHORT` is weer verwijderd. Meting C reproduceert exact, dus het long-pad is ongemoeid.

## eToro-beperking bij shorts (26 aug 2026)

Gemeten tegen het demo-account. eToro geeft per crypto twee configs: long op `settlementType: real`
met hefboom x1 en een stop tot 100% van de entry, short op `settlementType: cfd` **ook met hefboom
x1** maar met een stop tot maximaal 50%. Identiek voor BTC, ETH, SOL, XRP en ADA. Het is dus wel een
CFD, maar niet met hefboom: Kader hoeft "altijd x1, nooit hefboom" niet los te laten. Volledige
meting in [etoro-direct-handelen-plan.md](etoro-direct-handelen-plan.md) paragraaf 10.

---

## Meting H: relatieve sterkte versus BTC (2 sep 2026)

De sterkste vondst tot nu toe. Basis reproduceert de bekende cijfers: 3251 trades, +0,088 gemiddelde
R, high conviction +0,158 (iets hoger dan meting C omdat er zeven weken data bij zijn gekomen).

Drie filters op de COIN zelf getoetst, waar de poorten uit meting D naar de MARKT kijken.

**Afgevallen: boven de eigen EMA100.** +0,195 tegen +0,192 basis. De helft die het filter weggooit
doet +0,143, dus het sorteert niet. Het maakt 2025 bovendien slechter (-0,14 naar -0,61).

**Afgevallen: niet te ver uitgerekt boven EMA20.** Bij 2 ATR gebeurt er niets (geen enkel KOOP-signaal
staat daarboven), bij 1 ATR +0,197 tegen +0,192. Op high conviction geeft 2 ATR +0,210 tegen +0,193,
maar dat kost een derde van de trades en maakt 2026 slechter.

**De vondst: coins die zijn ACHTERGEBLEVEN op BTC doen het fors beter.** Binnen de koopsignalen van
Kader, over 30 dagen relatieve sterkte:

| relatieve sterkte 30d | n | treffer% | gem R |
|---|---|---|---|
| < -20% | 337 | 53 | **+0,775** |
| -20% tot -10% | 458 | 42 | +0,406 |
| -10% tot 0% | 732 | 33 | +0,132 |
| 0% tot +10% | 521 | 25 | -0,146 |
| +10% tot +25% | 342 | 24 | -0,146 |
| +25% tot +50% | 188 | 24 | -0,122 |
| > +50% | 146 | 32 | +0,168 |

Monotone helling over vrijwel het hele bereik, geen staarteffect. Alleen de laatste emmer wijkt af en
die is met n=146 de kleinste. Dezelfde vorm op high conviction (rs < -10%: +0,555, rs 0 tot +25%:
+0,045). Het houdt stand **zonder** de marktpoort, dus het is geen artefact van die doorsnede:

| regel | n | gem R | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| basis (KOOP + R/R) | 3251 | +0,088 | -0,34 | 0,07 | 0,59 | 0,41 | -0,33 | 0,30 | -0,01 | -0,24 | -0,05 |
| + zwakker dan BTC | 1879 | **+0,168** | -0,69 | -0,10 | 0,90 | 0,53 | -0,27 | 0,34 | 0,16 | -0,18 | 0,04 |
| + sterker dan BTC | 1862 | -0,032 | -0,11 | 0,07 | 0,24 | 0,34 | -0,45 | 0,21 | -0,19 | -0,36 | -0,23 |

**Hoe het te lezen:** een KOOP-signaal eist al een opwaartse trend en bullish MACD. Een coin die
daarbij ook nog eens 25% harder is gestegen dan BTC in een maand, heeft het makkelijke deel gehad.
Een coin met hetzelfde signaal die juist is achtergebleven, is een terugval binnen een opgaande
trend. Kader koopt dus beter de dip in een sterke coin dan de doorgeschoten winnaar.

### H2e: wat het in de engine zetten kost en oplevert

De laatste kolom is de belangrijkste: gemiddelde R zegt niets over of het scherm nog gevuld is.

| variant | n | gem R | 2022 | 2025 | 2026 | dagen met signaal |
|---|---|---|---|---|---|---|
| **wat de app vandaag doet** | 1919 | +0,192 | -0,46 | -0,14 | +0,09 | 714 |
| zonder voorlopers boven +25% | 1703 | +0,207 | -0,41 | -0,11 | +0,10 | 686 |
| **zonder voorlopers boven +10%** | 1512 | **+0,243** | -0,34 | -0,07 | +0,10 | **670** |
| alleen achterblijvers (-10% of meer) | 666 | **+0,574** | **+0,01** | **+0,73** | +0,20 | 468 |

**De grens van +10% is bijna gratis.** Een kwart hoger gemiddelde voor 6% van de signaaldagen.

**"Alleen achterblijvers" repareert precies de kapotte jaren** (2022 van -0,46 naar +0,01, 2025 van
-0,14 naar +0,73), maar kost een derde van de signaaldagen. In een jaar waarin de poort toch al vaak
dicht staat is dat het verschil tussen weinig en geen signalen.

Zonder de marktpoort (H2f) wijst het dezelfde kant op: "alleen achterblijvers" geeft +0,362 tegen
+0,088, met 2025 op +0,03 en 2026 op +0,14 in plaats van -0,24 en -0,05.

**Kanttekening:** dit is één harness op één dataset, zonder aparte out-of-sample-periode. Geloofwaardig
maken het de monotone helling over zeven emmers, dat het standhoudt zonder de marktpoort, en dat het
in acht van de negen jaren dezelfde kant op wijst. Maar er zijn nu drie hypotheses en een handvol
drempels getoetst op dezelfde negen jaar. Voor de +10%-grens in de engine gaat is het de moeite waard
de meting één keer opnieuw te draaien op verse data.
