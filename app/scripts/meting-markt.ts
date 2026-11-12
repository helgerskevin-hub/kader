// Meting N: Markt na kosten. Gebruikt de kern van meting-kansen.ts (data, simulatie met kosten,
// instap op de open na het signaal, bootstrap) en het plan dat daar gekozen is: stop 3x ATR,
// doel 3R, hoogstens 30 dagen. Dat plan wordt hier niet opnieuw afgesteld.
//
// De beslisregels staan in docs/markt-kosten-plan.md, paragraaf 5, en lagen vast voordat dit
// script voor het eerst draaide. Twee trappen:
//   trap 1 (KOOP): het signaal volgen houdt na kosten aantoonbaar geld over;
//   trap 2 (STERK KOOP, BEVESTIGD): aantoonbaar beter dan de gewone KOOP-coins op dezelfde dag.
//
// Gebruik (vanuit app/): npx tsx scripts/meting-markt.ts poort|score|onderdelen|toets
// De eerste drie tonen alleen de afsteljaren. 'toets' draait één keer, met de gekozen regels.

import {
  Bar, Regel, TradeUit, Opties, draai, interval, gem, f, mediaan, jaarVan, jaren, afstelJaren, toetsJaren,
  PLAN, AFSTEL_TOT, TOETS_VANAF, alleBars,
} from './meting-kansen';
import { DREMPEL_KOOP, DREMPEL_STERK_KOOP, DREMPEL_HOOG } from '../src/engine/drempels';

// --- de poortvarianten, vooraf vastgelegd in het plan -------------------------------------

const poorten: [string, (b: Bar) => boolean][] = [
  ['geen poort (ijk)', () => true],
  ['huidig: BTC > EMA50, breedte stijgt', b => b.btc50 && b.breedteStijgt],
  ['huidig + BTC > EMA200', b => b.btc50 && b.breedteStijgt && b.btc200],
  ['huidig + breedte >= 50%', b => b.btc50 && b.breedteStijgt && (b.breedte ?? 0) >= 0.5],
  ['BTC > EMA50 en EMA200 (zonder breedte)', b => b.btc50 && b.btc200],
];

// --- uitvoer: alleen de afsteljaren -------------------------------------------------------

const afstel = (t: TradeUit[]) => t.filter(x => x.datum < AFSTEL_TOT);
const toets = (t: TradeUit[]) => t.filter(x => x.datum >= TOETS_VANAF);

function jarenPlus(t: TradeUit[], lijst: string[], waarde: (x: TradeUit) => number | null): [number, number] {
  let plus = 0, geteld = 0;
  for (const j of lijst) {
    const w = t.filter(x => jaarVan(x.datum) === j).map(waarde).filter((x): x is number => x !== null);
    if (w.length >= 10) { geteld++; if (gem(w) > 0) plus++; }
  }
  return [plus, geteld];
}

function kop(lijst: string[], metExcess: boolean) {
  console.log(
    '  ' + 'regel'.padEnd(42) + 'n'.padStart(6) + 'stop%'.padStart(7) + 'netto'.padStart(8) + '  90%-interval netto'.padEnd(20) + ' jr+' +
    (metExcess ? 'excess'.padStart(9) + '  90%-interval excess'.padEnd(22) + ' jr+' : '') +
    ' | ' + lijst.map(j => j.slice(2).padStart(6)).join(''),
  );
}

// Eén regel, op de trades die meegegeven worden (afstel of toets).
function toon(naam: string, t: TradeUit[], lijst: string[], metExcess: boolean) {
  const [lo, hi] = interval(t);
  const [plus, geteld] = jarenPlus(t, lijst, x => x.r);
  let uit = '  ' + naam.padEnd(42) + String(t.length).padStart(6) + (t.length ? mediaan(t.map(x => x.stopPct)).toFixed(1) : '.').padStart(7) +
    f(gem(t.map(x => x.r))).padStart(8) + `  [${f(lo, 2)}, ${f(hi, 2)}]`.padEnd(20) + ` ${plus}/${geteld}`;
  if (metExcess) {
    const ex = t.filter(x => x.excess !== null);
    const [el, eh] = interval(ex, x => x.excess);
    const [ep, eg] = jarenPlus(t, lijst, x => x.excess);
    uit += f(gem(ex.map(x => x.excess as number))).padStart(9) + `  [${f(el, 2)}, ${f(eh, 2)}]`.padEnd(22) + ` ${ep}/${eg}`;
  }
  uit += ' | ' + lijst.map(j => {
    const rs = t.filter(x => jaarVan(x.datum) === j).map(x => x.r);
    return (rs.length >= 10 ? f(gem(rs), 2) : '.').padStart(6);
  }).join('');
  console.log(uit);
}

const regelVan = (naam: string, kiest: (b: Bar) => boolean): Regel => ({ naam, kiest, niveaus: PLAN });

// --- de losse onderdelen van de Markt-score (analyzer.ts, momentumprofiel) -----------------

const onderdelen: [string, (b: Bar) => boolean][] = [
  ['trend op (EMA20 > EMA50)', b => b.ema20 > b.ema50],
  ['slot boven EMA20', b => b.close > b.ema20],
  ['RSI gezond (45 tot 68)', b => b.rsi >= 45 && b.rsi <= 68],
  ['MACD bullish', b => b.macdBullish],
  ['volume >= 1,2x', b => b.volumeRatio >= 1.2],
  ['volume >= 1,5x', b => b.volumeRatio >= 1.5],
];

const scoreRegels: [string, (b: Bar) => boolean][] = [
  [`score >= ${DREMPEL_KOOP} (KOOP)`, b => b.score >= DREMPEL_KOOP],
  ['score >= 65', b => b.score >= 65],
  [`score >= ${DREMPEL_STERK_KOOP} (STERK KOOP)`, b => b.score >= DREMPEL_STERK_KOOP],
  [`score >= ${DREMPEL_HOOG}`, b => b.score >= DREMPEL_HOOG],
  ['BEVESTIGD (high conviction)', b => b.hc],
  ['score onder 55 (geen KOOP)', b => b.score < DREMPEL_KOOP],
];

const onderdeel = process.argv[2] ?? 'poort';

if (onderdeel === 'poort') {
  console.log('METING N, stap 1: de klimaatpoort. Elke bar met het plan, 1% per kant (alleen de afsteljaren).');
  console.log('Een poort is iets waard als de netto R ermee aantoonbaar boven nul komt en de verliesjaren dempt.\n');
  kop(afstelJaren, false);
  for (const [naam, poort] of poorten) toon(naam, afstel(draai(regelVan(naam, poort))), afstelJaren, false);
  console.log('\nIdem, alleen KOOP volgens Markt (score >= 55):');
  kop(afstelJaren, false);
  for (const [naam, poort] of poorten) toon(naam, afstel(draai(regelVan(naam, b => poort(b) && b.score >= DREMPEL_KOOP))), afstelJaren, false);
}

// Voor stap 2 en 3 kiest het script zelf geen poort: het toont elke variant die stap 1 overleefde.
const poortNaam = process.argv[3] ?? 'huidig';
const gekozenPoort = poorten.find(([naam]) => naam.startsWith(poortNaam));

if (onderdeel === 'score' || onderdeel === 'onderdelen') {
  if (!gekozenPoort) throw new Error(`Onbekende poort: ${poortNaam}`);
  const [pNaam, poort] = gekozenPoort;
  const lijst = onderdeel === 'score' ? scoreRegels : onderdelen;
  console.log(`METING N, ${onderdeel === 'score' ? 'stap 2: de score' : 'stap 3: de losse onderdelen'}. Poort: ${pNaam}. Alleen de afsteljaren.`);
  console.log('Excess = netto R min die van ELKE coin op dezelfde dag met de poort open.\n');
  const ijk: Opties = { ijkKiest: poort, ijkNaam: `poort:${pNaam}`, ijkMin: 10 };
  kop(afstelJaren, true);
  toon('elke coin, poort open (ijk)', afstel(draai(regelVan('ijk', poort), ijk)), afstelJaren, true);
  for (const [naam, kiest] of lijst) toon(naam, afstel(draai(regelVan(naam, b => poort(b) && kiest(b)), ijk)), afstelJaren, true);

  if (onderdeel === 'score') {
    console.log(`\nTrap 2: excess tegen de gewone KOOP-coins (score >= ${DREMPEL_KOOP}) op dezelfde dag.\n`);
    const koop = (b: Bar) => poort(b) && b.score >= DREMPEL_KOOP;
    const ijk2: Opties = { ijkKiest: koop, ijkNaam: `koop:${pNaam}`, ijkMin: 5 };
    kop(afstelJaren, true);
    for (const [naam, kiest] of scoreRegels.slice(1, 5)) toon(naam, afstel(draai(regelVan(naam, b => koop(b) && kiest(b)), ijk2)), afstelJaren, true);
  }
}

// --- de toets -----------------------------------------------------------------------------
//
// De regel die het afstellen koos voor trap 1. Trap 2 heeft geen regel: geen scoreband, BEVESTIGD
// of los onderdeel haalde in de afsteljaren de afstelpoort (stap 2 en 3), dus daar is niets te
// toetsen.
const POORT_N: (b: Bar) => boolean = b => b.btc50 && b.breedteStijgt && b.btc200;
export const MARKT_TRAP1: Regel = regelVan(
  `KOOP: score >= ${DREMPEL_KOOP}, poort + BTC > EMA200`,
  b => POORT_N(b) && b.score >= DREMPEL_KOOP,
);

// De lat voor trap 1 uit paragraaf 5 van het plan.
function oordeelTrap1(alle: TradeUit[]): string {
  const t = toets(alle);
  const [lo] = interval(t);
  const [tp, tg] = jarenPlus(alle, toetsJaren, x => x.r);
  const [ap, ag] = jarenPlus(alle, jaren, x => x.r);
  const eisen: [string, boolean][] = [
    [`minstens 150 trades in de toetsjaren (${t.length})`, t.length >= 150],
    [`netto R aantoonbaar boven nul, ondergrens interval ${f(lo, 2)}`, lo > 0],
    [`netto R positief in ${tp} van ${tg} toetsjaren (minstens 3 nodig)`, tp >= 3],
    [`netto R positief in ${ap} van ${ag} jaren in totaal (meerderheid nodig)`, ap > ag / 2],
  ];
  return (eisen.every(e => e[1]) ? 'HAALT DE LAT' : 'haalt de lat niet') + '\n' + eisen.map(([tekst, ok]) => `      ${ok ? 'ja ' : 'NEE'}  ${tekst}`).join('\n');
}

if (onderdeel === 'toets') {
  console.log(`METING N, de toets op ${toetsJaren[0]} t/m ${toetsJaren[toetsJaren.length - 1]}. Eén keer, met de regel uit het afstellen.\n`);
  kop(toetsJaren, false);
  const trap1 = draai(MARKT_TRAP1);
  toon(MARKT_TRAP1.naam, toets(trap1), toetsJaren, false);
  toon('idem, elke coin (zonder score)', toets(draai(regelVan('elke coin, poort N', POORT_N))), toetsJaren, false);
  toon('idem, met de huidige poort', toets(draai(regelVan('score, huidige poort', b => b.poort && b.score >= DREMPEL_KOOP))), toetsJaren, false);
  toon('idem, zonder poort', toets(draai(regelVan('score, geen poort', b => b.score >= DREMPEL_KOOP))), toetsJaren, false);
  toon('idem, zonder kosten', toets(draai(MARKT_TRAP1, { kosten: 0 })), toetsJaren, false);
  toon('idem, 1,5% per kant', toets(draai(MARKT_TRAP1, { kosten: 0.015 })), toetsJaren, false);
  toon('idem, stop minimaal 10%', toets(draai(MARKT_TRAP1, { minStop: 0.10 })), toetsJaren, false);
  console.log(`\n  Trap 1, ${MARKT_TRAP1.naam}: ${oordeelTrap1(trap1)}`);
  const dagenT = new Set<string>(), metSignaal = new Set<string>();
  for (const b of alleBars) {
    if (b.datum < TOETS_VANAF) continue;
    dagenT.add(b.datum);
    if (MARKT_TRAP1.kiest(b)) metSignaal.add(b.datum);
  }
  console.log(`\n  Dagen met de poort open en minstens een KOOP: ${metSignaal.size} van ${dagenT.size} (${(100 * metSignaal.size / dagenT.size).toFixed(0)}%)`);
  console.log('  Trap 2: geen regel haalde de afstelpoort, dus niet getoetst.');
}

export { poorten, toon, kop, regelVan, afstel, toets, jarenPlus, toetsJaren, jaren };
