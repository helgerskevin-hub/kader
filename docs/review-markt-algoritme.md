# Review: het Markt-algoritme aan de testbank (12 nov 2026)

Voor Thom en Kevin. De cijfers en de onderbouwing staan in meting O in `docs/metingen.md`, de
beslisregels in `docs/algoritme-plan.md`. Kansen valt erbuiten. Aan de app is niets veranderd.

## In één alinea

Markt zoals hij nu is (score 55+, poort, stop 3x ATR, doel 3R) verliest als portefeuille geld ten
opzichte van BTC houden: +11% per jaar met een terugval van -89% op de 57 coins, en -5% per jaar
met -96% op 359 coins die nooit in een meting zaten. Eén combinatie is op die nieuwe coins
aantoonbaar beter: **koop bij open poort de rustigste coins (laagste ATR ten opzichte van de koers),
hoogstens 5 tegelijk, zonder doel, met een stop die meeloopt met het laagste punt van de laatste 20
dagen.** Op de nieuwe coins +51% per jaar met een terugval van -68%, en per trade aantoonbaar winst
na kosten. Dat is de eerste regel in Kader die een toets op ongeziene data haalt. Hij wint
aantoonbaar van Nu, maar niet aantoonbaar van gewoon BTC houden: zonder het uitzonderlijke jaar
2021 doet hij ongeveer hetzelfde als BTC, met een kleinere terugval.

## Hoe het huidige algoritme ervoor staat

| | 57 coins | 359 nieuwe coins |
|---|---|---|
| BTC houden | +36% per jaar, terugval -77% | (zelfde) |
| Nu | +11%, -89% | -5%, -96% |
| Nu, verliesjaren | 2022, 2024, 2025, 2026 | 2022, 2024, 2025, 2026 |

## Pijnpunten

1. **Het vaste doel knipt de winst af.** Crypto verdient zijn geld in een paar trades die 10x of
   meer lopen. Een doel van 3R neemt die winst na een kwart van de weg. De mediane trade verliest
   altijd (ook in de beste variant); de winst zit in de staart, en het doel haalt de staart weg.
2. **De score kiest niet.** Na kosten deed "elke coin bij open poort" exact hetzelfde als score 55+,
   nu ook als portefeuille en op de nieuwe coins. EMA, RSI, MACD en volume voegen niets toe.
3. **Altcoins in de breedte verliezen sinds 2024.** Ook met de betere uitstap haalt een willekeurige
   alt-portefeuille -96% terugval op de nieuwe coins. De keuze van de coin doet ertoe, alleen niet via
   de score.
4. **De poort als aan/uit-knop is te onrustig.** Op BTC zelf toegepast levert hij -2% per jaar:
   16 wissels per jaar, 2% kosten per wissel. Hij werkt als filter voor instappen, niet als
   verkoopsignaal (verkopen als de poort dicht gaat: 0% per jaar).
5. **De maatstaf.** Gemiddelde R per trade zei "positief", terwijl het vermogen in drie van de
   laatste vier jaar kromp. Een trade-gemiddelde ziet niet dat verliezers tegelijk vallen.

## Winpunten

1. **Meelopende stop op het laagste punt van 20 dagen, geen doel.** Het grootste effect op de 57
   coins (+11% naar +78%). Een slot onder de EMA50 als verkoopregel is tweede (+48%).
2. **Rustigste coins eerst.** Van alle manieren om te kiezen wint de laagste volatiliteit, bij elk
   aantal plekken, op de 57 coins én op de nieuwe coins. Het tegendeel van wat de score beloont.
3. **Minder plekken, minder handel.** 5 plekken met 28 trades per jaar wint van 10 plekken met 97.
   Bij 2% kosten per ronde telt elke trade.
4. **Robuust.** 1,5% kosten per kant, eToro's minimale stop van 10%, slechtere vulling op
   crashcandles, de grootste winnaar eruit: overal blijft de regel overeind.

## Voorstel voor de app (beslissing aan jullie)

1. **Plan: geen doel meer, stop loopt mee.** Beginstop 3x ATR zoals nu; daarna elke dag de stop naar
   het laagste punt van de laatste 20 dagen, alleen omhoog. De bouwstenen zijn er: `wijzigNiveaus()`
   in `engine/etoro.ts` kan de stop bij eToro verzetten, en `tradeChecks.ts` heeft al een
   trailing-stop-voorstel. Nieuw is een dagelijkse "stop verzetten"-melding met bevestiging.
2. **"Wat kopen nu": sorteren op rust, hoogstens 5.** Bij open poort de vijf coins met de laagste
   ATR/koers, niet de hoogste score. De score kan als uitleg op de kaart blijven, niet als
   koopreden.
3. **Eerlijke ijklijn.** Signaalresultaat toont naast het resultaat ook wat BTC houden in dezelfde
   periode deed. Dat is de vergelijking die ertoe doet.
4. **Live naloop vanaf vandaag.** Het signaalboek volgt regel C vanaf 12 nov 2026. Dat is het enige
   schone bewijs voor de poort en voor de periode na 2021.
5. **De kooplabels blijven uit** tot het signaalboek regel C bevestigt; de lat uit
   `docs/markt-kosten-plan.md` blijft gelden.

## Wat er niet bewezen is

- **Beter dan BTC houden.** Zonder 2021: C +36% (57 coins) en +3% (nieuwe coins) per jaar, tegen
  +32,5% voor BTC. Het voordeel is vooral de kleinere terugval (-60% en -68% tegen -77%).
- **De poort.** De nieuwe coins zijn nieuw, de jaren en BTC niet.
- **Of eToro de dagelijkse stop praktisch toelaat** (minimale afstand, spread, de tijd tussen het
  slot en het verzetten).
- **Welke coins op eToro.** Op de nieuwe coins kiest "rustig" vaak Tron-tokens en XMR die eToro niet
  heeft. Op de 57 eToro-coins zijn het BTC, BNB, TRX, ETH, XLM en XRP.

## Mogelijke vervolgmetingen

- Een kern van BTC houden plus regel C als aanvulling: haalt dat de kleinere terugval met het
  rendement van BTC? Alleen nog op de 57 coins te meten, dus pas te bewijzen via het signaalboek.
- U3 (verkopen onder EMA50) naast U4 in de live naloop: eenvoudiger uit te leggen, tweede op de
  afstelset.
