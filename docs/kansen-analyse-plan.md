# Plan: de analyse achter Kansen

Branch: `feat/kansen-analyse`, afgetakt van `main` op 11 nov 2026 (na release 0.4.2).

De UX en UI van de Kansen-tab blijven staan. Dit plan gaat over wat erachter zit: hoe een coin
op de lijst komt, wanneer hij KOOP krijgt, met welke niveaus, en hoe we weten dat het klopt.

---

## 1. Wat Kansen nu doet

- **Score** (`momentumScore` in `engine/momentum.ts`): alleen de afstand tot de hoogste koers van
  90 dagen. 100 op de top, lineair naar 0 op 30% eronder. Vanaf 70 (binnen 9%) staat een coin op
  de radar.
- **KOOP** (`radarSignaal` in `engine/opportunities.ts`): radar, plus de technische score van Markt
  van minstens 55, plus R/R van minstens 2 op het radarplan.
- **Radarplan** (`radarNiveaus`): stop op de EMA20, geklemd tussen 0,5x en 3x ATR. Doel 2x ATR
  boven de 90-dagen-top.
- **Onderbouwing**: meting I en J in `app/scripts/backtest.ts`, negen jaar, 57 coins.

## 2. Waar het tekortschiet

Elk punt is in de code nagelopen, niet aangenomen.

| # | Bevinding | Waar |
|---|---|---|
| 1 | De backtest rekent zonder kosten. Geen spread, geen slippage. De gemeten voorsprong van KOOP is +0,235 R; bij een krappe stop is de spread een groot deel daarvan. | `backtest.ts` bevat het woord spread niet |
| 2 | De app rekent met de lopende dag, de backtest gooit die juist weg. Volume is halverwege de dag te laag, de score schuift door de dag. | `haalBinanceKlines` tegenover `haal-historie.mjs` |
| 3 | De R/R beloont een krappe stop. De vloer van 0,5x ATR ligt op dagkoersen binnen de ruis, en eToro schuift de stop daarna vaak op, waarna KOOP alsnog WATCH wordt. | `radarNiveaus`, `effectiefSignaal` |
| 4 | Kansen heeft geen klimaatpoort, Markt wel. De radar verloor in 2022 -0,66 R en voegt met de poort open niets toe boven Markt (+0,173 tegen +0,187). | `zoekKansen` roept `bepaalKlimaat` niet aan |
| 5 | De afstand tot de top is in procenten, niet in volatiliteit. 9% is voor BTC een correctie, voor PEPE een dag. | `momentumScore` |
| 6 | Vijf van de zes ingrediënten tellen niet mee maar staan wel op de kaart. De kaart toont "sterker dan BTC" als iets positiefs, terwijl meting H het omgekeerde vond. | `momentumRedenen` |
| 7 | Drempels en 25 stop/doel-varianten zijn gekozen op dezelfde negen jaar als waarop ze getoetst zijn. Het universum bevat alleen coins die vandaag nog bestaan. | meting I-c0, J1 |
| 8 | Kansen-signalen worden niet gelogd. Het signaalboek volgt alleen Markt. | `MarktProvider` is de enige aanroeper van `registreerSignalen` |
| 9 | Kansen kijkt niet naar je portfolio. | `KansenScreen` gebruikt alleen `magHandelen` |

### Eerste meting: wat de kosten doen (11 nov 2026)

De bestaande backtest reproduceert op verse data (57 coins t/m 10 nov 2026): de KOOP-regel van
Kansen geeft +0,236 R over 1279 trades, tegen +0,235 over 1161 in `docs/metingen.md`.

Daarna dezelfde regel nagespeeld met kosten erbij. eToro rekent 1% bij kopen en 1% bij verkopen
van crypto (eToro's eigen tarievenpagina). De stop van deze trades ligt op mediaan 7,3% van de
koers, een kwart ligt onder 4,6%.

| scenario | n | gem R | t/m 2022 | 2023 en later |
|---|---|---|---|---|
| zonder kosten (wat de app nu aanneemt) | 1279 | +0,236 | +0,350 | +0,192 |
| 0,5% per kant | 1279 | +0,038 | +0,199 | -0,025 |
| **1% per kant (eToro)** | 1279 | **-0,160** | +0,048 | -0,241 |
| 1% per kant, stop minimaal 5% | 1173 | -0,066 | +0,122 | -0,144 |
| 1% per kant, stop minimaal 10% | 751 | -0,070 | +0,142 | -0,191 |

Met eToro's kosten verliest de huidige KOOP van Kansen gemiddeld geld, en sinds 2023 in elk jaar.
De kosten in R zijn de kosten gedeeld door de stopafstand: hoe krapper de stop, hoe zwaarder 2%
weegt. Dat is de belangrijkste ontwerpregel voor alles hierna. Een soort kans met een ruimere
stop en een groter doel betaalt naar verhouding minder.

Kanttekeningen: dit is een proefmeting buiten `backtest.ts`, zonder klimaatpoort, en de minimale
stop is als één percentage voor alle coins genomen in plaats van per coin. Fase 0 bouwt hem
netjes in. Markts eigen KOOP (+0,106 R zonder kosten) is nog niet met kosten gemeten; dat hoort
bij het vervolgvoorstel voor Markt.

## 3. Keuzes van Kevin (11 nov 2026)

| Onderwerp | Keuze |
|---|---|
| Route | A (repareren) plus B (meerdere soorten kansen), gesorteerd op verwachte uitkomst na kosten (C) |
| Doel van de tab | Koopwaardig nu en een volglijst, duidelijk gescheiden |
| Strengheid | Streng: liever leeg dan zwak |
| Kosten en eToro-stop | Volledig meerekenen in het signaal en in de backtest |
| Marktklimaat | Zelfde poort als Markt |
| Dagcandle | Oordeel op de afgesloten dag, niveaus op de koers van nu |
| Portfolio | Markeren, niet wegfilteren |
| Bewijslat | Streng: afstellen op oude jaren, toetsen op nieuwe, na kosten, in de meeste jaren winnen |
| Soorten om te meten | Terugval in een opgaande trend, verse uitbraak met volume, rustige opbouw, afstand in volatiliteit |
| Markt-tab | Ongemoeid; bevindingen voor Markt worden een vervolgvoorstel |
| Scherm | Kleine toevoegingen binnen de kaart, met bestaande componenten |
| UI-regels | `docs/app-beschrijving-voor-claude-design.md` (4 t/m 9), `docs/huisstijl-kader.md`, `CLAUDE.md` |

## 4. Overwogen routes

- **A. Repareren.** Het concept blijft, de meetfouten gaan eruit. Veilig en snel, maar de radar
  blijft op één ingrediënt draaien en voegt binnen de poort niets toe boven Markt.
- **B. Meerdere soorten kansen.** Elke soort een eigen detectie en eigen niveaus, apart gemeten.
  Lost op dat Kansen nu vooral een tweede Markt is. Meer meetwerk, meer kans op overfitting.
- **C. Eén verwachte uitkomst.** Het eerlijkst als sortering, maar als enige model het gevoeligst
  voor afstellen op het verleden.

Gekozen: A als fundament, B erbovenop, en van C alleen de sortering. C wordt geen model maar een
opzoektabel: de gemeten netto R per soort en per sterkte-emmer uit de afsteljaren, getrokken
richting nul bij weinig trades. Geen regressie, geen gewichten die niemand kan uitleggen.

## 5. Beslisregels, vooraf vastgelegd

Deze regels staan vast voordat er één nieuwe meting draait. Achteraf bijstellen mag niet.

1. **Afstellen en toetsen gescheiden.** Drempels kiezen op 2017 t/m 2022. Toetsen op 2023 t/m
   2026, één keer, met de gekozen drempels. Wat op de toetsjaren valt, valt.
2. **Na kosten.** Elke trade betaalt de spread heen en terug en gebruikt de stop die eToro toelaat.
3. **Tegen de juiste tegenstander.** Een soort moet winnen van (a) alle bars op dezelfde dag
   (excess R, zoals meting I-e) en (b) Markts KOOP met poort open. Wint hij alleen van de
   nulmeting, dan is het een markteffect.
4. **In de meeste jaren.** Positieve netto excess R in minstens 3 van de 4 toetsjaren en in de
   meerderheid van alle jaren. Eén bulljaar dat het gemiddelde draagt telt niet.
5. **Genoeg trades.** Minstens 150 trades zonder overlap in de toetsjaren, anders "niet te meten"
   en dus niet in de app.
6. **Onzekerheid erbij.** Per uitkomst een betrouwbaarheidsinterval via bootstrap per kalenderdag
   (coins op dezelfde dag bewegen samen, dus trades zijn geen losse waarnemingen). De ondergrens
   van het interval moet boven nul liggen.
7. **Eenvoud wint.** Bij gelijke uitkomst gaat de regel met de minste parameters erin.

Haalt geen enkele nieuwe soort de lat, dan levert deze branch alleen de reparaties uit fase 1 op,
en staat in `docs/metingen.md` wat is afgevallen en waarom. Dat is ook een goede uitkomst.

## 6. Fasen

### Fase 0: meetfundament

Doel: een backtest die meet wat de app straks doet.

- Historie ophalen (`node scripts/haal-historie.mjs 9`) en meting C, I en J reproduceren. De
  cijfers moeten overeenkomen met `docs/metingen.md`, op de extra weken data na.
- Kosten in `simuleer()`: een parameter voor de kosten per kant. eToro rekent 1% per kant; daar
  moet een regel de lat op halen. De backtest toont ook 0,5% en 1,5%, zodat zichtbaar is hoe
  gevoelig een uitkomst is. De live spread uit `engine/spread.ts` komt daar nog bovenop en wordt
  per coin gemeten zodra de koppeling beschikbaar is.
- eToro-stop: per coin de minimale stopafstand. De app kent die via `etoroLimieten.ts`; voor de
  backtest komt er een tabel in `scripts/`, gevuld uit de cache van de app of het demo-account.
- Splitsing in afstel- en toetsjaren, bootstrap per dag, excess R als standaardkolom.
- Overlevingsbias: het universum zijn coins die nu op eToro staan. Dat is niet te repareren zonder
  data van verdwenen coins, wel te begrenzen: elke meting ook op alleen de coins die in 2019 al
  bestonden, zodat een effect dat alleen op nieuwkomers leunt opvalt.

Open punt voor Kevin of Thom: de echte spread en minimale stop per coin vragen de eToro-koppeling.

### Fase 1: reparaties (route A)

Alles in de Kansen-keten; `scoorCandles` en `analyseerMarkt` blijven byte-voor-byte gelijk.

- **Afgesloten dag.** `zoekKansen` splitst de candles in de afgesloten reeks (voor score, radar en
  oordeel) en de koers van nu (voor entry, stop, doel en R/R). Herkenning via de openingstijd van
  de laatste candle, zoals `haal-historie.mjs` dat doet.
- **Klimaatpoort.** `zoekKansen` heeft alle candles al en roept `bepaalKlimaat` aan. Poort dicht:
  geen KOOP, alleen volglijst, met dezelfde uitleg als op Markt.
- **Stop en R/R.** De stop die telt is de stop die eToro toelaat. De ATR-vloer wordt opnieuw
  gemeten in fase 0; R/R wordt netto, na spread.
- **Signaalboek.** Kansen-signalen worden gelogd met hun soort, zodat Signaalresultaat live laat
  zien of ze doen wat de backtest belooft.
- **Opslag.** `BEWAAR_VERSIE` omhoog, zodat een oude bewaarde scan niet in de nieuwe vorm wordt
  gelezen.

### Fase 2: soorten kansen (route B)

Elke soort is een pure functie in een nieuw bestand `engine/kansSoorten.ts`: candles erin,
detectie en niveaus eruit, met een self-check onderaan zoals de rest van de engine.

| Soort | Idee | Waarom het zou kunnen werken |
|---|---|---|
| Bij de top (bestaand) | Afstand tot de 90-dagen-top, nu in ATR | Meting I: het enige ingrediënt dat standhield tegen de andere coins |
| Terugval in opgaande trend | Trend op, coin 10 procentpunt of meer achter op BTC in 30 dagen | Meting H: +0,57 R bij achterblijvers, monotone helling over zeven emmers |
| Verse uitbraak met volume | Slot boven de vorige 90-dagen-top op duidelijk hoger volume | Onderscheidt een doorbraak van een coin die tegen zijn top aan hangt |
| Rustige opbouw | Trend op, schommelingen krimpen (ATR laag tegenover zijn eigen gemiddelde) | Krappe stop met een ruim doel, zonder dat de stop in de ruis ligt |

Per soort: afstellen, één keer toetsen, uitkomst in `docs/metingen.md` als meting M en verder,
ook als de soort afvalt.

### Fase 3: sortering (uit route C)

- Per soort en per sterkte-emmer de netto R uit de afsteljaren, als constanten met de meting
  erbij, zoals `drempels.ts` dat nu doet.
- Bij weinig trades trekt de waarde richting nul, zodat een emmer met 30 gelukkige trades niet
  bovenaan komt.
- De lijst sorteert op die verwachte netto R. KOOP vraagt: poort open, soort haalt de lat,
  verwachte netto R boven de drempel uit de afsteljaren, R/R netto minstens 2.

### Fase 4: scherm

Binnen de bestaande kaart, volgens de UI-regels.

- Koopwaardig nu en Volglijst als twee groepen in dezelfde lijst, gescheiden met de overline-kop
  die er al staat. Geen nieuw schermdeel.
- Een chip met de soort en de regel "verwacht na kosten" in het uitgeklapte deel. De redenen
  zeggen wat meetelt; "sterker dan BTC" verdwijnt als pluspunt.
- Portfolio-markering als chip: "Heb je al" of "Beweegt mee met je SOL", uit `correlatie.ts`.
- Checklist per wijziging: bestaande componenten (`PilKnop`, `StopDoelBaan`, `Drukbaar`), tokens
  uit `beweging.ts` en `haptiek.ts`, alleen transform en opacity, raakdoelen 44 px, kleur nooit de
  enige betekenisdrager, tabular cijfers, TalkBack-label bijgewerkt, geen em-dashes, disclaimer.

### Fase 5: verificatie en afronding

- Self-checks van elk engine-bestand draaien, plus `tsc`.
- Meting C moet exact reproduceren: bewijs dat Markt ongemoeid is.
- Emulator via de `run-android`-skill: volle radar, lege radar, poort dicht, verouderde scan.
- Review in een aparte pass (`code-reviewer`), niet door de schrijver zelf.
- `CHANGELOG.md` en `app/src/changelog.ts` gelijk bijwerken, `docs/metingen.md` aanvullen,
  hoofdstuk in `informatie/hoofdstukken.ts` laten kloppen met de nieuwe berekening.
- Geen versienummer en geen release: dat gebeurt pas bij een build.

## 7. Risico's

| Risico | Wat we doen |
|---|---|
| Na kosten blijft er niets over | Dan is dat de uitkomst. Kansen wordt een eerlijke volglijst zonder KOOP en dat staat in de app. |
| Overfitting door vier soorten maal drempels | Beslisregels uit 5, één toetsronde, bootstrap, alles wat afvalt wordt gedocumenteerd. |
| Markt verandert ongemerkt mee | Geen wijziging in `scoorCandles` of `analyseerMarkt`; meting C als bewaking. |
| Kansen vaker leeg | Bewust gekozen. De volglijst en de uitleg vangen het lege scherm op. |
| Spread en minimale stop niet gemeten | Drie scenario's in de backtest; de echte waarden zodra de koppeling beschikbaar is. |
| Thom werkt tegelijk in dezelfde bestanden | Afstemmen voor de start; deze branch raakt `engine/opportunities.ts`, `engine/momentum.ts`, `state/KansenProvider.tsx`, `components/KansKaart.tsx`, `scripts/backtest.ts`. |

## 8. Aanbeveling model en inspanning

- **Fase 0 t/m 3 (meten en engine):** het sterkste model, hoge inspanning. Hier zit het risico:
  een subtiele look-ahead of een verkeerd gelezen meting kost echt geld.
- **Fase 4 (scherm):** standaardmodel, gemiddelde inspanning. Kleine wijzigingen met bestaande
  componenten.
- **Fase 5 (review):** het sterkste model, hoge inspanning, in een eigen sessie of agent, zodat de
  beoordelaar niet de schrijver is.
