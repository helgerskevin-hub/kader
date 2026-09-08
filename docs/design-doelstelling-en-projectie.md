# Design: doelstelling en projectie (fase 2)

Ontwerpspec voor de vier taken van fase 2 uit `TODO.md`: een doelverdeling instellen, de afwijking
daarvan tonen, een bijstortplan en een projectie. Alles staat in tokenwaarden uit
`app/src/theme/tokens.ts` en stijlen uit `app/src/theme/typography.ts`. Waar een waarde niet uit een
token komt, staat het er expliciet bij. Alle gebruikerstekst hieronder is letterlijk overneembaar:
Nederlands, nuchter, geen em-dashes.

Uitgangspunten die overal gelden:

- React Native, alleen `react-native`, `react-native-svg` en `lucide-react-native`. Geen nieuwe
  libraries.
- Kleur is nooit het enige signaal. Elk gekleurd element heeft een naam, een letter, een cijfer of
  een vorm naast zich.
- Raakvlakken minimaal 44px, schermlezerlabels in het Nederlands.
- Licht en donker moeten allebei kloppen.
- Nooit een verzonnen getal. Ontbreekt de invoer (geen doel, geen kapitaal, geen live koers), dan is
  de lege staat met uitleg het ontwerp, precies zoals bij het vrije saldo op `PortfolioStatusKaart`
  en het handelskapitaal op `BlootstellingKaart`.
- Moet kloppen bij 0 posities, bij 1 positie en bij 25 posities.
- Het woord "advies" komt nergens voor bij het bijstortplan. Het is een rekensom op het doel dat de
  gebruiker zelf heeft ingevuld, geen aanbeveling van Kader.

Nog alleen crypto, geen nieuwe databron. Alle bedragen in dollars, weergegeven via de bestaande
`fmtBedrag`/valuta-laag (`useValutaStand`), net als de rest van de app.

---

## 0. Waar dit vandaan komt en waar het staat

`docs/design-portfolio-dashboard.md` §1.7 reserveert twee plekken voor fase 2: "een markering op de
belegd/beschikbaar-balk" (`PortfolioStatusKaart`) en "een Nu/Doel-schakelaar rechts in de kop van de
verdelingkaart" (`VerdelingKaart`). Deze spec gebruikt de tweede. De eerste blijft ongebruikt: de
belegd/beschikbaar-balk gaat over posities tegenover vrij saldo bij één platform, en een doelverdeling
gaat over de verdeling ÍN je posities. Dat zijn twee verschillende noemers en een markering daar zou
beweren dat ze hetzelfde meten. Wordt in een latere fase alsnog gebruikt, of blijft leeg; niet nu.

Alles hieronder hangt aan drie nieuwe schermdelen, in oplopende diepte:

1. **`VerdelingKaart`** krijgt een Nu/Doel-schakelaar. "Nu" is de bestaande ring en legenda,
   ongewijzigd. "Doel" toont, als er een doel is, per categorie de afwijking; is er geen doel, dan
   staat er een korte uitleg met een knop.
2. **`DoelSheet`** (nieuw, `BottomSheet`) is waar je het doel zelf invult en wijzigt.
3. **`DoelScherm`** (nieuw, full-screen zoals `VerdelingScherm` en `HistorieScherm`) is het volledige
   overzicht: je doelverdeling, het bijstortplan en de projectie. Bereikbaar via de affordance-rij
   onderaan `VerdelingKaart` wanneer die op "Doel" staat.

## 0.1 Wat er niet in past: buckets versus coins

De TODO noemt als voorbeeld "60% BTC, 20% ETH, 20% alt". Drie manieren om dat in te vullen zijn
overwogen.

**Optie A: drie vaste vakken (BTC/ETH/Alt).** Sluit letterlijk aan bij het voorbeeld, maar "alt" is
geen coin: het zou een aparte definitie nodig hebben van welke van de 57 coins in `STANDAARD_UNIVERSUM`
daaronder vallen, en die lijst verandert mee met het universum. Ook onbruikbaar zodra iemand een
specifiek doel voor SOL wil naast BTC en ETH. Niet gekozen.

**Optie B: een doel per coin, verplicht voor elke coin die je bezit.** Zuiver, maar onwerkbaar bij 25
posities: niemand vult 25 percentages in die precies bij zijn actuele bezit passen, en een nieuwe coin
kopen zou eerst een doel-update vereisen. Niet gekozen.

**Optie C: vrije coins plus een impliciete Overig-categorie.** Je vult in wat je bewust wilt sturen
(`BTC 30`, `ETH 25`, eventueel `SOL 10`), en de rest van de 100 procent valt automatisch onder
`Overig`, precies dezelfde `OVERIG_SLEUTEL` die `VerdelingKaart` al gebruikt voor coins buiten de top
zes. Gekozen. Dit is het "alt"-vak uit het voorbeeld, alleen eerlijk benoemd: het is niet één coin,
het is "de rest", en dat is precies wat het in de praktijk ook is. Het schaalt vanzelf: één rij volstaat
voor een doel als "60% BTC, rest vrij" en het blijft werken bij een portfolio van 25 coins zonder dat
het doel zelf ooit meer dan een paar rijen hoeft te tellen.

Consequentie: `Overig` is nooit een invoerbaar veld. Het is altijd `100 − som(ingevulde percentages)`,
dus het doel telt per constructie altijd op tot 100. De vraag "wat gebeurt er als het niet optelt tot
100" beantwoordt zich daarmee vanzelf: het kán niet, behalve als de ingevulde percentages zelf al boven
100 uitkomen, en dat blokkeert het opslaan (zie §2).

---

## 1. Engine (`app/src/engine/doelstelling.ts`, nieuw)

Puur, geen React, in de stijl van `verdeling.ts` met een `require.main`-zelftest eronder. Leunt op
`OVERIG_SLEUTEL` en de formatters uit `verdeling.ts`.

```ts
export interface DoelRegel {
  sleutel: string;   // coinsymbool, hoofdletters, bijv. 'BTC'
  doelPct: number;   // 0 < doelPct <= 100
}

// Overig zit hier NIET expliciet in. Het is altijd 100 - som(doelPct), berekend waar nodig.
export type Doelverdeling = DoelRegel[];

export interface AfwijkingRegel {
  sleutel: string;              // symbool, of OVERIG_SLEUTEL
  label: string;                 // 'BTC', of 'Overig'
  doelPct: number;
  actueelPct: number;
  actueelUsd: number;
  afwijkingPct: number;          // actueelPct - doelPct
  status: 'op-doel' | 'te-zwaar' | 'te-licht';
  ernst: 'mild' | 'flink';       // alleen betekenisvol als status !== 'op-doel'
}

// Binnen deze marge (procentpunt) telt een categorie als op doel, ongeacht het teken.
export const OP_DOEL_MARGE = 1;
// Boven deze marge (procentpunt) krijgt de afwijking het "let op"-gewicht. Een keuze, geen norm,
// net als CONCENTRATIE_DREMPEL in verdeling.ts.
export const AFWIJKING_FLINK = 5;

export function berekenAfwijking(
  doel: Doelverdeling,
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
): { regels: AfwijkingRegel[]; totaalUsd: number };

export interface BijstortRegel {
  sleutel: string;
  label: string;
  bedragUsd: number;    // toegewezen deel van de inleg
  nieuwPct: number;     // aandeel van deze categorie in het totaal NA de inleg
}

export function berekenBijstortplan(
  doel: Doelverdeling,
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
  inlegUsd: number,
): BijstortRegel[];

export interface ProjectiePunt {
  jaar: number;            // 0..jaren
  totaalWaarde: number;    // met het ingevulde rendement
  ingelegdWaarde: number;  // dezelfde opbouw maar zonder rendement (referentielijn)
}

export function berekenProjectie(
  huidigeWaardeUsd: number,
  maandelijkseInlegUsd: number,
  rendementPctPerJaar: number,
  jaren: number,
): ProjectiePunt[];   // één punt per jaar, inclusief jaar 0

// '+4,3pp' / '−3,2pp' / '0,0pp'. Procentpunt en niet procent: het gaat over het verschil tussen twee
// percentages, en "4,3%" zou lezen als 4,3 procent van iets, niet als 4,3 punten verschil.
export function fmtAfwijkingPp(pp: number): string;
```

### 1.1 Afwijking

`totaalUsd` en de weegregels zijn identiek aan `berekenVerdeling` uit `verdeling.ts`: alleen open
trades met een aantal én een live prijs tellen mee, waarde is marktwaarde (`livePrijs * aantalCoins`),
een short telt als omvang. Bewuste keuze: de Doel-weergave moet tegen dezelfde noemer aflezen als de
Nu-weergave op dezelfde kaart, anders klopt een omschakeling niet met wat je net zag.

Voor elke regel in `doel` is `actueelPct` het aandeel van dat symbool in `totaalUsd`. Voor `Overig` is
`actueelPct` het aandeel van alle symbolen die niet in `doel` genoemd staan, en `doelPct` is
`100 − som(doel.doelPct)`. `Overig` staat altijd als laatste regel, ongeacht zijn percentage: dezelfde
volgorde-afspraak als in de bestaande legenda.

Status:

```
|afwijkingPct| <= OP_DOEL_MARGE        -> 'op-doel'
afwijkingPct > OP_DOEL_MARGE           -> 'te-zwaar'
afwijkingPct < -OP_DOEL_MARGE          -> 'te-licht'

|afwijkingPct| > AFWIJKING_FLINK       -> ernst 'flink', anders 'mild'
```

Geen posities die aan `doel` voldoen (`totaalUsd === 0`): elke `actueelPct` is 0, dus alles behalve
een doel van precies 0 procent staat op `te-licht`. Dat is geen bijzonder geval in de code, het volgt
gewoon uit de formule; wél bijzonder voor de UI, zie §3.4.

### 1.2 Bijstortplan

Twee stappen, in vaste volgorde, zodat het een rekensom blijft en geen optimalisatie:

1. **Tekorten aanvullen.** Voor elke categorie is `doelUsd = doelPct/100 * (totaalUsd + inlegUsd)` en
   `tekortUsd = max(0, doelUsd − actueelUsd)`. Is `som(tekortUsd) <= inlegUsd`, dan krijgt elke
   categorie precies haar tekort.
   Is `som(tekortUsd) > inlegUsd` (de inleg is te klein om alle tekorten te dichten), dan krijgt elke
   categorie een aandeel naar rato van haar eigen tekort: `bedragUsd = tekortUsd / som(tekortUsd) *
   inlegUsd`. De categorie die het verst onder haar doel zit krijgt zo verhoudingsgewijs het meest,
   maar niemand krijgt meer dan waar hij naartoe moet.
2. **Rest verdelen naar doel.** Blijft er geld over nadat alle tekorten gedicht zijn (`som(tekortUsd)
   < inlegUsd`), dan gaat de rest naar rato van `doelPct` over alle categorieën, inclusief de
   categorieën die al op of boven hun doel zaten. Reden: als je doel al gehaald is voor deze maand,
   is er geen reden meer om die categorie over te slaan, en je eigen doelverdeling is de enige regel
   die er dan nog is om de rest te verdelen.

`nieuwPct = (actueelUsd + bedragUsd) / (totaalUsd + inlegUsd) * 100`.

Bij `totaalUsd === 0` (geen posities) is elke `tekortUsd` gelijk aan `doelUsd`, en omdat `doel`
optelt tot 100 procent is `som(tekortUsd)` precies gelijk aan `inlegUsd`. Stap 1 verdeelt dan de hele
inleg exact naar de doelverhouding en stap 2 heeft niets meer te verdelen. Dat is het "begin vanaf
nul"-geval en het volgt vanzelf uit dezelfde formule, geen aparte tak in de code.

### 1.3 Projectie

`r_jaar = rendementPctPerJaar / 100`, `r_maand = (1 + r_jaar)^(1/12) − 1` (behalve bij
`rendementPctPerJaar === 0`, dan is `r_maand = 0`). Voor elk jaar `t` van 0 tot `jaren`, met
`n = t * 12` maanden:

```
totaalWaarde   = huidigeWaardeUsd * (1 + r_jaar)^t
               + maandelijkseInlegUsd * (((1 + r_maand)^n − 1) / r_maand) * (1 + r_maand)   [r_maand != 0]
               + maandelijkseInlegUsd * n                                                    [r_maand == 0]

ingelegdWaarde = huidigeWaardeUsd + maandelijkseInlegUsd * n
```

`ingelegdWaarde` is dezelfde opbouw zonder enig rendement: puur wat je zelf hebt ingelegd plus je
startbedrag. Het verschil tussen de twee lijnen op jaar `t` is dus exact het aangenomen rendement, en
dat is precies wat de grafiek in §5 laat zien.

### 1.4 Zelftest, kernpunten

Naast de gebruikelijke `console.assert`-stijl: een doel dat optelt tot 100 blijft dat na
`berekenAfwijking` (som van `doelPct` inclusief Overig is 100); bij een lege `doel`-array is er precies
één regel (`Overig`, 100 procent doel); een tekort groter dan de inleg verdeelt de hele inleg zonder
rest; een inleg groter dan alle tekorten samen laat niets ongebruikt; `berekenProjectie` met
`rendementPctPerJaar = 0` geeft `totaalWaarde === ingelegdWaarde` op elk punt; jaar 0 geeft altijd
`totaalWaarde === huidigeWaardeUsd` en `ingelegdWaarde === huidigeWaardeUsd`.

---

## 2. Opslag en hooks

Nieuwe sleutels in `app/src/storage/opslag.ts` (`SLEUTELS`):

| Sleutel | Vorm | Betekenis |
|---------|------|-----------|
| `doelverdeling` | JSON (`laadObject`/`bewaarObject`) | `Doelverdeling`, `[]` of ontbrekend = geen doel |
| `maandelijkseInleg` | tekst (`laadTekst`/`bewaarTekst`) | inleg in dollars, zelfde patroon als `handelskapitaal` |
| `verwachtRendement` | tekst | rendement in procent per jaar, kan negatief |
| `projectieJaren` | tekst | laatst gekozen periode uit de jaren-chips |

Drie hooks, elk in de stijl van `useHandelskapitaal.ts`:

- **`app/src/state/useDoelverdeling.ts`**: `{ doel: Doelverdeling, zetDoel: (d: Doelverdeling) =>
  Promise<void>, geladen: boolean }`. `zetDoel([])` wist de sleutel (net als `zetKapitaal(null)`).
- **`app/src/state/useMaandelijkseInleg.ts`**: `{ inleg: number | null, zetInleg: (n: number | null)
  => Promise<void>, geladen: boolean }`. Één op één `useHandelskapitaal.ts`, alleen de sleutel en de
  naam anders.
- **`app/src/state/useProjectieInstellingen.ts`**: bundelt rendement en jaren, want die twee worden
  alleen samen gebruikt voor de grafiek: `{ rendementPct: number | null, jaren: number, zetRendement:
  (n: number | null) => Promise<void>, zetJaren: (n: number) => Promise<void>, geladen: boolean }`.
  Standaard `jaren = 5` als er nog nooit gekozen is; `rendementPct` start op `null` (leeg), er wordt
  nooit een percentage voorgevuld. Een voorgevuld rendement zou lezen als een verwachting van Kader,
  en die heeft de app niet.

---

## 3. `VerdelingKaart`: de Nu/Doel-schakelaar

### 3.1 Waarom de kaart een structuurwijziging nodig heeft

De hele kaart is vandaag één `Pressable` (kop, ring, legenda en de ingang-rij samen), met opzet: de
vorige spec verwierp expliciet een aparte knop naast een aantikbare kaart als "een raakvlakconflict".
Een Nu/Doel-schakelaar is zelf ook een tikbaar element, en die zou binnen diezelfde grote `Pressable`
precies dat conflict opnieuw invoeren: de kop zou zowel "wissel van weergave" als "open het volledige
overzicht" tegelijk betekenen, afhankelijk van welk deel van de kop je raakt.

De oplossing is de kop uit de `Pressable` te halen. Niet de hele kaart plat maken: de ring, de
legenda (of straks de afwijkingsrijen) en de ingang-rij blijven één aantikbaar gebied, alleen de kop
erboven niet meer.

```
<View kaart>                              <- was Pressable, wordt View
  <View kop>                              <- NIEUW: buiten de Pressable
    VERDELING VAN JE POSITIES     [Nu][Doel]
  </View>

  <Pressable onPress={actief === 'nu' ? onOpenDetail : onOpenDoel}>
    ...ring/legenda of afwijkingsrijen, afhankelijk van actief...
    ...ingang-rij, tekst verandert mee met actief...
  </Pressable>
</View>
```

De `pressed`-opacity (`0.96`) verhuist mee naar deze binnenste `Pressable`; de kop krijgt geen eigen
druk-effect, alleen de twee schakelaarknoppen zelf (zie 3.2).

### 3.2 De schakelaar

Twee knoppen in een pil, hetzelfde patroon als `WeergaveSchakelaar` in `PortfolioScreen.tsx`
(uitgebreid/compact):

```
kop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }

wrapper: { flexDirection: 'row', backgroundColor: colors.verhoogd, borderRadius: radii.knop, padding: 2, gap: 2 }
knop:    { minHeight: 28, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radii.knop - 2 }
actief:  { backgroundColor: colors.kaart }
```

Label `Type.caption` met `fontWeight: '600'`, `colors.tekstPrimair` als actief, `colors.tekstGedimd`
anders. Tekst "Nu" / "Doel". `hitSlop={6}` op elke knop zodat het raakvlak ruim boven de 28px visuele
hoogte uitkomt richting de 44px-norm; de twee knoppen staan dicht bij elkaar, dus een volle 44px per
knop zou ze laten overlappen.

`accessibilityRole="button"`, `accessibilityState={{ selected: actief === 'nu' }}` (resp. `'doel'`),
labels `Huidige verdeling tonen` / `Doelverdeling tonen`.

`actief` is lokale state (`useState<'nu' | 'doel'>('nu')`), niet bewaard tussen sessies. Bewust: dit
is een lichte weergavewissel en geen instelling, en het standaardbeeld van de kaart moet de ring
blijven die iedereen uit fase 1 kent, ook als je de vorige keer op Doel stond.

### 3.3 Inhoud bij "Doel", met een doel ingesteld

Vervangt de ring en de legenda. Geen ring hier: bij zeven categorieën zou een tweede donut naast de
eerste vooral verwarren over welke ring bij welk getal hoort, en de rijenvorm hieronder laat zowel het
getal als de afwijking in één oogopslag zien, wat een ring niet kan.

Per regel uit `berekenAfwijking`, in dezelfde volgorde als het doel (Overig laatst):

```
+-----------------------------------------------------+
|  VERDELING VAN JE POSITIES              [Nu][Doel]  |
|                                                       |
|  [#] BTC                              TE ZWAAR ·+4,3pp |
|      =====================|=========================  |
|      Nu 34,3% · $4.812,40           Doel 30,0%       |
|                                                       |
|  [#] ETH                              TE LICHT ·−3,2pp |
|      ===============|=================================  |
|      Nu 21,8% · $3.058,10           Doel 25,0%       |
|                                                       |
|  [.] Overig                                 OP DOEL  |
|      ====================|============================  |
|      Nu 43,9% · $6.153,30           Doel 45,0%       |
|                                                       |
|  Doel, bijstorten en projectie                  >    |
+-----------------------------------------------------+
```

**Regel 1** (`flexDirection: 'row'`, `alignItems: 'center'`, `gap: spacing.sm`): kleurvierkantje 9x9
(`colors.verdeling[i]` voor de eerste zes doelregels op volgorde, `colors.verdelingOverig` voor
Overig, zelfde toewijzing als de bestaande legenda), symbool (`Type.caption`, `fontWeight: '600'`,
`colors.tekstPrimair`), vulling (`flex: 1`), dan de statuspil rechts uitgelijnd.

**Statuspil**, drie staten:

| Status | Ernst | Tekst | Achtergrond | Tekstkleur |
|--------|-------|-------|-------------|------------|
| `op-doel` | — | `OP DOEL` | `colors.verhoogd` | `colors.tekstGedimd` |
| `te-zwaar` / `te-licht` | `mild` | `TE ZWAAR` / `TE LICHT` `· {fmtAfwijkingPp}` | `colors.verhoogd` | `colors.tekstPrimair`, `fontWeight: '600'` |
| `te-zwaar` / `te-licht` | `flink` | `TE ZWAAR` / `TE LICHT` `· {fmtAfwijkingPp}` | `colors.letOp + '1A'` | `colors.letOp` |

`Type.label` (11px mono, tabular) voor het cijfer-suffix, `Type.caption` `fontSize: 10` `fontWeight:
'700'` `letterSpacing: 0.4` voor het woord zelf, in één `Text`-element zoals de `AANGEPAST`-pil uit
`docs/design-verdeling-en-kaartindicatie.md` §4.3. `borderRadius: radii.pill`, `paddingHorizontal:
8`, `paddingVertical: 3`. Nergens `colors.winst` of `colors.verlies`: een afwijking van je eigen doel
is geen resultaat, dezelfde reden waarom de ring zelf al geen groen of rood gebruikt.

**Regel 2, het staafje.** Zelfde opbouw als de staven in `VerdelingScherm`: track `colors.verhoogd`,
`height: 3`, `borderRadius: radii.pill`, `marginTop: 5`, `marginLeft: 17` (kleurvierkantje 9 plus gap
8). Vulling tot `actueelPct` in de kleur van het vierkantje, minimaal 2px breed. Daarbovenop, als
losse laag op dezelfde track, een verticale streep van 2px breed en 3px hoog op de positie van
`doelPct`, in `colors.tekstPrimair` (dezelfde `streep`-techniek als `BlootstellingKaart.Balk`, waar
de plafondlijn ook zo getekend wordt). De vulling laat zien waar je nu staat, de streep waar je doel
ligt; het gat ertussen is precies wat de statuspil in woorden zegt.

**Regel 3**, `Type.caption` `color: colors.tekstGedimd`, `marginTop: 4`, `marginLeft: 17`,
`flexDirection: row`, `justifyContent: space-between`: links `Nu {aandeelTekst(actueelPct/100)} ·
{fmtBedrag(actueelUsd)}`, rechts `Doel {aandeelTekst(doelPct/100)}`.

`rowGap: spacing.base` tussen regel-groepen.

### 3.4 Inhoud bij "Doel", zonder posities die meetellen

Zelfde als de bestaande "geen live koersen"-staat van de Nu-weergave, hergebruikt: elke `actueelPct`
is dan 0 en elke categorie (behalve een toevallig doel van 0 procent) staat op `te-licht`. Dat is
technisch correct maar leest raar als eerste indruk ("alles te licht"), dus een aparte melding in
plaats van de rijen:

> Kader heeft nog geen live koersen om je posities tegen je doel af te zetten. De afwijking
> verschijnt na de eerste sync.

`Type.caption`, `colors.tekstGedimd`, gecentreerd, zelfde plek en opmaak als de bestaande tekst bij
`gewaardeerd === 0` in de Nu-weergave.

### 3.5 Inhoud bij "Doel", zonder doel

Geen rijen, geen `Pressable` om dit stuk heen (zie 3.1: zonder doel is er niets om naar door te
klikken, dus geen impliciete kaart-tap hier). In plaats daarvan een expliciete knop, in dezelfde vorm
als de "Handelskapitaal invullen"-knop op `BlootstellingKaart`:

```
+-----------------------------------------------------+
|  VERDELING VAN JE POSITIES              [Nu][Doel]  |
|                                                       |
|            (target-icoon, 28px, tekstGedimd)         |
|                                                       |
|   Je hebt nog geen doelverdeling ingesteld. Vul in    |
|   welk percentage je in welke coin wil hebben, dan    |
|   laat Kader zien waar je te zwaar of te licht zit.   |
|                                                       |
|            [ Doel instellen ]                         |
+-----------------------------------------------------+
```

Icoon `Target` (lucide) 28px, `colors.tekstGedimd`, `strokeWidth: 1.5`, `alignSelf: center`,
`marginTop: spacing.base`. Tekst `Type.caption`, `colors.tekstGedimd`, `textAlign: center`,
`marginTop: spacing.sm`, `lineHeight: 18`, `paddingHorizontal: spacing.lg`. Knop: omlijnd,
`borderColor: colors.cta`, `borderWidth: StyleSheet.hairlineWidth`, tekst `colors.cta`
`fontWeight: 600`, `minHeight: 44`, `alignSelf: center`, `marginTop: spacing.base`,
`paddingHorizontal: spacing.lg`, `borderRadius: radii.knop`. Opent `DoelSheet` direct (niet via
`DoelScherm`: dit is de kortste weg naar een eerste doel).

### 3.6 Toegankelijkheid van de kaart

- De schakelaarknoppen: zie 3.2.
- Elke afwijkingsrij krijgt `accessible` met één label:
  `BTC, nu 34,3 procent, doel 30,0 procent, 4,3 procentpunt te zwaar.` (bij `op-doel`:
  `..., op doel.`) Kleurvierkantje en staafje krijgen `accessibilityElementsHidden`.
- De binnenste `Pressable` (ring/legenda of afwijkingsrijen plus ingang-rij) behoudt zijn bestaande
  `accessibilityRole="button"` en `accessibilityHint`, met een label dat meewisselt:
  `Verdeling in detail bekijken` bij Nu, `Doel, bijstorten en projectie bekijken` bij Doel.
- De "Doel instellen"-knop in de lege staat: `accessibilityRole="button"`,
  `accessibilityLabel="Doelverdeling instellen"`.

### 3.7 Wat er verandert in code

| Bestand | Wat |
|---------|-----|
| `app/src/components/VerdelingKaart.tsx` | kop uit de buitenste `Pressable` gehaald (structuur uit 3.1); nieuwe lokale state `actief`; nieuwe props `doel: Doelverdeling`, `onOpenDoel: () => void`; Doel-weergave uit 3.3 tot 3.5; ingang-rij tekst wisselt mee. Ring/legenda-code van de Nu-weergave blijft ongewijzigd. |
| `app/src/screens/PortfolioScreen.tsx` | `useDoelverdeling()` erbij, `doel` en `onOpenDoel={() => setDoelOpen(true)}` doorgeven aan `VerdelingKaart`; nieuwe state `doelOpen`; `<DoelScherm>` renderen naast `<VerdelingScherm>`. |

De render-conditie van de kaart (`if (gewaardeerd + zonderLivePrijs === 0) return null`) wordt
`if (gewaardeerd + zonderLivePrijs === 0 && doel.length === 0) return null`. Bij 0 posities zonder
doel blijft de kaart verborgen, precies zoals in fase 1. Heb je al wel een doel ingesteld, bijvoorbeeld
nadat je al je posities hebt gesloten, dan blijft de kaart staan (in de Doel-weergave, met de
"geen live koersen"-tekst uit 3.4 als er ook nul posities zijn) zodat een eerder ingesteld doel niet
zomaar uit beeld verdwijnt. Voor het allereerste doel instellen bij een leeg portfolio bestaat geen
apart ingangspunt: dat is een bewuste grens, geen omissie, zie §8.

---

## 4. `DoelSheet` (nieuw, `BottomSheet`)

Bestand: `app/src/components/DoelSheet.tsx`. Props: `zichtbaar`, `doel: Doelverdeling`, `onOpslaan:
(doel: Doelverdeling) => void`, `onSluiten: () => void`.

### 4.1 Opbouw

```
+-----------------------------------------------------+
|  Doelverdeling                                  [X] |
|                                                       |
|  Welk percentage van je crypto wil je in welke coin   |
|  hebben? De rest valt onder Overig.                   |
|                                                       |
|  [ BTC        ]  [ 30 ]%                        [x]  |
|  [ ETH        ]  [ 25 ]%                        [x]  |
|  [ SOL        ]  [ 10 ]%                        [x]  |
|                                                       |
|  + Coin toevoegen                                     |
|                                                       |
|  --------------------------------------------------- |
|  Overig                                       35,0%  |
|  Totaal                                      100,0%  |
|                                                       |
|  [        Doel opslaan        ]                       |
|                                                       |
|             Doel verwijderen                          |
+-----------------------------------------------------+
```

Titelrij en sluitkruis zoals `KapitaalSheet`. Uitlegtekst `Type.body`, `colors.tekstGedimd`,
`lineHeight: 22`, kort gehouden om dezelfde reden als bij `KapitaalSheet`: met het toetsenbord open
moet alles boven de knop passen.

**Rij** (per `DoelRegel`, `flexDirection: row`, `alignItems: center`, `gap: spacing.sm`,
`marginTop: spacing.sm`):

- Symboolveld: `flex: 1`, zelfde `inputStyle` als `TradeFormulier` (`colors.verhoogd` achtergrond,
  `colors.rand` rand, `minHeight: 44`), `autoCapitalize="characters"`, `autoCorrect={false}`,
  placeholder `bijv. BTC`.
- Percentageveld: `width: 72`, zelfde `inputStyle`, `keyboardType="decimal-pad"`, placeholder `30`.
  Geen apart `%`-teken in het veld zelf (dat zou de invoerbreedte extra inperken); het `%`-teken staat
  vast rechts ernaast, `Type.body`, `colors.tekstGedimd`, buiten het veld.
- Verwijderknop: `X` 18px, `colors.tekstGedimd`, `minHeight/minWidth: 44`, `accessibilityLabel`
  `{symbool of 'deze regel'} verwijderen uit doel`.

**"+ Coin toevoegen"**: `Type.caption`, `colors.cta`, `fontWeight: 600`, `minHeight: 44`,
`marginTop: spacing.md`, voegt een lege `DoelRegel` toe. Geen limiet op het aantal rijen; in de
praktijk houdt niemand meer dan een handvol namen bij, en de `ScrollView` vangt de rest op zoals bij
elk ander formulier in de app.

**Overig/Totaal-blok**: `borderTopWidth: StyleSheet.hairlineWidth` in `colors.rand`,
`marginTop: spacing.base`, `paddingTop: spacing.md`. Twee rijen, `flexDirection: row`,
`justifyContent: space-between`:

- `Overig` (`Type.caption`, `colors.tekstGedimd`) tegenover zijn berekende percentage
  (`Type.label`, rechts uitgelijnd). Normaal `colors.tekstGedimd`; is de som van de ingevulde
  percentages groter dan 100 (dus Overig zou negatief worden), dan toont dit veld `—` in
  `colors.verlies` in plaats van een negatief getal.
- `Totaal` (`Type.body`, `fontWeight: 600`, `colors.tekstPrimair`) tegenover `100,0%` (altijd
  precies 100, want Overig vult per definitie aan; alleen bij de foutstaat hierboven staat er `—`).

### 4.2 Validatie

Live, bij elke wijziging, geen aparte "controleer"-knop:

| Voorwaarde | Gedrag |
|------------|--------|
| Een symboolveld is leeg terwijl het percentageveld niet leeg is, of andersom | Opslaan uitgeschakeld, foutregel: `Vul bij elke regel een coin en een percentage in.` |
| Hetzelfde symbool komt twee keer voor (hoofdletterongevoelig) | Opslaan uitgeschakeld, foutregel: `{symbool} staat al in je doel.` |
| Een percentage is 0, negatief, of groter dan 100 | Opslaan uitgeschakeld, foutregel: `Een percentage moet tussen 0 en 100 liggen.` |
| Som van de percentages is groter dan 100 | Opslaan uitgeschakeld, foutregel: `Je vult {som}% in, dat is meer dan 100%. Verlaag een percentage.` |
| Nul rijen (na het verwijderen van de laatste) | Opslaan uitgeschakeld, geen foutregel maar een hint onder de "+ Coin toevoegen"-knop: `Voeg minimaal één coin toe.` in `colors.tekstGedimd` |

Precies één foutregel tegelijk, in de volgorde van de tabel hierboven (leeg veld gaat voor dubbel
symbool gaat voor bereik gaat voor som). `Type.caption`, `colors.verlies`, `marginTop: spacing.sm`,
zelfde plek en opmaak als de foutregel in `TradeFormulier`.

De opslaanknop: gevuld `colors.cta` als geldig, `colors.verhoogd`/`colors.tekstGedimd` als
uitgeschakeld, tekst `Doel opslaan`, `minHeight: 48`, `borderRadius: radii.knop`,
`marginTop: spacing.lg`.

### 4.3 Doel verwijderen

Alleen zichtbaar als `doel.length > 0` bij het openen (een bestaand doel, geen nieuw). Tekstknop
onder de opslaanknop, `Type.caption`, `colors.tekstGedimd`, `textAlign: center`, `minHeight: 44`,
`marginTop: spacing.sm`. Geen bevestigingsdialoog: hetzelfde lage-drempel-patroon als "leeg laten wist"
op `KapitaalSheet`, een doel is zonder moeite opnieuw in te vullen. Roept `onOpslaan([])` aan en sluit.

### 4.4 Toegankelijkheid

- Elk veld: zichtbaar label via de uitlegtekst plus placeholder, `accessibilityLabel` per veld
  (`Coinsymbool, regel {n}` / `Percentage, regel {n}`).
- Verwijderknop, toevoegknop, opslaanknop en "Doel verwijderen": alle `accessibilityRole="button"`,
  alle minimaal 44px hoog.
- Foutregel: geen aparte `accessibilityLiveRegion` nodig, hij staat direct boven de (uitgeschakelde)
  opslaanknop en wordt dus vanzelf voorgelezen bij het navigeren daarheen, zelfde aanpak als elders
  in de app.

---

## 5. `DoelScherm` (nieuw, full-screen)

Bestand: `app/src/components/DoelScherm.tsx`. Zelfde vorm als `VerdelingScherm.tsx`: `Modal` met
`presentationStyle="fullScreen"`, `animationType="slide"`, `SafeAreaView`, header met sluitkruis,
`ScrollView` met blokken eronder, `useModalKopruimte()`.

Props: `zichtbaar`, `trades`, `livePrijzen`, `doel: Doelverdeling`, `inleg: number | null`,
`rendementPct: number | null`, `jaren: number`, `onOpenDoelSheet: () => void`,
`onWijzigInleg: (n: number | null) => void`, `onWijzigRendement: (n: number | null) => void`,
`onWijzigJaren: (n: number) => void`, `onSluiten: () => void`.

**Header**: `Target` 18px `colors.tekstGedimd`, titel `Doel` (`Type.titel`, `colors.tekstPrimair`,
`accessibilityRole="header"`), sluitkruis 22px `colors.tekstGedimd` `minHeight/minWidth: 44`. Zelfde
`borderBottomWidth`/`paddingTop` als `VerdelingScherm`.

Drie blokken, elk een kaart (`colors.kaart`, `radii.kaart`, `spacing.base` padding,
`marginBottom: spacing.base`, `shadow.kaart`), in deze volgorde.

### 5.1 Blok 1: je doelverdeling

Kop: `Type.overline` `JE DOELVERDELING` links, rechts een tekstknop `Aanpassen` (`Type.caption`,
`colors.cta`, `fontWeight: 600`, `minHeight: 44`) die `onOpenDoelSheet` aanroept. Zonder doel toont
het blok in plaats daarvan de lege staat uit §3.5 (icoon, tekst, knop `Doel instellen`), en de
blokken 5.2 en 5.3 daaronder tonen elk hun eigen "eerst een doel nodig"-melding (zie hieronder) in
plaats van hun normale inhoud.

Met een doel: exact dezelfde rijen als `VerdelingKaart` in Doel-weergave (§3.3), alleen zonder de
buitenste `Pressable` eromheen (dit scherm ís al het volledige overzicht, er valt niets meer te
openen). Elke rij krijgt hetzelfde `accessible`-label als in §3.6.

### 5.2 Blok 2: bijstorten

Kop: `Type.overline` `BIJSTORTEN`.

**Zonder doel**: `Type.caption`, `colors.tekstGedimd`: `Stel eerst een doelverdeling in om te zien
waar je inleg heen kan.`

**Met doel, zonder ingevulde inleg**:

```
+-----------------------------------------------------+
|  BIJSTORTEN                                          |
|                                                       |
|  Vul in wat je deze maand van plan bent bij te        |
|  storten, dan rekent Kader uit waar dat volgens je     |
|  doel het beste heen kan.                              |
|                                                       |
|            [ Inleg invullen ]                          |
+-----------------------------------------------------+
```

Tekst `Type.body`, `colors.tekstGedimd`, `lineHeight: 22`. Knop zelfde vorm als "Doel instellen",
`accessibilityLabel="Maandelijkse inleg invullen"`, opent `InlegSheet`.

**Met doel en ingevulde inleg**:

```
+-----------------------------------------------------+
|  BIJSTORTEN                              Aanpassen   |
|                                                       |
|  Deze maand: $300,00                                  |
|                                                       |
|  [#] BTC              $90,00        -> 31,2%          |
|  [#] ETH              $135,00       -> 26,8%          |
|  [.] Overig           $75,00        -> 43,1%          |
|                                                       |
|  Dit is een rekensom op basis van de doelverdeling    |
|  die je zelf hebt ingevuld. Geen beleggingsadvies.    |
+-----------------------------------------------------+
```

`Aanpassen`-knop rechts in de kop opent `InlegSheet` met het huidige bedrag voorgevuld. `Deze maand:
{fmtBedrag(inleg)}` in `Type.prijs`. Per `BijstortRegel`: kleurvierkantje 9x9 (dezelfde
kleurtoewijzing als blok 1), symbool (`Type.caption`, `fontWeight: 600`), vulling, bedrag
(`fmtBedrag(bedragUsd)`, `Type.prijs`, `fontSize: 12`, `colors.tekstGedimd`), dan
`→ {aandeelTekst(nieuwPct/100)}` in `Type.caption`, `colors.tekstGedimd`, `marginLeft: spacing.sm`.
Een categorie met `bedragUsd === 0` (al ruim boven doel, kreeg dus niets in stap 1 en had geen
doelaandeel over voor stap 2 valt bijna nooit voor, maar kán) toont gewoon `$0,00`, niet weggelaten:
zwijgen over een categorie zou net zo goed lezen als "vergeten" als "bewust nul".

Slotregel, `Type.caption`, `colors.tekstGedimd`, `marginTop: spacing.base`, `paddingTop: spacing.md`,
`borderTopWidth: StyleSheet.hairlineWidth` in `colors.rand`:

> Dit is een rekensom op basis van de doelverdeling die je zelf hebt ingevuld. Geen beleggingsadvies.

### 5.3 Blok 3: projectie

Kop: `Type.overline` `PROJECTIE`. Werkt onafhankelijk van blok 1 en 2: de TODO koppelt de projectie
niet aan een doel, alleen aan inleg per maand en een zelf ingevuld rendement. Een doel is dus geen
voorwaarde voor dit blok; wel deelt het dezelfde ingevulde `inleg` als blok 5.2, zodat je het bedrag
maar één keer hoeft in te vullen.

**Zonder ingevulde inleg** (ongeacht of er een doel is): `Type.caption`, `colors.tekstGedimd`:
`Vul eerst in wat je maandelijks inlegt (bij Bijstorten hierboven), dan kan Kader een projectie
rekenen.` Geen los inlegveld hier: één plek voor dat getal voorkomt dat de twee blokken uit elkaar
kunnen lopen.

**Met inleg, zonder ingevuld rendement**:

```
+-----------------------------------------------------+
|  PROJECTIE                                            |
|                                                         |
|  [1j][3j][5j][10j][20j]                                |
|                                                         |
|  VERWACHT RENDEMENT PER JAAR                            |
|  [        ]%                                            |
|                                                         |
|  Vul een verwacht rendement in om de projectie te zien. |
+-----------------------------------------------------+
```

Jaren-chips: zelfde vorm als `bereikPil` in `PrijsGrafiek` (`radii.pill`, `minHeight: 32`,
`minWidth: 52`, actief `colors.cta`/wit, inactief `colors.verhoogd`/`colors.tekstGedimd`), labels
`1j 3j 5j 10j 20j`, `accessibilityLabel` voluit (`Projectie over 1 jaar` etc.). Rendementveld: label
`Type.overline` `VERWACHT RENDEMENT PER JAAR`, invoerrij zelfde `inputStyle` als elders,
`keyboardType="decimal-pad"`, `%`-teken vast ernaast. Geen placeholder-getal: het veld staat leeg
totdat de gebruiker zelf iets intikt, en de tekst eronder legt uit waarom er nog niets te zien is.
Wijzigingen aan jaren-chips en rendementveld persisten meteen (`onWijzigJaren` bij elke tik,
`onWijzigRendement` bij `onEndEditing` van het veld, niet bij elke toets, om niet bij elk cijfer naar
`AsyncStorage` te schrijven); de grafiek herrekent wel bij elke toets, want dat is alleen rekenwerk in
het geheugen.

**Met inleg en rendement**:

```
+-----------------------------------------------------+
|  PROJECTIE                                             |
|                                                          |
|  [1j][3j][ 5j ][10j][20j]                               |
|                                                          |
|  VERWACHT RENDEMENT PER JAAR                             |
|  [ 7 ]%                                                  |
|                                                          |
|  Over 5 jaar: $28.640,50                                 |
|  Waarvan $18.000,00 eigen inleg en $10.640,50 rendement. |
|                                                          |
|   $28.640,50 ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈●                  |
|             ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╱                    |
|           ╱                     ╱┈┈┈┈┈┈┈○ $18.000,00     |
|         ╱________________╱┈┈┈┈┈┈                          |
|  Nu                                          Over 5 jaar |
|  ● met rendement    ┈┈┈ alleen inleg                     |
|                                                          |
|  Dit is een rekensom op basis van het rendement dat je   |
|  zelf hebt ingevuld, geen voorspelling van de koers.     |
+-----------------------------------------------------+
```

Groot getal `Over {jaren} jaar: {fmtBedrag(eindwaarde)}` in `Type.display`, `colors.tekstPrimair`.
Onderregel `Waarvan {fmtBedrag(ingelegdEind)} eigen inleg en {fmtBedrag(eindwaarde − ingelegdEind)}
rendement.` in `Type.caption`, `colors.tekstGedimd`. Bij een negatief rendementspercentage kan
`eindwaarde < ingelegdEind` uitkomen; dan wordt het tweede deel `en −{fmtBedrag(...)} verlies door het
ingevulde rendement.` in plaats van "rendement": het woord moet kloppen met het teken.

**De grafiek**, nieuw component `app/src/components/ProjectieGrafiek.tsx`, zelfde SVG-opbouw als
`PrijsGrafiek.tsx` (`Svg`, `Defs`/`LinearGradient` voor de vulling, `Polyline` voor de lijnen) maar met
twee, principieel verschillende, bedoelde afwijkingen:

- **Alle lijnen zijn gestippeld** (`strokeDasharray="4,4"`), ook de hoofdlijn. Dat is het omgekeerde
  van `PrijsGrafiek`, waar de lijn altijd een dichte streep is omdat het gemeten koersdata is. Hier is
  niets gemeten; de stippellijn is de visuele articulatie van "dit is een aanname", overal in deze
  grafiek, niet alleen in de tekst eronder.
- **Twee lijnen, geen aanwijzer.** Lijn 1 (`totaalWaarde` per jaar uit `berekenProjectie`) in
  `colors.cta`, `strokeWidth: 2`, met een lichte gradiëntvulling eronder (`colors.cta` op 20 procent
  dekking naar 0, dezelfde `Defs`-opzet als `PrijsGrafiek`). Lijn 2 (`ingelegdWaarde`) in
  `colors.tekstGedimd`, `strokeWidth: 1.5`, geen vulling: de rechte referentielijn van "je eigen geld
  zonder rendement". Geen sleep-aanwijzer zoals bij `PrijsGrafiek`: dit is een uitkomst om te lezen,
  niet historie om doorheen te bladeren, en zonder de `PanResponder` is er ook geen kans dat een veeg
  hier per ongeluk als "ik wil een ander jaartal zien" wordt gelezen terwijl het antwoord al in de
  chips hierboven staat.

X-as: alleen `Nu` (links) en `Over {jaren} jaar` (rechts), `Type.overline`, `colors.tekstGedimd`,
zelfde `datumRij`-opmaak als `PrijsGrafiek`. Waardelabels aan het eind van elke lijn: eindwaarde van
lijn 1 rechtsboven (`Type.label`, `colors.cta`), eindwaarde van lijn 2 bij het eindpunt van die lijn
zelf (`Type.label`, `colors.tekstGedimd`), niet gecentreerd bovenaan zoals bij `PrijsGrafiek` (daar
gaat het om min/max van de hele reeks; hier is alleen het eindpunt van elke lijn interessant).

Legenda onder de grafiek, `flexDirection: row`, `justifyContent: center`, `gap: spacing.base`,
`marginTop: spacing.sm`: bolletje gevuld `colors.cta` plus tekst `met rendement`
(`Type.caption`), en een streepje van 3 gestippelde segmentjes in `colors.tekstGedimd` plus tekst
`alleen inleg`. Kleur én lijnstijl verschillen dus tussen de twee reeksen, niet kleur alleen.

Hoogte `140`, iets lager dan `PrijsGrafiek`'s standaard `180`: deze grafiek heeft geen periode-pillen
en geen tooltip die ruimte opeisen.

Slotregel, zelfde opmaak als 5.2: `Dit is een rekensom op basis van het rendement dat je zelf hebt
ingevuld, geen voorspelling van de koers.`

### 5.4 Lege staten van het hele scherm

| Staat | Wat je ziet |
|-------|-------------|
| Geen doel | Blok 1 in lege staat (§3.5-vorm), blok 2 en 3 tonen hun eigen "eerst een doel/inleg"-tekst uit 5.2/5.3. Het scherm is verder nooit volledig leeg: er is altijd minstens blok 1 om een doel in te stellen. |
| Doel, geen inleg | Blok 1 gevuld, blok 2 toont de "Inleg invullen"-knop, blok 3 verwijst naar diezelfde knop. |
| Doel en inleg, geen rendement | Blok 1 en 2 gevuld, blok 3 toont de jaren-chips en het lege rendementveld met de wachttekst. |
| Alles ingevuld | Alle drie de blokken volledig gevuld, zoals in de schetsen hierboven. |
| 0 posities, wel een doel | Blok 1 toont elke categorie op `te-licht` met `actueelPct = 0`, tenzij er geen live koers is (dan de tekst uit §3.4 in plaats van de rijen). Blok 2 en 3 werken gewoon door: een bijstortplan en een projectie hebben geen bestaande positie nodig, alleen een doel (voor blok 2) en een startwaarde die dan 0 is. |
| 25 posities | Blok 1 blijft even lang als het aantal doelcategorieën, niet als het aantal posities: het doel bepaalt de rijen, niet de portfolio. Blok 2 en 3 veranderen niet mee met het aantal posities. |

### 5.5 Toegankelijkheid

- `onRequestClose={onSluiten}` op de `Modal`, zodat de Android-terugknop sluit, net als
  `VerdelingScherm`.
- Elke blokkop krijgt `accessibilityRole="header"`.
- De jaren-chips: `accessibilityRole="button"`, `accessibilityState={{ selected }}`.
- De grafiek is decoratief naast de tekst erboven die dezelfde getallen al noemt: `Svg`
  krijgt `accessibilityElementsHidden` en de omhullende `View` een `accessibilityLabel` in de vorm
  `Verwachte waarde over 5 jaar: $28.640,50, waarvan $18.000,00 eigen inleg en $10.640,50 rendement.`
- Alle knoppen (sluitkruis, Aanpassen, Inleg invullen, Doel instellen) minimaal 44px.

---

## 6. `InlegSheet` (nieuw, `BottomSheet`)

Bestand: `app/src/components/InlegSheet.tsx`. Vrijwel een kopie van `KapitaalSheet.tsx`, met een
andere sleutel en andere tekst; geen nieuw patroon.

```
Titel:    Maandelijkse inleg
Uitleg:   Wat je van plan bent om deze markt maandelijks bij te storten, in dollars.
Veld:     $ [        ]   (keyboardType="decimal-pad", placeholder "bijv. 300")
Caption:  Blijft op je telefoon. Leeg laten wist het bedrag.
Knop:     Opslaan (geldig) / Wissen (leeg)
```

Props: `zichtbaar`, `huidig: number | null`, `onOpslaan: (n: number | null) => void`, `onSluiten:
() => void`. Zelfde validatie als `KapitaalSheet` (`waarde > 0`, anders `null`).

---

## 7. Wat er niet bijkomt

- **Geen aparte categorieën-bibliotheek.** Elke coin die de gebruiker intikt is geldig, ongeacht of
  hij op eToro handelbaar is of al in portfolio zit. Een doel mag best over een coin gaan die je nog
  niet bezit; dat is precies het punt van een bijstortplan.
- **Geen automatische normalisatie van percentages.** Als de ingevulde percentages niet optellen tot
  100, wordt er niets stilzwijgend herschaald. Dezelfde regel als bij de bestaande
  aandeel-afronding in `verdeling.ts`: "een opgepoetst getal is een leugentje."
- **Geen koppeling tussen het bijstortplan en een echte order.** Dit blijft een rekensom die je zelf
  moet uitvoeren, bijvoorbeeld via de bestaande koopsheet. Fase 5 van de TODO gaat over automatisch
  handelen; dat raakt deze spec niet.
- **Geen melding of pushnotificatie als je van je doel afwijkt.** De TODO vraagt daar niet om, en het
  zou de "geen advies"-eis onder druk zetten: een melding die zegt dat je iets moet bijstellen begint
  al snel als een aanbeveling te lezen, ook als de tekst dat woord vermijdt.

---

## 8. Randgevallen

| Situatie | Gedrag |
|----------|--------|
| Doel ingevuld, daarna alle posities gesloten | `VerdelingKaart` blijft zichtbaar (zie §3.7), Doel-weergave toont alles op `te-licht` met `actueelUsd = 0` of de "geen live koersen"-tekst als er sowieso geen koersen zijn. |
| Nooit een doel ingesteld, 0 posities | Geen ingangspunt op het portfolio-scherm zelf: `VerdelingKaart` rendert niet (zie §3.7). Bewuste grens: fase 2 bouwt voort op de kaart uit fase 1, en die verschijnt pas met een eerste positie. Een los ingangspunt ergens anders (bijvoorbeeld Instellingen) is voor een latere fase als hier vraag naar blijkt. |
| Eén positie, doel voor een andere coin | Werkt zonder aanpassing: de ene bezeten coin komt in Overig terecht als hij niet met naam in het doel staat, en staat dan tegenover het Overig-doel. |
| 25 posities, doel van 2 regels (bijv. alleen BTC en ETH) | Blok 1/§3.3 blijft 3 rijen (BTC, ETH, Overig), ongeacht hoeveel van de 25 coins onder Overig vallen. |
| Rendement van 0% ingevuld | Beide lijnen in de grafiek vallen samen; de onderregel wordt `Waarvan {inleg} eigen inleg en $0,00 rendement.` |
| Negatief rendement ingevuld | Toegestaan (zie §1.3/5.3), geen validatiefout. De projectie mag dalen; dat is een eerlijke rekensom net zo goed als een stijgende. |
| Percentageveld met komma (`7,5`) | Zelfde `.replace(',', '.')`-behandeling als overal elders in de app (`TradeFormulier`, `KapitaalSheet`). |
| App-herstart met een doel dat nog niet is opgeslagen (sheet halverwege ingevuld) | Geen conceptopslag voor `DoelSheet`, anders dan `TradeFormulier`: een doel wijzig je zelden en de rijen zijn kort genoeg om zonder concept opnieuw in te tikken. Bewust simpeler gehouden. |

---

## 9. Implementatiechecklist

### Nieuwe bestanden

| Pad | Wat |
|-----|-----|
| `app/src/engine/doelstelling.ts` | `DoelRegel`, `Doelverdeling`, `AfwijkingRegel`, `BijstortRegel`, `ProjectiePunt`, `berekenAfwijking()`, `berekenBijstortplan()`, `berekenProjectie()`, `fmtAfwijkingPp()`, `OP_DOEL_MARGE`, `AFWIJKING_FLINK`. Zelftest onder `require.main`. |
| `app/src/state/useDoelverdeling.ts` | Hook, patroon van `useHandelskapitaal.ts`. |
| `app/src/state/useMaandelijkseInleg.ts` | Hook, patroon van `useHandelskapitaal.ts`. |
| `app/src/state/useProjectieInstellingen.ts` | Hook voor rendement% en jaren samen. |
| `app/src/components/DoelSheet.tsx` | Editor voor de doelverdeling, §4. |
| `app/src/components/DoelScherm.tsx` | Full-screen overzicht, §5. |
| `app/src/components/InlegSheet.tsx` | Editor voor de maandelijkse inleg, §6, kopie van `KapitaalSheet.tsx`. |
| `app/src/components/ProjectieGrafiek.tsx` | SVG-grafiek, §5.3, gebaseerd op `PrijsGrafiek.tsx` met de aangepaste stippellijn-opzet. |

### Gewijzigde bestanden

| Pad | Wat |
|-----|-----|
| `app/src/storage/opslag.ts` | vier nieuwe `SLEUTELS`: `doelverdeling`, `maandelijkseInleg`, `verwachtRendement`, `projectieJaren`. |
| `app/src/components/VerdelingKaart.tsx` | structuurwijziging uit §3.1 (kop uit de `Pressable`), Nu/Doel-schakelaar, drie nieuwe render-takken (§3.3-3.5), nieuwe props `doel` en `onOpenDoel`, render-conditie aangepast (§3.7). |
| `app/src/screens/PortfolioScreen.tsx` | drie nieuwe hooks erbij, state `doelOpen`, props doorgeven aan `VerdelingKaart`, `<DoelScherm>` renderen. |

### Waarden om niet te vergeten

- `OP_DOEL_MARGE = 1`, `AFWIJKING_FLINK = 5` (procentpunt).
- Statuspil: `colors.verhoogd` bij `op-doel` en `mild`, `colors.letOp + '1A'` bij `flink`; nooit
  `colors.winst`/`colors.verlies`.
- Afwijkingsstaafje: track `colors.verhoogd`, vulling in de categoriekleur, doel-streep 2px in
  `colors.tekstPrimair`, minimaal 2px vulling.
- Schakelaar Nu/Doel: pil `colors.verhoogd`, actieve knop `colors.kaart`, `minHeight: 28` met
  `hitSlop={6}`.
- Projectiegrafiek: alle lijnen `strokeDasharray="4,4"`, lijn 1 `colors.cta` met vulling, lijn 2
  `colors.tekstGedimd` zonder vulling, hoogte `140`.

### Verificatie met de `run-android`-skill, licht én donker

1. Portfolio zonder doel: kaart toont ring zoals voorheen op "Nu"; op "Doel" de lege staat met
   "Doel instellen".
2. Doel instellen met drie coins die niet optellen tot 100: opslaan staat uit, foutregel klopt met de
   som. Percentages naar precies 100 corrigeren: opslaan wordt actief.
3. Na opslaan: kaart op "Doel" toont de rijen, Overig als laatste, statuspillen kloppen met de
   ingevulde percentages tegenover de actuele verdeling.
4. Kaart aantikken op "Doel" opent `DoelScherm`; blok 1 komt overeen met de kaart.
5. Inleg invullen in blok 2: de bedragen per categorie tellen op tot het ingevulde bedrag (op
   afrondingen na); een categorie die al ruim boven doel zit krijgt een klein of nul bedrag.
6. Rendement invullen in blok 3: grafiek verschijnt, beide lijnen gestippeld, eindwaardes kloppen met
   de tekst erboven. Rendement op 0 zetten: beide lijnen vallen samen.
7. Alle posities verwijderen terwijl er een doel staat: kaart blijft zichtbaar, toont 0%-afwijkingen
   of de "geen live koersen"-tekst.
8. Doel verwijderen via de sheet: kaart valt terug op de lege "Doel instellen"-staat (of verdwijnt
   helemaal als er ook geen posities zijn).
9. Android-terugknop sluit `DoelScherm`, `DoelSheet` en `InlegSheet` netjes.

### Changelog

Dit zijn zichtbare wijzigingen, dus `CHANGELOG.md` en `app/src/changelog.ts` moeten allebei bij,
nieuwste bovenaan, in het Nederlands. Het versienummer pas toekennen op het moment dat er echt een
release-APK gebouwd wordt.
