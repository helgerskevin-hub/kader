# Plan: portfolio-fixes, Marktanalyse, trailing stop en meldingen

Branch: `feat/portfolio-fixes-en-trailing-stop` (vanaf `main`, 9c8090f).
Paden hieronder zijn relatief aan `app/src/`.

## 1. Buy orders die blijven hangen

**Oorzaak (uit de code, nog niet gemeten op een toestel):**

- De kaart "Wachtende orders" (`components/WachtendeOrdersKaart.tsx`) toont de orderlijsten precies zoals eToro ze teruggeeft (`engine/etoro.ts:395-437`, `PortfolioProvider.tsx:545`). Er wordt nergens gekeken of een order al een open positie is geworden.
- Na een order synct `verzoenNaOrder` op 0s, 5s, 20s, 45s en 90s (`PortfolioProvider.tsx:687-695`). eToro's portfolio-endpoint loopt soms minuten achter (`docs/etoro-direct-handelen-plan.md:258`). Na 90s volgt geen nieuwe sync tot de gebruiker ververst of de app na 5 minuten opnieuw opent, dus de kaart blijft hangen.
- De status-lookup (`werkOrderUitkomstenBij`, `:448-496`) ziet status 3 (Filled) wel, maar gebruikt die alleen om `geplaatsteOrders` op te ruimen. De kaart doet er niets mee.
- Onbekende orders worden nooit vanzelf opgeruimd: `ruimOnbekendeOrdersOp` draait alleen via een banner die zelf alleen verschijnt nadat die functie al gedraaid heeft. Regel 674 leest ook `tradesRef.current` vlak na `await synchroniseer()`, en die ref is dan nog niet bijgewerkt.

**Fix:**

1. `orderID` uitlezen op `EtoroPositie` en `positionExecutions[].positionId` op `OrderLookupRespons`. Een order verbergen op de kaart zodra er een positie met hetzelfde `orderID` bestaat, of zodra de lookup een eindstatus geeft (3, 4, 7-10).
2. Zolang er niet-afgeronde orders zijn, elke 60-90s een lichte sync doen (alleen op de voorgrond), tot maximaal ongeveer 10 minuten na de order. `verzoenNaOrder` verlengen met stappen op 3, 5 en 10 minuten.
3. `ruimOnbekendeOrdersOp` na elke geslaagde sync draaien, met de vers geïmporteerde trades in plaats van `tradesRef`. Dit ook bij het laden doen.
4. Eenmalig de ruwe orderlijsten loggen op demo, om te bevestigen in welke lijst een gevulde market-order met SL/TP blijft staan (open punt in `TODO.md:176-183`).

## 2. Ingelegd/Cash balk

Component: `components/PortfolioStatusKaart.tsx` (balk op regels 437-495, rekenwerk op 195-233).

**Gevonden problemen:**

1. **Mengt bronnen.** "IN POSITIES" telt alle zichtbare trades mee, dus ook handmatige trades en trades van andere platforms (`PortfolioProvider.tsx:745`). "BESCHIKBAAR" is alleen eToro-cash. In Demo wordt echt geld opgeteld bij speelgeld. Dit is waarschijnlijk de hoofdoorzaak.
2. **Geld in wachtende orders verdwijnt.** Het wordt van de cash afgetrokken maar nergens bijgeteld, dus het totaal ligt lager dan eToro's equity.
3. **Andere waardering dan eToro.** Kader rekent met Binance-koersen en `entry * aantal` in plaats van eToro's `amount` (die al als `bedragUsd` bewaard wordt) en eToro's PnL.
4. **Animatie.** Voordat `onLayout` heeft gevuurd is `balkBreedte` 0, waardoor de vulling eerst vanuit het midden schaalt en daarna verspringt.
5. **Randgevallen.** Een short met groot verlies maakt `belegdUsd` negatief. Posities zonder live koers vallen stil weg.

**Fix (voorstel):**

- A. Balk en totaal alleen baseren op eToro-trades van de actieve omgeving.
- B. Een derde segment "gereserveerd" voor wachtende orders, zodat het totaal gelijk is aan eToro's equity.
- C. eToro-posities waarderen met eToro-data (`amount` en PnL), met Binance alleen als terugval.
- D. De animatie pas starten als de breedte bekend is.
- E. Negatieve waarden afkappen op 0, en een notitie tonen als er posities zonder koers zijn.

**Symptoom (gemeld):** de balk is volledig grijs, terwijl hij een verdeling zou moeten tonen. Grijs is de baan (`colors.verdelingOverig`); de blauwe "in posities"-laag (`Animated.View` met `scaleX`) wordt dus niet zichtbaar.

**Hypotheses, eerst op de emulator vaststellen (kijk naar het percentage bij "IN POSITIES"):**

1. **Legenda zegt 0%:** `belegdUsd` is 0. De posities hebben geen live Binance-koers (`zonderLivePrijs`) of worden niet meegeteld. Dat is een databug, en dan zijn A en C de fix.
2. **Legenda zegt meer dan 0%, balk toch grijs:** de laag wordt niet getekend. Mogelijke oorzaken:
   - `belegdAandeel` blijft op 0, bijvoorbeeld omdat `naar()` de animatie niet start of omdat de effect-hook niet opnieuw draait bij hetzelfde `belegdPctBalk`.
   - `balkBreedte` uit `useState` wordt in de worklet van `useAnimatedStyle` niet bijgewerkt.
   - `scaleX` met `width: '100%'` in een `flexDirection: 'row'`-baan met `overflow: 'hidden'` tekent op Android niets.

   Fix: `balkBreedte` als shared value, de vulling met `width` in pixels tekenen (gemeten via `onLayout`) in plaats van `scaleX`, en `eersteBalk` resetten bij het mounten. Dat is dezelfde soort Android-valkuil als in 0.1.21.

De overige problemen (A, B, C, E) meenemen zodra de balk weer zichtbaar is.

## 3. Informatie: hoofdstuk "Marktanalyse"

- Een nieuw object in `HOOFDSTUKKEN` (`informatie/hoofdstukken.ts`), in groep `markt`, als eerste van die groep.
- Het hoofdstuk legt de hele pijplijn uit, wat nog geen enkel hoofdstuk doet:
  - 57 coins
  - Binance-dagcandles, met CoinGecko als terugval
  - indicatoren
  - score 0-100
  - stop onder de swing low, doel op +3x ATR, R/R-filter van 1:2
  - de klimaat-poort
  - sorteren en een top 20
  - verversen bij openen of trekken
  - de radar als losse scan
- Voor de details verwijst het naar de bestaande hoofdstukken `score`, `advies`, `atr`, `indicatoren`, `klimaat`, `rs` en `radar`, in plaats van die cijfers te herhalen.
- Het icoon moet in `ICONEN` en in de lucide-import in `components/AchtergrondScherm.tsx` staan.
- De zelfcontrole onderaan `hoofdstukken.ts` aanpassen:
  - het aantal hoofdstukken van 21 naar 22
  - de `nieuw`-lijst uitbreiden met `marktanalyse`
  - geen em-dashes in de tekst
  - de regel voor het woord "kader" respecteren
- De Disclaimer-toon aanhouden.

## 4. Trailing stop-loss

**Wat er al is:**

- `voorstelTrailingStop` (`state/afbouw.ts:27-43`): het hoogste van entry en `koers - ATR`.
- De chip "winst beschermen" in `NiveausSheet.tsx:360-379`.
- De melding `trekStopAan` in `notifications/tradeChecks.ts:187-203`.
- Een werkende PATCH om de stop te wijzigen (`wijzigNiveaus`, `engine/etoro.ts:813-831`).

**Beperkingen:**

- Volgens de regel in `etoro.ts:530-541` en het plan-doc mag een stop alleen na expliciete bevestiging verzet worden. Dus niet vanuit een interval of de achtergrondtaak.
- Op het echte account blokkeert `NiveausSheet` nu elke stop op of boven de entry. Dat is precies het break-even-geval, en het is zo omdat T2/T3 (`scripts/etoro-demo-order.ts --stopmeting`) nog niet gemeten zijn.
- De achtergrondtaak draait minstens 15 minuten na de vorige, op een moment dat Android zelf kiest.
- eToro's eigen `isTslEnabled` is nooit getest.

**Voorstel, in fases:**

1. **Nu: advies plus bevestigen met één tik.**
   - Een nieuwe trigger "break-even": de positie staat X% in winst (bijvoorbeeld 1x de stop-afstand, dus 1R), los van momentum.
   - Tik op de melding opent `NiveausSheet` met het voorstel al ingevuld. De gebruiker bevestigt, daarna de PATCH.
2. **Meting op demo:**
   - `--stopmeting` draaien voor een stop boven de entry.
   - Een demo-order met `isTslEnabled: true` testen.
   - Als een stop boven de entry werkt, de blokkade in `NiveausSheet` voor echt geld opheffen.
3. **Later, alleen na een besluit van Kevin en Thom (`TODO.md:81-91`):** Kader verhoogt de stop zelf, en verlaagt hem nooit. Eventueel via eToro's native TSL als de meting die bevestigt.

**Scope van deze branch (gekozen): alleen fase 1.** Fase 2 en 3 blijven als vervolgpunt in `TODO.md` staan.

## 5. Minder meldingen

**Regel (van Kevin):** alleen de melding om 9:00, meldingen waarbij de gebruiker iets moet doen, en een sterk koopsignaal uit de achtergrondscan.

**Wat er nu verstuurd wordt:**

| Melding | Waar | Besluit |
|---|---|---|
| Dagelijkse herinnering 9:00 | `notifications/meldingen.ts:37` | blijft |
| Sterk koopsignaal (BEVESTIGD en klimaat gunstig) | `tradeChecks.ts:281-310` | blijft, frequentie zoals nu (scan 1x per uur, per coin 1x per 6 uur) |
| Stop/doel geraakt, handmatige trade | `sluitingen.ts:257-319` | blijft |
| Stop/doel geraakt, eToro-positie | `sluitingen.ts:125-220` | blijft |
| Zelf ingestelde prijsalerts | `tradeChecks.ts:357-390` | blijft |
| Stop aantrekken (`trekStopAan`) | `tradeChecks.ts:187-203` | blijft, wordt de break-even-melding uit punt 4 |
| Doel verhogen (`verhoogTP`) | `tradeChecks.ts:170-184` | **weg** |
| Marktklimaat omgeslagen | `tradeChecks.ts:229-275` | **weg** (de klimaatstand wel blijven opslaan) |
| "X van je posities staan zwak" | `tradeChecks.ts:318-331` | **vervangen**: alleen een melding per positie als `bepaalAfbouwAdvies` (`state/afbouw.ts:66`) niveau `afbouwen` geeft, dus echt advies om (deels) te verkopen |

**Aanpak:**

- `verhoogTP` en de klimaatmelding schrappen.
  - De trigger-types en de `levend`-set in `checkOpenTrades` daarop aanpassen.
  - Het meldingenlog (`laadMeldingLog`) moet oude entries met deze types nog wel kunnen tonen.
- De portfolio-risicomelding vervangen door een melding per trade met niveau `afbouwen`.
  - Die trade-melding hergebruikt dezelfde marktscan (`alle`), dus er komen geen extra requests bij.
  - Sleutel `afbouwen` per trade, met het bestaande herhaalvenster van 6 uur.
- `trekStopAan` samenvoegen met de nieuwe break-even-trigger uit punt 4. Dat wordt één melding per trade, en een tik erop opent `NiveausSheet` met het voorstel al ingevuld.
- De cooldown van 1 uur over alle trade-meldingen samen blijft.
- Een vermelding in de changelog. De meldingenuitleg in `informatie/hoofdstukken.ts` (hoofdstuk `meldingen`) moet aangepast worden.

## Volgorde en verificatie

1. Hangende orders: de grootste ergernis, en raakt echt geld.
2. Cash-balk: eerst vaststellen of het om data of om de tekening gaat.
3. Marktanalyse-hoofdstuk: laag risico.
4. Trailing stop: fase 1.
5. Minder meldingen, samen met punt 4, want ze raken allebei `tradeChecks.ts`.

Per punt één commit op deze branch. Na elk punt `CHANGELOG.md` en `changelog.ts` bijwerken. Verifiëren op de emulator met de `run-android` skill; voor de orders en de trailing stop met een demo-account.

## Model- en effort-advies

| Punt | Model | Effort |
|---|---|---|
| 1. Hangende orders | Opus | hoog (state, sync-timing, eToro-velden) |
| 2. Cash-balk | Sonnet | medium |
| 3. Marktanalyse | Sonnet | laag |
| 4. Trailing stop, fase 1 | Opus | medium-hoog (raakt orders met echt geld) |
| 5. Minder meldingen | Sonnet | medium |
