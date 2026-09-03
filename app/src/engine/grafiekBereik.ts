// Welke periode de prijsgrafiek toont, en welke keuzes daarvoor überhaupt zin hebben.
//
// Apart van de grafiek zelf omdat het rekenwerk is dat fout kan gaan op de randen: een bron die
// minder historie teruggeeft dan de knop belooft, candles zonder tijdstempel, of een filter dat zo
// weinig punten overhoudt dat er geen lijn meer te tekenen valt. PrijsGrafiek.tsx trekt
// react-native binnen en draait daardoor niet in Node; dit bestand wel, met de self-check onderaan.
//
// Achtergrond: de grafiek toonde altijd de laatste 90 candles, zonder keuze. Bij Binance is dat
// ongeveer drie maanden, en dat blijft hier de standaard, zodat het scherm er hetzelfde uitziet
// als je niets aanraakt.
import { Candle } from './types';

export type BereikId = '1M' | '3M' | '6M' | 'alles';

export interface Bereik {
  id: BereikId;
  label: string;
  // null = alles wat de bron teruggaf.
  dagen: number | null;
}

export const BEREIKEN: readonly Bereik[] = [
  { id: '1M', label: '1M', dagen: 30 },
  { id: '3M', label: '3M', dagen: 90 },
  { id: '6M', label: '6M', dagen: 180 },
  { id: 'alles', label: 'Alles', dagen: null },
];

export const STANDAARD_BEREIK: BereikId = '3M';

// De grafiek heeft minstens twee punten nodig, anders is er geen lijn.
const MIN_PUNTEN = 2;
const DAG_MS = 86_400_000;

// Hoeveel dagen historie zit er in deze candles? 0 als de bron geen tijdstempels meegeeft.
export function spanInDagen(candles: Candle[]): number {
  if (candles.length < MIN_PUNTEN) return 0;
  const eerste = candles[0]?.tijd;
  const laatste = candles[candles.length - 1]?.tijd;
  if (!eerste || !laatste || laatste <= eerste) return 0;
  return (laatste - eerste) / DAG_MS;
}

// Alleen knoppen tonen die daadwerkelijk iets wegsnijden. Een "6M" naast een "Alles" die exact
// hetzelfde laten zien is geen keuze maar een knop die niets doet, en dat is precies het soort
// ding waarvan je gaat denken dat de app kapot is.
//
// De marge van één dag vangt op dat de laatste candle van vandaag is: 200 dagelijkse candles
// spannen 199 dagen, en dan hoort 180 er nog gewoon bij te staan.
export function beschikbareBereiken(candles: Candle[]): Bereik[] {
  const span = spanInDagen(candles);
  if (span <= 0) return [];
  const bruikbaar = BEREIKEN.filter(b => b.dagen === null || b.dagen < span - 1);
  // Blijft alleen "Alles" over, dan valt er niets te kiezen en hoort de rij helemaal weg.
  return bruikbaar.length < 2 ? [] : bruikbaar;
}

// Welk bereik er echt getoond wordt. Staat de keuze op iets wat deze coin niet kan leveren (een
// andere coin met minder historie, of een bron die terugvalt op CoinGecko), dan zakt hij terug naar
// 'alles' in plaats van een lege grafiek te tonen.
export function geldigBereik(candles: Candle[], gekozen: BereikId): BereikId {
  const beschikbaar = beschikbareBereiken(candles);
  if (beschikbaar.length === 0) return 'alles';
  return beschikbaar.some(b => b.id === gekozen) ? gekozen : 'alles';
}

// De candles die bij dit bereik horen. Filtert op tijd en niet op aantal, want de CoinGecko-fallback
// levert vier-uurs candles: "de laatste 90" is daar drie weken en niet drie maanden.
export function reeksVoorBereik(candles: Candle[], gekozen: BereikId): Candle[] {
  if (candles.length < MIN_PUNTEN) return candles;

  const id = geldigBereik(candles, gekozen);
  const bereik = BEREIKEN.find(b => b.id === id);
  if (!bereik || bereik.dagen === null) return candles;

  const laatste = candles[candles.length - 1]?.tijd;
  if (!laatste) return candles;

  const vanaf = laatste - bereik.dagen * DAG_MS;
  const gefilterd = candles.filter(c => typeof c.tijd === 'number' && c.tijd >= vanaf);
  // Te weinig over om een lijn van te maken: dan liever de hele reeks dan een kapotte grafiek.
  return gefilterd.length >= MIN_PUNTEN ? gefilterd : candles;
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/grafiekBereik.ts`
if (require.main === module) {
  const DAG = DAG_MS;
  const nu = Date.parse('2026-09-03T00:00:00Z');
  // n dagelijkse candles die op `nu` eindigen.
  const dagelijks = (n: number): Candle[] =>
    Array.from({ length: n }, (_, i) => ({
      open: 1, high: 1, low: 1, close: 1, volume: 0,
      tijd: nu - (n - 1 - i) * DAG,
    }));

  // ---------- Hoeveel historie zit erin ----------
  console.assert(Math.round(spanInDagen(dagelijks(200))) === 199, '200 dagcandles spannen 199 dagen');
  console.assert(spanInDagen([]) === 0, 'geen candles is geen span');
  console.assert(spanInDagen([{ open: 1, high: 1, low: 1, close: 1, volume: 0 }]) === 0,
    'candles zonder tijd geven geen span');

  // ---------- Welke knoppen horen er te staan ----------
  const bij200 = beschikbareBereiken(dagelijks(200)).map(b => b.id);
  console.assert(bij200.join(',') === '1M,3M,6M,alles',
    `met 200 dagen staan alle bereiken er, was: ${bij200.join(',')}`);

  const bij100 = beschikbareBereiken(dagelijks(100)).map(b => b.id);
  console.assert(bij100.join(',') === '1M,3M,alles',
    `met 100 dagen valt 6M weg, was: ${bij100.join(',')}`);

  // 30 dagen historie: 1M laat exact hetzelfde zien als Alles, dus er valt niets te kiezen.
  console.assert(beschikbareBereiken(dagelijks(30)).length === 0,
    'met 30 dagen is er geen zinnige keuze en verdwijnt de rij');
  console.assert(beschikbareBereiken([]).length === 0, 'zonder candles geen keuzerij');

  // ---------- Terugvallen ----------
  console.assert(geldigBereik(dagelijks(100), '6M') === 'alles',
    '6M op een coin met 100 dagen zakt terug naar alles');
  console.assert(geldigBereik(dagelijks(200), '6M') === '6M', '6M mag bij genoeg historie gewoon');
  console.assert(geldigBereik(dagelijks(10), '3M') === 'alles', 'te weinig historie valt terug');

  // ---------- De reeks zelf ----------
  const maand = reeksVoorBereik(dagelijks(200), '1M');
  console.assert(maand.length === 31, `1M houdt 31 dagcandles over, was: ${maand.length}`);
  console.assert(maand[maand.length - 1].tijd === nu, '1M eindigt op de laatste candle');

  const alles = reeksVoorBereik(dagelijks(200), 'alles');
  console.assert(alles.length === 200, 'alles houdt alles');

  // Een bereik dat deze coin niet heeft levert de hele reeks, geen lege grafiek.
  const teKort = reeksVoorBereik(dagelijks(40), '6M');
  console.assert(teKort.length === 40, `te lang bereik geeft de hele reeks, was: ${teKort.length}`);

  // Vier-uurs candles: filteren op tijd, niet op aantal. 30 dagen aan 4h-candles is 180 punten,
  // en 1M hoort ze dan allemaal te houden in plaats van er 90 te pakken.
  const vierUurs: Candle[] = Array.from({ length: 180 }, (_, i) => ({
    open: 1, high: 1, low: 1, close: 1, volume: 0,
    tijd: nu - (179 - i) * (DAG / 6),
  }));
  console.assert(reeksVoorBereik(vierUurs, '1M').length === 180,
    'bij vier-uurs candles telt de tijd, niet het aantal');

  // Zonder tijdstempels valt alles terug op de hele reeks in plaats van te crashen.
  const zonderTijd: Candle[] = Array.from({ length: 50 }, () => ({
    open: 1, high: 1, low: 1, close: 1, volume: 0,
  }));
  console.assert(reeksVoorBereik(zonderTijd, '1M').length === 50,
    'candles zonder tijd geven gewoon de hele reeks');

  console.log('grafiekBereik.ts self-check geslaagd');
}
