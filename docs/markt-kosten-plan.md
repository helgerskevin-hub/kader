# Plan: Markt na kosten

Branch: `feat/markt-kosten`, afgetakt van `main` op 11 nov 2026 (na de merge van #115, Kansen).

Vervolg op `docs/kansen-analyse-plan.md` en meting M in `docs/metingen.md`. Deze ronde levert
alleen een meting en een voorstel op. Aan de app verandert niets tot Kevin en Thom over de uitkomst
beslist hebben.

---

## 1. Aanleiding

Meting M rekende voor het eerst met eToro's kosten (1% bij kopen, 1% bij verkopen). Markts eigen
koopsignaal was daarbij alleen ijkpunt, maar de uitkomst is duidelijk:

| Markt KOOP + R/R, poort open | zonder kosten | met kosten | met kosten, 2023 t/m 2026 |
|---|---|---|---|
| gemiddelde R per trade | +0,220 | -0,052 | -0,140 |

De oorzaak is dezelfde als bij Kansen: de stop onder de swing low ligt op ongeveer 11% van de
koers, waardoor 2% kosten zwaar weegt. Alle drempels in `engine/drempels.ts`, het ijkpunt in
Signaalresultaat (+0,08 en +0,15 R) en de labels KOOPZONE, STERK KOOP en BEVESTIGD rusten op
cijfers zonder kosten.

## 2. Wat er op Markts koopsignaal leunt

Niet alleen het Markt-scherm. Een wijziging raakt:

- de kaarten, filters en "Wat kopen nu" op Markt, en de koopknop;
- de labels KOOPZONE, STERK KOOP en het keurmerk BEVESTIGD;
- de meldingen bij een sterk koopsignaal en de checks op open posities;
- het signaalboek, Signaalresultaat, Gemiste kansen en het weekrapport;
- "Eén ding vandaag" en het afbouwadvies;
- de Kader-check op de Copy-tab;
- de teksten in het uitlegboek en de uitleg over voorlopers en achterblijvers (meting H, die in
  meting M een markteffect bleek).

## 3. Keuzes van Kevin (11 nov 2026)

| Onderwerp | Keuze |
|---|---|
| Labels | Houden, maar alleen als ze winstgevend zijn |
| Winstgevend | Twee trappen, zie paragraaf 4 |
| Een label dat de lat niet haalt | Verdwijnt tot het bewezen is; het live trackrecord blijft het volgen |
| Bewijslat | Strenger dan bij Kansen |
| Plan | Mag veranderen naar wat de meting uitwijst, ook met een stop rond 25% |
| Wat te meten | De score, BEVESTIGD, de losse onderdelen van de score, en de klimaatpoort zelf |
| Oplevering | Eerst meten, dan pas bouwen |

## 4. Twee trappen

Een label mag alleen beloven wat gemeten is.

- **Trap 1, KOOP.** Wie het signaal volgt met het plan houdt na kosten aantoonbaar geld over. De
  klimaatpoort en het plan mogen dat werk doen; de coin hoeft niet beter te zijn dan een andere.
- **Trap 2, STERK KOOP en BEVESTIGD.** Coins met dit label doen het aantoonbaar beter dan de
  gewone KOOP-coins op dezelfde dag. Dit is de belofte dat Kader iets kiest.

Trap 2 kan alleen bestaan als trap 1 bestaat.

## 5. Beslisregels, vooraf vastgelegd

Vastgelegd voordat `scripts/meting-markt.ts` voor het eerst draaide. Achteraf bijstellen mag niet.

**Voor allebei de trappen**

1. Kosten: 1% per kant. Instap op de open na het signaal. Per coin geen overlappende trades.
2. Het plan ligt vast en is hetzelfde als bij Kansen: stop 3x ATR, doel 3R, hoogstens 30 dagen.
   Dat plan is in meting M gekozen op een neutrale selectie en wordt hier niet opnieuw afgesteld.
3. Afstellen op signalen t/m november 2022. Toetsen op 2023 t/m 2026.
4. De toetsjaren zijn in meting M al één keer bekeken, en daarbij is gezien dat 2025 en 2026
   voor long-regels met de huidige poort verliesjaren waren. Daarom twee extra drempels:
   - **Afstelpoort.** Een regel gaat alleen naar de toets als hij in de afsteljaren zelf zijn
     eis al haalt (zelfde eis als op de toets, zie hieronder).
   - **Hoogstens twee regels naar de toets**: één voor trap 1 en één voor trap 2. Haalt de regel
     voor trap 1 de afstelpoort niet, dan is er geen toets en vervallen alle kooplabels.
5. Het interval is een 90%-bootstrap per kalendermaand van instap.
6. Bij gelijke uitkomst wint de regel met de minste onderdelen.

**Trap 1 haalt de lat als, op de toetsjaren:**

- minstens 150 trades;
- de ondergrens van het interval van de netto R boven nul ligt;
- de netto R positief is in minstens 3 van de 4 toetsjaren en in de meerderheid van alle jaren.

**Trap 2 haalt de lat als, op de toetsjaren:**

- minstens 150 trades;
- de netto R min de gemiddelde netto R van alle trap-1-coins op dezelfde dag (met hetzelfde plan)
  een interval heeft met de ondergrens boven nul;
- dat verschil positief is in minstens 3 van de 4 toetsjaren en in de meerderheid van alle jaren.

**Wat op de afsteljaren mag**

Alles uit paragraaf 3 mag op de afsteljaren naast elkaar gelegd worden om de twee regels te
kiezen: scorebanden, BEVESTIGD, de losse onderdelen, en varianten van de klimaatpoort. De
poortvarianten staan hier vooraf, zodat er niet eindeloos gezocht wordt:

- de huidige: BTC boven EMA50 en de marktbreedte hoger dan 20 dagen terug;
- de huidige, plus BTC boven EMA200;
- de huidige, plus een marktbreedte van minstens 50%;
- alleen BTC boven EMA50 en EMA200 (zonder breedte, zodat ook 2018 en 2019 meetellen);
- geen poort (als ijk).

## 6. Mogelijke uitkomsten en wat ze betekenen

| Uitkomst | Gevolg voor de app |
|---|---|
| Trap 1 en trap 2 halen het | KOOP en het hogere label blijven, met het nieuwe plan en de nieuwe drempels. |
| Alleen trap 1 haalt het | Eén label KOOP. STERK KOOP en BEVESTIGD verdwijnen tot ze zich bewijzen. |
| Trap 1 haalt het niet | Geen kooplabel op Markt. De score, het klimaat en het plan blijven; het live trackrecord volgt het signaal verder. |

In elk geval: Markt gaat rekenen op de laatste afgesloten dag, net als Kansen, en de cijfers in
`drempels.ts` en Signaalresultaat worden vervangen door cijfers na kosten.

## 7. Oplevering

1. `scripts/meting-markt.ts` en de uitkomst als meting N in `docs/metingen.md`.
2. Een voorstel per onderdeel uit paragraaf 2: wat blijft, wat verandert, wat verdwijnt.
3. Daarna pas bouwen, in overleg met Thom, omdat dit `analyzer.ts`, `drempels.ts`, de meldingen
   en het signaalboek raakt.

## 8. Uitkomst (11 nov 2026)

De volledige cijfers staan in `docs/metingen.md`, meting N.

- **Trap 2 (STERK KOOP, BEVESTIGD): geen kandidaat.** Geen scoreband, BEVESTIGD of los onderdeel
  van de score kiest in de afsteljaren aantoonbaar beter dan de andere coins. Niets getoetst.
- **Trap 1 (KOOP): haalt de lat niet.** Netto +0,112 R per trade in 2023 t/m 2026, positief in 3
  van de 4 toetsjaren, maar het interval loopt van -0,18 tot +0,41.
- **Het ruime plan is wel veel beter dan het huidige:** van -0,14 naar +0,11 R na kosten.
- **De poort blijft zoals hij is.** De variant met EMA200 was op de toets niet beter.

Volgens de keuzes in paragraaf 3 verdwijnen daarmee alle kooplabels op Markt tot ze zich bewijzen.

## 9. Voorstel per onderdeel

Nog niets gebouwd. Dit is wat de uitkomst voor elk onderdeel betekent; Kevin en Thom beslissen.

| Onderdeel | Voorstel |
|---|---|
| Kaarten op Markt | Score, grafiek en klimaat blijven. KOOPZONE, STERK KOOP en BEVESTIGD verdwijnen. De kaart toont het plan dat de kosten draagt (stop 3x ATR, doel 3R), met dezelfde eerlijke uitleg als op Kansen. |
| Het plan | Van "stop onder de swing low, doel 3x ATR" naar "stop 3x ATR, doel 3R". Dit is de enige wijziging die aantoonbaar helpt, dus die gaat er in elk geval in. |
| Afgesloten dag | `analyseerMarkt` rekent het oordeel op de laatste afgesloten dag, net als Kansen. Dan zeggen beide tabs ook hetzelfde klimaat. |
| Klimaatpoort | Ongewijzigd. De balk op Markt blijft, met een tekst die niet meer over koopsignalen gaat. |
| "Wat kopen nu" en de filters | Vervallen of worden een neutrale sortering op score. Er is geen koopadvies meer om uit te lichten. |
| Koopknop | Blijft overal, ook zonder label. Besloten door Kevin: handelen vanuit Kader is het doel. Op Kansen teruggezet in #116. |
| Meldingen | De melding bij een sterk koopsignaal vervalt. De checks op je open posities blijven; die gaan over je eigen stop en doel. |
| Signaalboek en Signaalresultaat | Blijven lopen als trackrecord, na kosten en met het nieuwe plan, zoals de volglijst van Kansen. De ijkpunten +0,08 en +0,15 R worden vervangen door +0,11 R uit meting N, met het interval erbij. |
| Gemiste kansen en het weekrapport | Vervallen in de huidige vorm: zonder signaal valt er niets te missen. |
| "Eén ding vandaag" en het afbouwadvies | De acties rond je eigen posities blijven. Acties die een nieuw koopsignaal aanraden vervallen. |
| Kader-check op Copy | "Zelf ook een koopsignaal" vervalt. De check toont de score en het klimaat. |
| `drempels.ts` | De cijfers in het commentaar zijn van voor de kosten. Wat overblijft is een kleurschaal voor de score, zonder belofte. |
| Uitleg over voorlopers en achterblijvers | Vervalt. Meting M liet zien dat het een markteffect was. |

**Wanneer een label terug kan.** Het trackrecord loopt door. Een label komt terug als het de lat
haalt op data die er nu nog niet is: een jaarlijkse hertoets met de nieuwe jaren erbij, of een
live trackrecord dat groot genoeg is. Niet door de lat te verlagen.

**De vraag die hierboven nog open staat** is de koopknop op Markt, en daarmee wat Kader is: een
hulpmiddel voor plan, risico en discipline rond trades die je zelf kiest, met Copy en Portfolio
ernaast.

## 10. Gebouwd (11 nov 2026)

Kevin besloot dezelfde dag: de koopknop blijft overal ("we willen juist vanuit Kader traden, super
simpel en laagdrempelig"), en verder bouwen. Wat er nu in zit:

- **Eén plek in de engine.** `analyseerMarkt` rekent de score op de afgesloten dag en zet het plan
  (stop 3x ATR, doel 3R) op de koers van nu (`metPlan`). `scoorCandles` zelf is ongewijzigd, dus
  `scripts/backtest.ts` geeft nog exact dezelfde uitvoer en de checks op open posities ook.
- **Twee schakelaars** in `engine/drempels.ts`: `LABEL_KOOP_BEWEZEN` en `LABEL_STERK_BEWEZEN`,
  allebei uit. Uit betekent: elke coin op AFWACHTEN, geen BEVESTIGD. Dat is dezelfde toestand die
  de app al kende bij een ongunstig klimaat, dus kaarten, filters, "Eén ding vandaag" en de
  meldingen volgen vanzelf.
- **Het ruwe signaal blijft bestaan** (`ruwSignaal`, `ruwHighConviction`). Het signaalboek volgt
  dat, na kosten en met het nieuwe plan, in een nieuw boek (versie 2).
- **Koopknop:** ongewijzigd op Markt (stond er al bij elke coin) en terug op Kansen (#116).
- **Uit zolang er geen bewezen label is:** "Wat moet ik nu kopen", Gemiste kansen, de melding bij
  een sterk koopsignaal, het kooplabel in het detailscherm, en "zelf ook een koopsignaal" in de
  Copy-check.
- **Teksten:** het uitlegboek, de klimaatbalk, de bear-kaart, de onboarding en de uitleg over
  voorlopers en achterblijvers beloven geen koopsignaal meer.
- **Kader-niveaus voor copies** (`state/kaderNiveaus.ts`) gebruiken hetzelfde plan.

Na een onafhankelijke review aangescherpt:

- Zonder klimaat (BTC ontbreekt of te weinig coins) is er geen ruw signaal. Anders kwamen er na
  één mislukte ophaalronde tientallen regels in het trackrecord die nooit zo gemeten zijn.
- Coins op de CoinGecko-terugval (vier-uurs candles) krijgen het plan niet en geen signaal: "3x
  ATR" zou daar ongeveer 1,2x de dag-ATR zijn, de krappe stop die de kosten niet draagt.
- Het detailscherm en de Kader-check rekenen op dezelfde afgesloten dag als de score.
- Het R/R-filter op Markt is weg: de R/R is bij elke coin 1 : 3.
- STERK KOOP volgt op de kaart zijn eigen schakelaar.
- Wat er nagelopen moet worden voordat een schakelaar aan gaat, staat bij de schakelaars in
  `drempels.ts`.

Niet gewijzigd, bewust:

- De checks op je open posities (`tradeChecks.ts`) en het afbouwadvies rekenen nog met de oude
  niveaus uit `scoorCandles`. Die gaan over posities die je al hebt; een nieuw plan daarvoor is
  een eigen meting waard.
- De animatie bij het hoofdstuk Advieslabels toont nog de drie labels.
- De poort: ongewijzigd, de variant met EMA200 was op de toets niet beter.

Een label terugzetten is één schakelaar, maar alleen na een meting die de lat uit paragraaf 5
haalt op data die bij het afstellen niet gebruikt is.

## 11. Aanbeveling model en inspanning

- Meten en het voorstel: het sterkste model, hoge inspanning.
- De bouw daarna: het sterkste model voor de engine en de meldingen, het standaardmodel voor de
  schermen, en de review in een aparte sessie.
