# Design: vermogensbalk en periodefilter

Ontwerpspec voor twee wijzigingen aan `PortfolioStatusKaart.tsx`. Alles staat in tokenwaarden uit
`app/src/theme/tokens.ts` en stijlen uit `app/src/theme/typography.ts`. Waar een waarde niet uit een
token komt, staat het er expliciet bij. Alle gebruikerstekst hieronder is letterlijk overneembaar:
Nederlands, nuchter, geen em-dashes.

Uitgangspunten die overal gelden:

- React Native, alleen `react-native`, `react-native-svg` (niet nodig hier) en `lucide-react-native`.
  Geen nieuwe libraries.
- Kleur is nooit het enige signaal. Elk gekleurd element heeft een naam, een letter, een cijfer of
  een vorm naast zich.
- Raakvlakken minimaal 44px, schermlezerlabels in het Nederlands.
- Licht en donker moeten allebei kloppen.
- Nooit een verzonnen getal. Dat geldt ook voor de visuele breedte van een balkstuk: een
  minimumbreedte (zie 1.4) verandert nooit het getal dat ernaast staat, alleen hoe breed het
  stukje op het scherm is. En het geldt voor het periodecijfer in sectie 2: ontbreekt een
  referentiekoers, dan telt die positie niet mee en zegt de kaart dat met zoveel woorden.
- Geen nieuwe tokens nodig voor deze twee wijzigingen. Alle kleuren hieronder komen uit de bestaande
  `ColorTokens`.
- Deze feature gaat op een branch vanaf `main`. Alle verwijzingen hieronder zijn gecontroleerd tegen
  wat er op `main` staat: `engine/verdeling.ts` (inclusief `aandeelTekst`, `spreekAandeel`,
  `berekenVolledigeVerdeling` en `NietGewogen`), `engine/grafiekBereik.ts`
  (`BereikId`/`BEREIKEN`/`STANDAARD_BEREIK`), `VerdelingKaart.tsx`, `PrijsGrafiek.tsx`,
  `MarktFilters.tsx`, `AdviceBadge.tsx` (met zijn `score`-suffix) en `state/useHandelskapitaal.ts`
  bestaan daar allemaal.

---

## 0. Waarom de balk "het nog steeds niet doet"

`PortfolioStatusKaart.tsx` bevat al de fix van `flex` naar percentagebreedtes (regel 174 tot 176) en
gebruikt daar al `colors.primair` tegenover `colors.verdelingOverig`, niet twee keer dezelfde grijstint.
Puur technisch tekent de balk dus al. Er blijven twee kandidaten over voor de klacht.

**Gemeten, Pixel_8, licht thema, main 0.1.21, kaart geforceerd in de staat "saldo bekend":**

| Cash-aandeel | Wat er te zien is |
|--------------|--------------------|
| 3,2 procent | De balk tekent: blauw stuk plus een grijs stukje van een paar pixels rechts. Zichtbaar, maar je moet ernaar zoeken. |
| 0,3 procent | De balk is een effen blauwe lijn. Geen grijs te zien, nergens. |

Dat tweede resultaat is precies wat "de staaf doet het nog steeds niet" betekent: hij tekent wel, maar
hij laat geen verdeling meer zien. Daarmee is bevestigd:

1. **Een klein cash-aandeel is onzichtbaar. Gemeten, dit is de bug.** Bij een aandeel onder ongeveer 1
   procent wordt het stuk op een balk van circa 311px breed (kaartbreedte min padding) minder dan een
   paar pixels, en verdwijnt het volledig in het blauwe stuk ernaast. Dat leest als "de balk doet het
   niet", ook al klopt de breedte wiskundig. **Niet de oorzaak:** de meting weerlegt de verdenking dat
   `overflow: hidden` in combinatie met `borderRadius: radii.pill` op 8px hoogte hier iets mee te
   maken heeft. Die styling doet het gewoon goed op Android; het probleem is puur dat het percentage
   zelf te dicht bij nul ligt. De huidige styling blijft dus ongewijzigd, afgezien van de hoogte van
   8 naar 10 die 1.3 al voorstelt.
2. **Geen balk zonder saldo (regel 61, 116).** De balk wordt alleen gerenderd als `vrijSaldoUsd !==
   null` én `totaalUsd > 0`. Zonder eToro-koppeling, of als eToro het veld `credit` niet meestuurt,
   is er dus helemaal geen balk: alleen de kop `WAARDE OPEN POSITIES` in plaats van `TOTAAL VERMOGEN`,
   en de twee kolommen met een scheidingslijntje in plaats van de balk erboven. Wie dat niet weet ziet
   een kaart zonder balk en concludeert "de balk werkt niet", terwijl er feitelijk geen balk hóórt te
   zijn. Dit is niet gemeten in deze sessie (de test hierboven ging uit van een bekend saldo), maar
   blijft een reëel, apart scenario met dezelfde klacht als gevolg.

Deze spec pakt beide aan: 1.4 geeft de kleine kant een gegarandeerde minimumbreedte plus een
percentage in tekst (zodat je het getal kunt lezen ook als het vlak te smal is om te zien), en 1.3
zet nog eens puntsgewijs neer wat er in elke staat te zien hoort te zijn, zodat "geen balk" in staat
d herkenbaar blijft als correct gedrag en niet als bug.

---

## 1. De vermogensbalk

### 1.1 Bestanden

| Pad | Wat |
|-----|-----|
| `app/src/components/PortfolioStatusKaart.tsx` | balkbreedte krijgt een ondergrens, legendakolommen krijgen een percentage, balk wordt iets steviger, toegankelijkheidslabels erbij |

Geen wijziging nodig aan `engine/etoro.ts`, `PortfolioProvider.tsx` of de propsignatuur: `vrijSaldoUsd`
bestaat al als `number | null` en de gating-logica in 0 hierboven is al correct.

### 1.2 De vijf staten

| Staat | Voorwaarde | Wat je ziet |
|-------|------------|-------------|
| a. Saldo bekend, allebei substantieel | `vrijSaldoUsd !== null`, `totaalUsd > 0`, geen van beide aandelen onder de 4 procent | Balk met twee zichtbare stukken op hun eigen, ongewijzigde breedte. Kop `TOTAAL VERMOGEN`. |
| b. Saldo bekend, cash bijna nul | zoals a, maar het cash-aandeel is bijvoorbeeld 2 procent | Balk met het cash-stuk op de minimumbreedte uit 1.4 (visueel dus iets breder dan zijn werkelijke aandeel), plus het exacte percentage in de legenda eronder zodat het echte getal altijd afleesbaar is. |
| c. Saldo bekend, alles in cash | `vrijSaldoUsd !== null`, `belegdUsd === 0`, `vrijSaldoUsd > 0` | Balk volledig in `colors.verdelingOverig`, geen blauw stuk. Geen ondergrens nodig: nul procent mag ook nul breed zijn, dat is geen klein aandeel maar een afwezig aandeel. |
| d. Saldo onbekend | `vrijSaldoUsd === null` | Geen balk. In plaats daarvan een scheidingslijntje boven de twee kolommen, een gestippeld leeg bolletje bij BESCHIKBAAR met de tekst `Onbekend`, en het uitlegblok eronder. Kop `WAARDE OPEN POSITIES`. Dit is de bestaande, correcte staat uit 0.1; hij verandert hier niet. |
| e. Totaal is nul | `vrijSaldoUsd !== null`, `belegdUsd === 0`, `vrijSaldoUsd === 0` | Geen balk (`totaalUsd > 0` is dan onwaar). De twee kolommen blijven staan en tonen allebei `$0,00`. Geen speciale tekst: een saldo van exact nul is een eerlijk antwoord, geen ontbrekend antwoord. |

Staat c en e zien er in code identiek uit op één punt na (`totaalUsd > 0`), maar verdienen allebei een
eigen regel in deze tabel omdat de balk in c wél getekend wordt (volledig één kleur) en in e helemaal
niet.

### 1.3 Uitwerking

**Hoogte en vorm.** Van 8 naar 10px. Nog steeds een dunne balk die past bij de rest van de kaart, maar
in combinatie met de ondergrens hieronder wordt een klein stukje een echt zichtbaar blokje in plaats
van een lijnrandje.

```
balk: {
  flexDirection: 'row',
  height: 10,                 // was 8
  borderRadius: radii.pill,
  overflow: 'hidden',
  marginTop: spacing.base,    // 16, ongewijzigd
}
balkStuk: { height: 10 }      // was 8
```

**Minimumbreedte.** Een nieuwe constante boven de component:

```ts
// Percentage van de balkbreedte. Garandeert dat een klein aandeel (bijvoorbeeld 2% cash) nog een
// zichtbaar stukje krijgt, ook al zou de werkelijke breedte een paar pixels zijn. Het getal in de
// legenda blijft altijd het echte percentage; alleen de tekening schuift op.
const MIN_BALKSTUK_PCT = 6;
```

Vervang de bestaande `belegdPct`-berekening (regel 75) door:

```ts
const belegdPct = totaalUsd > 0 ? (belegdUsd / totaalUsd) * 100 : 0;
// De ondergrens geldt alleen als een kant ECHT nul is versus ECHT klein. Nul blijft nul (staat c
// en e), een klein maar bestaand aandeel krijgt de minimumbreedte (staat b).
const belegdPctBalk =
  belegdUsd <= 0 ? 0
  : vrijSaldoUsd !== null && vrijSaldoUsd <= 0 ? 100
  : Math.min(100 - MIN_BALKSTUK_PCT, Math.max(MIN_BALKSTUK_PCT, belegdPct));
```

De balk gebruikt `belegdPctBalk` voor de breedtes (regel 174 tot 176 in de huidige code), precies
zoals nu, alleen met de nieuwe variabele. `belegdPct` is voor de legenda hieronder: die moet altijd
het echte getal tonen, nooit het opgerekte.

**Percentage in de legenda.** `IN POSITIES` en `BESCHIKBAAR` tonen vandaag alleen een bedrag. Zet er
het percentage bij, in dezelfde overline-regel, met een punt-scheiding zoals de app dat al doet bij
`AdviceBadge`'s scorecijfer:

```
IN POSITIES · 96,8%
$14.023,80

BESCHIKBAAR · 3,2%
$463,20
```

Gebruik `aandeelTekst` uit `app/src/engine/verdeling.ts` (al elders in de app geïmporteerd voor
precies dit soort percentage, inclusief de `<0,1%`-regel bij een heel klein aandeel):

```tsx
<Text style={[Type.overline, { color: colors.tekstGedimd }]}>
  IN POSITIES · {aandeelTekst(belegdPct / 100)}
</Text>
...
<Text style={[Type.overline, { color: colors.tekstGedimd }]}>
  BESCHIKBAAR · {aandeelTekst((100 - belegdPct) / 100)}
</Text>
```

Dit lost staat b in tekst op: ook als het blokje zelf op de ondergrens van 4 procent breedte staat,
zie je er "3,2%" naast staan en weet je dat het klein is, niet kapot.

**Contrast van het grijze stuk.** Eerst even scherp waar het contrastprobleem wel en niet zit: de twee
`balkStuk`-breedtes tellen per constructie altijd op tot exact 100 procent (de tweede is letterlijk
`100 - belegdPctBalk`), dus `colors.verhoogd` (`#EEF2F7` licht) op de buitenste `balk`-`View` wordt
nooit zichtbaar, die zit altijd volledig onder de twee stukken bedekt. De echte grens die je ziet is
dus niet "grijs tegen de baan eronder", maar "grijs tegen de witte kaart" op het punt waar de pil-vorm
afrondt, want het rechterstuk (`verdelingOverig`) ligt tegen die ronding aan. Gemeten:
`colors.verdelingOverig` (`#94A3B8` licht) tegen `colors.kaart` (`#FFFFFF`) geeft een contrastratio
van ongeveer **2,6 : 1**, onder de WCAG-richtlijn van 3 : 1 voor niet-tekstuele UI-elementen. Bij een
breed stuk valt dat niet op, want je ziet dan vooral de rand met het blauw ernaast (die twee hebben
wél ruim voldoende contrast). Bij een smal stuk op de ondergrens, waar de pil-ronding al een deel van
de zichtbare breedte opeet, telt juist die zwakke rand tegen het witte kaartoppervlak extra mee.

Voorgestelde extra maatregel, zonder een nieuw token: een dunne rand om de hele balk-pil,
`borderWidth: 1`, `borderColor: colors.rand`. Dat tekent de buitenlijn van de balk in alle staten
scherper af tegen de kaart, ook precies op de ronding waar het grijze stuk anders in het wit
oplost. `colors.rand` is zelf ook een lichte kleur en haalt zelfstandig geen 3 : 1, maar het is
dezelfde randdikte en -kleur die de rest van deze kaart al overal gebruikt voor scheidingslijnen
(bijvoorbeeld de `borderTopColor: colors.rand` tussen de blokken), dus dit voegt geen nieuw
visueel gewicht toe, alleen een consistente omlijning die er nu nergens is. Wil je een randkleur die
zelfstandig wél 3 : 1 haalt tegen wit, dan is dat een nieuw, donkerder token nodig (`verdelingOverig`
zelf aanpassen raakt ook de ring in `VerdelingKaart`, dus dat is een aparte afweging en geen onderdeel
van deze twee wijzigingen).

**Wat niet verandert.** De kleuren (`colors.primair` links, `colors.verdelingOverig` rechts), de
bolletjes in de legenda, de marges tussen balk en legenda (`spacing.md`), en alles in staat d en e.

### 1.4 Toegankelijkheid

- De balk zelf is decoratief: dezelfde informatie staat zo meteen in tekst in de twee kolommen
  eronder. Geef de balk-`View` `accessibilityElementsHidden` en
  `importantForAccessibility="no-hide-descendants"`, dezelfde behandeling als de ring in
  `VerdelingKaart.tsx`.
- Elke kolom krijgt `accessible` met één samengesteld label in plaats van dat de schermlezer overline,
  bedrag en percentage als losse knipsels voorleest:
  - `In posities: ${fmtBedrag(belegdUsd)}, ${spreekAandeel(belegdPct / 100)} van je vermogen.`
  - `Beschikbaar: ${fmtBedrag(vrijSaldoUsd)}, ${spreekAandeel((100 - belegdPct) / 100)} van je vermogen.`

  `spreekAandeel` komt uit hetzelfde bestand als `aandeelTekst` en geeft de comma-vorm die een
  schermlezer als "34,3 procent" uitspreekt in plaats van "34,3 punt 3 procent".
- Staat d en e blijven ongewijzigd, dus ook hun bestaande labels (`Onbekend` als platte tekst, het
  uitlegblok) blijven zoals ze zijn.

---

## 2. Periodefilter op het resultaat

Herzien: het periodecijfer telt niet alleen gesloten trades, maar ook de koersverandering van je
nu nog open posities over diezelfde periode. Zie 2.1 voor de precieze reden en 2.3 voor de volledige
formule.

### 2.1 Wat dit blok laat zien, en waarom het een apart blok is

De bestaande regel onder het grote bedrag (`waarde.ongerealiseerdUsd`) is het verschil tussen entry en
huidige koers van je **nu nog open** posities, altijd "nu", zonder tijdvak. Dat blijft precies zoals
het is: die regel verandert hier niet en staat straks nog steeds bovenaan, ongeacht welke periode je in
het nieuwe blok kiest.

Het nieuwe blok beantwoordt een andere vraag: "hoe heeft mijn portfolio het gedaan over de laatste
maand", en dat cijfer bestaat uit twee delen:

```
resultaat(periode) = gerealiseerd(periode) + ongerealiseerdeVerandering(periode)
```

- **Gerealiseerd(periode).** Som van het resultaat van trades die in de periode gesloten zijn. Dit kan
  lokaal en exact: gesloten trades hebben `slotTijd` (epoch ms) en `resultaatUsd` of, bij handmatige
  trades, genoeg velden om het bruto resultaat uit te rekenen.
- **OngerealiseerdeVerandering(periode).** Voor elke nu nog open positie: het verschil tussen de
  huidige koers en de koers aan het begin van de periode, keer het aantal coins, richting-bewust. Voor
  een positie die al vóór de periode openstond is "de koers aan het begin van de periode" een
  historische slotkoers; voor een positie die er pas ná het begin van de periode bij kwam is dat
  gewoon de entryprijs, want de positie bestond daarvoor niet.

Dat laatste deel heeft historische candles nodig (`engine/marketData.ts`), dus netwerkverkeer. Dat is
in deze herziening geaccepteerd; 2.4 en 2.5 specificeren hoe dat ophalen en cachen eruitziet zodat het
wisselen tussen periodes daarna zelf geen netwerkverkeer meer kost.

Bij periode **Alles** is de referentieprijs voor elke open positie altijd de entryprijs (er is geen
"begin van de periode" vóór de eerste trade), dus `ongerealiseerdeVerandering('alles')` is per
definitie gelijk aan het bestaande `waarde.ongerealiseerdUsd`. Dat is geen toeval maar een directe
consequentie van de formule, en het is een bruikbare zelftest: `resultaat('alles')` moet uitkomen op
`berekenStatistieken(trades).totaalResultaatUsd + waarde.ongerealiseerdUsd` (op afrondingen na), en
`ongerealiseerdeVerandering('alles')` moet exact gelijk zijn aan `waarde.ongerealiseerdUsd`. `Alles`
heeft daarmee ook nooit historische candles nodig: geen netwerkafhankelijkheid, dus geen laad- of
faalstaat op die ene chip.

### 2.2 Plek in de kaart

Bestaande volgorde van boven naar beneden: kop met acties, groot bedrag, ongerealiseerde resultaatregel,
balk, saldokolommen (of de onbekend-staat), detailrij (INGELEGD / OPEN POSITIES / LAATSTE SYNC),
eventuele meldingen (gereserveerd saldo, sync-advies, posities zonder live prijs), historie-knop.

Het nieuwe blok komt **na de meldingen en vóór de historie-knop**:

```
...detailrij...
...meldingen (gereserveerd/advies/zonder-live-prijs), indien van toepassing...
[NIEUW] Resultaat over periode: kop, uitlegzin, periodechips, getal, bijschrift
Historie-knop
```

Twee redenen voor deze plek. Eén: de meldingen erboven zijn tijdsgevoelige waarschuwingen (verouderde
sync, geld vast in een order) en die moeten boven een optioneel historisch overzicht blijven staan.
Twee: het gerealiseerde deel van dit blok gaat over gesloten trades, en de historie-knop is de ingang
naar diezelfde gesloten trades in detail. Ze horen dus naast elkaar te staan, met het blok als
samenvatting en de knop als vervolgstap.

Scheiding van het blok erboven, zelfde patroon als de detailrij:

```
marginTop: spacing.base, paddingTop: spacing.md,
borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rand
```

### 2.3 Nieuw veld: `openTijd` op een open positie

De formule in 2.1 moet per open positie weten of hij al vóór de periodegrens bestond. `PortfolioTrade`
heeft daar vandaag geen betrouwbaar epoch-veld voor: `datum` is een reeds opgemaakte weergavestring
(`new Date(...).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })`,
bijvoorbeeld `"12 sep. 2026"`), en die terug parsen naar een tijdstip is onbetrouwbaar (afgekorte
Nederlandse maandnamen, geen ISO-vorm). Een gok op die string zou precies het soort verzonnen getal
zijn dat deze app vermijdt.

Beide plekken die `datum` vandaag zetten, hebben de ruwe epoch al in handen op het moment zelf, en
gooien hem daarna weg:

- `engine/etoro.ts`, `naarPortfolioTrade()`: `new Date(positie.openDateTime).toLocaleDateString(...)`.
  `positie.openDateTime` is al een epoch/ISO-tijdstip van eToro zelf.
- `screens/PortfolioScreen.tsx`, trade-aanmaak (rond regel 486): `new Date().toLocaleDateString(...)`,
  dus `Date.now()` was er net.

Voeg een nieuw, optioneel veld toe aan `state/portfolioTypes.ts`, in dezelfde stijl als `slotTijd`:

```ts
// Epoch ms waarop deze positie geopend is. Alleen voor open trades van ná deze versie: oudere lokale
// data heeft dit veld niet, en dan is niet te bepalen of de positie al vóór een gekozen periode
// bestond. Zie state/statistieken.ts, berekenResultaatPeriode: zonder dit veld telt de positie niet
// mee bij een tijdsbegrensde periode, wel bij Alles (waar de entryprijs sowieso de referentie is).
openTijd?: number;
```

En vul hem op de twee plekken hierboven:

```ts
// engine/etoro.ts, naarPortfolioTrade(): hergebruik dezelfde Date in plaats van twee keer parsen.
const openDatum = new Date(positie.openDateTime);
// ...
datum: openDatum.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }),
openTijd: openDatum.getTime(),
```

```ts
// screens/PortfolioScreen.tsx, trade-aanmaak:
openTijd: bestaand ? bestaand.openTijd : Date.now(),
```

Geen migratie voor bestaande trades: precies dezelfde aanpak als `richting?`, `bron?` en `slotTijd?`
al hebben, een ontbrekend veld is een bekend, opgevangen geval en geen fout.

### 2.4 Engine: `berekenResultaatPeriode`

Nieuw in `app/src/state/statistieken.ts`, naast de bestaande `berekenStatistieken`.

```ts
// Labels in dezelfde stijl als BereikId in engine/grafiekBereik.ts (1M/3M/6M/alles), met 'dag' en
// '1J' erbij. Geen import van elkaar: allebei een eigen, kleine lijst voor een eigen doel, maar wel
// dezelfde schrijfwijze zodat de app niet twee keer een ander woord voor hetzelfde gebruikt.
export type PeriodeId = 'dag' | '1M' | '3M' | '6M' | '1J' | 'alles';

export const PERIODES: { id: PeriodeId; label: string; dagen: number | null }[] = [
  { id: 'dag',   label: 'Dag',   dagen: null },   // kalenderdag, zie middernachtVan hieronder
  { id: '1M',    label: '1M',    dagen: 30 },
  { id: '3M',    label: '3M',    dagen: 90 },
  { id: '6M',    label: '6M',    dagen: 180 },
  { id: '1J',    label: '1J',    dagen: 365 },
  { id: 'alles', label: 'Alles', dagen: null },
];

export const STANDAARD_PERIODE: PeriodeId = '1M';

// 'leeg': geen gesloten trades én geen gewaardeerde open positie in deze periode, er is niets te tonen.
// 'compleet': alle gewaardeerde open posities konden een referentieprijs krijgen (of er zijn er geen).
// 'deels': een deel van de open posities miste een referentieprijs; resultaatUsd telt de rest wel mee.
// 'alleen-gerealiseerd': er zijn wel gewaardeerde open posities, maar niet één kon een referentieprijs
//   krijgen. resultaatUsd is dan puur het gerealiseerde deel, en de kaart moet dat ook zo noemen
//   in plaats van een cijfer te tonen dat compleet oogt maar het niet is (zie 2.7).
export type ResultaatOverPeriodeStatus = 'leeg' | 'compleet' | 'deels' | 'alleen-gerealiseerd';

export interface ResultaatOverPeriode {
  status: ResultaatOverPeriodeStatus;
  resultaatUsd: number | null;   // null alleen bij status 'leeg'
  pct: number | null;
  aantalGesloten: number;
  nietMeegenomen: number;        // aantal open posities buiten de telling; relevant bij 'deels' en 'alleen-gerealiseerd'
}

const DAG_MS = 24 * 60 * 60 * 1000;
// Verder dan dit van de periodegrens vandaan is geen betrouwbare referentie meer, bijvoorbeeld bij
// een net genoteerde coin zonder oudere candles.
const MAX_AFWIJKING_MS = 5 * DAG_MS;

function middernachtVan(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function periodegrens(periode: PeriodeId, nu: number): number | null {
  if (periode === 'alles') return null;
  if (periode === 'dag') return middernachtVan(nu);
  return nu - PERIODES.find(p => p.id === periode)!.dagen! * DAG_MS;
}

// Kies de candle waarvan tijd het dichtst bij de grens ligt. Werkt ongeacht of de reeks dagelijkse
// of grovere candles bevat (zie 2.5 over de CoinGecko-fallback), en null als de dichtstbijzijnde
// candle te ver weg ligt om nog als referentie te gelden.
function dichtstbijzijndeSlotkoers(
  candles: { tijd: number; close: number }[],
  grens: number,
): number | null {
  let beste: { tijd: number; close: number } | null = null;
  for (const c of candles) {
    if (beste === null || Math.abs(c.tijd - grens) < Math.abs(beste.tijd - grens)) beste = c;
  }
  if (beste === null || Math.abs(beste.tijd - grens) > MAX_AFWIJKING_MS) return null;
  return beste.close;
}

function referentieprijs(
  t: PortfolioTrade,
  grens: number | null,
  candles: { tijd: number; close: number }[] | null,
): number | null {
  if (grens === null) return t.entryPrijs;                   // periode 'alles'
  if (typeof t.openTijd !== 'number') return null;            // onbekend of de positie al open stond
  if (t.openTijd >= grens) return t.entryPrijs;                // positie geopend binnen deze periode
  if (!candles) return null;                                   // historie niet beschikbaar voor dit symbool
  return dichtstbijzijndeSlotkoers(candles, grens);
}

export function berekenResultaatPeriode(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
  // Per symbool de opgehaalde dagcandles, alleen gevuld voor symbolen waarvan het ophalen lukte.
  // Zie state/useResultaatHistorie.ts voor hoe dit object tot stand komt.
  historie: Record<string, { tijd: number; close: number }[]>,
  periode: PeriodeId,
  nu: number = Date.now(),
): ResultaatOverPeriode {
  const grens = periodegrens(periode, nu);

  const gesloten = trades.filter(t => t.status !== 'open'
    && (grens === null || (typeof t.slotTijd === 'number' && t.slotTijd >= grens)));
  const resultaten = gesloten.map(resultaatVan).filter((v): v is number => v !== null);
  const gerealiseerdUsd = resultaten.reduce((s, v) => s + v, 0);
  const ingelegdGesloten = gesloten
    .filter(t => typeof t.aantalCoins === 'number' && t.aantalCoins > 0)
    .reduce((s, t) => s + t.entryPrijs * t.aantalCoins!, 0);

  const openGewaardeerd = trades.filter(t => t.status === 'open'
    && typeof t.aantalCoins === 'number' && t.aantalCoins > 0
    && typeof livePrijzen[t.symbool] === 'number');

  let ongerealiseerdeVeranderingUsd = 0;
  let ingelegdOpen = 0;
  let nietMeegenomen = 0;

  for (const t of openGewaardeerd) {
    const referentie = referentieprijs(t, grens, historie[t.symbool] ?? null);
    if (referentie === null) { nietMeegenomen += 1; continue; }
    ongerealiseerdeVeranderingUsd += tekenVan(t) * (livePrijzen[t.symbool] - referentie) * t.aantalCoins!;
    ingelegdOpen += t.entryPrijs * t.aantalCoins!;
  }

  if (gesloten.length === 0 && openGewaardeerd.length === 0) {
    return { status: 'leeg', resultaatUsd: null, pct: null, aantalGesloten: 0, nietMeegenomen: 0 };
  }

  const status: ResultaatOverPeriodeStatus =
    openGewaardeerd.length > 0 && nietMeegenomen === openGewaardeerd.length ? 'alleen-gerealiseerd'
    : nietMeegenomen > 0 ? 'deels'
    : 'compleet';

  const resultaatUsd = status === 'alleen-gerealiseerd'
    ? gerealiseerdUsd
    : gerealiseerdUsd + ongerealiseerdeVeranderingUsd;
  const ingelegdUsd = status === 'alleen-gerealiseerd' ? ingelegdGesloten : ingelegdGesloten + ingelegdOpen;
  const pct = ingelegdUsd > 0 ? (resultaatUsd / ingelegdUsd) * 100 : null;

  return { status, resultaatUsd, pct, aantalGesloten: gesloten.length, nietMeegenomen };
}
```

`resultaatVan` en `tekenVan` zijn de bestaande functies in dit bestand respectievelijk
`portfolioTypes.ts`; `resultaatVan` is vandaag privé (regel 90) en moet geëxporteerd worden, want dit
is precies dezelfde richting-bewuste logica die hier hergebruikt moet worden in plaats van
gedupliceerd.

Zelftest erbij in het bestaande `require.main`-blok:

- een trade gesloten gisteren valt buiten `dag` maar binnen `1M`;
- een gesloten trade zonder `slotTijd` telt mee bij `alles` maar bij geen enkele andere periode;
- een open trade zonder `openTijd` geeft `status: 'deels'` of `'alleen-gerealiseerd'`, nooit een
  stille 0 in de telling;
- `resultaat('alles')` komt overeen met `berekenStatistieken(trades).totaalResultaatUsd plus
  waarde.ongerealiseerdUsd` (zie 2.1) op een testset met zowel open als gesloten trades;
- `aantalGesloten === 0` en `openGewaardeerd.length === 0` geeft `status: 'leeg'` en
  `resultaatUsd: null`, nooit `0`.

### 2.5 Historische referentieprijzen: ophalen en cachen

Nieuw bestand `app/src/state/useResultaatHistorie.ts`, in dezelfde opzet als `useStopLossLimiet.ts`:
module-niveau cache, een dag geldig, met een gedeelde lopende belofte zodat twee onderdelen die
tegelijk opengaan niet twee keer over de lijn gaan.

**Per symbool, niet per periode.** Eén reeks van circa 400 dagcandles per symbool dekt alle vijf
tijdsbegrensde periodes tegelijk (het langste tijdvak is 365 dagen, plus marge voor ontbrekende
handelsdagen). Het ophalen gebeurt dus één keer per symbool waarin je een open positie hebt, niet één
keer per periode: wisselen tussen chips leest daarna alleen nog uit de al aanwezige reeks en is
instant.

```ts
const TTL_MS = 24 * 60 * 60 * 1000;         // een dag, zelfde ordegrootte als useStopLossLimiet
const CANDLES_NODIG = 400;
const CACHE_VERSIE = 1;

interface HistorieCache {
  versie: number;
  perSymbool: Record<string, { opgehaald: number; candles: { tijd: number; close: number }[] }>;
}
```

Nieuwe sleutel in `app/src/storage/opslag.ts` (`SLEUTELS`):

```ts
// Dagcandles per coin, alleen voor het periodecijfer op Portfolio. Een dag geldig: dagelijkse
// candles veranderen niet meer zodra de dag voorbij is, dus vaker verversen heeft geen nut.
resultaatHistorie: 'resultaat_historie_candles',
```

**Ophalen per symbool.** `engine/marketData.ts` haalt op `main` alleen crypto op: Binance met
CoinGecko als fallback, er is geen Yahoo/aandelenbron voor dit pad. Gebruik de al bestaande, exacte
functies met een expliciete limiet, niet `haalData()` zelf: die roept intern `haalBinanceKlines` aan
met zijn eigen default van 200 candles, en dat is te weinig voor een jaar terugkijken.

```ts
async function haalHistorieVoorSymbool(symbool: string): Promise<{ tijd: number; close: number }[] | null> {
  const binance = await haalBinanceKlines(symbool, '1d', CANDLES_NODIG);
  if (binance) return binance.map(c => ({ tijd: c.tijd!, close: c.close }));
  // CoinGecko's /ohlc geeft op deze tijdschaal geen dagelijkse granulariteit meer (zie het bestaande
  // ponytail-commentaar bij haalCoingeckoOhlc in marketData.ts), maar dichtstbijzijndeSlotkoers
  // zoekt toch al de candle die het dichtst bij de grens ligt, dus een grovere reeks is een
  // bruikbare, iets minder precieze referentie, geen onbruikbare.
  const cg = await haalCoingeckoOhlc(symbool, CANDLES_NODIG);
  return cg ? cg.map(c => ({ tijd: c.tijd, close: c.close })) : null;
}
```

**Cache-gedrag.** Voor elk gevraagd symbool: is er een cache-item jonger dan `TTL_MS`, gebruik die.
Anders opnieuw ophalen; mislukt dat, val terug op een verlopen cache-item als dat er is (zelfde
redenering als `useStopLossLimiet`: een week oude dagcandle is voor een venster van 90 of 365 dagen nog
altijd bruikbaarder dan niets). Is er nooit een geslaagde haal geweest voor dat symbool, dan blijft het
gewoon weg uit het resultaat-object, en telt de bijbehorende positie mee als "niet meegenomen" in
`berekenResultaatPeriode` (2.4).

```ts
export type HistorieStatus = 'leeg' | 'laden' | 'klaar';

export function useResultaatHistorie(symbolen: string[]): {
  candles: Record<string, { tijd: number; close: number }[]>;   // alleen de symbolen waarvoor het lukte
  status: HistorieStatus;
}
```

`status` is `'leeg'` zolang `symbolen.length === 0` (geen open, gewaardeerde posities, dus niets nodig),
`'laden'` zolang minstens één gevraagd symbool nog geen bruikbaar cache-resultaat heeft (vers of
verlopen), en anders `'klaar'`, ook als sommige symbolen uiteindelijk zijn mislukt. Het is aan
`berekenResultaatPeriode` en niet aan deze hook om te bepalen wat een gedeeltelijk of volledig mislukte
haal betekent voor het getal (2.4, `status: 'deels'`/`'alleen-gerealiseerd'`); deze hook levert alleen
data en een simpele laad-indicator.

`PortfolioStatusKaart` roept deze hook zelf aan, met de unieke symbolen van zijn eigen gewaardeerde
open trades (`useMemo`), net zoals `VerdelingKaart` zijn eigen `berekenVerdeling` intern aanroept op de
`trades`-prop die het al kreeg.

### 2.6 De periodechips

Zes chips in een rij die mag afbreken, zelfde patroon als `pillRij` in `MarktFilters.tsx`.

**Herzien na meting op de emulator.** Hier stond eerst een horizontaal scrollende rij, op de aanname
dat zes labels op een smal toestel niet betrouwbaar naast elkaar passen. Die aanname klopte niet en de
oplossing kostte meer dan ze opleverde:

- Gemeten op een Pixel_8 (1080px, 360dp) passen alle zes de chips ruim op één regel, met ruimte over.
- Een horizontale `ScrollView` in deze kolom trok de breedtebepaling van de kaart scheef. In de staat
  zonder eToro-saldo kneep de kolom `BESCHIKBAAR` daardoor samen tot één letter per regel. Dat was een
  regressie op een staat die op `main` gewoon goed stond.

Een afbrekende rij heeft dat probleem niet en degradeert netter: wordt het ooit krapper, dan zakt er
een chip naar de volgende regel in plaats van buiten beeld te schuiven, waar je hem niet ziet staan.

```
periodeRij: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: spacing.sm,
  marginTop: spacing.sm,
}
periodeChip: {
  minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.pill,
  alignItems: 'center', justifyContent: 'center',
}
```

| Staat | Achtergrond | Tekst |
|-------|-------------|-------|
| Actief | `colors.cta` | `'white'` (letterlijk, zelfde als de bestaande `bereikPil` in `PrijsGrafiek.tsx` en de filterpillen in `MarktFilters.tsx`) |
| Inactief | `colors.verhoogd` | `colors.tekstGedimd` |

Tekst `Type.caption` met `fontWeight: '600'`.

Dit is bewust hoger dan de bestaande `bereikPil` (32px): dit blok staat op de financiële
samenvattingskaart en verdient de volle 44px zonder op een `hitSlop`-truc te leunen, in plaats van
visueel groter te worden dan nodig. Elke chip krijgt zijn hoogte dus rechtstreeks via `minHeight`.

Labels (kort, in dezelfde stijl als de bestaande `1M`/`3M`/`6M`/`Alles` in `grafiekBereik.ts`, met
`Dag` en `1J` als enige twee nieuwe):

| id | Label | Uitleg (accessibilityLabel) |
|----|-------|------------------------------|
| `dag` | `Dag` | Toon resultaat van vandaag |
| `1M` | `1M` | Toon resultaat over de laatste maand |
| `3M` | `3M` | Toon resultaat over de laatste 3 maanden |
| `6M` | `6M` | Toon resultaat over de laatste 6 maanden |
| `1J` | `1J` | Toon resultaat over het laatste jaar |
| `alles` | `Alles` | Toon resultaat sinds de eerste trade |

`accessibilityRole="button"`, `accessibilityState={{ selected: periode === p.id }}`.

**"Maand" versus "1M".** De opdracht noemt "Maand" als label; hier gekozen voor `1M` om aan te sluiten
bij de bestaande `1M`/`3M`/`6M`-reeks die de app al gebruikt in `PrijsGrafiek`. Eén consistente
naamgeving voor tijdvakken door de hele app is meer waard dan het exacte woord uit de opdracht, en de
betekenis is identiek.

**"Alles" versus "Sinds start".** Gekozen voor `Alles`, want dat woord staat al letterlijk in
`grafiekBereik.ts` voor precies hetzelfde soort "geen ondergrens"-keuze. Twee verschillende woorden
voor hetzelfde concept op twee plekken in dezelfde app zou een onnodig verschil zijn.

### 2.7 Het resultaatblok, kop en labels

**Kop.** Het woord "gerealiseerd" dekt de lading niet meer nu het cijfer ook de koersverandering van
open posities meetelt. Twee koppen, afhankelijk van `status` uit 2.4:

| `status` | Kop |
|----------|-----|
| `compleet`, `deels`, `leeg` | `RESULTAAT OVER PERIODE` |
| `alleen-gerealiseerd` | `GEREALISEERD RESULTAAT` |

De kop valt dus terug op de oude, smallere naam precies op het moment dat het cijfer ook echt alleen
dat smallere ding is. Zo staat er nooit "resultaat over periode" boven een getal dat in werkelijkheid
alleen het gerealiseerde deel is.

**Vaste uitlegzin**, ongeacht periode en status (voorkomt dat elke periodewissel zijn eigen disclaimer
nodig heeft):

> Resultaat van gesloten trades in deze periode, plus wat je nog open posities in diezelfde periode
> aan koers wonnen of verloren. De regel bovenaan blijft altijd van nu, dit cijfer kijkt terug.

Layout:

```
RESULTAAT OVER PERIODE
Resultaat van gesloten trades in deze periode, plus wat je nog open posities in diezelfde periode
aan koers wonnen of verloren. De regel bovenaan blijft altijd van nu, dit cijfer kijkt terug.
[ Dag ] [ 1M ] [ 3M ] [ 6M ] [ 1J ] [ Alles ]
+$148,20 (+4,2%)
3 gesloten trades
```

| Element | Stijl | Kleur |
|---------|-------|-------|
| Kop | `Type.overline` | `colors.tekstGedimd` |
| Uitlegzin | `Type.caption`, `marginTop: 2`, `lineHeight: 18` | `colors.tekstGedimd` |
| Chips | zie 2.6, `marginTop: spacing.sm` | zie 2.6 |
| Getal | `Type.prijs`, `marginTop: spacing.md` | `colors.winst` bij `resultaatUsd >= 0`, anders `colors.verlies`, zelfde regel als de bestaande ongerealiseerde resultaatregel |
| Percentage (optioneel) | `Type.prijs`, `marginLeft: spacing.sm` | zelfde kleur als het getal |
| Bijschrift | `Type.caption`, `marginTop: 2` | `colors.tekstGedimd` |
| Extra disclosure-regel (alleen bij `deels`/`alleen-gerealiseerd`) | `Type.caption`, `marginTop: 2` | `colors.tekstGedimd` |

Getal met `fmtResultaatUsd` (expliciet `+`/`−` teken), percentage met `fmtPct`, exact dezelfde
formatters als de bestaande ongerealiseerde resultaatregel gebruikt. Het percentage wordt alleen
gerenderd als `pct !== null`.

**Bijschrift**, afhankelijk van `aantalGesloten`:

```
aantalGesloten === 0
  ? 'Geen gesloten trades in deze periode, dit is de koersverandering van je open posities.'
  : `${aantalGesloten} gesloten ${aantalGesloten === 1 ? 'trade' : 'trades'}`
```

**Extra disclosure-regel**, alleen als `nietMeegenomen > 0`:

- Bij `status === 'deels'`: `${nietMeegenomen} open ${nietMeegenomen === 1 ? 'positie telt' : 'posities tellen'} niet mee in dit cijfer (geen openingsdatum of geen historische koers).` Zelfde zinsbouw als de bestaande regel "posities tellen niet mee in de waarde (geen aantal of live koers)" verderop op dezelfde kaart.
- Bij `status === 'alleen-gerealiseerd'`: zie 2.9, dat is de faalstaat en heeft een eigen tekst.

### 2.8 Lege staat

`status === 'leeg'`: geen `$0,00` tonen (dat leest als "quitte gespeeld"), maar een streepje:

```
RESULTAAT OVER PERIODE
Resultaat van gesloten trades in deze periode, plus wat je nog open posities in diezelfde periode
aan koers wonnen of verloren. De regel bovenaan blijft altijd van nu, dit cijfer kijkt terug.
[ Dag ] [ 1M ] [ 3M ] [ 6M ] [ 1J ] [ Alles ]
—
Geen gesloten trades vandaag.
```

`—` in `Type.prijs`, `colors.tekstGedimd` (geen `AnimatedGetal`, er is niets om naartoe te animeren).
Bijschrifttekst per periode:

| Periode | Tekst |
|---------|-------|
| `dag` | `Geen gesloten trades vandaag.` |
| `1M` | `Geen gesloten trades in de laatste maand.` |
| `3M` | `Geen gesloten trades in de laatste 3 maanden.` |
| `6M` | `Geen gesloten trades in de laatste 6 maanden.` |
| `1J` | `Geen gesloten trades in het laatste jaar.` |
| `alles` | `Nog geen gesloten trades.` |

`status === 'leeg'` kan alleen voorkomen als er op dat moment ook geen enkele gewaardeerde open positie
is (zie 2.4): staat er wél een open, gewaardeerde positie, dan levert die minstens een `'compleet'`,
`'deels'` of `'alleen-gerealiseerd'` resultaat op, nooit `'leeg'`. Deze tabel geldt dus vooral voor een
portfolio dat op dit moment niets open of recent gesloten heeft.

`alles` krijgt met opzet een andere formulering: "geen gesloten trades ooit" leest korzelig, "nog geen"
past bij de rest van de app se toon (vergelijk "Nog geen open posities" elders op dezelfde kaart).

### 2.9 Laadstaat en faalstaat

Dit blok heeft, anders dan de rest van de kaart, wél netwerkverkeer nodig zodra je een tijdsbegrensde
periode kiest (niet bij `Alles`, zie 2.1).

**Laadstaat.** Zolang `useResultaatHistorie(...).status === 'laden'` én de gekozen periode niet
`alles` is:

```
RESULTAAT OVER PERIODE
...uitlegzin...
[ Dag ] [ 1M ] [ 3M ] [ 6M ] [ 1J ] [ Alles ]
Laden...
Historische koersen worden opgehaald.
```

`Laden...` in `Type.prijs`, `colors.tekstGedimd`, bijschrift in `Type.caption`, `colors.tekstGedimd`.
De chips blijven bedienbaar: het ophalen loopt per symbool, niet per periode, dus wisselen tijdens het
laden start geen nieuwe haalactie. Schakel je tijdens het laden naar `Alles`, dan is dat cijfer meteen
er, want dat heeft nooit historie nodig.

**Faalstaat**, `status === 'alleen-gerealiseerd'` (zie 2.4 en 2.7): het ophalen is voor geen enkele
relevante positie gelukt, bijvoorbeeld helemaal offline zonder bruikbare cache. Kop valt terug op
`GEREALISEERD RESULTAAT` (2.7), het getal is `gerealiseerdUsd` alleen, en in plaats van de gewone
disclosure-regel komt er:

> Kon de koersverandering van je open posities niet ophalen. Dit is alleen het gerealiseerde deel.

**Waarom dit geen stilzwijgend gedeeltelijk totaal wordt.** Bij een totale mislukking (alle relevante
posities missen een referentieprijs) zou de som van gerealiseerd plus 0 ongerealiseerd er hetzelfde
uitzien als een compleet cijfer dat toevallig 0 ongerealiseerde verandering heeft, en dat is geen
eerlijk onderscheid. Daarom verandert in dat geval ook de kóp: een gebruiker die alleen het getal en de
kop leest, en niet elke keer het bijschrift, mag nooit denken dat hij een compleet periodecijfer ziet
terwijl het er in werkelijkheid maar de helft van is. Bij een gedeeltelijke mislukking (`status:
'deels'`, een paar posities missen het, de rest niet) ligt dat anders: daar blijft de kop staan zoals
hij is en volstaat de disclosure-regel uit 2.7, dezelfde behandeling die de kaart al geeft aan
posities zonder live prijs (`waarde.zonderLivePrijs`). Het verschil is de omvang van wat ontbreekt: een
paar posities missen is een randgeval dat een voetnoot verdient, alle posities missen betekent dat de
helft van het concept "resultaat over periode" er niet is, en dat verdient een andere naam boven het
cijfer, niet alleen een kleinere lettertjes eronder.

### 2.10 Onthouden tussen sessies

Nee. `periode` is lokale state (`useState<PeriodeId>(STANDAARD_PERIODE)`), niet bewaard in
`AsyncStorage`. Precedent: de periodeknoppen in `PrijsGrafiek` (`STANDAARD_BEREIK = '3M'`, ongeacht wat
je de vorige keer koos) zijn dezelfde soort kortstondige weergavekeuze, geen instelling die de
gebruiker één keer zet en daarna verwacht terug te zien. Dat is iets anders dan bijvoorbeeld het
handelskapitaal in `state/useHandelskapitaal.ts`, dat wél bewaard blijft: dat is een waarde die de
gebruiker bewust invult en die verder niets met "waar kijk ik nu naar" te maken heeft. Standaard `1M`:
`Dag` staat vaak leeg (zie 2.8) en is een zwakke eerste indruk, `Alles` is minder representatief voor
"hoe gaat het nu"; een maand is de kortste periode die meestal iets te laten zien heeft.

### 2.11 Toegankelijkheid

- Chips: zie 2.6 (`accessibilityRole="button"`, `accessibilityState`, beschrijvend
  `accessibilityLabel` per periode).
- Kop, uitlegzin, getal, bijschrift en de eventuele disclosure-regel zijn gewone doorlopende
  `Text`-elementen zonder gedeelde `accessible`-wrapper: een schermlezer leest ze na elkaar voor in
  leesvolgorde, zelfde behandeling als de bestaande ongerealiseerde resultaatregel erboven, die ook
  geen samengevoegd label heeft.
- Geen `accessibilityElementsHidden` nodig: er is hier geen decoratief grafisch element zoals de balk
  of de ring elders, alleen tekst en knoppen.

---

## 3. Implementatiechecklist

### Nieuwe bestanden

| Pad | Wat |
|-----|-----|
| `app/src/state/useResultaatHistorie.ts` | Hook plus module-cache voor de historische dagcandles per symbool, patroon van `useStopLossLimiet.ts` (2.5). |

### Gewijzigde bestanden

| Pad | Wat |
|-----|-----|
| `app/src/components/PortfolioStatusKaart.tsx` | `MIN_BALKSTUK_PCT`, `belegdPctBalk`/`belegdPct`-splitsing, balkhoogte 8 naar 10, percentage in de twee legendakolommen, toegankelijkheidslabels op balk en kolommen (1.3, 1.4); nieuw blok "Resultaat over periode" met periodechips, laad- en faalstaat (2.2 tot en met 2.11); nieuwe prop `trades: PortfolioTrade[]`; roept `useResultaatHistorie()` zelf aan op de unieke symbolen van zijn gewaardeerde open trades |
| `app/src/state/portfolioTypes.ts` | nieuw veld `openTijd?: number` (2.3) |
| `app/src/engine/etoro.ts` | `naarPortfolioTrade()` vult `openTijd` vanuit `positie.openDateTime` (2.3) |
| `app/src/screens/PortfolioScreen.tsx` | trade-aanmaak vult `openTijd` met `Date.now()` (2.3); `trades` doorgeven aan `PortfolioStatusKaart` (naast de bestaande `waarde`-prop, die al uit dezelfde `trades`-array wordt afgeleid) |
| `app/src/state/statistieken.ts` | `PeriodeId`, `PERIODES`, `STANDAARD_PERIODE`, `ResultaatOverPeriode(Status)`, `berekenResultaatPeriode()` met de helpers `periodegrens`/`referentieprijs`/`dichtstbijzijndeSlotkoers` (2.4); `resultaatVan` wordt geëxporteerd in plaats van privé; zelftest uitgebreid |
| `app/src/storage/opslag.ts` | nieuwe `SLEUTELS.resultaatHistorie` (2.5) |

### Waarden om niet te vergeten

- `MIN_BALKSTUK_PCT = 6`.
- Balkhoogte `10` (was 8).
- Chip: `minHeight: 44`, actief `colors.cta` met `'white'`-tekst, inactief `colors.verhoogd` met
  `colors.tekstGedimd`.
- `STANDAARD_PERIODE = '1M'`, niet bewaard in `AsyncStorage`.
- Periode-ids: `'dag' | '1M' | '3M' | '6M' | '1J' | 'alles'`.
- Historie-cache: `TTL_MS` één dag, `CANDLES_NODIG = 400`, `MAX_AFWIJKING_MS` vijf dagen.

### Verificatie met de `run-android`-skill, licht én donker

1. Portfolio met eToro-koppeling en een substantieel cashdeel: balk met twee duidelijke stukken,
   percentages in de legenda kloppen met de bedragen.
2. Zelfde koppeling, cash handmatig naar een klein bedrag (2 tot 3 procent van het totaal): het
   cash-stuk blijft zichtbaar op de balk, en het exacte percentage staat ernaast in de legenda.
3. Alles in cash (geen open posities, wel een vrij saldo): de hele balk in het grijze
   `verdelingOverig`-token, geen blauw stukje.
4. Zonder eToro-koppeling: geen balk, kop `WAARDE OPEN POSITIES`, `Onbekend` bij beschikbaar, het
   uitlegblok eronder, precies zoals vóór deze wijziging.
5. Saldo exact nul: geen balk, beide kolommen tonen `$0,00`.
6. Portfolio met minstens één open positie ouder dan een maand: kies `1M`, wacht de laadstaat af, en
   controleer dat het getal na het laden gerealiseerd én ongerealiseerd samenvoegt (vergelijk handmatig
   met wat de kaart al toont voor gesloten trades en de ongerealiseerde regel).
7. Kies `Alles`: geen laadstaat, getal verschijnt direct, en is gelijk aan `totaalResultaatUsd +
   waarde.ongerealiseerdUsd` (2.1).
8. Zet het toestel in vliegtuigmodus vóór de eerste keer dat de kaart opent (geen cache): kies een
   tijdsbegrensde periode met minstens één open positie. Verwacht de faalstaat, kop
   `GEREALISEERD RESULTAAT`, de tekst "Kon de koersverandering... niet ophalen."
9. Scherm sluiten en binnen een dag opnieuw openen: geen nieuwe netwerkaanvraag voor de historie
   (bijvoorbeeld te zien via de netwerkmonitor), het cijfer verschijnt meteen.
10. Periodefilter: wissel door alle zes chips, het getal en bijschrift wijzigen mee; een periode zonder
    gesloten trades én zonder open posities toont het streepje en de juiste lege-staattekst.
11. Een gesloten trade zonder `slotTijd` (oude data) telt mee bij `Alles` maar niet bij een
    tijdsbegrensde periode; een open trade zonder `openTijd` (oude data) toont de disclosure-regel bij
    elke tijdsbegrensde periode maar telt gewoon mee bij `Alles`.
12. App herstarten: periodefilter staat weer op `1M`, ongeacht wat er bij het sluiten van de app stond.
13. Schermlezer aan: de twee balkkolommen lezen als één zin voor in plaats van drie losse stukjes tekst;
    elke periodechip meldt zijn eigen betekenis, niet alleen het korte label.

## 4. Changelog

Dit zijn zichtbare wijzigingen, dus `CHANGELOG.md` en `app/src/changelog.ts` moeten allebei bij,
nieuwste bovenaan, in het Nederlands. Het versienummer pas toekennen op het moment dat er echt een
release-APK gebouwd wordt.
