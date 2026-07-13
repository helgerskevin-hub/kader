// Backtest-harness: meet wat het analyse-algoritme werkelijk doet op historische data.
//
// Draait de échte engine (scoorCandles uit src/engine/analyzer.ts), niet een kopie ervan.
// Look-ahead bias is per constructie onmogelijk: de engine krijgt alleen candles[0..i] te zien,
// dus hij kán de toekomst niet kennen.
//
// Gebruik:
//   node scripts/haal-historie.mjs      (eenmalig, vanuit de repo-root)
//   npm run backtest                    (vanuit app/)
//
// Twee metingen:
//
//   A. Signaalkwaliteit. Voor élke bar van élke coin: wat zou de engine hier hebben gezegd, en
//      hoe liep die trade af? Uitgesplitst per scorebucket. Omdat we élke bar meenemen, is de
//      regel "alle bars" meteen de eerlijke nulmeting: dat is wat een willekeurige instap
//      oplevert met dezelfde stop en hetzelfde doel. Een scorebucket die het daar niet van wint,
//      voegt niets toe.
//
//   B. De strategie zoals de app hem nu draait: alleen KOOP (score >= 55), alleen na de
//      R/R-filter, geen overlappende trades per coin.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoorCandles, MIN_CANDLES, MIN_RISK_REWARD, STANDAARD_UNIVERSUM } from '../src/engine/analyzer';
import { ema } from '../src/engine/indicators';
import { Candle, Trade } from '../src/engine/types';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATA = join(HIER, '..', '..', 'data', 'historie');
const UIT = join(HIER, '..', '..', 'data', 'backtest');

// Hoe lang we een trade maximaal aanhouden voor we hem op de close sluiten. De app doet geen
// uitspraak over houdduur, dus dit is een aanname van de harness. 30 dagen past bij een
// swing-tool met een doel op 3x ATR.
const MAX_BARS = 30;

type Simulatie = {
  symbool: string;
  datum: string;
  score: number;
  signaal: 'KOOP' | 'WATCH';
  highConviction: boolean;
  rr: number;
  doorRrFilter: boolean;
  r: number;                              // resultaat in R: (exit - entry) / risico
  exitReden: 'stop' | 'doel' | 'tijd';
  bars: number;
  btcRiskOn: boolean | null;              // BTC boven zijn EMA200 op dat moment
  fng: number | null;                     // Fear & Greed-stand op dat moment
};

// `tijd` is optioneel in het Candle-type (de CoinGecko-fallback vult het niet), maar de dump uit
// haal-historie.mjs heeft het altijd. Ontbreekt het toch, dan klopt de dump niet en willen we dat
// weten in plaats van stilletjes de regime- en Fear & Greed-kolommen kwijtraken.
function datumVan(tijd: number | undefined): string {
  if (tijd === undefined) throw new Error('Candle zonder tijd. Draai `node scripts/haal-historie.mjs` opnieuw.');
  return new Date(tijd).toISOString().slice(0, 10);
}

// Simuleert één trade vooruit vanaf bar i. Ziet alleen candles ná de instap, dus de uitkomst
// kan de instapbeslissing niet beïnvloeden.
function simuleer(
  candles: Candle[],
  i: number,
  entry: number,
  stop: number,
  doel: number,
): { r: number; exitReden: Simulatie['exitReden']; bars: number } | null {
  const risico = entry - stop;
  if (risico <= 0) return null;

  const eind = Math.min(i + MAX_BARS, candles.length - 1);
  if (eind <= i) return null; // geen toekomst meer om in te simuleren

  for (let j = i + 1; j <= eind; j++) {
    const c = candles[j];

    // Gap door de stop heen: je komt er niet op je stop uit, maar op de open. Slechter dan
    // gepland, en precies wat er in het echt gebeurt.
    if (c.open <= stop) {
      return { r: (c.open - entry) / risico, exitReden: 'stop', bars: j - i };
    }
    if (c.open >= doel) {
      return { r: (c.open - entry) / risico, exitReden: 'doel', bars: j - i };
    }

    const raaktStop = c.low <= stop;
    const raaktDoel = c.high >= doel;

    // Raakt de candle allebei, dan weten we zonder intraday-data niet wat er eerst kwam.
    // We nemen de stop. Dat is de conservatieve aanname: liever een backtest die te somber is
    // dan een die je een strategie in de armen drijft die in het echt verliest.
    if (raaktStop) return { r: (stop - entry) / risico, exitReden: 'stop', bars: j - i };
    if (raaktDoel) return { r: (doel - entry) / risico, exitReden: 'doel', bars: j - i };
  }

  return { r: (candles[eind].close - entry) / risico, exitReden: 'tijd', bars: eind - i };
}

// --- data inlezen -----------------------------------------------------------------------

const beschikbaar = new Set(
  readdirSync(DATA).filter(f => f.endsWith('.json') && !f.startsWith('_')).map(f => f.replace('.json', '')),
);
const coins = STANDAARD_UNIVERSUM.filter(s => beschikbaar.has(s));
if (coins.length === 0) {
  console.error('Geen data gevonden. Draai eerst `node scripts/haal-historie.mjs` vanuit de repo-root.');
  process.exit(1);
}

const laadCandles = (s: string): Candle[] => JSON.parse(readFileSync(join(DATA, `${s}.json`), 'utf8'));

let fng: Record<string, number> = {};
try {
  fng = JSON.parse(readFileSync(join(DATA, '_fng.json'), 'utf8'));
} catch {
  console.warn('Geen Fear & Greed-historie gevonden, die kolom blijft leeg.');
}

// BTC-regime per datum. EMA is een causaal filter: de waarde op bar i hangt alleen af van bars
// 0..i. Hem één keer over de hele reeks berekenen en op datum opzoeken is dus geen look-ahead.
const btcCandles = laadCandles('BTC');
const btcEma200 = ema(btcCandles.map(c => c.close), 200);
const btcRiskOnPerDag: Record<string, boolean> = {};
for (let i = 0; i < btcCandles.length; i++) {
  // Vóór ~200 bars is een EMA200 nog niet ingelopen en zegt hij niets, dus die laten we leeg.
  if (i < 200) continue;
  btcRiskOnPerDag[datumVan(btcCandles[i].tijd)] = btcCandles[i].close > btcEma200[i];
}

// --- meting A: elke bar, elke coin ------------------------------------------------------

console.log(`Backtest over ${coins.length} coins, max houdduur ${MAX_BARS} dagen.\n`);

const alle: Simulatie[] = [];
const strategie: Simulatie[] = [];

for (const symbool of coins) {
  const candles = laadCandles(symbool);
  if (candles.length < MIN_CANDLES + 2) continue;

  let bezetTot = -1; // voor meting B: geen overlappende trades in dezelfde coin

  for (let i = MIN_CANDLES - 1; i < candles.length - 1; i++) {
    // minRR: 0 zet de R/R-filter uit, zodat we óók de afgewezen signalen kunnen meten.
    const t: Trade | null = scoorCandles(symbool, candles.slice(0, i + 1), 'binance', { minRR: 0 });
    if (!t) continue;

    const uitkomst = simuleer(candles, i, t.entry, t.stopLoss, t.takeProfit);
    if (!uitkomst) continue;

    const datum = datumVan(candles[i].tijd);
    const sim: Simulatie = {
      symbool,
      datum,
      score: t.score,
      signaal: t.signaal,
      highConviction: t.highConviction,
      rr: t.rr,
      doorRrFilter: t.rr >= MIN_RISK_REWARD - 1e-9,
      r: uitkomst.r,
      exitReden: uitkomst.exitReden,
      bars: uitkomst.bars,
      btcRiskOn: btcRiskOnPerDag[datum] ?? null,
      fng: fng[datum] ?? null,
    };
    alle.push(sim);

    // Meting B: precies wat de app zou hebben gedaan.
    if (sim.signaal === 'KOOP' && sim.doorRrFilter && i > bezetTot) {
      strategie.push(sim);
      bezetTot = i + uitkomst.bars;
    }
  }
}

// --- rapportage -------------------------------------------------------------------------

type Stat = { n: number; treffer: number; gemR: number; totaalR: number; medR: number };

function stat(rijen: Simulatie[]): Stat {
  if (rijen.length === 0) return { n: 0, treffer: 0, gemR: 0, totaalR: 0, medR: 0 };
  const rs = rijen.map(r => r.r).sort((a, b) => a - b);
  const totaal = rs.reduce((s, r) => s + r, 0);
  return {
    n: rijen.length,
    treffer: (rijen.filter(r => r.r > 0).length / rijen.length) * 100,
    gemR: totaal / rijen.length,
    totaalR: totaal,
    medR: rs[Math.floor(rs.length / 2)],
  };
}

function tabel(titel: string, rijen: [string, Simulatie[]][]) {
  console.log(`\n${titel}`);
  console.log('  ' + 'groep'.padEnd(22) + 'n'.padStart(7) + 'treffer%'.padStart(10) + 'gem R'.padStart(9) + 'mediaan R'.padStart(11) + 'totaal R'.padStart(11));
  console.log('  ' + '-'.repeat(70));
  for (const [naam, set] of rijen) {
    const s = stat(set);
    if (s.n === 0) {
      console.log('  ' + naam.padEnd(22) + '0'.padStart(7));
      continue;
    }
    console.log(
      '  ' + naam.padEnd(22) +
      String(s.n).padStart(7) +
      s.treffer.toFixed(1).padStart(10) +
      s.gemR.toFixed(3).padStart(9) +
      s.medR.toFixed(2).padStart(11) +
      s.totaalR.toFixed(0).padStart(11),
    );
  }
}

const buckets: [string, (s: Simulatie) => boolean][] = [
  ['score 0-40', s => s.score < 40],
  ['score 40-55', s => s.score >= 40 && s.score < 55],
  ['score 55-65 (KOOP)', s => s.score >= 55 && s.score < 65],
  ['score 65-75 (KOOP)', s => s.score >= 65 && s.score < 75],
  ['score 75+ (KOOP)', s => s.score >= 75],
];

const basis = stat(alle);

console.log('='.repeat(72));
console.log('METING A: signaalkwaliteit over elke bar (nulmeting = willekeurige instap)');
console.log('='.repeat(72));
console.log(`\nNulmeting: ${basis.n} bars, treffer ${basis.treffer.toFixed(1)}%, gem R ${basis.gemR.toFixed(3)}`);
console.log('Een scorebucket is pas iets waard als hij deze gem R verslaat.');

tabel('Per scorebucket:', buckets.map(([naam, f]) => [naam, alle.filter(f)] as [string, Simulatie[]]));

tabel('High conviction (score 75+ met trend, MACD en volume):', [
  ['high conviction', alle.filter(s => s.highConviction)],
  ['rest', alle.filter(s => !s.highConviction)],
]);

tabel('Wat kost de R/R-filter ons? (alle bars)', [
  [`R/R >= ${MIN_RISK_REWARD} (toegelaten)`, alle.filter(s => s.doorRrFilter)],
  [`R/R < ${MIN_RISK_REWARD} (afgewezen)`, alle.filter(s => !s.doorRrFilter)],
]);

tabel('Idem, maar alleen binnen de KOOP-signalen:', [
  ['KOOP + door filter', alle.filter(s => s.signaal === 'KOOP' && s.doorRrFilter)],
  ['KOOP + afgewezen', alle.filter(s => s.signaal === 'KOOP' && !s.doorRrFilter)],
]);

tabel('Marktregime: staat BTC boven zijn EMA200?', [
  ['BTC risk-on', alle.filter(s => s.btcRiskOn === true)],
  ['BTC risk-off', alle.filter(s => s.btcRiskOn === false)],
]);

tabel('Marktregime, alleen KOOP-signalen door de filter:', [
  ['KOOP in risk-on', alle.filter(s => s.signaal === 'KOOP' && s.doorRrFilter && s.btcRiskOn === true)],
  ['KOOP in risk-off', alle.filter(s => s.signaal === 'KOOP' && s.doorRrFilter && s.btcRiskOn === false)],
]);

tabel('Fear & Greed op de instapdag:', [
  ['angst (< 25)', alle.filter(s => s.fng !== null && s.fng < 25)],
  ['neutraal (25-75)', alle.filter(s => s.fng !== null && s.fng >= 25 && s.fng <= 75)],
  ['hebzucht (> 75)', alle.filter(s => s.fng !== null && s.fng > 75)],
]);

// --- meting B ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(72));
console.log('METING B: de strategie zoals de app hem nu draait');
console.log('='.repeat(72));

const sb = stat(strategie);
console.log(`\n${sb.n} trades over ${coins.length} coins.`);
console.log(`  trefferpercentage : ${sb.treffer.toFixed(1)}%`);
console.log(`  gemiddelde R      : ${sb.gemR.toFixed(3)}   (nulmeting willekeurig: ${basis.gemR.toFixed(3)})`);
console.log(`  mediaan R         : ${sb.medR.toFixed(2)}`);
console.log(`  totaal R          : ${sb.totaalR.toFixed(0)}`);

const redenen = ['stop', 'doel', 'tijd'] as const;
console.log('\n  Hoe liepen ze af:');
for (const reden of redenen) {
  const set = strategie.filter(s => s.exitReden === reden);
  if (set.length === 0) continue;
  const pct = (set.length / strategie.length) * 100;
  console.log(`    ${reden.padEnd(6)} ${String(set.length).padStart(5)}  (${pct.toFixed(1)}%)  gem R ${stat(set).gemR.toFixed(2)}`);
}

// Buy & hold als marktcontext: was dit sowieso een stijgende periode?
const bh = coins.map(s => {
  const c = laadCandles(s);
  return (c[c.length - 1].close / c[0].close - 1) * 100;
}).sort((a, b) => a - b);
const bhMediaan = bh[Math.floor(bh.length / 2)];
console.log(`\n  Marktcontext: mediane buy & hold over de hele periode: ${bhMediaan.toFixed(0)}%`);
console.log(`  (${bh.filter(x => x > 0).length}/${bh.length} coins stonden hoger dan aan het begin)`);

// --- meting C: kandidaat-varianten ------------------------------------------------------
//
// Dezelfde simulaties, maar telkens met een andere instapregel, en steeds met de geen-overlap-
// regel zodat het een echte strategie is en niet een wolk overlappende signalen. Zo zien we in
// één tabel wat een wijziging aan de instapregel zou hebben opgeleverd, zonder ook maar iets aan
// de engine te veranderen.
//
// Let op: dit zijn regels die we ná het zien van de data bedenken, dus ze zijn per definitie
// vleiend voor zichzelf. Daarom staat de periode-splitsing eronder: een variant die alleen in
// de eerste helft werkt, werkt niet.

// De geen-overlap-regel opnieuw toepassen op een deelverzameling. Simulaties staan al op
// coin-en-datumvolgorde, dus we kunnen ze gewoon aflopen.
function alsStrategie(rijen: Simulatie[]): Simulatie[] {
  const uit: Simulatie[] = [];
  const bezet: Record<string, number> = {};
  for (const s of rijen) {
    const dag = Date.parse(s.datum) / 86400000;
    if (bezet[s.symbool] !== undefined && dag <= bezet[s.symbool]) continue;
    uit.push(s);
    bezet[s.symbool] = dag + s.bars;
  }
  return uit;
}

const varianten: [string, (s: Simulatie) => boolean][] = [
  ['app nu (KOOP + R/R)', s => s.signaal === 'KOOP' && s.doorRrFilter],
  ['KOOP, geen R/R-filter', s => s.signaal === 'KOOP'],
  ['score 75+, geen filter', s => s.score >= 75],
  ['high conviction', s => s.highConviction],
  ['high conv. + niet hebzucht', s => s.highConviction && (s.fng === null || s.fng <= 75)],
];

// Grens tussen de eerste twee jaar en het laatste jaar. Een variant die alleen vóór deze datum
// werkt, is aan de data aangepast en niet aan de markt.
const alleDatums = alle.map(s => s.datum).sort();
const grens = alleDatums[Math.floor(alleDatums.length * 0.66)];

console.log('\n' + '='.repeat(72));
console.log('METING C: kandidaat-instapregels, als echte strategie (geen overlap)');
console.log('='.repeat(72));
console.log(`\nPeriode-splitsing op ${grens}: eerste deel om ideeen op te doen, laatste deel om ze te toetsen.\n`);
console.log('  ' + 'variant'.padEnd(28) + 'n'.padStart(6) + 'treffer%'.padStart(10) + 'gem R'.padStart(9) + '  |' + 'n'.padStart(6) + 'gem R'.padStart(9) + '   ' + 'n'.padStart(6) + 'gem R'.padStart(9));
console.log('  ' + ' '.repeat(28) + '     hele periode        |     eerste deel        laatste deel');
console.log('  ' + '-'.repeat(88));

for (const [naam, f] of varianten) {
  const set = alsStrategie(alle.filter(f));
  const vroeg = set.filter(s => s.datum < grens);
  const laat = set.filter(s => s.datum >= grens);
  const a = stat(set), v = stat(vroeg), l = stat(laat);
  console.log(
    '  ' + naam.padEnd(28) +
    String(a.n).padStart(6) + a.treffer.toFixed(1).padStart(10) + a.gemR.toFixed(3).padStart(9) + '  |' +
    String(v.n).padStart(6) + v.gemR.toFixed(3).padStart(9) + '   ' +
    String(l.n).padStart(6) + l.gemR.toFixed(3).padStart(9),
  );
}

// --- wegschrijven -----------------------------------------------------------------------

mkdirSync(UIT, { recursive: true });
const stempel = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const pad = join(UIT, `${stempel}.json`);
writeFileSync(pad, JSON.stringify({
  gedraaidOp: new Date().toISOString(),
  coins: coins.length,
  maxBars: MAX_BARS,
  nulmeting: basis,
  perBucket: Object.fromEntries(buckets.map(([naam, f]) => [naam, stat(alle.filter(f))])),
  strategie: sb,
  simulaties: alle,
}));
console.log(`\nRuwe data: ${pad}`);
