<p align="center">
  <img src="docs/readme/kader-hero.svg" alt="Het logo van Kader: vier hoekjes omlijsten het woordmerk Kader met de payoff Structuur in crypto." width="880">
</p>

<p align="center"><strong>Structuur in crypto. Geen hype, gewoon data.</strong></p>

Kader is een persoonlijke Android-app die publieke marktdata van 57 crypto's analyseert en daar technische signalen uit haalt. Bij elk signaal staat het plan er meteen bij: een entry, een stop-loss net onder de recente bodem en een doel, met minimaal twee keer zoveel opbrengst als risico. Je kunt je eToro-account koppelen om je posities te volgen en, als je dat wilt, orders te plaatsen. Alles wordt op je telefoon berekend; er is geen server.

> [!WARNING]
> **Geen financieel advies. De koers op eToro kan afwijken.**
> Kader rekent met openbare marktdata (Binance, met CoinGecko als terugval). eToro hanteert een eigen koers met spread, dus controleer de koers in eToro voordat je een order plaatst. Kader geeft technische signalen ter ondersteuning van je eigen onderzoek, geen beloftes. Crypto is volatiel; handel nooit met geld dat je niet kunt missen.

## Wat je ziet

De app heeft vier schermen, bereikbaar via de tabbalk onderin. Je wisselt met een tik of door opzij te vegen.

**Markt.** Kader scant de 57 coins die ook op eToro verhandelbaar zijn en toont de beste twintig als kaarten. Elke kaart heeft de score als ring rond het coinlogo, de koers, een grafiek van 30 dagen en het oordeel. Tik op een kaart en hij klapt uit: stop, entry en doel op één baan, de risico/opbrengst-verhouding en welke bevestigingen meestaan. Bovenaan staat het marktklimaat.

<p align="center">
  <img src="docs/readme/markt-kaart.svg" alt="Voorbeeld van een kaart op Markt voor een verzonnen munt: score 64 als ring rond het logo, koers 100 dollar, plus 6,9 procent over 30 dagen, een koersgrafiek, de badge KOOPZONE en R/R 1 : 2.4." width="460">
</p>

**Kansen.** De momentum-radar scant dezelfde coins met een andere vraag: welke staan dicht bij hun hoogste koers van de afgelopen 90 dagen? Elke kandidaat krijgt een uitbraak-plan (stop op de EMA20, doel 2x ATR boven de top van 90 dagen). KOOP verschijnt alleen bij een score vanaf 55 en een risico/opbrengst van minstens 1:2, anders staat er WATCH. Staat er niets dicht bij zijn top, dan zegt het scherm dat en toont het de sterkste paar coins als WATCH.

**Portfolio.** Je open posities, uit eToro of handmatig ingevoerd, met je resultaat groot in beeld en een stip op de stop-doel-baan voor de live koers. Uitgeklapt zie je een afbouwadvies (bijvoorbeeld WINST BESCHERMEN, STOP OPTREKKEN of HOUDT STAND). Kader controleert je posities ook op de achtergrond en stuurt een melding als een positie de rand van je kader nadert of als eToro een positie voor je sluit.

**Traders.** Beoordeel een eToro Popular Investor op consistentie, risico en spreiding. Je krijgt een score van 0 tot 100, een oordeel GROEN, GEEL of ROOD en een aanbevolen Copy Stop Loss.

## Hoe Kader rekent

Alles hieronder staat in de code (`app/src/engine/analyzer.ts`, `drempels.ts`, `marktklimaat.ts` en `bevestigingen.ts`). De drempels komen uit een backtest over negen jaar Binance-historie, niet uit gevoel.

### De score (0 tot 100)

Kader telt punten op uit de koershistorie van een coin (dagcandles van Binance):

| Kenmerk | Punten |
|---|---|
| Opwaartse trend: EMA20 boven EMA50 | 25 |
| Koers boven de EMA20 | 15 |
| Gezonde RSI (45 tot 68); oversold (onder 35) geeft 10 | 20 |
| MACD bullish, plus 5 als het histogram stijgt | 20 + 5 |
| Volume minstens 1,5x het gemiddelde van 20 dagen; vanaf 1,2x geeft 8 | 15 |

De score gaat nooit boven 100.

### Stop, doel en risico/opbrengst

<p align="center">
  <img src="docs/readme/stop-doel-baan.svg" alt="Voorbeeld van de stop-doel-baan: stop 90 dollar links, entry 100 dollar, doel 125 dollar rechts, met een stip voor de koers die rustig tussen entry en doel beweegt en R/R 1 : 2.5." width="760">
</p>

- **Stop:** net onder de laagste koers van de laatste 10 candles (de swing low), met een kleine marge. De afstand wordt begrensd tussen 0,5x en 3x de ATR, zodat de stop niet in de dagelijkse ruis staat en ook niet absurd ver weg.
- **Doel:** entry + 3x ATR.
- **Risico/opbrengst:** de afstand tot het doel gedeeld door de afstand tot de stop. Die verschilt dus per coin. Onder **1:2** geeft Kader nooit een koopsignaal; de coin blijft wel zichtbaar, met de reden erbij.

### Het oordeel

<p align="center">
  <img src="docs/readme/score-ring.svg" alt="Voorbeeld: een scorering loopt op tot 80 van 100, met de badge STERK KOOP, het keurmerk BEVESTIGD en de vier bevestigingen trend, MACD, volume en R/R." width="760">
</p>

- **AFWACHTEN:** geen koopsignaal. De score is lager dan 55, de risico/opbrengst haalt 1:2 niet, of het marktklimaat houdt het signaal tegen.
- **KOOPZONE:** koopsignaal met een score vanaf 55.
- **STERK KOOP:** koopsignaal met een score vanaf 72.
- **BEVESTIGD:** een keurmerk naast STERK KOOP. Dat krijgt een coin alleen in een gunstig marktklimaat, bij een score van 75 of hoger en als alle vier de bevestigingen meestaan: opwaartse trend, bullish MACD, volume van minstens 1,3x het gemiddelde en een risico/opbrengst van minstens 1:2. Uitgeklapt zie je welke van de vier er meestaan en welke ontbreekt.

### Het marktklimaat

<p align="center">
  <img src="docs/readme/klimaat.svg" alt="Voorbeeld van de klimaatbalk met de standen ongunstig, gemengd en gunstig; de stip glijdt naar gunstig." width="760">
</p>

Kader kijkt ook naar de markt als geheel: staat BTC boven zijn EMA50, en stijgt het aandeel coins dat boven zijn eigen EMA50 staat (de marktbreedte, vergeleken met 20 dagen terug)?

- Beide ja: **GUNSTIG**.
- Beide nee: **ONGUNSTIG**.
- Eén van de twee: **GEMENGD**.

Koopsignalen gaan alleen door bij een gunstig klimaat. In de backtest verloren koopsignalen in ongunstige periodes (2018, 2022, begin 2026) gemiddeld geld. Bij GEMENGD of ONGUNSTIG blijven de score en de niveaus zichtbaar, maar wordt een KOOP teruggezet naar afwachten. Is er te weinig data om het klimaat te bepalen, dan houdt Kader niets tegen.

## eToro-koppeling

Koppelen is optioneel en loopt via een wizard van vijf stappen. Je kiest eerst of je alleen wilt meekijken of ook wilt handelen.

- **Eén sleutel, twee omgevingen.** eToro geeft één API-sleutel uit die zowel je demo- als je echte account bestuurt. De schakelaar **Demo/Echt** kiest alleen het pad naar eToro, en dat pad is het enige wat speelgeld van echt geld scheidt. Naar Echt overstappen doe je in Instellingen door Echt 800 ms vast te houden; terug naar Demo is één tik.
- **Geen order zonder bevestiging.** Kader plaatst nooit uit zichzelf een order. Elke order gaat pas weg na een expliciete bevestiging in het ordervenster: in Demo tik je op de knop, met echt geld houd je de knop 800 ms vast.
- **Sleutels blijven op je toestel.** Ze staan in de beveiligde opslag van Android (`expo-secure-store`), niet in de gewone app-opslag, en gaan dus niet mee in een back-up.
- **Grenzen van eToro.** Kader controleert een voorgestelde stop-loss tegen de grens die eToro voor die coin hanteert. Lukt dat niet, dan toont Kader geen verzonnen grens.

## Installeren

Kader staat niet in de Play Store. Je installeert de app zelf (sideloaden):

1. Download de nieuwste `.apk` onder [Releases](https://github.com/helgerskevin-hub/kader/releases/latest).
2. Open het bestand op je Android-telefoon en sta installeren uit deze bron toe.
3. Een update installeer je over de bestaande app heen; je portfolio en traders blijven bewaard.

### Zelf bouwen

De app staat in `app/` (React Native en Expo SDK 56, TypeScript). Je hebt nodig: Node.js, JDK 17 of nieuwer (de JBR van Android Studio volstaat) en de Android SDK (platform 35 of nieuwer). Zet `JAVA_HOME` en `ANDROID_HOME` en zet het project op een lokale schijf zonder spaties in het pad (bijvoorbeeld `C:\dev`).

```bash
cd app
npm install          # eerste keer, en na een pull die dependencies wijzigt
npx expo start       # Metro bundler + dev-client
npm run android      # bouw en installeer op een aangesloten toestel of emulator
```

Na een pull die een native dependency toevoegt of bijwerkt (Reanimated, Skia, gesture-handler, expo-haptics en dergelijke) is één keer `npm run android` nodig; daarna volstaat hot reload weer.

Een release bouw je **altijd** met `npm run release:apk`, nooit met een losse Gradle-build. Dat script doet een schone prebuild en controleert versienummer en ondertekening voordat de APK de deur uit gaat. Elke release is ondertekend met dezelfde sleutel; een andere sleutel zou iedereen dwingen de app eerst te verwijderen, en daarmee hun lokale gegevens.

## Samenwerken

Kader wordt gebouwd door Thom en Kevin, allebei via Claude Code. De afspraken staan in [`docs/github-werkwijze.md`](docs/github-werkwijze.md). Kort:

- `main` is altijd stabiel en installeerbaar. Daar wordt niet rechtstreeks op gewerkt.
- Eén branch per taak, samengevoegd via een pull request.
- Zeg vooraf tegen elkaar wat je oppakt, zodat twee sessies niet tegelijk in dezelfde bestanden werken.
- Begin met `git fetch origin` en kijk wat de ander heeft gepusht.

Het merk en de huisstijl staan in [`docs/huisstijl-kader.md`](docs/huisstijl-kader.md). Alle tekst in de app is Nederlands.

## Bronnen en licenties

- **Marktdata:** [Binance](https://www.binance.com) (dagcandles) met [CoinGecko](https://www.coingecko.com) als terugval, en de angst-en-hebzuchtindex van [Alternative.me](https://alternative.me/crypto/fear-and-greed-index/). Allemaal openbaar, zonder API-sleutel.
- **Coinlogo's:** uit `cryptocurrency-icons` (CC0) en `@web3icons/core` (MIT), plus één hertekend logo (SOL). De logo's zijn merken van de projecten zelf; Kader gebruikt ze alleen om een coin te herkennen. Details per logo staan in [`app/assets/coins/LICENTIES.md`](app/assets/coins/LICENTIES.md).

<p align="center"><sub>Geen financieel advies. De koers op eToro kan afwijken.</sub></p>
