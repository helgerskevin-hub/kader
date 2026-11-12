# Universum uitgebreid van 57 naar 148 coins (12 nov 2026)

## Hoe de lijst tot stand kwam

1. eToro's publieke instrumentenlijst (`api.etorostatic.com/sapi/instrumentsmetadata/V1.1/instruments`):
   crypto (`InstrumentTypeID` 10) in de hoofdcategorie (subcategorie 1001, 391 stuks) en de categorie waar
   eToro nieuwere en meme-coins zet (1010, 39 stuks). De andere subcategorieën zijn paren tegen de euro.
2. Per instrument eToro's publieke handelsdata
   (`www.etoro.com/sapi/trade-real/instruments/?InstrumentDataFilters=TradingData`). Koopbaar telt als:
   `AllowBuy`, `AllowManualTrading`, niet `IsDelisted`, niet `RestrictedManualOpen`. Dat laat 160 over in 1001 en 28 in 1010.
   FLOW, ENJ en THETA (alleen bekijken, zie `platforms.ts`) vallen er op `RestrictedManualOpen` ook uit.
3. Daarvan een live Binance-USDT-paar en nog niet in Kader: 77 plus 15. USDC eraf (stablecoin): 91 nieuwe
   coins.
4. Per coin de koers van eToro naast die van Binance. 89 liggen binnen 2%: dezelfde munt in dezelfde
   eenheid. BONK en FLOKI voert eToro per miljoen munten (BONKxM, FLOKIxM, factor 9,96e5 en 9,99e5), net
   als SHIB en PEPE; die staan nu in `ETORO_ALIAS` in `etoroSymbolen.ts`.
5. Zelfde ticker, ander project: alleen bij de logo's gevonden (AMP, MET, JUP), niet bij de koersen.

Geen liquiditeitsgrens: de vraag was alles wat op eToro te koop is. Een paar coins zijn dun verhandeld;
eToro's spread kan daar boven de 1% per kant uitkomen waarmee de metingen rekenen.

## Wat er niet verandert

- **Het marktklimaat** rekent de breedte op `KLIMAAT_UNIVERSUM`, de oorspronkelijke 57. Daarop is de poort
  gemeten; met 148 coins zou de breedte iets anders meten.
- **De meetscripts** (`backtest.ts`, `meting-kansen.ts`, `meting-algoritme.ts`, `haal-holdout.mjs`) gebruiken
  ook `KLIMAAT_UNIVERSUM`, zodat meting C t/m O exact reproduceren (gecontroleerd: N4 en de ijklijn van O).

## Wat er wel verandert

- Markt, Kansen, de naloop van regel C en de Copy-tab kijken naar 148 coins. Een scan duurt ongeveer twee
  keer zo lang (blokken van 6).
- `haalStopLossLimieten` vroeg eToro maximaal 100 symbolen en liet de rest stil vallen; nu in blokken van 100.
- 38 coins hebben geen vrij te gebruiken logo en krijgen een eigen badge (cirkel in de merkkleur met de ticker), zie `app/assets/coins/LICENTIES.md`.

## Opgevallen

- **SNX** staat in `STANDAARD_UNIVERSUM`, maar heeft in de publieke handelsdata nu `AllowBuy: false`. Niet
  aangepast: `ALLEEN_BEKIJKEN` is met een echte sleutel gemeten en dat is hier niet opnieuw gedaan.
- **HYPE** heeft op Binance pas 50 dagcandles; Kader scoort een coin vanaf 55. Tot die tijd slaat de scan hem
  over.
- De nieuwe coins hebben geen naam of uitleg in `coinInfo.ts`; de app toont dan de ticker en "Onbekend",
  net als bij de meeste van de oorspronkelijke 57.

## Meting P: het klimaat op 148 coins (beslisregel vooraf, 12 nov 2026)

De vraag: moet de marktbreedte in het klimaat over alle 148 coins gaan in plaats van over de 57?
Zelfde poort (BTC boven EMA50 en de breedte hoger dan 20 dagen terug, minstens 20 coins met historie),
alleen een andere set voor de breedte. Script: `app/scripts/meting-algoritme.ts klimaat`.

Gemeten, met de portefeuille-simulatie van meting O (1% per kant, 15 nov 2019 t/m nu):

- op hoeveel dagen de twee poorten hetzelfde zeggen;
- Nu (score 55+, stop 3x ATR, doel 3R) en regel C, elk met de poort op 57 en de poort op 148;
- dat allebei op de 57 coins als handelsset (vergelijkbaar met meting O) en op alle 148 (wat de app nu doet).

Overstappen op 148 alleen als, op beide handelssets en voor zowel Nu als regel C, de poort op 148:
een hogere CAGR geeft, een max drawdown die niet slechter is, en in de meerderheid van de jaren beter
is. Anders blijft de breedte op de 57. Er is hier geen ongeziene toetsdata: de jaren en BTC zijn in
meting M, N en O al bekeken. Daarom een strenge lat; het signaalboek moet het daarna live bevestigen.

### Uitkomst meting P

142 van de 148 coins hebben genoeg historie. De breedte op de 57 geeft exact `poortOpen()` (0 van 2554
dagen anders).

- **De twee poorten zeggen op 98% van de dagen hetzelfde** (2496 van 2554), per jaar 95 tot 100%. Open op
  853 dagen (57) tegen 863 dagen (148).
- **Op 148 is in alle vier de combinaties iets slechter**:

| handelsset, regel | poort op 57 | poort op 148 | beter in jaren |
|---|---|---|---|
| 57 coins, Nu | +11,1%, terugval -89% | +9,0%, -92% | 3 van 7 |
| 57 coins, regel C | +103,0%, -60% | +99,9%, -57% | 2 van 7 |
| 148 coins, Nu | +30,6%, -89% | +28,2%, -90% | 4 van 7 |
| 148 coins, regel C | +89,3%, -64% | +87,7%, -61% | 4 van 7 |

**Oordeel: de breedte blijft op de 57.** De lat vroeg een hogere CAGR in alle vier, en die haalt de brede
poort nergens. Het verschil is klein; de keuze doet er weinig toe, en dan wint de versie die gemeten is.

Terzijde, geen besluit: handelen in alle 148 coins in plaats van de 57 gaf voor Nu een hoger rendement
(+30,6% tegen +11,1%) en voor regel C een lager (+89% tegen +103%), met regel C sinds 2025 wel beter.
Dat is op jaren die al bekeken zijn, en de 148 coins zijn coins die er nu nog zijn: overlevingsbias
maakt dit cijfer te mooi.
