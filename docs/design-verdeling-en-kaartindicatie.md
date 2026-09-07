# Design: legenda-indeling, Verdeling in detail, kaartniveau en platform-indicatie

Ontwerpspec voor vier wijzigingen. Alles staat in tokenwaarden uit `app/src/theme/tokens.ts` en
stijlen uit `app/src/theme/typography.ts`. Waar een waarde niet uit een token komt, staat het er
expliciet bij. Alle gebruikerstekst hieronder is letterlijk overneembaar: Nederlands, nuchter,
geen em-dashes.

Uitgangspunten die overal gelden:

- React Native, alleen `react-native`, `react-native-svg` en `lucide-react-native`. Geen nieuwe
  libraries.
- Kleur is nooit het enige signaal. Elk gekleurd element heeft een naam, een letter, een cijfer of
  een vorm naast zich.
- Raakvlakken minimaal 44px, schermlezerlabels in het Nederlands.
- Licht en donker moeten allebei kloppen. Waar een kleur in donker anders moet, staat dat erbij.
- De kaart moet kloppen bij 1 positie en bij 25 posities.

---

## 1. Legenda van "Verdeling van je posities" opnieuw indelen

### 1.1 Het probleem

De legenda in `VerdelingKaart.tsx` staat nu in twee kolommen. Per cel:

```
[▪] BTC              34,3%
    $4.812,40
```

Het label heeft `flex: 1`, dus het percentage wordt naar rechts geduwd tot aan de rand van zijn
eigen cel. Die celrand ligt op ongeveer 45 procent van de kaartbreedte voor de linkerkolom en aan
de rechterrand voor de rechterkolom. Gevolg: percentages staan op twee verschillende horizontale
posities, waarvan er één midden op de kaart zweeft. Ze zijn onderling niet te vergelijken, want je
oog heeft geen rechte kolom om langs te lopen. Het bedrag staat op een derde regel, ingesprongen op
15px, wat een derde uitlijning toevoegt.

Dat is precies de klacht: "de percentages achter de naam van de coin staan op een rare plek".

De ring zelf blijft ongewijzigd. Dit gaat alleen over de legenda eronder.

### 1.2 De opties

**Optie A: twee kolommen houden, percentage onder de naam**

```
[▪] BTC               [▪] ETH
    34,3%                 21,8%
    $4.812,40             $3.058,10
```

Kleinste ingreep, en het zwevende percentage is weg omdat alles links uitlijnt. Maar percentages
staan nu onder elkaar in twee losse kolommen, dus vergelijken kan nog steeds alleen binnen een
kolom. En elke cel wordt drie regels hoog: bij zeven segmenten is de legenda 4 rijen van 3 regels,
hoger dan de ring. Niet gekozen.

**Optie B: één kolom, vaste kolommen, percentage rechts uitgelijnd**

```
[▪] BTC          $4.812,40    34,3%
[▪] ETH          $3.058,10    21,8%
[▪] SOL          $1.994,60    14,2%
[▪] AVAX           $912,00     6,5%
[▪] Overig (9)   $3.245,80    23,2%
```

Eén regel per segment. Drie rechte kolommen: naam links, bedrag rechts uitgelijnd, percentage in
een vaste kolom van 46px helemaal rechts. Alle percentages staan onder elkaar op dezelfde
horizontale positie, tegen dezelfde rand als de rest van de kaart. Met `tabular-nums` uit
`Type.label` en `Type.prijs` lijnen ook de cijfers binnen die kolommen uit. Dit leest als een
tabel, wat het ook is.

Hoogte bij zeven segmenten: 7 regels van 18px plus 6 tussenruimtes van 10px is 186px. Dat is meer
dan de huidige 4 rijen van circa 40px (160px), maar niet dramatisch, en het is de enige optie waarin
de percentages een echte kolom vormen.

**Optie C: mini-staafje per rij**

```
BTC                          34,3%
████████████░░░░░░░░░░░░░░░░░░░░░
$4.812,40
```

Sterkste visuele vergelijking, maar dubbelop: de ring erboven zégt al hoe de verhoudingen liggen.
Twee grafieken van dezelfde data boven elkaar op een kaart van 343px breed is te veel. Wel bruikbaar
op het detailscherm, waar er geen ring per blok is en waar 25 rijen wél om een lengtemaat vragen.
Zie punt 2. Niet gekozen voor de kaart.

**Optie D: percentage alleen in het gat van de ring, bij aanraking van een segment**

De legenda wordt dan alleen naam plus bedrag, en het percentage verschijnt in het midden als je een
segment aantikt. Elegant, maar een segment van 4 procent is op een ring van 150px een raakvlak van
ongeveer 20 bij 22 pixels, ver onder de 44px-eis, en een schermlezer kan er niets mee. Bovendien
moet de kaart ook zonder tikken kloppen. Niet gekozen.

**Optie E: naam en percentage als één tekst**

```
[▪] BTC 34,3%                  $4.812,40
```

Het percentage zweeft niet meer, want het plakt aan de naam. Maar de percentages beginnen nu op een
positie die afhangt van de lengte van de coinnaam ("BTC 34,3%" tegenover "Overig (9) 23,2%"), dus
ze staan alsnog niet onder elkaar. Het probleem verschuift in plaats van dat het weggaat. Niet
gekozen.

### 1.3 Gekozen: optie B

Eén kolom, drie rechte kolommen per rij. Reden: het percentage is het getal waar de kaart om draait,
en dat getal hoort in één kolom te staan zodat je met je oog van boven naar beneden kunt lopen.
Twee kolommen naast elkaar maken van vijf getallen twee lijstjes die je niet kunt vergelijken. De
extra hoogte is de prijs, en die is acceptabel: bij meer dan zeven coins vouwt de kaart nog steeds
samen tot zes plus Overig, en het volledige overzicht staat vanaf nu op het detailscherm uit punt 2.

### 1.4 Uitwerking

**Container.** `styles.legenda` wordt:

```
marginTop: spacing.base (16)
rowGap: 10
```

Geen `flexDirection: 'row'`, geen `flexWrap`, geen `columnGap`. De cellen worden gewone blokken
onder elkaar.

**Rij.** Eén `View` per segment, `flexDirection: 'row'`, `alignItems: 'center'`, `gap: spacing.sm (8)`:

| Element | Maat | Stijl | Kleur |
|---------|------|-------|-------|
| Kleurvierkantje | 9x9, `borderRadius: 2`, `marginRight: 0` (de `gap` doet het) | | segmentkleur uit `colors.verdeling[i]` of `colors.verdelingOverig` |
| Naam | `flex: 1`, `numberOfLines={1}` | `Type.caption` met `fontWeight: '600'` | `colors.tekstPrimair` |
| Bedrag | `minWidth: 78`, `textAlign: 'right'` | `Type.prijs` met `fontSize: 12` | `colors.tekstGedimd` |
| Percentage | `width: 46`, `textAlign: 'right'` | `Type.label` (11px mono, tabular) | `colors.tekstPrimair` |

De hiërarchie is bewust: naam en percentage zijn primair (dat is wat je leest), het bedrag is
gedimd (dat is de onderbouwing). Nu staat het percentage nog in `colors.tekstGedimd`; dat gaat
naar `colors.tekstPrimair`, want het is het hoofdgetal van de rij.

`minWidth: 78` op het bedrag is genoeg voor `$12.480,00` op 12px mono (10 tekens van circa 7.2px).
Loopt een bedrag daaroverheen (zes cijfers voor de komma), dan groeit de kolom en krimpt de naam,
en dat is de goede volgorde: een symbool van vier letters mag inleveren, een bedrag niet.

`width: 46` op het percentage is genoeg voor `100,0%` op 11px mono. Vast, niet flexibel, want dit
is de kolom die recht moet staan.

**Schets, licht en donker identiek van indeling:**

```
+-----------------------------------------------------+
|  VERDELING VAN JE POSITIES                          |
|                                                     |
|                    ,---------.                      |
|                  /   $14.023   \                    |
|                 |   12 posities  |                  |
|                  \             /                    |
|                    `---------'                      |
|                                                     |
|  [#] BTC             $4.812,40    34,3%             |
|  [#] ETH             $3.058,10    21,8%             |
|  [#] SOL             $1.994,60    14,2%             |
|  [#] AVAX              $912,00     6,5%             |
|  [#] LINK              $743,20     5,3%             |
|  [#] DOT               $455,10     3,2%             |
|  [.] Overig (6)      $2.047,60    14,7%             |
|                                                     |
|  Alle posities en platforms                    >    |
+-----------------------------------------------------+
```

De kolom met percentages staat rechts, recht onder elkaar, tegen dezelfde marge als de kaartrand.
Dat is het verschil met nu.

**Lange namen.** Coinsymbolen zijn maximaal vijf tekens, dus in de praktijk speelt dit alleen bij
`Overig (12)`. De naam heeft `flex: 1` en `numberOfLines={1}`; bij te weinig ruimte kapt hij af met
een ellips. De bedrag- en percentagekolom leveren nooit in.

**Aandeel onder 1 procent.** `fmtAandeel` geeft nu `0,4%` en bij alles onder 0,05 procent `0,0%`.
Nul procent is onwaar. Regel:

```
aandeel < 0.001  ->  '<0,1%'
anders           ->  fmtAandeel(aandeel)
```

Voor de schermlezer wordt dat `minder dan 0,1 procent`.

**Eén segment.** Eén regel, `100,0%`, volle ring. De kaart blijft staan: dat alles in één coin zit
is de informatie.

**Nul segmenten met wel open posities.** Ongewijzigd: gestippelde ring in `colors.rand` en de
bestaande zin over ontbrekende live koersen.

**Wat vervalt.** De uitklapfunctie in de kaart gaat weg, inclusief `uitgeklapt`-state,
`LayoutAnimation`, `useReduceMotion`, de leden-rijen (`lidRij`, `lidLabel`, `lidRest`), de stijl
`celVol` en de knop `Toon alle {n}`. Reden: vanaf punt 2 is de hele kaart aantikbaar en opent hij
het volledige overzicht. Twee ingangen naar hetzelfde overzicht op één kaart, waarvan er één de
andere blokkeert (een knop binnen een aantikbare kaart), is een raakvlakconflict. Op de plek van de
knop komt de affordance-rij uit punt 2.5.

### 1.5 Toegankelijkheid

- De ring houdt zijn bestaande gedrag: `accessibilityElementsHidden` op de `Svg`, en een
  `accessibilityLabel` op de omhullende `View` in de vorm
  `Verdeling: BTC 34,3 procent, ETH 21,8 procent, en 6 kleinere posities.`
- Elke legendarij krijgt `accessible` met een eigen label:
  `BTC, $4.812,40, 34,3 procent van je posities.` Zo leest de schermlezer één zin per rij in plaats
  van drie losse tekstknopjes.
- Het kleurvierkantje krijgt `accessibilityElementsHidden`: de naam staat er al naast.

---

## 2. Nieuw scherm "Verdeling in detail"

### 2.1 Waarom een full-screen scherm en niet een sheet

De inhoud is een lijst die bij 25 posities makkelijk drie schermhoogtes lang wordt, met vier blokken
die elk hun eigen kop hebben. Een `BottomSheet` staat in Kader voor iets wat je afhandelt en weer
sluit (een order, een instelling); dit is iets wat je leest. `HistorieScherm.tsx` is precies dat
patroon en heeft dezelfde vorm: `Modal` met `presentationStyle="fullScreen"`, `animationType="slide"`,
`SafeAreaView`, een eigen header met sluitkruis, en een `ScrollView` eronder. Dat patroon wordt
één op één overgenomen, inclusief `useModalKopruimte()` voor de extra kopruimte.

Nieuw bestand: `app/src/components/VerdelingScherm.tsx`.

### 2.2 De ingang

De hele `VerdelingKaart` wordt aantikbaar:

```
<Pressable
  onPress={onOpenDetail}
  accessibilityRole="button"
  accessibilityLabel="Verdeling in detail bekijken"
  accessibilityHint="Opent het volledige overzicht per coin en per platform."
>
```

De `Pressable` zit binnen de kaart-`View` en omvat kop, ring, legenda en de affordance-rij. De
kaart houdt zijn eigen achtergrond en schaduw; er komt geen extra `pressed`-staat bij behalve
`opacity: 0.96` tijdens het indrukken.

Onderaan de kaart, op de plek van de oude uitklapknop:

```
+-----------------------------------------------------+
|  ---------------------------------------------------|
|  Alle posities en platforms                     >   |
+-----------------------------------------------------+
```

`borderTopWidth: StyleSheet.hairlineWidth` in `colors.rand`, `marginTop: spacing.md`,
`paddingTop: spacing.md`, `minHeight: 44`, `flexDirection: 'row'`,
`justifyContent: 'space-between'`, `alignItems: 'center'`. Tekst in `Type.caption` met
`fontWeight: '600'` in `colors.cta`, en een `ChevronRight` van 16px in `colors.cta`, `strokeWidth: 1.75`.
Precies de vorm van de historie-knop in `PortfolioStatusKaart.tsx`, zodat de twee ingangen op het
portfolio-scherm er hetzelfde uitzien.

### 2.3 Wat "de verschillende apps" betekent

Een positie heeft een bron: `bron: 'etoro' | 'handmatig'` (helper `bronVan()`), en bij eToro ook
`etoroOmgeving: 'real' | 'demo'`. Dat zijn vandaag drie herkomsten, morgen meer. Het ontwerp gaat
daarom uit van N platforms met een register, niet van een if-else op eToro.

Nieuw bestand `app/src/engine/platforms.ts`, puur, geen React:

```ts
export type PlatformId = 'etoro' | 'etoro-demo' | 'handmatig';

export interface PlatformInfo {
  id: PlatformId;
  naam: string;        // 'eToro', 'eToro demo', 'Handmatig'
  monogram: string;    // 'E', 'E', 'H'  (1 teken, hoofdletter)
  kleurIndex: number;  // index in colors.verdeling, of -1 voor neutraal
  demo?: boolean;
}
```

| id | naam | monogram | kleurIndex | demo |
|----|------|----------|------------|------|
| `etoro` | `eToro` | `E` | 2 | |
| `etoro-demo` | `eToro demo` | `E` | 2 | ja |
| `handmatig` | `Handmatig` | `H` | -1 | |

`kleurIndex: 2` is `#0E7490` in licht en `#22D3EE` in donker. Bewust niet index 0 of 1: die zijn in
één van beide thema's gelijk aan `colors.primair` of `colors.cta`, en een merkje dat exact de
CTA-kleur heeft leest als een knop. `kleurIndex: -1` betekent: vulling `colors.verhoogd`, rand 1px
`colors.rand`, letter `colors.tekstGedimd`. Handmatig is geen platform met een merk, dus krijgt het
ook geen merkkleur.

Toekomstige platforms krijgen `bitvavo` met `kleurIndex: 3` (violet) en `coinbase` met
`kleurIndex: 1` (blauw). Er zijn zes kleuren in de reeks, dus tot zes merken zonder botsing; daarna
valt een platform terug op `-1`.

Verder in dat bestand:

```ts
export function platformVanTrade(t: PortfolioTrade): PlatformId;
export function handelbaarOp(symbool: string): PlatformId[];  // voor punt 4
```

`platformVanTrade` leest `bronVan(t)` en, bij eToro, `t.etoroOmgeving === 'demo'`.

**Demo-posities.** Die krijgen een eigen platformregel `eToro demo` met een `DEMO`-pil ernaast, en
tellen mee in het totaal. Reden: het totaal op dit scherm moet gelijk zijn aan het totaal op de kaart
die je aantikte, en `berekenVerdeling` telt demo nu ook mee. Twee verschillende totalen voor
dezelfde ring is erger dan speelgeld dat meetelt. De pil vertelt dat het speelgeld is, en de
platformregel maakt zichtbaar hoeveel het is. Wil Kevin demo later uit het totaal halen, dan moet
dat op beide plekken tegelijk gebeuren, niet alleen hier.

### 2.4 Reken-uitbreiding

In `app/src/engine/verdeling.ts` erbij, met een zelftest onder `require.main` in dezelfde stijl als
de bestaande:

```ts
export interface CoinRegel {
  symbool: string;
  waardeUsd: number;
  aandeel: number;                // 0..1 van het totaal
  posities: number;               // aantal open trades in deze coin
  platforms: PlatformId[];        // aflopend op waarde, uniek
}

export interface PlatformRegel {
  id: PlatformId;
  waardeUsd: number;
  aandeel: number;
  posities: number;
  coins: number;
}

export interface KruisRegel {
  symbool: string;
  delen: { platform: PlatformId; waardeUsd: number; aandeel: number }[];  // aandeel binnen de coin
}

export interface NietGewogen {
  symbool: string;
  reden: 'geen aantal' | 'geen live koers';
  platform: PlatformId;
}

export interface VolledigeVerdeling {
  coins: CoinRegel[];          // aflopend, volledig, geen Overig
  platforms: PlatformRegel[];  // aflopend
  kruis: KruisRegel[];         // alleen coins die op 2 of meer platforms staan
  nietGewogen: NietGewogen[];
  totaalUsd: number;
  gewaardeerd: number;
  zonderLivePrijs: number;
}

export function berekenVolledigeVerdeling(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
): VolledigeVerdeling;

export function duidingen(v: VolledigeVerdeling): string[];
```

Dezelfde regels als `berekenVerdeling`: alleen open trades met `aantalCoins > 0` én een live prijs
tellen mee, waarde is `livePrijs * aantalCoins` (marktwaarde, ook bij een short), percentages worden
niet opgepoetst. `totaalUsd`, `gewaardeerd` en `zonderLivePrijs` moeten per definitie gelijk zijn
aan die van `berekenVerdeling` op dezelfde invoer; zet dat als assertie in de zelftest.

### 2.5 Het scherm

**Header**, exact het patroon van `HistorieScherm`:

```
+-----------------------------------------------------+
| (o) Verdeling                                   [X] |
+-----------------------------------------------------+
```

`PieChart` 18px in `colors.tekstGedimd`, titel `Verdeling` in `Type.titel` / `colors.tekstPrimair`,
sluitkruis `X` 22px in `colors.tekstGedimd` met `minHeight/minWidth: 44`.
`borderBottomWidth: StyleSheet.hairlineWidth` in `colors.rand`,
`paddingTop: spacing.base + useModalKopruimte()`.

Daaronder een `ScrollView` met `contentContainerStyle: { padding: spacing.base }`. Blokken in deze
volgorde, elk een kaart met `backgroundColor: colors.kaart`, `borderRadius: radii.kaart`,
`padding: spacing.base`, `marginBottom: spacing.base`, `shadow.kaart`.

---

**Blok 1: Totaal en ring**

De ring komt mee van de kaart die je aantikte, zodat het scherm doorleest als hetzelfde object en
niet als een nieuw ding. Zelfde tekening, zelfde kleuren, iets kleiner: `RING_MAAT = 132`,
`STRAAL = 51`, `DIKTE = 19`. Segmenten blijven de zes grootste plus Overig, dus de ring hier is
identiek aan die op het portfolio-scherm.

```
+-----------------------------------------------------+
|  IN POSITIES                                        |
|  $14.023,80                                         |
|                                                     |
|                    ,---------.                      |
|                  /             \                    |
|                 |               |                   |
|                  \             /                    |
|                    `---------'                      |
|                                                     |
|  12 posities · 9 coins · 2 platforms                |
+-----------------------------------------------------+
```

| Element | Stijl | Kleur |
|---------|-------|-------|
| `IN POSITIES` | `Type.overline` | `colors.tekstGedimd` |
| `$14.023,80` (via `fmtBedrag`) | `Type.display` | `colors.tekstPrimair` |
| Ring | zie boven, `alignSelf: 'center'`, `marginTop: spacing.base` | segmentkleuren |
| Onderregel | `Type.caption`, `marginTop: spacing.base`, `textAlign: 'center'` | `colors.tekstGedimd` |

Onderregel-copy, met enkelvoud en meervoud:
`{n} positie(s) · {m} coin(s) · {p} platform(s)`. Bij één platform:
`12 posities · 9 coins · 1 platform`.

Het gat van de ring blijft hier leeg: het bedrag staat er al boven in `Type.display`, en twee keer
hetzelfde getal op één blok is precies het soort dubbeling dat punt 3 juist opruimt.

---

**Blok 2: Per coin**

```
+-----------------------------------------------------+
|  PER COIN                                  9 coins  |
|                                                     |
|  [#] BTC  (E)          $4.812,40           34,3%    |
|      ==================================-------      |
|  [#] ETH  (E)(H)       $3.058,10           21,8%    |
|      =======================------------------      |
|  [#] SOL  (E)          $1.994,60           14,2%    |
|      ===============--------------------------      |
|  [#] AVAX (H)            $912,00            6,5%    |
|      =======----------------------------------      |
|  [.] LINK (E)            $743,20            5,3%    |
|      ======-----------------------------------      |
|  [.] DOT  (E)            $455,10            3,2%    |
|      ====-------------------------------------      |
|  [.] ...                                            |
|                                                     |
|  De zes grootste hebben de kleur uit de ring.       |
|  De rest deelt één grijs.                           |
+-----------------------------------------------------+
```

Blokkop: `Type.overline` `PER COIN` in `colors.tekstGedimd` links, rechts `{n} coins` in
`Type.caption` / `colors.tekstGedimd`. `flexDirection: 'row'`,
`justifyContent: 'space-between'`, `marginBottom: spacing.md`.

Per rij, twee regels, `rowGap: spacing.md` tussen rijen:

Regel 1 (`flexDirection: 'row'`, `alignItems: 'center'`, `gap: spacing.sm`):

| Element | Maat | Stijl | Kleur |
|---------|------|-------|-------|
| Kleurvierkantje | 9x9, `borderRadius: 2` | | `colors.verdeling[i]` voor i < 6, anders `colors.verdelingOverig` |
| Symbool | | `Type.caption`, `fontWeight: '600'` | `colors.tekstPrimair` |
| Platformmerkjes | chip 16px, `gap: 3` | zie 4.2 | platformkleur |
| Vulling | `flex: 1` | | |
| Bedrag | `textAlign: 'right'` | `Type.prijs`, `fontSize: 12` | `colors.tekstGedimd` |
| Percentage | `width: 46`, `textAlign: 'right'` | `Type.label` | `colors.tekstPrimair` |

Regel 2, het staafje: `marginTop: 5`, `marginLeft: 17` (9 vierkantje plus 8 gap, zodat het onder het
symbool begint), `height: 3`, `borderRadius: radii.pill`, achtergrond `colors.verhoogd`, met daarin
een `View` met `width: '{aandeel*100}%'` in dezelfde kleur als het vierkantje. Minimum
`width: 2` zodat een positie van 0,2 procent nog een streepje heeft in plaats van niets.

Hier is het staafje uit optie C van punt 1 wél op zijn plek: dit blok kan 25 rijen lang zijn, er
staat geen ring naast om de verhoudingen af te lezen, en een lengtemaat is bij dat aantal het enige
dat nog werkt.

Voetregel van het blok, alleen als er meer dan zes coins zijn: `Type.caption` in
`colors.tekstGedimd`, `marginTop: spacing.md`:

> De zes grootste hebben de kleur uit de ring. De rest deelt één grijs.

---

**Blok 3: Per platform**

```
+-----------------------------------------------------+
|  PER PLATFORM                          2 platforms  |
|                                                     |
|  (E) eToro                      $11.520,30   82,1%  |
|      ==================================------       |
|      9 posities · 7 coins                           |
|                                                     |
|  (H) Handmatig                   $2.503,50   17,9%  |
|      ========---------------------------------      |
|      3 posities · 2 coins                           |
+-----------------------------------------------------+
```

Met een demo-account erbij:

```
|  (E) eToro demo  [DEMO]            $310,00    2,2%  |
```

Per platform drie regels:

Regel 1: chip 24px (zie 4.2), naam in `Type.caption` `fontWeight: '600'` / `colors.tekstPrimair`,
bij een demo-platform een pil ernaast, dan `flex: 1` vulling, dan bedrag (`Type.prijs`, `fontSize: 12`,
`colors.tekstGedimd`) en percentage (`Type.label`, `width: 46`, `textAlign: 'right'`,
`colors.tekstPrimair`).

De `DEMO`-pil: `Type.label` met `fontSize: 10`, `colors.letOp`, achtergrond `colors.letOp + '1A'`,
`borderRadius: radii.pill`, `paddingHorizontal: 6`, `paddingVertical: 1`.

Regel 2: hetzelfde staafje als in blok 2, `marginLeft: 32` (24 chip plus 8 gap), in de platformkleur;
bij `kleurIndex: -1` in `colors.tekstGedimd`.

Regel 3: `Type.caption` in `colors.tekstGedimd`, `marginLeft: 32`, `marginTop: 4`:
`{n} positie(s) · {m} coin(s)`.

Bij precies één platform blijft het blok staan met één regel. De informatie is dan dat alles op één
plek staat, en dat is wat blok 5 ook zegt.

---

**Blok 4: Op meer dan één plek**

Alleen coins die op twee of meer platforms staan. Dit is de kruising waar de gebruiker om vroeg, en
in deze vorm blijft hij kort: de rest van de kruising staat al als merkjes in blok 2.

```
+-----------------------------------------------------+
|  OP MEER DAN ÉÉN PLEK                               |
|                                                     |
|  ETH                              $3.058,10         |
|    (E) eToro                      $2.140,70   70,0% |
|    (H) Handmatig                    $917,40   30,0% |
|                                                     |
|  SOL                              $1.994,60         |
|    (E) eToro                      $1.196,80   60,0% |
|    (E) eToro demo                   $797,80   40,0% |
+-----------------------------------------------------+
```

Let op: de percentages hier zijn het aandeel **binnen die coin**, niet binnen het totaal. Dat moet
uit de kop blijken, dus onder de blokkop een regel in `Type.caption` / `colors.tekstGedimd`:

> De percentages hieronder gaan over de coin zelf, niet over je hele portfolio.

Coin-regel: `Type.caption` `fontWeight: '600'` / `colors.tekstPrimair` links, totaalbedrag rechts in
`Type.prijs` `fontSize: 12` / `colors.tekstGedimd`.
Platformregels: `paddingLeft: spacing.md`, chip 16px, naam `Type.caption` / `colors.tekstGedimd`,
bedrag en percentage rechts zoals hierboven. `rowGap: spacing.md` tussen coins, `rowGap: 4` binnen
een coin.

Staat er geen enkele coin op meer dan één plek, dan vervalt het hele blok en komt er in blok 3, als
laatste regel, één zin in `Type.caption` / `colors.tekstGedimd`:

> Elke coin staat op één platform.

---

**Blok 5: Wat opvalt**

Feitelijke observaties, geen aanbevelingen. Kader zegt wat er staat en niet wat je moet doen.

```
+-----------------------------------------------------+
|  WAT OPVALT                                         |
|                                                     |
|  •  Je grootste positie is BTC, 34,3% van je        |
|     blootstelling.                                  |
|  •  De drie grootste zijn samen 70,3%.              |
|  •  82,1% staat op eToro.                           |
|  •  Meer dan 40 procent in één coin betekent dat    |
|     je resultaat vooral van die coin afhangt.       |
|                                                     |
|  Dit zijn observaties, geen advies.                 |
+-----------------------------------------------------+
```

`duidingen()` levert de zinnen op, in deze volgorde, en levert er minimaal één en hoogstens vijf:

1. Bij één coin: `Alles staat in {X}.` Anders: `Je grootste positie is {X}, {p} van je blootstelling.`
2. Alleen bij vier coins of meer: `De drie grootste zijn samen {p}.`
3. Bij één platform: `Alles staat op {naam}.` Anders: `{p} staat op {naam}.` (het grootste platform)
4. Alleen als de grootste coin 40 procent of meer is:
   `Meer dan 40 procent in één coin betekent dat je resultaat vooral van die coin afhangt.`
5. Alleen als er één platform is én meer dan één coin:
   `Eén platform betekent dat een storing daar al je posities tegelijk raakt.`

Zin 4 en 5 zijn met opzet mechanisch geformuleerd: ze beschrijven wat concentratie doet, ze zeggen
niet dat het te veel is. De drempel van 40 procent is een keuze, geen norm, en staat daarom in de
zin zelf zodat de lezer hem kan wegen.

Opmaak: per zin een rij met een bolletje van 5x5 in `radii.pill` / `colors.tekstGedimd`,
`marginTop: 7` (optisch uitgelijnd op de eerste regel), `gap: spacing.sm`, tekst in `Type.body` /
`colors.tekstPrimair`, `flex: 1`. `rowGap: spacing.md` tussen de zinnen.
Slotregel `Dit zijn observaties, geen advies.` in `Type.caption` / `colors.tekstGedimd`,
`marginTop: spacing.base`, `paddingTop: spacing.md`,
`borderTopWidth: StyleSheet.hairlineWidth` in `colors.rand`.

---

**Blok 6: Niet meegeteld**

Alleen als `zonderLivePrijs > 0`. Dit scherm is de plek waar die posities een naam krijgen; op de
kaart staat alleen het aantal.

```
+-----------------------------------------------------+
|  NIET MEEGETELD                                     |
|                                                     |
|  Deze posities staan open, maar Kader kan ze niet   |
|  wegen. Ze tellen niet mee in de percentages        |
|  hierboven.                                         |
|                                                     |
|  (H) ADA                          geen live koers   |
|  (E) XRP                             geen aantal    |
+-----------------------------------------------------+
```

Blok zonder schaduw: `backgroundColor: colors.verhoogd`, `borderRadius: radii.kaart`,
`padding: spacing.base`. Het is een terzijde, geen kaart met data.
Kop `Type.overline` / `colors.tekstGedimd`. Uitleg `Type.caption` / `colors.tekstGedimd`,
`marginTop: spacing.sm`. Rijen `marginTop: spacing.md`, `rowGap: 6`: chip 16px, symbool in
`Type.caption` `fontWeight: '600'` / `colors.tekstPrimair`, `flex: 1` vulling, reden rechts in
`Type.caption` / `colors.tekstGedimd`.

### 2.6 Lege staten

| Staat | Wat je ziet |
|-------|-------------|
| Geen open posities | Het scherm is niet te openen: de kaart wordt dan al niet gerenderd. Voor de zekerheid toch een lege staat, in de vorm van `HistorieScherm.leeg`: `PieChart` 40px in `colors.tekstGedimd`, daaronder `Type.body` / `colors.tekstGedimd`, gecentreerd: `Je hebt nog geen open posities. Zodra er iets openstaat, verschijnt hier hoe het verdeeld is.` |
| Open posities, geen enkele met live koers (`gewaardeerd === 0`) | Blok 1 met de gestippelde ring uit de kaart (`stroke: colors.rand`, `strokeDasharray="6 8"`), geen bedrag maar `—` in `Type.display` / `colors.tekstGedimd`, en daaronder: `Kader heeft nog geen live koersen om je posities te wegen. De verdeling verschijnt na de eerste sync.` Blok 2 tot en met 5 vervallen. Blok 6 toont dan alle open posities. |
| Eén positie | Alle blokken blijven staan. Blok 2 heeft één rij op 100,0%, blok 3 één platform, blok 4 vervalt, blok 5 zegt `Alles staat in BTC.` en `Alles staat op eToro.` |
| 25 posities | Blok 2 wordt lang. Geen "toon meer"-knop: dit ís het volledige overzicht, dat is de reden dat het scherm bestaat. De `ScrollView` doet de rest. |

### 2.7 Toegankelijkheid

- De `Modal` krijgt `onRequestClose={onSluiten}` zodat de Android-terugknop sluit.
- Elke blokkop krijgt `accessibilityRole="header"`.
- Elke rij in blok 2 krijgt `accessible` met één label:
  `BTC, op eToro, $4.812,40, 34,3 procent van je posities.`
- Elke rij in blok 3: `eToro, $11.520,30, 82,1 procent, 9 posities in 7 coins.`
  Bij demo begint het label met `eToro demo, speelgeld,`.
- Het staafje en het kleurvierkantje krijgen `accessibilityElementsHidden`: het percentage staat er
  al naast.
- De ring in blok 1 blijft `accessibilityElementsHidden` met een samenvattend label op de houder,
  net als op de kaart.
- Alle raakvlakken (sluitkruis, de kaart-`Pressable`, de affordance-rij) minimaal 44px. De rijen
  in dit scherm zijn niet aantikbaar, dus daar geldt de eis niet.

---

## 3. Sterkere indicatie op de tradekaart

### 3.1 Het probleem

Wat er weg is: de gekleurde linkerstreep (`borderLeftWidth: 4`) en de `ScoreBadge` rechtsboven. Wat
er nu nog is: de `AdviceBadge` linksboven, een rand van 1.5 in `colors.primair` bij high conviction,
een rand van 1 in `colors.rand` bij afwachten, en wel of geen schaduw.

Dat werkt op papier, maar op een scrollend scherm van 20 kaarten is het te weinig. De vier niveaus
verschillen alleen in een randje van anderhalve pixel en in een schaduw die op een licht thema bijna
onzichtbaar is (`shadowOpacity: 0.06`). Alle vier de kaarten hebben verder exact dezelfde
achtergrond, dezelfde kopgrootte en dezelfde hoeveelheid tekst. Je moet de badge lézen om te weten
wat er aan de hand is, en dat is precies wat een indicatie zou moeten voorkomen.

De oplossing is niet de streep terughalen. Die was fout omdat hij vier keer hetzelfde zei en ook op
AFWACHTEN stond, waar niets aan de hand is. De oplossing is een ladder over vier assen tegelijk:
**achtergrond, rand, schaduw en badge-gewicht**, plus het scorecijfer terug op één rustige plek.

### 3.2 Het scorecijfer terug, in de badge

De `SCORE`-kolom in de metarij is het zwakste plekje voor het cijfer dat het meest zegt: hij staat
onderaan, naast R/R en RSI, in dezelfde grootte en kleur als die twee, en hij is de vierde kolom van
links. Voorstel: haal die kolom weg en zet het getal in de badge zelf.

```
[ HIGH CONVICTION · 82 ]      [ STERK KOOP · 74 ]
[ KOOPZONE · 61 ]             [ AFWACHTEN · 38 ]
```

Eén element draagt dan zowel het oordeel als de maat ervan, het staat linksboven waar je begint met
lezen, en het cijfer staat nog steeds maar één keer op de kaart. `AdviceBadge` krijgt een optionele
prop `score?: number`. Staat hij er, dan komt achter het label een scheidingspunt en het getal in
`Type.label` (11px mono, tabular) in dezelfde kleur als het label, met `opacity: 0.85` zodat het
label voorop blijft staan. Bij AFWACHTEN geen opacity: `colors.tekstGedimd` is al gedimd.

De metarij houdt dan R/R, RSI en eventueel VS BTC over, drie kolommen die ruimer kunnen staan.

### 3.3 De vier niveaus

| | HIGH CONVICTION | STERK KOOP | KOOPZONE | AFWACHTEN |
|---|---|---|---|---|
| Kaartachtergrond | `colors.kaart` | `colors.kaart` | `colors.kaart` | `colors.achtergrond` |
| Rand | `1.5` in `colors.primair` | `1` in `colors.winst + '33'` | geen | `1` in `colors.rand` |
| Schaduw | `shadow.kaart` | `shadow.kaart` | `shadow.kaart` | geen |
| Badge | gevuld `colors.primair`, tekst `#FFFFFF` in licht en `colors.achtergrond` in donker, `fontWeight: '700'` | omlijnd `1.5` `colors.winst`, stip 6x6, tekst `colors.winst`, `'700'` | zacht `colors.winst + '1A'`, geen rand, tekst `colors.winst`, `'700'` | vlak `colors.verhoogd`, geen rand, tekst `colors.tekstGedimd`, `'600'` |
| Symbool in de kop | `Type.titel` (21/600) | `Type.titel` (21/600) | `Type.sectiekop` (16/600) | `Type.sectiekop` (16/600) |
| Prijs rechtsboven | `Type.prijsGroot` | `Type.prijsGroot` | `Type.prijsGroot` | `Type.prijsGroot` in `colors.tekstGedimd` |

Vier verschillen tegelijk, in oplopende sterkte:

- **AFWACHTEN** heeft de achtergrond van het scherm zelf en geen schaduw. De kaart ligt dus letterlijk
  plat op de pagina en is alleen een omlijnd vak. Dat is geen truc maar een eerlijke weergave: er is
  niets aan de hand met deze coin. In licht is dat `#F8FAFC` met een rand `#E2E8F0`, in donker
  `#0E1117` met een rand `#2A3140`. In beide thema's blijft de rand zichtbaar, want dat is precies
  het paar dat de app overal voor randen gebruikt. De prijs dimt mee; het symbool blijft
  `colors.tekstPrimair`, want je moet nog wel kunnen zien wélke coin het is.
- **KOOPZONE** is de basiskaart: witte of donkere kaart, schaduw, geen rand, zachte groene badge.
- **STERK KOOP** krijgt daar een groene haarlijn omheen. `colors.winst + '33'` is 20 procent dekking:
  net genoeg om de kaart een tint te geven, niet genoeg om te concurreren met high conviction. De
  badge wordt omlijnd met een stip ervoor, dus het niveau is ook zonder kleur te zien.
- **HIGH CONVICTION** krijgt een volle rand van 1.5 in `colors.primair` én als enige een gevulde
  badge. Vulling tegenover omlijning is het grootste verschil dat een badge kan maken.

Het symbool in `Type.titel` bij de bovenste twee niveaus is de vierde as. Een kop van 21px tegenover
16px is op afstand zichtbaar zonder dat er kleur aan te pas komt, en het maakt de kaart die je moet
lezen ook fysiek zwaarder.

**Wat er niet bijkomt:** geen tweede gekleurde streep, geen gekleurde kaartachtergrond bij de
positieve niveaus, geen glow. De positieve kant van de ladder werkt via vulling en gewicht, de
negatieve kant via wegvallen. Als alle vier de niveaus iets extra's krijgen, roept de lijst weer even
hard als voorheen.

### 3.4 De vier kaarten naast elkaar, licht

`#` = een gevuld vlak, `=` = de kaartrand, spatie = de schermachtergrond die doorloopt.

```
  LICHT THEMA, schermachtergrond #F8FAFC

  +==================+   +------------------+   +------------------+   +------------------+
  | [##HIGH CONV·82] |   | [(o)STERK KOOP   |   | [ KOOPZONE · 61] |   | [ AFWACHTEN·38 ] |
  | ##############   |   |    · 74 ]        |   |                  |   |                  |
  |                  |   |                  |   |                  |   |                  |
  |  BTC   (E)       |   |  ETH   (E)       |   |  SOL   (E)       |   |  DOT   (E)       |
  |  Bitcoin         |   |  Ethereum        |   |  Solana          |   |  Polkadot        |
  |          $64.213 |   |          $3.058  |   |          $182,40 |   |          $ 6,41  |
  |  (21px symbool)  |   |  (21px symbool)  |   |  (16px symbool)  |   |  (16px, prijs    |
  |                  |   |                  |   |                  |   |   gedimd)        |
  |  STOP ENTRY DOEL |   |  STOP ENTRY DOEL |   |  STOP ENTRY DOEL |   |  STOP ENTRY DOEL |
  |  ====|=========  |   |  ====|=========  |   |  ====|=========  |   |  ====|=========  |
  |  R/R  RSI  VSBTC |   |  R/R  RSI  VSBTC |   |  R/R  RSI  VSBTC |   |  R/R  RSI  VSBTC |
  |  ---------------- |   |  ---------------- |   |  ---------------- |   |  ---------------- |
  |  info  getrade   |   |  info  getrade   |   |  info  getrade   |   |  info  getrade   |
  +==================+   +------------------+   +------------------+   +------------------+
   rand 1.5 #1E3A8A       rand 1 #16A34A33      geen rand             rand 1 #E2E8F0
   kaart #FFFFFF          kaart #FFFFFF         kaart #FFFFFF         kaart #F8FAFC
   schaduw                schaduw               schaduw               geen schaduw
   badge gevuld navy      badge omlijnd groen   badge zacht groen     badge vlak grijs
```

### 3.5 Dezelfde vier in donker

```
  DONKER THEMA, schermachtergrond #0E1117

  +==================+   +------------------+   +------------------+   +------------------+
  | [##HIGH CONV·82] |   | [(o)STERK KOOP   |   | [ KOOPZONE · 61] |   | [ AFWACHTEN·38 ] |
  |                  |   |    · 74 ]        |   |                  |   |                  |
  |  BTC   (E)       |   |  ETH   (E)       |   |  SOL   (E)       |   |  DOT   (E)       |
  ...
  +==================+   +------------------+   +------------------+   +------------------+
   rand 1.5 #3B82F6       rand 1 #22C55E33      geen rand             rand 1 #2A3140
   kaart #161B22          kaart #161B22         kaart #161B22         kaart #0E1117
   schaduw (elevation 2)  schaduw               schaduw               geen schaduw
   badge gevuld #3B82F6   badge omlijnd #22C55E badge zacht           badge vlak #1C2230
   badgetekst #0E1117     badgetekst #22C55E    badgetekst #22C55E    badgetekst #8B949E
```

In donker doet de schaduw op Android weinig, maar `elevation: 2` geeft nog steeds een zichtbare rand
van licht. Het echte onderscheid in donker komt van het verschil tussen `#161B22` (kaart) en
`#0E1117` (achtergrond): dat is duidelijk zichtbaar, dus AFWACHTEN valt in donker net zo goed weg
als in licht. De gevulde badge in `#3B82F6` met tekst in `colors.achtergrond` haalt AA ruim
(donkere tekst op een lichtblauw vlak), dat is dezelfde aanpak als de bestaande `vulTekst`-regel in
`AdviceBadge.tsx`.

### 3.6 Wat er verandert in code

| Bestand | Wat |
|---------|-----|
| `AdviceBadge.tsx` | nieuwe optionele prop `score?: number`, rendert `· {score}` in `Type.label` achter het label, `opacity: 0.85` behalve bij AFWACHTEN. De vier varianten blijven inhoudelijk zoals ze zijn. |
| `TradeCard.tsx` | `niveauOpmaak` levert er twee velden bij: `achtergrond` (`colors.kaart` of `colors.achtergrond`) en `kopStijl` (`Type.titel` of `Type.sectiekop`). STERK KOOP krijgt `borderWidth: 1` in `colors.winst + '33'`. De `SCORE`-kolom uit de metarij verdwijnt, `score` gaat naar de badge. |
| `SkeletonCard.tsx` | het badge-blokje wordt 108x22 in plaats van 84x22, want de badge is nu breder door het cijfer. Verder ongewijzigd. |

Niet aanraken: `LevelRow`, `ScoreBadge` (blijft elders in gebruik), `RichtingBadge`, de drempels in
`drempels.ts`, en de adviesteksten zelf.

---

## 4. Platform-indicatie rechtsboven op de tradekaart

### 4.1 Twee dingen die nu door elkaar lopen

Het woordje `ETORO` naast `STOP` in `LevelRow.tsx` betekent: *de stop-loss die je hier ziet is niet
die van Kader, maar de dichtstbijzijnde stop die eToro accepteert*. Het betekent níet "deze coin is
verhandelbaar op eToro". Dat is te lezen als een merklogo op een rare plek, en dat is precies hoe de
gebruiker het las.

De twee worden uit elkaar getrokken:

- **4.2** rechtsboven in de kaart: op welke platforms deze coin verhandelbaar is, als merkje.
- **4.3** bij STOP: dat het niveau is aangepast, zonder merknaam.

### 4.2 Het platformmerkje

Er is geen eToro-logobestand in de repo en een merklogo namaken doen we niet. Dus een eigen merkje:
een ronde chip met een monogram, per platform een vaste letter en een vaste kleur uit
`colors.verdeling` (zie het register in 2.3). Herkenbaar, uitbreidbaar, en het claimt geen andermans
merk.

```
   ,-.        ,-.  ,-.        ,-.  ,-.  ,-.
  ( E )      ( E )( B )      ( E )( B )( C )
   `-'        `-'  `-'        `-'  `-'  `-'
  1 platform  2 platforms     3 platforms
```

| Eigenschap | Waarde |
|------------|--------|
| Diameter | 20 op de tradekaart, 24 in blok 3 van het detailscherm, 16 in de coinrijen en blok 4/6 |
| Vorm | `borderRadius: radii.pill`, `alignItems`/`justifyContent: 'center'` |
| Vulling | `colors.verdeling[kleurIndex]`, of bij `kleurIndex: -1` `colors.verhoogd` met `borderWidth: 1` in `colors.rand` |
| Letter | `Fonts.sansSemiBold`, `fontSize: 11` bij 20px en 24px, `fontSize: 9` bij 16px, `letterSpacing: 0` |
| Letterkleur | `#FFFFFF` in licht, `colors.achtergrond` in donker; bij `kleurIndex: -1` altijd `colors.tekstGedimd` |
| Onderlinge afstand | `gap: 4` bij 20px, `gap: 3` bij 16px |
| Maximaal zichtbaar | 3. Meer dan 3: toon er 2 en daarachter een chip met `+{n}` in `colors.verhoogd` en `colors.tekstGedimd` |

Nieuw component: `app/src/components/PlatformChip.tsx`, met props `platform: PlatformId` en
`maat?: 16 | 20 | 24`. En `PlatformChips.tsx` (of dezelfde file met een tweede export) voor de rij,
met props `platforms: PlatformId[]` en `maat`.

De letterkleur volgt exact de `vulTekst`-regel die `AdviceBadge` al gebruikt
(`donkerActief ? colors.achtergrond : '#FFFFFF'`), want de donkere reeks in `colors.verdeling` is
licht en witte letters daarop halen geen AA.

**Plek op de tradekaart.** De bestaande `badgeRij` wordt een rij met twee kanten:

```
badgeRij: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: spacing.md,      // 12, ongewijzigd
  paddingHorizontal: spacing.base,  // 16, ongewijzigd
}
```

`alignSelf: 'flex-start'` vervalt (die zat op de rij en moet naar de badge zelf, of kan weg omdat de
rij nu de volle breedte gebruikt). Links de `AdviceBadge`, rechts de `PlatformChips`. Dat is de
bovenste 32px van de kaart, boven de koprij met symbool en prijs. De prijs staat dus onder de
merkjes en niet ernaast, met de gebruikelijke `spacing.sm` ertussen uit `styles.kop.paddingTop`.

```
+--------------------------------------------------+
|  [ STERK KOOP · 74 ]                    (E) (B)  |   <- 12px boven, 16px opzij
|                                                  |
|  ETH  *                              $3.058,10   |
|  Ethereum                                        |
+--------------------------------------------------+
```

**Geen koppeling, of geen platform bekend.** `handelbaarOp(symbool)` geeft terug waar een coin
verhandelbaar is; dat is kennis uit Kaders eigen lijsten en hangt niet af van een koppeling. Voor
alles in `STANDAARD_UNIVERSUM` is dat `['etoro']`. Geeft de functie een lege lijst terug (een coin
uit de kansen-scanner die nergens in een lijst staat), dan wordt er **niets** gerenderd: geen
placeholder, geen streepje, geen grijze chip. Een lege plek is eerlijk; een grijze chip zou beweren
dat er een platform is.

Merk op dat het merkje op de tradekaart iets anders betekent dan op het detailscherm: hier
"verhandelbaar op", daar "je positie staat op". Dat is geen probleem zolang de schermlezerlabels het
verschil maken, en dat doen ze:

- tradekaart: `Verhandelbaar op eToro` / `Verhandelbaar op eToro en Bitvavo` /
  `Verhandelbaar op eToro, Bitvavo en 2 andere`
- detailscherm: het chiplabel zit in het rijlabel, in de vorm `BTC, op eToro, ...`

De chips zelf zijn niet aantikbaar, dus de 44px-eis geldt er niet voor. Ze zitten in een `View` met
`accessible` en het bovenstaande label; de losse chips krijgen `accessibilityElementsHidden`.

### 4.3 De stop-aanpassing bij STOP

Het woord `ETORO` verdwijnt uit `LevelRow.tsx`. Wat er moet blijven staan is: dit getal is niet dat
van Kader, het is opgeschoven. Drie opties:

| Optie | Voorbeeld | Oordeel |
|-------|-----------|---------|
| A. Alleen een icoon | `STOP (i)` | Te stil. Een informatie-icoontje van 11px naast een overline valt weg, en het zegt niet wát er anders is. |
| B. Woord zonder pil | `STOP AANGEPAST` | Leest als één label ("stop aangepast" als naam van het niveau) in plaats van als twee dingen. |
| C. Pil naast het label | `STOP [AANGEPAST]` | Duidelijk twee dingen, kan nooit voor een logo doorgaan (het is een woord, geen letter in een rondje), en het is een vorm die de app al kent van de `DEMO`-pil. Gekozen. |

Uitwerking, in `LevelRow.tsx` op de plek van het huidige `ETORO`-tekstje:

```
pil: {
  borderRadius: radii.pill,
  paddingHorizontal: 5,
  paddingVertical: 1,
  backgroundColor: colors.letOp + '1A',
}
tekst: Type.label, fontSize: 9, color: colors.letOp, letterSpacing: 0.4
```

Label: `AANGEPAST`. Bij een short staat de pil rechts, aan de kant van het STOP-label, precies zoals
de bestaande `stopAangepast`-logica dat al regelt.

Schermlezerlabel op de pil: `Stop-loss aangepast naar de grens die eToro toestaat`.

Waarom `AANGEPAST` en niet `GRENS` of `ETORO-GRENS`: `AANGEPAST` zegt wat er met het getal is
gebeurd, en dat is de informatie die je op de kaart nodig hebt. Het waaróm (eToro accepteert Kaders
niveau niet) staat al voluit in de uitklap, in `niveaus.uitleg`, in `colors.letOp`. Daar is ruimte
voor een hele zin, op de kaart niet. En zonder merknaam kan de pil onmogelijk voor een
platformmerkje doorgaan, wat de hele aanleiding was.

De kleur blijft `colors.letOp`: dit is een let-op en geen fout. Kleur is niet het enige signaal, want
er staat een woord in.

---

## 5. Implementatiechecklist

### Nieuwe bestanden

| Pad | Wat |
|-----|-----|
| `app/src/engine/platforms.ts` | `PlatformId`, `PlatformInfo`, `PLATFORMS`, `platformVanTrade()`, `handelbaarOp()`. Puur, met zelftest onder `require.main` zoals `verdeling.ts`. |
| `app/src/components/PlatformChip.tsx` | `PlatformChip` (één chip, maat 16/20/24) en `PlatformChips` (rij, maximaal 3 zichtbaar plus `+n`). |
| `app/src/components/VerdelingScherm.tsx` | Het full-screen scherm uit punt 2, patroon van `HistorieScherm.tsx`. |

### Gewijzigde bestanden

| Pad | Wat |
|-----|-----|
| `app/src/engine/verdeling.ts` | erbij: `CoinRegel`, `PlatformRegel`, `KruisRegel`, `NietGewogen`, `VolledigeVerdeling`, `berekenVolledigeVerdeling()`, `duidingen()`. Zelftest uitbreiden, inclusief de assertie dat `totaalUsd`, `gewaardeerd` en `zonderLivePrijs` gelijk zijn aan die van `berekenVerdeling` op dezelfde invoer. |
| `app/src/components/VerdelingKaart.tsx` | legenda naar één kolom met vaste kolommen (1.4); `<0,1%`-regel; uitklap eruit (`uitgeklapt`, `LayoutAnimation`, `useReduceMotion`, `celVol`, `lidRij`, `lidLabel`, `lidRest`, `uitklapKnop`, `uitklapLabel`, `MAX_ZICHTBARE_LEDEN`); hele kaart in een `Pressable` met `onOpenDetail`; affordance-rij onderaan; nieuwe prop `onOpenDetail: () => void`. |
| `app/src/screens/PortfolioScreen.tsx` | state `verdelingOpen`, `onOpenDetail` doorgeven aan `VerdelingKaart`, `<VerdelingScherm>` renderen naast `<HistorieScherm>` (rond regel 1283). |
| `app/src/components/AdviceBadge.tsx` | optionele prop `score?: number`, gerenderd als `· {score}` in `Type.label` met `opacity: 0.85` (niet bij AFWACHTEN). |
| `app/src/components/TradeCard.tsx` | `niveauOpmaak` levert `achtergrond` en `kopStijl` mee; STERK KOOP krijgt `borderWidth: 1` in `colors.winst + '33'`; AFWACHTEN krijgt `colors.achtergrond` als kaartkleur en een gedimde prijs; symbool in `Type.titel` bij de bovenste twee niveaus; `badgeRij` wordt `space-between` met `PlatformChips` rechts; `SCORE`-kolom uit de metarij; `score={Math.round(trade.score)}` naar de badge. |
| `app/src/components/LevelRow.tsx` | `ETORO`-tekst vervangen door de `AANGEPAST`-pil uit 4.3, met schermlezerlabel. |
| `app/src/components/SkeletonCard.tsx` | badge-blokje van 84x22 naar 108x22. |

### Waarden om niet te vergeten

- Legenda-percentagekolom: `width: 46`, `textAlign: 'right'`, `Type.label`, `colors.tekstPrimair`.
- Legenda-bedragkolom: `minWidth: 78`, `textAlign: 'right'`, `Type.prijs` `fontSize: 12`, `colors.tekstGedimd`.
- Ring op het detailscherm: `RING_MAAT = 132`, `STRAAL = 51`, `DIKTE = 19`, `OMTREK = 2 * Math.PI * 51`.
- Staafje in blok 2 en 3: `height: 3`, `borderRadius: radii.pill`, track `colors.verhoogd`, vulling minimaal 2px breed.
- Chipmaten: 20 op de tradekaart, 24 in blok 3, 16 elders. Letter 11px (9px bij maat 16).
- `AANGEPAST`-pil: `fontSize: 9`, `colors.letOp` op `colors.letOp + '1A'`, `paddingHorizontal: 5`.
- STERK KOOP-rand: `colors.winst + '33'`.

### Verificatie met de `run-android`-skill, licht én donker

1. Portfolio: legenda staat in één kolom, alle percentages recht onder elkaar tegen de rechtermarge.
2. Portfolio met meer dan zeven coins: `Overig (n)` staat in de legenda, er is geen uitklapknop meer,
   en de rij `Alle posities en platforms` staat onderaan de kaart.
3. Kaart aantikken opent `VerdelingScherm`; de Android-terugknop sluit het.
4. Op het detailscherm: het bedrag in blok 1 is exact gelijk aan het bedrag in het gat van de ring op
   de kaart.
5. Detailscherm met posities uit twee bronnen: blok 3 toont twee platforms, blok 4 toont alleen de
   coins die op beide staan.
6. Detailscherm met één positie: blok 4 is weg, blok 3 heeft één regel, blok 5 zegt `Alles staat in X.`
7. Detailscherm met een positie zonder aantal of live koers: blok 6 noemt hem bij naam met de reden.
8. Markt: de vier niveaus naast elkaar in één lijst. AFWACHTEN ligt plat op de achtergrond,
   HIGH CONVICTION springt eruit, en het scorecijfer staat alleen nog in de badge.
9. Markt: rechtsboven op elke kaart één chip `(E)`, niet naast STOP.
10. Een coin waarvan eToro de stop opschuift: bij STOP staat de pil `AANGEPAST` en nergens meer het
    woord ETORO.

### Changelog

Dit zijn zichtbare wijzigingen, dus `CHANGELOG.md` en `app/src/changelog.ts` moeten allebei bij,
nieuwste bovenaan, in het Nederlands. Het versienummer pas toekennen op het moment dat er echt een
release-APK gebouwd wordt.
