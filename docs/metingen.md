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
- **Meting F, shorts** (shorts zijn op 31 okt 2026 uit de app gehaald; meting F staat niet meer in backtest.ts). Short op score < 40, doel 2x ATR, 20 dagen: +0,064 over 5377 trades. Het
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

## Meting K: doel meebewegen (29 sep 2026)

De vraag: levert het iets op als je de melding "nadert je doel, overweeg je doel te verhogen"
(`verhoogTP` in `tradeChecks.ts`) opvolgt? Die vuurt als de koers boven `drempelBijnaOpDoel()` staat,
MACD bullish is met een stijgend histogram, de koers nog onder het doel ligt en het verse doel van
`scoorCandles()` hoger uitkomt. Gemeten op exact dezelfde 3170 instappen als meting B, dus het verschil
komt alleen uit het beheer van de trade. De regel draait op het slot van elke dag met alleen de
candles tot dan; een verhoogd doel geldt pas vanaf de volgende dag.

- **B**: vaste stop, vast doel (wat de app nu aanneemt).
- **K1**: doel verhogen naar het verse doel zodra de regel vuurt, stop blijft staan.
- **K2**: als K1, en de stop gaat mee omhoog via `voorstelTrailingStop()`.

| variant | n | treffer% | gem R | totaal R | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B vast doel | 3170 | 32,1 | +0,083 | 264 | -0,34 | 0,07 | 0,59 | 0,41 | -0,33 | 0,30 | -0,01 | -0,24 | -0,14 |
| K1 doel mee | 3170 | 31,8 | +0,089 | 283 | -0,34 | 0,10 | 0,62 | 0,42 | -0,35 | 0,31 | -0,00 | -0,25 | -0,14 |
| K2 doel + stop mee | 3170 | 32,2 | +0,089 | 281 | -0,34 | 0,07 | 0,62 | 0,40 | -0,33 | 0,31 | -0,00 | -0,24 | -0,14 |

**De melding vuurt bijna nooit.** In 51 van de 3170 trades (1,6%), gemiddeld 1,1 keer per trade
waarin hij vuurt. Op die 51 trades levert opvolgen wel iets op: B +2,34, K1 +2,71, K2 +2,67 R per
trade. K2 verliest daar geen enkele trade (treffer 100%), K1 geeft een kwart ervan terug aan de stop
maar haalt een hogere mediaan. Over alle trades verdunt dat tot +0,006 R.

**Per jaar is het ruis.** K1 wint in 5 van de 9 jaren, K2 in 4, met verschillen van 0,01 tot 0,03 R;
één trade meer of minder in een jaar met een paar honderd trades verschuift het jaargemiddelde al zo
veel. K1 verliest in 2022 en 2025, juist de bearjaren. Per marktklimaat hetzelfde beeld: poort open
+0,226 (B) tegen +0,239 (K1) en +0,232 (K2), poort dicht vrijwel gelijk (-0,040 / -0,041 / -0,036).

**Conclusie: geen "verzet doel bij eToro"-knop bouwen.** De beslisregel was dat K1 of K2 in de meeste
jaren boven B moest uitkomen, niet in één bulljaar. K1 haalt formeel 5 van 9, maar met marges die
binnen de ruis vallen en verliezen in twee van de drie bearjaren; K2 haalt het niet. De melding zelf
kan blijven staan: hij kost niets en de trades waar hij vuurt doen het met opvolgen iets beter.

**Kanttekening:** de backtest toetst de regel één keer per dag op het slot, de app elke 5 tot 15
minuten. Een koers die binnen een dag door de laatste 10% naar het doel schiet, raakt in de backtest
meteen het doel zonder dat de regel kans krijgt. In het echt vuurt de melding dus vaker dan 1,6%. Om
dat te meten is intraday-data nodig; zonder die data is dit de ondergrens van het effect.

## Meting L: uitstapsignaal bij omslaand momentum (5 nov 2026)

De vraag (D5 in het plan): staat je positie op het slot van een dag minstens +1 R in winst en draait
het momentum, levert ingrijpen dan meer op dan wachten op doel of stop? Pas als dat in de meeste
jaren wint, krijgt Kader er een melding voor. Gemeten op exact dezelfde 3170 instappen als meting B
en K. De trigger draait op het slot met alleen de candles tot dan; de actie geldt vanaf de volgende
dag. Eén keer per trade.

Drie triggers, elk met twee acties:

- **T1**: slot onder EMA20.
- **T2**: slot onder EMA20 en MACD-histogram negatief.
- **T3**: MACD-histogram kruist van positief naar negatief.
- **stop**: stop naar de instap. **sluit**: verkopen op de open van de volgende dag.

| variant | n | treffer% | gem R | totaal R | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | wint jaren |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B wachten | 3170 | 32,1 | +0,083 | 264 | -0,34 | 0,07 | 0,59 | 0,41 | -0,33 | 0,30 | -0,01 | -0,24 | -0,14 | |
| T1 stop | 3170 | 32,0 | +0,084 | 267 | -0,32 | 0,08 | 0,59 | 0,41 | -0,33 | 0,30 | -0,01 | -0,24 | -0,14 | 4 van 9 |
| T1 sluit | 3170 | 32,3 | +0,082 | 260 | -0,29 | 0,08 | 0,56 | 0,39 | -0,33 | 0,31 | -0,00 | -0,24 | -0,15 | 5 van 9 |
| T2 stop | 3170 | 32,0 | +0,084 | 265 | -0,34 | 0,08 | 0,59 | 0,41 | -0,33 | 0,30 | -0,01 | -0,24 | -0,14 | 2 van 9 |
| T2 sluit | 3170 | 32,2 | +0,081 | 256 | -0,34 | 0,08 | 0,56 | 0,39 | -0,33 | 0,31 | -0,01 | -0,24 | -0,15 | 4 van 9 |
| T3 stop | 3170 | 31,8 | +0,084 | 266 | -0,32 | 0,05 | 0,57 | 0,40 | -0,32 | 0,31 | -0,01 | -0,24 | -0,14 | 6 van 9 |
| T3 sluit | 3170 | 32,8 | +0,085 | 269 | -0,31 | 0,08 | 0,55 | 0,39 | -0,30 | 0,32 | -0,00 | -0,24 | -0,13 | 6 van 9 |

**De trigger vuurt bijna nooit.** T1 in 18 trades (0,6%), T2 in 16 (0,5%), T3 in 59 (1,9%). Een
swingtrade die +1 R staat loopt meestal door naar het doel of zakt terug, zonder dat het dagslot
eerst onder de EMA20 komt.

**Op de trades waar hij vuurt:** T3 sluit haalt +1,31 R tegen +1,23 R voor wachten (59 trades, samen
+5 R in negen jaar). T1 en T2 sluit doen het juist slechter dan wachten (+1,31 tegen +1,50 en +1,33
tegen +1,81): die trades liepen daarna vaak alsnog naar het doel. Stop naar instap scheelt overal
weinig, want de mediaan valt terug naar 0 R terwijl het gemiddelde nauwelijks stijgt.

**Conclusie: geen uitstapmelding bouwen.** Alleen T3 wint formeel in 6 van de 9 jaren, maar met een
verschil van +0,002 R per trade en jaarverschillen van 0,01 tot 0,03 R. Dat valt in dezelfde ruis
als meting K. T3 wint ook juist in de bearjaren (2018, 2022, 2026) en verliest in 2020 en 2021, dus
het is eerder "minder lang blijven zitten in een slechte markt" dan een bruikbaar uitstapmoment. Een
melding die over alle coins samen een keer of zes per jaar komt en per keer ongeveer +0,08 R oplevert, rechtvaardigt
geen extra melding. Daarmee vervalt ook de actie "winst nemen bij omslaand momentum" in de
"Eén ding vandaag"-kaart (D9). "Winst nemen vlak bij het doel" kan daar wel blijven.

**Kanttekening:** net als bij meting K toetst de backtest één keer per dag op het slot, terwijl de
app elke 5 tot 15 minuten kijkt. EMA20 en MACD zijn hier over de hele reeks per coin berekend in
plaats van over het venster van 200 candles van de app; beide zijn causaal, dus dat geeft geen
look-ahead, alleen een verwaarloosbaar ander startpunt.

## Meting M: Kansen met kosten, en een aparte toets (11 nov 2026)

De eerste meting met eToro's kosten erin. Eigen script, `app/scripts/meting-kansen.ts`, zodat
`backtest.ts` en dus alles wat Markt onderbouwt ongemoeid blijft. Draaien vanuit `app/`:
`npx tsx scripts/meting-kansen.ts basis|niveaus|soorten|top|toets`. 57 coins, data t/m 10 nov 2026.

Vier dingen zijn anders dan in de metingen hierboven:

- **Kosten.** eToro rekent 1% bij kopen en 1% bij verkopen van crypto. In R is dat 2% gedeeld door
  de stopafstand, dus een krappe stop betaalt veel meer dan een ruime.
- **Instap op de open na het signaal.** Het oordeel valt op een afgesloten dag; kopen kan pas
  daarna. `backtest.ts` stapt in op het slot van de signaaldag zelf.
- **Afstellen en toetsen gescheiden.** Kiezen op t/m november 2022, toetsen op 2023 t/m 2026, één
  keer. Signalen uit december 2022 tellen bij geen van beide: hun trade loopt de toetsjaren in.
- **Excess R.** De uitkomst min die van een willekeurige coin op dezelfde dag met dezelfde niveaus.
  Dat scheidt "deze regel kiest goed" van "het was een goede dag".

De beslisregels lagen vast voordat het script draaide, zie `docs/kansen-analyse-plan.md`,
paragraaf 5.

### M1: wat de kosten doen met wat er was

Gemiddelde R per trade, alle jaren, en tussen haakjes alleen 2023 en later.

| regel | zonder kosten | 1% per kant | 1% per kant, stop minimaal 10% |
|---|---|---|---|
| elke bar, niveaus van Markt | +0,020 | -0,251 (-0,300) | -0,122 (-0,153) |
| Markt KOOP + R/R | +0,106 | -0,152 (-0,254) | -0,093 (-0,170) |
| Markt KOOP + R/R, poort open | +0,220 | -0,052 (-0,140) | -0,010 (-0,074) |
| Kansen oud (radar + score 55 + R/R 2) | +0,224 | -0,174 (-0,258) | -0,073 (-0,188) |

Zonder kosten reproduceert dit de bekende cijfers (meting C: +0,106; meting J: +0,236). Met kosten
is elke regel negatief, ook Markts KOOP met de poort open. De stop van het oude Kansen-plan lag op
mediaan 7% van de koers; 2% kosten is dan ruim een kwart R.

**Dit raakt Markt ook.** Markt is in deze ronde bewust niet aangepast. Het vervolgvoorstel staat
onderaan.

### M2: welke opzet draagt de kosten

Op een neutrale selectie (EMA20 boven EMA50, slot boven EMA20, poort open), alleen t/m 2022, 30
dagen houdtijd, 1% per kant:

| stop | doel | mediane stop | bruto | netto |
|---|---|---|---|---|
| 1,5x ATR | 2R | 13% | +0,213 | +0,046 |
| 1,5x ATR | 3R | 13% | +0,317 | +0,149 |
| 2x ATR | 3R | 17% | +0,333 | +0,204 |
| **3x ATR** | **3R** | 25% | +0,395 | **+0,305** |
| onder low20 en EMA50 | 3R | 30% | +0,376 | +0,296 |

Een ruime stop houdt van het bruto resultaat het meeste over. Gekozen: 3x ATR, doel 3R, 30 dagen,
de eenvoudigste die in alle drie de meetbare afsteljaren boven de ijklijn bleef. Met "stop minimaal
10%" (eToro's gemeten grens voor BTC) zijn de cijfers identiek: 3x ATR ligt daar bijna altijd
voorbij. Langer vasthouden (60 of 90 dagen) gaf een hoger gemiddelde, maar geen betere excess R.

### M3: vier soorten kansen, op de afsteljaren

Zelfde opzet voor alle soorten, poort open, 1% per kant, alleen t/m 2022.

| soort | n | netto | excess | 90%-interval excess |
|---|---|---|---|---|
| ijk: elke bar | 942 | +0,284 | -0,004 | -0,03 tot +0,02 |
| bij de top, binnen 9% (de radar) | 338 | +0,552 | **+0,199** | +0,08 tot +0,31 |
| bij de top, binnen 1x ATR | 313 | +0,541 | +0,164 | +0,06 tot +0,27 |
| terugval: trend op, 10pp achter op BTC | 238 | +0,744 | +0,019 | -0,07 tot +0,11 |
| verse uitbraak, volume 1,5x | 194 | +0,572 | +0,087 | -0,10 tot +0,28 |
| rustige opbouw, ATR-krimp 0,8 | 281 | +0,188 | +0,024 | -0,11 tot +0,15 |

- **Bij de top** houdt stand. De afstand in ATR meten in plaats van in procenten voegt niets toe.
- **Terugval** heeft het hoogste gemiddelde en geen excess. Dat is de vondst uit meting H opnieuw
  bekeken: de achterblijvers vielen op dagen dat alles steeg. Het was een markteffect, geen
  betere keuze van de coin.
- **Verse uitbraak** en **rustige opbouw** komen niet aantoonbaar boven de ijklijn.

Binnen "bij de top": drempel 60 gaf +0,125 excess, 70 +0,199, 80 +0,115. De Markt-score van 55
erbij veranderde niets (337 van de 338 trades haalden die al). Boven de 70 lopen de emmers niet op
(70 tot 80 +0,19, 80 tot 90 +0,09, 90 tot 100 +0,17), dus een fijnere sortering is niet te
onderbouwen.

Eén regel ging naar de toets: radar 70 of hoger, poort open, stop 3x ATR, doel 3R, 30 dagen.

### M4: de toets, 2023 t/m 2026

| regel, 1% per kant | n | netto | excess | 90%-interval excess | 23 | 24 | 25 | 26 |
|---|---|---|---|---|---|---|---|---|
| Markt KOOP + R/R, poort open | 1269 | -0,140 | -0,016 | -0,08 tot +0,05 | +0,02 | -0,13 | -0,44 | -0,03 |
| Kansen oud, poort open | 662 | -0,194 | -0,112 | -0,33 tot +0,07 | -0,18 | -0,09 | -0,67 | -0,02 |
| **Kansen nieuw** | 691 | **+0,290** | +0,040 | -0,01 tot +0,09 | +0,39 | +0,65 | -0,30 | -0,04 |
| idem, zonder poort | 796 | +0,215 | +0,036 | -0,01 tot +0,09 | +0,36 | +0,60 | -0,37 | -0,16 |
| idem, 1,5% per kant | 691 | +0,223 | +0,034 | -0,01 tot +0,09 | | | | |
| idem, alleen de 18 coins van voor 2019 | 275 | +0,251 | -0,009 | -0,13 tot +0,11 | | | | |

Tegen de lat:

- ja: minstens 150 trades in de toetsjaren (691)
- **nee**: excess R aantoonbaar boven nul (ondergrens interval -0,01)
- ja: wint van Markt KOOP met poort (+0,290 tegen -0,140)
- **nee**: excess positief in minstens 3 van de 4 toetsjaren (2 van 4)
- ja: excess positief in de meerderheid van alle jaren (5 van 7)

De regel haalt de lat niet. Het netto gemiddelde zelf heeft een interval van -0,10 tot +0,64. Met
"stop minimaal 10%" is de uitkomst gelijk (+0,286 over 688 trades). Op 33% van de dagen in de
toetsjaren stond er minstens één coin op de radar met de poort open.

**Hoe het te lezen:** het nieuwe plan is veel beter dan het oude (van -0,19 naar +0,29 R), en dat
komt uit de opzet: de ruime stop, het grote doel en de poort. Welke coin de radar kiest doet daar
weinig aantoonbaars bovenop. Een coin van voor 2019 doet het niet beter dan willekeurig, dus een
deel van het effect in de afsteljaren leunde op nieuwkomers.

### Wat er in de app veranderd is

- Kansen is een volglijst: altijd WATCH, geen koopknop. De kaart zegt wat het plan na kosten deed.
- Het plan is stop 3x ATR en doel 3R (`radarNiveaus` in `engine/momentum.ts`).
- Het oordeel valt op de laatste afgesloten dag; de app rekende tot nu toe met de lopende dag,
  wat de backtest nooit gemeten heeft.
- Het klimaat van Markt staat ook op Kansen.

### Kanttekeningen

- Met de poort open zijn er maar drie meetbare afsteljaren (2020, 2021, 2022): de marktbreedte
  vraagt minstens 20 coins met historie.
- De minimale stop is alleen voor BTC gemeten (10%). Voor de andere coins is hij onbekend.
- De live spread van eToro komt nog boven de 1% per kant. Die is niet gemeten.
- Overlevingsbias: het universum zijn coins die nu op eToro staan.
- Het interval komt uit een bootstrap per kalendermaand van instap. Trades lopen tot 30 dagen en
  steken dus over maandgrenzen heen, waardoor het interval eerder te smal dan te breed is. De
  uitkomst valt daar niet door om: de regel haalt de lat ook met dit interval niet.
- Een trade die bij het einde van de data nog loopt telt niet mee.
- Na een onafhankelijke review zijn twee dingen in het script aangescherpt (de maand tussen
  afstellen en toetsen, en lopende trades aan het einde). De toets gaf daarna exact dezelfde
  uitkomst; de afstelcijfers verschoven in de derde decimaal en de keuzes bleven gelijk.
- De toetsjaren zijn één keer bekeken voor de regel die getoetst is. De bestaande regels (Markt
  KOOP, Kansen oud) stonden als ijk in dezelfde tabel en waren niet te vermijden.

### Vervolgvoorstel voor Markt

Niet uitgevoerd, wel gemeten: Markts KOOP met de poort open gaat met 1% per kant van +0,220 naar
-0,052 R per trade, en naar -0,140 in 2023 t/m 2026. De oorzaak is dezelfde als bij Kansen: de
stop onder de swing low ligt op mediaan 11% van de koers. Wat een vervolg zou moeten meten:
dezelfde ruime opzet op Markts selectie, de kosten in de drempels van `drempels.ts`, en de
afgesloten dag in `analyseerMarkt`. Tot dan beloven de cijfers in `drempels.ts` meer dan er na
kosten overblijft.
