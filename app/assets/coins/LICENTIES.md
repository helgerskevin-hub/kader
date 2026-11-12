# Coinlogo's: bron en licentie

De 103 logo's in deze map horen bij `STANDAARD_UNIVERSUM` in `src/engine/analyzer.ts`. Ze gaan mee in de app (geen netwerkverzoek per coin) via `scripts/genereer-coinlogos.mjs`, dat `src/components/coinLogos.ts` schrijft. Bestandsnaam = Kader-symbool in kleine letters.

De logo's zijn merken van de projecten zelf. Kader gebruikt ze alleen om een coin te herkennen, niet om een band met het project te suggereren.

## 1. cryptocurrency-icons 0.18.1: CC0 1.0 (54 logo's)

Bron: npm-pakket `cryptocurrency-icons@0.18.1`, map `svg/color/`. Licentie: Creative Commons Zero v1.0 Universal (publiek domein), https://creativecommons.org/publicdomain/zero/1.0/. Geen naamsvermelding verplicht; staat hier voor de volledigheid.

`1inch aave ada algo atom avax bat bch bnb btc chz comp crv doge dot enj etc eth fil grt icp link ltc mana matic mkr sand snx sushi theta trx uni vet xlm xrp xtz yfi zrx`

Bewerkt (mag onder CC0), omdat react-native-svg SVG-filters niet betrouwbaar tekent:
- `ada.svg`: de schaduwkopie onder het logo en de bijbehorende filter weggehaald.
- `grt.svg`, `mana.svg`: de filter die de vorm wit kleurde vervangen door een witte vulling. Zelfde beeld.

Erbij op 12 nov 2026 (uitbreiding van het universum), ongewijzigd: `ankr ape band bnt cvc gno knc ksm lpt neo qnt ray skl stx uma zen`

## 2. web3icons (`@web3icons/core` 4.0.56): MIT (48 logo's)

Bron: npm-pakket `@web3icons/core@4.0.56` (https://github.com/0xa3k5/web3icons), variant `background` (logo op een vlak in de merkkleur; Kader snijdt het rond af). INJ komt uit `networks/background/injective`, de rest uit `tokens/background/<SYMBOOL>`.

`apt arb axs fet flow ftm gala hbar imx inj near op pepe rndr sei shib sui tia`

Erbij op 12 nov 2026, ongewijzigd, gecontroleerd tegen de projectnaam in `@web3icons/common`: `a ach ar axl c98 cake celo celr coti cow ctsi dydx ens eul ilv jasmy jst kava ldo lqty metis ogn osmo pendle pyth rsr rune strk tao trb`

FTM toont het Fantom-logo: Kader noemt de coin FTM, eToro voert hem als S (Sonic), zie `src/engine/etoroSymbolen.ts`.

Trust Wallet assets (github.com/trustwallet/assets) is bewust niet gebruikt: de MIT-licentie daar dekt volgens de README alleen "the scripts and documentation", niet de ingestuurde logo's.

```
MIT License

Copyright (c) 2024 0xa3k5

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Coins zonder logo

45 coins hebben geen logo en tonen een monogram (`CoinLogo.tsx`). Voor de meeste bestaat er geen logo in de twee pakketten hierboven. Vier zijn er bewust uit gelaten omdat het logo onder dezelfde ticker bij een ander project hoort: AMP (HyperSpace in plaats van Amp), MET (Metronome in plaats van Meteora), JUP (het oude Jupiter Project in plaats van Jupiter op Solana) en GRAM (niet zeker dat het de Gram van eToro is). Een verkeerd logo is erger dan geen.

## 3. SOL: hertekend voor Kader (1 logo)

`sol.svg` komt uit het ontwerp van de UI-makeover (`.omc/handoffs/ui-makeover/ontwerp/kader-kaarten.html`, `const LOGO.SOL`): de officiële Solana-vorm met het verloop #9945FF naar #14F195 op zwart. De CC0-set heeft alleen een groene cirkel, en groen is in Kader winst.
