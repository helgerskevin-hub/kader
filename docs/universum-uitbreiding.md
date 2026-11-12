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
- 45 coins hebben geen logo en tonen een monogram, zie `app/assets/coins/LICENTIES.md`.

## Opgevallen

- **SNX** staat in `STANDAARD_UNIVERSUM`, maar heeft in de publieke handelsdata nu `AllowBuy: false`. Niet
  aangepast: `ALLEEN_BEKIJKEN` is met een echte sleutel gemeten en dat is hier niet opnieuw gedaan.
- **HYPE** heeft op Binance pas 50 dagcandles; Kader scoort een coin vanaf 55. Tot die tijd slaat de scan hem
  over.
- De nieuwe coins hebben geen naam of uitleg in `coinInfo.ts`; de app toont dan de ticker en "Onbekend",
  net als bij de meeste van de oorspronkelijke 57.
