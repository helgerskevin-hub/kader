# Design: portfolio-dashboard, dialogen, orderbevestiging, NiveausSheet en adviesniveau

Canvas met alle artboards (licht en donker):
**https://claude.ai/code/artifact/ee6f5583-aab5-4ef5-aef7-473fc15f0884**

Dit document is de opdracht voor de implementeerder. Alles staat in tokenwaarden uit
`app/src/theme/tokens.ts` en stijlen uit `app/src/theme/typography.ts`. Waar een token ontbreekt,
staat er expliciet dat hij toegevoegd moet worden.

Alle gebruikerstekst in dit document is letterlijk overneembaar. Nederlands, geen em-dashes,
nuchter van toon.

---

## 0. Nieuwe tokens

In `app/src/theme/tokens.ts` komen er tokens bij. Voeg ze toe aan `ColorTokens`, `lightTokens` en
`darkTokens`. Verzin verder niets: elke andere kleur in dit document komt uit de bestaande set.

```ts
export interface ColorTokens {
  // ... bestaand ...
  // Schakelaars: neutraal grijs, want de aan-stand van een schakelaar is geen goedkeuring.
  schakelaarAan: string;
  schakelaarDuim: string;
  // Categorische kleuren voor het cirkeldiagram. Bewust geen groen of rood: die twee
  // betekenen in Kader winst en verlies, en een segment is geen resultaat.
  verdeling: readonly string[];
  verdelingOverig: string;
}
```

```ts
export const lightTokens: ColorTokens = {
  // ... bestaand ...
  schakelaarAan: '#94A3B8',
  schakelaarDuim: '#FFFFFF',
  verdeling: ['#1E3A8A', '#2563EB', '#0E7490', '#6D28D9', '#A21CAF', '#B45309'],
  verdelingOverig: '#94A3B8',
};

export const darkTokens: ColorTokens = {
  // ... bestaand ...
  schakelaarAan: '#6B7280',
  schakelaarDuim: '#E6EDF3',
  verdeling: ['#93C5FD', '#3B82F6', '#22D3EE', '#A78BFA', '#F0ABFC', '#FCD34D'],
  verdelingOverig: '#64748B',
};
```

---

## 1. Portfolio-dashboard

**Artboards:** Dashboard licht, Dashboard donker, Zonder eToro-koppeling, Cirkeldiagram alle staten.

### 1.1 Bestanden

| Pad | Wat |
|-----|-----|
| `app/src/engine/etoro.ts` | `EtoroSyncResultaat` krijgt `vrijSaldoUsd: number \| null` |
| `app/src/state/PortfolioProvider.tsx` | bewaart en levert `vrijSaldoUsd` |
| `app/src/components/PortfolioStatusKaart.tsx` | wordt de totaalkaart |
| `app/src/components/VerdelingKaart.tsx` | **nieuw**, cirkeldiagram plus legenda |
| `app/src/engine/verdeling.ts` | **nieuw**, pure functie die posities naar segmenten rekent |
| `app/src/screens/PortfolioScreen.tsx` | rendert `VerdelingKaart` onder `PortfolioStatusKaart` |

### 1.2 Het vrije saldo ophalen

`haalVrijSaldo()` in `app/src/engine/etoro.ts` (regel 299) doet een eigen `haalEtoroPortfolio`-call.
Doe dat hier **niet**: `importeerEtoroAlles()` (regel 829) heeft die respons al in handen. Lees het
veld daar en geef het mee terug:

```ts
export interface EtoroSyncResultaat {
  open: EtoroImportResultaat;
  historie: EtoroImportResultaat;
  // clientPortfolio.credit, of null als eToro het veld niet meestuurt. Nooit 0 invullen:
  // een verzonnen saldo is erger dan geen saldo.
  vrijSaldoUsd: number | null;
}
```

```ts
const credit = portfolio.clientPortfolio?.credit;
const vrijSaldoUsd = typeof credit === 'number' && isFinite(credit) ? credit : null;
```

`PortfolioProvider` bewaart de laatste waarde in state en levert hem als `vrijSaldoUsd: number | null`.
Mislukt een sync, dan blijft de vorige waarde staan; is er nooit een geslaagde sync geweest, dan is
hij `null`. `haalVrijSaldo()` blijft bestaan voor `KooporderSheet`, laat die ongemoeid.

### 1.3 Totaalkaart (`PortfolioStatusKaart.tsx`)

De bestaande kaart blijft de basis. Wat verandert: de kop, het grote bedrag en er komt een blok
belegd/beschikbaar bij. De detailrij, de sync-melding en de historie-knop blijven precies zoals ze
zijn.

Nieuwe prop: `vrijSaldoUsd: number | null`.

**Kop.** Het label hangt af van het saldo.

| Situatie | Overline | Groot bedrag |
|----------|----------|--------------|
| `vrijSaldoUsd !== null` | `TOTAAL VERMOGEN` | `waarde.huidigeWaardeUsd + vrijSaldoUsd` |
| `vrijSaldoUsd === null` | `WAARDE OPEN POSITIES` | `waarde.huidigeWaardeUsd` |

Dit is het leidende principe van het scherm: zonder saldo is er geen totaal, dus staat er geen
totaal. Niet optellen met een 0.

Stijlen: overline `Type.overline` in `colors.tekstGedimd`, bedrag `Type.display` in
`colors.tekstPrimair` via de bestaande `AnimatedGetal` met `fmtPrijs`. Daaronder, ongewijzigd, de
ongerealiseerde regel in `colors.winst` of `colors.verlies`.

**Balk belegd/beschikbaar.** Alleen als `vrijSaldoUsd !== null` en het totaal groter dan 0 is.

```
marginTop: spacing.base (16)
hoogte 8, borderRadius: radii.pill, overflow hidden, backgroundColor: colors.verhoogd
  links  flex = huidigeWaardeUsd, backgroundColor: colors.primair
  rechts flex = vrijSaldoUsd,     backgroundColor: colors.verhoogd
```

Daaronder een rij van twee gelijke kolommen, `marginTop: spacing.md (12)`, `gap: spacing.md`:

- Links: bolletje 8x8 `radii.pill` in `colors.primair`, `gap: 6`, dan `Type.overline` `IN POSITIES`
  in `colors.tekstGedimd`; eronder `Type.prijs` in `colors.tekstPrimair` met `fmtPrijs(huidigeWaardeUsd)`.
- Rechts: bolletje 8x8 met `borderWidth: 1.5`, `borderColor: colors.rand`, vulling `colors.verhoogd`,
  dan `BESCHIKBAAR`; eronder `fmtPrijs(vrijSaldoUsd)`.

**Zonder saldo.** De balk vervalt. De twee kolommen blijven staan, met een `borderTopWidth:
StyleSheet.hairlineWidth` in `colors.rand` erboven en `paddingTop: spacing.md`. Het rechterbolletje
wordt `borderStyle: 'dashed'` en de waarde wordt de tekst `Onbekend` in `Type.prijs`,
`colors.tekstGedimd`. Daaronder een uitlegblok:

```
marginTop: spacing.md, padding: spacing.md, borderRadius: radii.veld,
backgroundColor: colors.verhoogd, flexDirection row, gap spacing.sm
  Info-icoon 15px, colors.tekstGedimd, strokeWidth 1.75
  Type.caption in colors.tekstGedimd
```

Copy, twee varianten:

- Geen koppeling: `Zonder eToro-koppeling kent Kader je vrije saldo niet, dus je totale vermogen ook niet. Koppel je account in Instellingen.`
- Wel gekoppeld, maar eToro gaf het veld niet: `eToro geeft je vrije saldo nu niet door. Kader laat het liever leeg dan dat het een bedrag verzint.`

**Wat niet verandert:** de twee actieknoppen rechtsboven (`RefreshCw`, `CloudDownload`) met hun
kleurlogica uit `bepaalSyncStand`, de detailrij `INGELEGD / OPEN POSITIES / LAATSTE SYNC`, de
`stand.advies`-regel, de regel over posities zonder live prijs, en de historie-knop onderaan.
De historie-knop blijft de enige ingang naar `HistorieScherm.tsx`.

### 1.4 Segmenten rekenen (`app/src/engine/verdeling.ts`, nieuw)

Pure functie, geen React, in de stijl van `statistieken.ts` met een `require.main`-zelftest eronder.

```ts
export interface Segment {
  sleutel: string;      // symbool, of '__overig__'
  label: string;        // 'BTC', of 'Overig (9)'
  waardeUsd: number;
  aandeel: number;      // 0..1
  kleur: string;        // toegewezen door de kaart, niet hier
  leden?: { symbool: string; waardeUsd: number; aandeel: number }[];  // alleen bij overig
}

export interface Verdeling {
  segmenten: Segment[];
  totaalUsd: number;
  gewaardeerd: number;
  zonderLivePrijs: number;
}

export const MAX_SEGMENTEN = 7;

export function berekenVerdeling(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
): Verdeling;
```

Regels:

- Alleen open trades met zowel `aantalCoins > 0` als een live prijs tellen mee. De rest telt op in
  `zonderLivePrijs`, precies zoals `berekenPortfolioWaarde` het doet.
- Waarde per positie is `livePrijs * aantalCoins`. Let op: dit is **markt**waarde, niet het eigen
  vermogen dat `berekenPortfolioWaarde` uitrekent. Voor een short is de marktwaarde de waarde van
  wat je moet terugleveren; die telt hier gewoon als omvang van de positie mee, want de verdeling
  gaat over blootstelling en niet over resultaat.
- Meerdere trades in hetzelfde symbool worden opgeteld tot één segment.
- Sorteer aflopend op waarde. Zijn er meer dan `MAX_SEGMENTEN` symbolen, houd dan de eerste zes en
  vat de rest samen in één segment `__overig__` met `leden` erin, ook aflopend gesorteerd.
- `aandeel` wordt afgerond bij het tonen, niet hier. Percentages tellen door het afronden niet altijd
  precies op tot 100,0%. Corrigeer dat niet: een opgepoetst getal is een leugentje.

### 1.5 Verdelingkaart (`app/src/components/VerdelingKaart.tsx`, nieuw)

`react-native-svg` staat al in `app/package.json` (`15.15.4`), er hoeft geen dependency bij.

**Circles met `strokeDasharray`, geen `Path` met `d`-attributen.** Er is nog nergens in de app een
grafiek met svg-paden gebouwd, en een taartpunt als pad vraagt om booghoeken, `largeArcFlag` en
sinus en cosinus per segment. Dat is precies waar dit soort code stukgaat. Met een ring zijn de
enige benodigde onderdelen `Svg`, `G` en `Circle`, is de wiskunde één vermenigvuldiging per segment,
en klopt de tekening automatisch bij één segment, bij zeven, en bij een segment van 0,4 procent.
Dit is dus een bewuste keuze voor een donut en niet voor een volle taart.

**Kaart:** `backgroundColor: colors.kaart`, `borderRadius: radii.kaart`, `padding: spacing.base`,
`marginHorizontal: spacing.base`, `marginBottom: spacing.base`, `shadow.kaart`.

**Kop:** rij met `Type.overline` `VERDELING VAN JE POSITIES` in `colors.tekstGedimd`,
`marginBottom: spacing.md`. De rechterkant van deze rij blijft leeg; daar komt in fase 2 de
Nu/Doel-schakelaar.

**Ring.** Eén `<Svg width={150} height={150} viewBox="0 0 150 150">` met per segment een `<Circle>`:

```
cx=75 cy=75 r=58 fill="none" strokeWidth={22}
transform="rotate(-90 75 75)" op de omhullende <G>
omtrek C = 2 * Math.PI * 58 = 364.42
strokeDasharray = `${aandeel * C - 2} ${C}`     // die 2 is de visuele naad tussen segmenten
strokeDashoffset = -(cumulatiefAandeel * C)
```

Bij precies één segment: geen dasharray, één volle `<Circle>`. Anders zou de naad een gat lijken.

In het gat, absoluut gepositioneerd en gecentreerd:
- `fmtPrijs(totaalUsd)` in `Type.prijs` met `fontSize: 14`, `fontWeight: '500'`, `colors.tekstPrimair`
- `${gewaardeerd} ${gewaardeerd === 1 ? 'positie' : 'posities'}` in `Type.caption`, `colors.tekstGedimd`

Kleur per segment: `colors.verdeling[i]` op volgorde, en `colors.verdelingOverig` voor `__overig__`.

**Legenda.** Grid van twee kolommen, `gap: 10` verticaal en `spacing.md` horizontaal. Per cel:

```
rij: vierkantje 9x9 borderRadius 2 in de segmentkleur, gap 6,
     Type.caption fontWeight '600' colors.tekstPrimair met het label,
     Type.label colors.tekstGedimd rechts uitgelijnd met '34,3%'
regel eronder: Type.prijs fontSize 12, colors.tekstGedimd, marginLeft 15, met fmtPrijs(waardeUsd)
```

Percentage met `fmtPct(aandeel * 100)`; de komma en het procentteken komen daar al uit.

**Uitklappen.** Staat er een `__overig__`-segment, dan komt er onder de legenda een knop
`Toon alle {n}` met een `ChevronDown` 12px, in `colors.cta`, `Type.caption` `fontWeight: '600'`,
`minHeight: 44`. Uitgeklapt wordt de legenda één kolom en komen de leden van `Overig` eronder,
ingesprongen op `paddingLeft: 15`, in `Type.caption` `colors.tekstGedimd`, zonder eigen kleurvierkantje
(ze delen de kleur van Overig). Zijn er meer dan vier leden, toon dan de eerste vier en daaronder
`en {n} kleinere posities`. De knop wordt `Toon minder`. Gebruik `LayoutAnimation.configureNext`
met een `useReduceMotion()`-check, net als `TradeCard.wisselUitgeklapt`.

**Staten.**

| Staat | Wat je ziet |
|-------|-------------|
| Geen open posities | De hele kaart wordt niet gerenderd. `PortfolioScreen` heeft al een lege staat. |
| Open posities, maar `gewaardeerd === 0` | Ring in `colors.rand` met `strokeDasharray="6 8"`, geen legenda, tekst `Kader heeft nog geen live koersen om je posities te wegen. De verdeling verschijnt na de eerste sync.` in `Type.caption`, `colors.tekstGedimd`. |
| Eén positie | Volle ring in `colors.verdeling[0]`, één legendaregel, `100,0%`. De kaart blijft staan: hij zegt dat alles in één coin zit, en dat is de informatie. |
| 2 tot 7 posities | Ring met evenveel segmenten, legenda in twee kolommen. |
| Meer dan 7 | Zes segmenten plus `Overig ({n})`, uitklapbaar. |
| `zonderLivePrijs > 0` | Onder de legenda: `{n} {n === 1 ? 'positie telt' : 'posities tellen'} niet mee in de verdeling (geen aantal of live koers).` in `Type.caption`, `colors.tekstGedimd`, `marginTop: spacing.sm`. |
| Laden | Geen aparte skeleton. De kaart toont de laatst bekende verdeling; de sync-indicatie staat al in de totaalkaart. |

### 1.6 Toegankelijkheid

- De uitklapknop: `accessibilityRole="button"`, `accessibilityLabel` `Toon alle 15 posities` of
  `Toon minder posities`, `minHeight: 44`.
- De ring is decoratief naast de legenda die dezelfde cijfers geeft. Geef de `Svg`
  `accessibilityElementsHidden` en zet op de omhullende `View` een
  `accessibilityLabel` in de vorm `Verdeling: BTC 34,3 procent, ETH 21,8 procent, en 13 kleinere posities.`
- Kleur is nergens het enige signaal: elk segment heeft in de legenda zijn naam en percentage.

### 1.7 Ruimte voor later

- Fase 2 (doelverdeling en projectie) zet een markering op de belegd/beschikbaar-balk en een
  Nu/Doel-schakelaar rechts in de kop van de verdelingkaart. Beide plekken zijn nu al leeg gehouden.
- Fase 3 (aandelen en indexfondsen) voedt `berekenVerdeling` met segmenten uit meerdere
  activaklassen. Houd `Segment` daarom generiek: `sleutel` en `label` zijn strings, niet per se een
  cryptosymbool.

---

## 2. KaderDialoog

**Artboards:** KaderDialoog licht, KaderDialoog donker.

### 2.1 Waarom gecentreerd en niet als bottom sheet

Dit is een stop-en-beslis-moment, geen paneel dat je opzij schuift. De onderrand van het scherm is
in Kader al van de sheets; een sheet boven op een sheet leest als een stapel. Een gecentreerde
dialoog is bovendien wat Android voor een bevestiging doet, en dat is precies het gedrag dat we
overnemen van `Alert.alert`, alleen dan in Kader-stijl.

### 2.2 De ANR uit `MeldingNotitie.tsx` niet terughalen

De waarschuwing in `MeldingNotitie.tsx` klopt: een native `Alert` boven op een `Modal` die net aan
het sluiten was legde op Android de UI-thread plat. `BottomSheet.tsx` gebruikt een `Modal`, en de
plek waar we de dialoog willen tonen is precies de plek waar een sheet sluit
(`onSluiten(); onGeslaagd(...)` in `KooporderSheet` regel 185, `VerkoopOrderSheet` regel 110,
`NiveausSheet` regel 147).

Daarom is er **één** dialooghost voor de hele app, en die mount zijn `Modal` nooit in dezelfde tick
waarin een andere `Modal` verdwijnt:

`app/src/state/DialoogProvider.tsx` (nieuw)

```ts
import { InteractionManager } from 'react-native';

export interface DialoogKnop {
  label: string;
  onDruk?: () => void;
  soort?: 'primair' | 'secundair' | 'destructief';   // default: primair
}

export interface DialoogInhoud {
  variant: 'informatie' | 'gelukt' | 'waarschuwing' | 'fout';
  titel: string;
  tekst: string;
  details?: string;               // optioneel blok, bijv. de lijst overgeslagen posities
  resultaat?: DialoogResultaat;   // zie punt 3
  knoppen: DialoogKnop[];         // 1 of 2
}

// toonDialoog wacht op InteractionManager voordat de Modal mount. Zonder die wachtbeurt komt
// deze Modal op tafel terwijl de BottomSheet-Modal eronder nog aan het opruimen is, en dat is
// exact de situatie die op Android de UI-thread vastzette (zie MeldingNotitie.tsx).
export function useDialoog(): { toonDialoog: (inhoud: DialoogInhoud) => void };
```

De provider wordt in `app/App.tsx` binnen `PortfolioProvider` gezet (regel 253 tot 255), zodat elk
scherm en elke sheet erbij kan.

### 2.3 Het component (`app/src/components/KaderDialoog.tsx`, nieuw)

Kaart, gecentreerd in een `Modal` met `transparent`, `animationType="fade"`, `onRequestClose`.

```
Achtergrond: 'rgba(15,23,42,0.5)' in licht, 'rgba(0,0,0,0.6)' in donker.
             Zelfde waarde als BottomSheet in licht, zodat de twee niet uit elkaar lopen.
Kaart:       width '100%', maxWidth 342, marginHorizontal spacing.lg (24),
             backgroundColor colors.kaart, borderRadius radii.kaart (16),
             padding spacing.lg (24), shadow.modal
```

Van boven naar beneden:

1. **Icoonschijf.** 40x40, `borderRadius: radii.pill`, achtergrond de variantkleur op 10 procent
   dekking in licht en 14 procent in donker, icoon 20px `strokeWidth={1.75}` in de variantkleur.

   | Variant | Icoon (lucide) | Kleur |
   |---------|----------------|-------|
   | informatie | `Info` | `colors.cta` |
   | gelukt | `CheckCircle2` | `colors.winst` |
   | waarschuwing | `AlertTriangle` | `colors.letOp` |
   | fout | `XCircle` | `colors.verlies` |

2. **Titel.** `Type.titel`, `colors.tekstPrimair`, `marginTop: spacing.md (12)`.
3. **Tekst.** `Type.body`, `colors.tekstGedimd`, `marginTop: spacing.sm (8)`.
4. **Detailblok** (optioneel). `marginTop: spacing.base (16)`, `padding: spacing.md (12)`,
   `borderRadius: radii.veld (8)`, `backgroundColor: colors.verhoogd`, tekst in `Type.caption`,
   `colors.tekstGedimd`. Meer dan zes regels: in een `ScrollView` met `maxHeight: 160`.
5. **Knoppen.** `marginTop: spacing.lg (24)`, altijd onder elkaar met `gap: spacing.sm (8)`, de
   primaire bovenaan. Onder elkaar en niet naast elkaar, omdat Nederlandse labels als
   `Koppeling verwijderen` naast een `Annuleren` op 342px gaan afbreken.

   | Soort | Vulling | Rand | Tekst |
   |-------|---------|------|-------|
   | primair | `colors.cta` | geen | `#FFFFFF` |
   | destructief | `#DC2626` (vast, beide thema's) | geen | `#FFFFFF` |
   | secundair | geen | 1px `colors.rand` | `colors.tekstGedimd` |

   Hoogte 48, `borderRadius: radii.knop (12)`, label in `Type.body` met `fontWeight: '600'`.

   De rode knop houdt in beide thema's `#DC2626`, omdat de donkere `colors.verlies` (`#EF4444`) met
   witte tekst niet op AA uitkomt en `#DC2626` wel.

**Sluitgedrag.**

- Eén knop: tik naast de kaart sluit, `onRequestClose` (Android terug) sluit. Er valt niets te
  beslissen.
- Twee knoppen: tik naast de kaart doet **niets**, `onRequestClose` voert de secundaire knop uit.
  Een bevestiging mag niet per ongeluk wegvallen.

**Beweging.** Bij `variant: 'gelukt'` krijgt de icoonschijf één schaalpuls: `1.0` naar `1.06` naar
`1.0` in 260ms met `Easing.out(Easing.cubic)` en `useNativeDriver: true`. Slaat over bij
`useReduceMotion()`. Verder geen animatie.

**Geen `FeestConfetti`.** Die is 70 deeltjes over 3,2 seconden over het hele scherm. Voor iets wat
je meerdere keren per week doet is dat na drie keer irritant, en een verkoop kan verlies zijn.
`FeestConfetti.tsx` blijft waar hij staat (`WelkomFeest.tsx`) en wordt hier niet gebruikt.

### 2.4 Toegankelijkheid

- Elke knop: `accessibilityRole="button"`, `accessibilityLabel` gelijk aan het label, hoogte 48 en
  dus ruim boven de 44px.
- De `Modal` krijgt `accessibilityViewIsModal` op de kaart, zodat de schermlezer niet achter de
  dialoog gaat lezen.
- Titel: `accessibilityRole="header"`.
- De icoonschijf is decoratief, `accessibilityElementsHidden`. De variant staat al in de tekst.

### 2.5 Wat er precies vervangen wordt

Alle zeven `Alert.alert`-aanroepen. Copy blijft ongewijzigd tenzij hieronder anders staat.

| Bestand en regel | Variant | Knoppen |
|------------------|---------|---------|
| `PortfolioScreen.tsx:942` Nog geen eToro-koppeling | informatie | `Oké` |
| `PortfolioScreen.tsx:951` Sleutel niet te lezen | informatie | `Oké` |
| `PortfolioScreen.tsx:961` Import mislukt | fout | `Oké`, foutmelding in het detailblok |
| `PortfolioScreen.tsx:975` Import voltooid | gelukt | `Oké`, de overgeslagen posities in het detailblok in plaats van achter `\n\n` in de tekst |
| `InstellingenSheet.tsx:126` Overschakelen naar echt | waarschuwing | `Naar echt` (destructief) en `Annuleren` |
| `EtoroKoppelingWizard.tsx:184` Opslaan mislukt | fout | `Oké`, de foutmelding van de kluis in het detailblok |
| `EtoroKoppelingWizard.tsx:196` Koppeling verwijderen | fout | `Verwijderen` (destructief) en `Annuleren` |

Haal daarna de `Alert`-import uit alle drie de bestanden weg.

`MeldingNotitie.tsx` blijft bestaan en blijft zoals hij is: die is voor een terzijde waar geen
beslissing bij hoort (een aangetikte melding die nergens meer op uitkomt), niet voor een dialoog.

---

## 3. Bevestiging na een order

**Artboards:** Na een order licht, Na een order donker.

### 3.1 Bestanden

`KooporderSheet.tsx`, `VerkoopOrderSheet.tsx`, `NiveausSheet.tsx`.

Let op: de prop `onGeslaagd` bestaat in alle drie de sheets maar wordt door **geen enkele**
aanroeper doorgegeven (`MarktScreen.tsx:305`, `KansenScreen.tsx:444`, `CoinDetailScherm.tsx:461`,
`PortfolioScreen.tsx:1214` en `:1223`). Er is dus vandaag helemaal geen bevestiging. Vervang de prop
door een directe `useDialoog()`-aanroep in de sheet zelf en haal `onGeslaagd` uit de drie
interfaces weg; dan hoeven de vijf aanroepplekken niets door te geven.

### 3.2 Koop

`KooporderSheet.tsx`, in plaats van regel 185 tot 188:

```
variant: 'gelukt'
titel:  'Koop staat bij eToro'          (short: 'Short staat bij eToro')
tekst:  'Je koop van $250,00 in SOL is doorgegeven. Hij verschijnt in je portfolio zodra eToro de order heeft gevuld.'
        (short: 'Je short van $180,00 in AVAX is doorgegeven. Hij verschijnt in je portfolio zodra eToro de order heeft gevuld.')
knop:   'Oké'
```

Het bedrag met `fmtBedrag(bedragGetal, DOLLARS)`, precies zoals de sheet dat nu al doet.

### 3.3 Verkoop

`VerkoopOrderSheet.tsx`, in plaats van regel 110 tot 112. De sheet heeft `resultaat` al staan
(regel 88 tot 90, richtingbewust en in dollars) en `aantal` (regel 86, met terugval op
`bedragUsd / entryPrijs`). Leid het percentage daaruit af, zodat er maar één bron van waarheid is:

```ts
const inleg = aantal !== undefined ? trade.entryPrijs * aantal : undefined;
const resultaatPct = resultaat !== undefined && inleg !== undefined && inleg > 0
  ? (resultaat / inleg) * 100
  : undefined;
```

Er zijn drie afloopen, en alle drie krijgen een dialoog. Ze staan hieronder op volgorde.

```
variant: 'gelukt'
titel:  'Verkoop staat bij eToro'
tekst:  'Je verkoop van SOL is doorgegeven. Kader werkt je portfolio bij zodra de positie gesloten is.'
knop:   'Oké'
```

Plus een `resultaat`-blok in de dialoog, tussen de tekst en de knoppen. Twee varianten.

**Variant 1, resultaat bekend als schatting** (`resultaat !== undefined` en `resultaatPct !== undefined`):

```
marginTop spacing.base, padding spacing.md, borderRadius radii.veld, backgroundColor colors.verhoogd
  Type.overline, colors.tekstGedimd:  'GESCHAT RESULTAAT'
  rij, marginTop 4, alignItems 'baseline', gap spacing.sm:
    Type.prijsGroot in colors.winst of colors.verlies:  fmtResultaatUsd(resultaat)
    Type.prijs      in dezelfde kleur:                  '(' + fmtPct(resultaatPct) + ')'
  scheidingslijn: marginTop spacing.sm, paddingTop spacing.sm,
                  borderTopWidth StyleSheet.hairlineWidth, borderTopColor colors.rand
    Type.caption, colors.tekstGedimd:  '1,3714 SOL · aankoop $87,20 · nu $182,40'
```

Daaronder, buiten het blok, `marginTop: spacing.sm`, `Type.caption`, `colors.tekstGedimd`:

> Schatting op de koers van dit moment. eToro sluit op zijn eigen koers en rekent kosten, dus het
> definitieve bedrag kan afwijken. Kader zet het echte resultaat in je historie na de volgende sync.

**Variant 2, resultaat onbekend** (`aantal` of `huidigePrijs` ontbreekt, dus `resultaat === undefined`):

```
zelfde blok, maar:
  Type.overline:  'RESULTAAT'
  Type.prijsGroot in colors.tekstGedimd, marginTop 4:  'Nog onbekend'
```

En eronder:

> Kader kent het aantal coins of de live koers van deze positie niet, dus een bedrag zou gokwerk
> zijn. Zodra eToro de verkoop heeft verwerkt staat het echte resultaat in je historie.

**Bij verlies.** De variant blijft `gelukt`: de order is geslaagd, dat is wat de dialoog meldt. De
icoonschijf blijft dus groen en alleen het bedrag kleurt `colors.verlies`. De schaalpuls uit 2.3
slaat over als het bedrag negatief is; je feliciteert niemand met een verlies.

**Variant 3, we weten niet of de order is doorgegaan** (`uitkomst.soort === 'onbekend'`, regel 105
tot 124). Dit is een andere afloop dan de twee hierboven: hier is de opdracht misschien wel en
misschien niet uitgevoerd.

```
variant: 'waarschuwing'
titel:  'We weten niet of je verkoop is doorgegaan'
tekst:  'Kader heeft geen antwoord van eToro gekregen. De opdracht staat genoteerd en Kader controleert het zelf bij eToro.'
knop:   'Oké'
```

Plus een blok in plaats van het resultaatblok, met dezelfde maten maar met
`borderWidth: 1`, `borderColor: colors.letOp`, tekst in `Type.caption`, `colors.letOp`:

> Stuur de verkoop niet opnieuw voordat je bij eToro hebt gekeken.

**Hier staat met opzet geen bedrag en geen percentage**, ook niet als `resultaat` gewoon berekend
kan worden. Een resultaat tonen bij een order waarvan we niet weten of hij is uitgevoerd, doet
alsof we weten wat er gebeurd is. Dat is dezelfde regel als bij het vrije saldo in punt 1.

Deze dialoog komt ná `await noteerOnbekendeOrder(order)` en na `onSluiten()`. De aantekening op
schijf is wat de verzoening straks oppakt, en `PortfolioScreen` toont zelf al een blok voor orders
die na een kwartier nog onbevestigd zijn (regel 1108 tot 1132). De dialoog vervangt daar niets van,
hij vertelt alleen op het moment zelf wat er aan de hand is. De regel `setOnbekend(...)` en de
`onbekend === ''`-voorwaarde in `magBevestigen` mogen daarmee weg uit de sheet.

Dezelfde variant 3 geldt voor `KooporderSheet.tsx` (regel 195 tot 217) en `NiveausSheet.tsx`
(regel 157 tot 168), met alleen een andere titel en actieregel:

| Sheet | Titel | Actieregel |
|-------|-------|-----------|
| Koop | `We weten niet of je order is doorgegaan` | `Koop niet opnieuw voordat je bij eToro hebt gekeken. Anders open je mogelijk een tweede positie.` |
| Verkoop | `We weten niet of je verkoop is doorgegaan` | `Stuur de verkoop niet opnieuw voordat je bij eToro hebt gekeken.` |
| Niveaus | `We weten niet of je wijziging is doorgegaan` | `Stuur de niveaus niet opnieuw voordat je bij eToro hebt gekeken.` |

### 3.4 Niveaus

`NiveausSheet.tsx` regel 147: dezelfde `gelukt`-dialoog zonder resultaatblok.

```
titel: 'Niveaus doorgegeven'
tekst: 'De stop-loss en het doel van SOL staan bij eToro. Kader werkt ze bij na de volgende sync.'
knop:  'Oké'
```

### 3.5 Wat niet verandert

De **foutafhandeling** (`uitkomst.soort === 'fout'`) blijft inline in de sheet staan, precies zoals
nu, in alle drie de sheets. Bij een afgewezen order is er zeker niets gebeurd en kun je in het
formulier nog iets aanpassen; een dialoog zou je juist wegduwen van het veld dat je moet wijzigen.
De sheet blijft daarbij dus ook open.

Twee afloopen sluiten de sheet en krijgen een dialoog: geslaagd en onbekend. Bij allebei valt er in
het formulier niets meer te doen.

Verder blijft de hele order-invariant staan: geen retry, geen backoff, `noteerOnbekendeOrder` vóór
de melding, en `verzoenNaOrder()` bij een geslaagde order. Aan `engine/etoro.ts` verandert alleen
`EtoroSyncResultaat` uit punt 1.2, niets aan de orderfuncties.

---

## 4. NiveausSheet

**Artboards:** NiveausSheet licht, NiveausSheet donker, Schakelaar.

Bestand: `app/src/components/NiveausSheet.tsx`.

### 4.1 Stabiele hoogte

De sheet krimpt omdat de hulpregel (regel 275 tot 279) uit de layout verdwijnt zodra er iets
gewijzigd is. De oplossing is niet de sheet vastzetten: `BottomSheet` telt de toetsenbordhoogte bij
de `paddingBottom` op, dus een vaste hoogte zou bij een open toetsenbord het formulier wegdrukken.
In plaats daarvan krijgen de twee blokken die komen en gaan een gereserveerde plek die er ook is als
er niets in staat.

**Plek 1, het stop-advies.** Vervang het blok op regel 225 tot 233 door een `View` die er altijd is:

```ts
adviesSlot: {
  minHeight: 60,          // padding 12 boven en onder plus twee regels Type.caption op lineHeight 18
  marginTop: spacing.md,  // 12
  justifyContent: 'center',
},
```

Staat er wel een advies, dan krijgt dezelfde `View` de bestaande `stijlen.melding`-opmaak
(`borderWidth: 1`, `borderRadius: radii.veld`, `padding: spacing.md`,
`backgroundColor: colors.verhoogd`, randkleur `colors.verlies` bij `waarschuwing` en `colors.letOp`
bij de rest). Staat er niets, dan geen rand, geen achtergrond, alleen de hoogte. De `marginTop` van
`stijlen.melding` vervalt, die zit nu in het slot.

**Plek 2, de hulpregel.** Haal regel 275 tot 279 uit de `ScrollView` en zet hem samen met
`OrderBevestigKnop` in een vaste voet ónder de `ScrollView`, zodat de knop altijd op dezelfde hoogte
staat en niet meescrollt:

```ts
hulpSlot: {
  minHeight: 60,             // twee regels Type.caption plus lucht
  marginTop: spacing.md,     // 12, dit is punt 4.2
  marginBottom: spacing.base, // 16, hier zat helemaal niets
  justifyContent: 'center',
},
```

De `ScrollView` krijgt `style={{ flexShrink: 1 }}` zodat hij inlevert in plaats van de voet weg te
duwen. De blokken voor blokkade, fout en onbekend (regel 257 tot 273) blijven waar ze staan, in de
`ScrollView`. Die verschijnen bij een echte gebeurtenis en mogen de sheet best iets laten groeien;
de klacht ging over de hulpregel die verdwijnt terwijl er niets gebeurt.

`velStijl` blijft `{ maxHeight: '90%' }`.

### 4.2 Witruimte

Zie `hulpSlot` hierboven: 12px erboven, 16px eronder, en de regel staat verticaal gecentreerd in
zijn eigen 60px. Dat is het verschil met nu, waar alleen `marginTop: spacing.md` stond en er onder
de zin niets zat.

### 4.3 De schakelaar

`trackColor={{ true: colors.cta }}` gaf op Android een blauwe track met een duim die het systeem
zelf inkleurt, en dat pakt op veel toestellen groen uit. Groen is hier sowieso het verkeerde
signaal: deze schakelaar haalt je stop-loss wég.

Zet alle vier de waarden expliciet, op beide schakelaars (regel 217 tot 222 en 249 tot 254):

```tsx
<Switch
  value={wisStop}
  onValueChange={setWisStop}
  trackColor={{ false: colors.rand, true: colors.schakelaarAan }}
  thumbColor={colors.schakelaarDuim}
  ios_backgroundColor={colors.rand}
  accessibilityLabel="Stop-loss weghalen"
  accessibilityHint="Zet dit aan om je stop-loss bij eToro te verwijderen in plaats van te verzetten."
/>
```

| | Track uit | Track aan | Duim |
|-|-----------|-----------|------|
| Licht | `colors.rand` `#E2E8F0` | `colors.schakelaarAan` `#94A3B8` | `colors.schakelaarDuim` `#FFFFFF` |
| Donker | `colors.rand` `#2A3140` | `colors.schakelaarAan` `#6B7280` | `colors.schakelaarDuim` `#E6EDF3` |

**Risicomarkering, alleen op de stop-loss-schakelaar.** Staat `wisStop` aan, dan krijgt die rij een
`AlertTriangle` van 15px in `colors.letOp` vóór de tekst, en kleurt de tekst `colors.letOp` in
plaats van `colors.tekstGedimd`. Zo is de aan-stand herkenbaar zonder dat de schakelaar zelf een
kleur claimt. De doel-schakelaar krijgt dit niet: een take-profit weghalen verhoogt je risico niet.

De `accessibilityHint` op de doel-schakelaar: `Zet dit aan om je doel bij eToro te verwijderen in plaats van te verzetten.`

### 4.4 Wat niet verandert

De hele `bepaalStop`-logica, de fail-closed poort, `OrderBevestigKnop` met zijn ingedrukt-houden
voor echte accounts, de teksten van de blokkades, en de invoervelden. Alleen layout en kleur.

---

## 5. Adviesniveau in plaats van de adviesrand

**Artboards:** Adviesniveau nu en voorstel, Adviesniveau donker.

### 5.1 Waarom de streep weg gaat

`TradeCard` toont hetzelfde oordeel drie keer: de gekleurde linkerrand, de `AdviceBadge` en het
gekleurde cijfer in `ScoreBadge`. En de streep staat óók op AFWACHTEN, waar juist niets aan de hand
is, zodat elke kaart in de lijst even hard roept. De vervanging is geen tweede streep maar een
andere as: **hoogte plus badge-gewicht**.

### 5.2 De vier niveaus

| Niveau | Kaartrand | Schaduw | Badge |
|--------|-----------|---------|-------|
| HIGH CONVICTION | `borderWidth: 1.5`, `borderColor: colors.primair` | `shadow.kaart` | gevuld `colors.primair`, tekst `#FFFFFF` in licht en `colors.achtergrond` in donker |
| STERK KOOP | geen | `shadow.kaart` | omlijnd `borderWidth: 1.5` `colors.winst`, tekst `colors.winst`, met een bolletje 6x6 in `colors.winst` ervoor |
| KOOPZONE | geen | `shadow.kaart` | zacht, achtergrond `colors.winst + '1A'`, geen rand, tekst `colors.winst` |
| AFWACHTEN | `borderWidth: 1`, `borderColor: colors.rand` | **geen** | grijs, achtergrond `colors.verhoogd`, geen rand, tekst `colors.tekstGedimd`, `fontWeight: '600'` in plaats van `'700'` |

AFWACHTEN verliest zijn schaduw en ligt daardoor plat op `colors.achtergrond`, terwijl de andere
drie zweven. In een scrollende lijst is dat het verschil dat je zoekt: HIGH CONVICTION springt eruit,
AFWACHTEN valt weg.

Badge-maten (in `AdviceBadge.tsx`): `borderRadius: radii.pill`, `paddingHorizontal: 12`,
`paddingVertical: 5`, label `fontSize: 11`, `letterSpacing: 0.8`.

### 5.3 De badge verhuist naar boven

Nu staat de `AdviceBadge` op regel 178 tot 180, ná de niveaus en de metarij. Zet hem als eerste
element van de kaart, in een eigen rij met `padding: 12px 16px 0` en `alignSelf: 'flex-start'`.
Je leest dan het oordeel voordat je de cijfers leest, en dat is precies wat de streep probeerde te
doen.

### 5.4 Bestanden

| Pad | Wat |
|-----|-----|
| `app/src/components/AdviceBadge.tsx` | de vier badge-varianten uit 5.2; `adviesRandKleur` verdwijnt |
| `app/src/components/TradeCard.tsx` | `borderLeftWidth`/`borderLeftColor` weg (regel 88 en 259), `adviesRandKleur` weg (regel 49 tot 53), rand en schaduw per niveau, badge naar boven |
| `app/src/components/SkeletonCard.tsx` | `borderLeftWidth: 4` en `borderLeftColor` weg (regel 11 en 40), in plaats daarvan bovenaan een blokje van 84x22 met `borderRadius: radii.pill` in `colors.verhoogd`, op de plek van de badge |
| `app/src/screens/PortfolioScreen.tsx` | `borderLeftColor: randKleur` weg (regel 127), `borderLeftWidth: 4` weg (regel 308), `randKleur` (regel 82) verdwijnt |

### 5.5 Open posities in `PortfolioScreen`

Daar betekent de rand iets anders: `adviesKleur` uit `bepaalAdvies` voor open trades, `statusKleur`
voor afgesloten. Zelfde behandeling, ander dragertje. Het adviesblok op regel 150 (dat al op
`colors.verhoogd` staat) krijgt vooraan een bolletje van 8x8 in `radii.pill` met de adviescolour, en
de adviestekst krijgt diezelfde kleur met `fontWeight: '600'`.

De kaart zelf: open trades houden `shadow.kaart` en krijgen geen rand; afgesloten trades verliezen
`shadow.kaart` en krijgen `borderWidth: 1` in `colors.rand`. Zo zakt je historie visueel weg achter
wat nog loopt, precies zoals AFWACHTEN dat op het marktscherm doet.

### 5.6 Aanbevolen, maar apart te beslissen

De `ScoreBadge` in de kop van `TradeCard` (regel 120) toont hetzelfde getal als de kolom `SCORE` in
de metarij (regel 172 tot 174). Dat is letterlijk hetzelfde cijfer, twee keer, en de badge brengt
er een derde kleuroordeel bij. Aanbeveling: haal de `ScoreBadge` uit de kaartkop en houd de
`SCORE`-kolom. `ScoreBadge.tsx` zelf blijft ongewijzigd, hij wordt elders nog gebruikt.

Dit staat los van de rest van punt 5. Doe het niet als Kevin de badge daar wil houden.

### 5.7 Wat niet verandert

- `MeldingNotitie.tsx` houdt zijn `borderLeftWidth: 3`. Dat is een meldingsstrook, geen tradekaart,
  en er is niets mis mee.
- `ScoreBadge.tsx`, `LevelRow.tsx`, `RichtingBadge.tsx` en de metarij van `TradeCard` blijven zoals
  ze zijn.
- De adviesteksten en de drempels (`DREMPEL_STERK_KOOP`, `highConviction`) veranderen niet. Alleen
  hoe ze eruitzien.

---

## 6. Verificatie

Er is geen testsuite. Loop na de implementatie met de `run-android`-skill deze lijst af, in licht
én in donker:

1. Portfolio-scherm met eToro-koppeling: `TOTAAL VERMOGEN`, balk, twee tegels, ring met legenda.
2. Portfolio-scherm zonder koppeling: `WAARDE OPEN POSITIES`, `Onbekend`, uitlegblok, geen balk.
3. Meer dan zeven posities: `Overig (n)` in de ring, uitklappen en weer inklappen.
4. Import-knop zonder koppeling: de informatie-dialoog, en die moet openen ná het sluiten van de
   instellingen-sheet zonder dat de app hangt.
5. Instellingen, omschakelen naar echt: de waarschuwing-dialoog met twee knoppen, tik naast de kaart
   sluit hem niet.
6. Demo-order plaatsen en weer verkopen: koopbevestiging, verkoopbevestiging met resultaat. Zet
   daarna eens vliegtuigmodus aan halverwege een order om de onbekend-dialoog te zien, en
   controleer dat er in die dialoog géén bedrag staat.
7. NiveausSheet openen, een schakelaar aanzetten en weer uit: de sheet verspringt geen pixel.
8. De schakelaar is grijs, niet groen, en de stop-loss-rij kleurt oranje als hij aanstaat.
9. Marktscherm: HIGH CONVICTION springt eruit, AFWACHTEN ligt plat, nergens meer een gekleurde
   linkerrand op een tradekaart.

## 7. Changelog

Dit zijn zichtbare wijzigingen, dus `CHANGELOG.md` en `app/src/changelog.ts` moeten allebei bij,
nieuwste bovenaan, in het Nederlands. Het versienummer pas toekennen op het moment dat er echt een
release-APK gebouwd wordt.
