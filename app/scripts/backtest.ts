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
import { scoorCandles, stopAfstandStructuur, MIN_CANDLES, MIN_RISK_REWARD, STANDAARD_UNIVERSUM } from '../src/engine/analyzer';
import { ema } from '../src/engine/indicators';
import { momentumIngredienten, momentumScore, radarNiveaus, RADAR_DREMPEL, MomentumIngredienten } from '../src/engine/momentum';
import { Candle, Trade } from '../src/engine/types';
import { DREMPEL_KOOP } from '../src/engine/drempels';
import { radarSignaal } from '../src/engine/opportunities';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATA = join(HIER, '..', '..', 'data', 'historie');
const UIT = join(HIER, '..', '..', 'data', 'backtest');

// Hoe lang we een trade maximaal aanhouden voor we hem op de close sluiten. De app doet geen
// uitspraak over houdduur, dus dit is een aanname van de harness. 30 dagen past bij een
// swing-tool met een doel op 3x ATR.
const MAX_BARS = 30;

// De app haalt per coin 200 candles op (limit=200 in marketData.ts) en ziet dus nooit meer dan
// dat. De backtest moet de engine precies zo veel geschiedenis voeren, anders meten we een
// engine die in het echt niet bestaat. Scheelt bovendien enorm veel rekenwerk: zonder venster
// groeit het werk kwadratisch met de lengte van de historie.
const VENSTER = 200;

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
  breedte: number | null;                 // deel van het universum boven zijn EMA50
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
  maxBars: number = MAX_BARS,
): { r: number; exitReden: Simulatie['exitReden']; bars: number } | null {
  const risico = entry - stop;
  if (risico <= 0) return null;

  const eind = Math.min(i + maxBars, candles.length - 1);
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

// BTC-slotkoers per dag, voor de relatieve sterkte in meting H. Opzoeken op datum in plaats van
// op index, want niet elke coin heeft evenveel candles als BTC.
const btcCloseOpDag: Record<string, number> = {};
for (const c of btcCandles) btcCloseOpDag[datumVan(c.tijd)] = c.close;

// Marktbreedte per datum: welk deel van het universum staat boven zijn eigen EMA50?
// BTC boven zijn EMA200 bleek niets te zeggen over de altmarkt (goede en slechte kwartalen
// zaten in beide regimes), dus meten we die altmarkt hier rechtstreeks. Ook dit is causaal:
// EMA50 op bar i gebruikt alleen bars 0..i, dus geen look-ahead.
const bovenEma50: Record<string, { boven: number; totaal: number }> = {};
for (const symbool of coins) {
  const candles = laadCandles(symbool);
  const e50 = ema(candles.map(c => c.close), 50);
  for (let i = 50; i < candles.length; i++) {
    const dag = datumVan(candles[i].tijd);
    bovenEma50[dag] ??= { boven: 0, totaal: 0 };
    bovenEma50[dag].totaal++;
    if (candles[i].close > e50[i]) bovenEma50[dag].boven++;
  }
}
const breedtePerDag: Record<string, number> = {};
for (const [dag, t] of Object.entries(bovenEma50)) {
  // Onder de 20 coins is het aandeel te ruisgevoelig om iets te betekenen.
  if (t.totaal >= 20) breedtePerDag[dag] = t.boven / t.totaal;
}

// BTC boven zijn EMA50: een snellere trendmeter dan de EMA200, die in 2025 drie kwartalen te
// laat kwam. Sneller betekent ook vaker vals alarm, dus we meten of het per saldo helpt.
const btcBovenEma50: Record<string, boolean> = {};
const btcEma50 = ema(btcCandles.map(c => c.close), 50);
for (let i = 50; i < btcCandles.length; i++) {
  btcBovenEma50[datumVan(btcCandles[i].tijd)] = btcCandles[i].close > btcEma50[i];
}

// Stijgt de marktbreedte t.o.v. 20 dagen geleden? Het niveau van de breedte zei niets, maar de
// richting ervan is een ander signaal: een markt die opdroogt terwijl de koersen nog hoog staan,
// is precies het patroon van een top.
const breedteDagen = Object.keys(breedtePerDag).sort();
const breedteStijgend: Record<string, boolean> = {};
for (let i = 20; i < breedteDagen.length; i++) {
  const nu = breedtePerDag[breedteDagen[i]];
  const toen = breedtePerDag[breedteDagen[i - 20]];
  breedteStijgend[breedteDagen[i]] = nu > toen;
}

// --- meting A: elke bar, elke coin ------------------------------------------------------

console.log(`Backtest over ${coins.length} coins, max houdduur ${MAX_BARS} dagen.\n`);

const alle: Simulatie[] = [];
const strategie: Simulatie[] = [];

// Wat de engine op elke bar zei, bewaard zodat meting D er andere doelen en houdtijden
// overheen kan leggen zonder 57.000 keer opnieuw te scoren. De instapbeslissing (entry, stop)
// blijft van de engine, alleen het beheer van de trade varieert.
type Signaal = {
  i: number; datum: string; entry: number; stop: number; atr: number;
  score: number; hc: boolean; koop: boolean; rrOk: boolean; breedte: number | null;
  // Omkeerprofiel (mean reversion), voor meting G. Losse velden i.p.v. een sub-object, zodat
  // de rest van het script (draai, jaarRegel) simpel Signaal-velden kan blijven lezen.
  scoreOmkeer: number; entryOmkeer: number; stopOmkeer: number; koopOmkeer: boolean; rrOkOmkeer: boolean;
  // Voor meting H: eigenschappen van de COIN zelf op dat moment, los van de markt eromheen.
  // De poorten uit meting D kijken allemaal naar de markt (BTC, breedte); deze drie kijken naar
  // wat de coin zelf doet. Alle drie causaal: ze gebruiken alleen candles[0..i].
  bovenEma100: boolean | null;   // staat de coin boven zijn eigen EMA100?
  rs30: number | null;           // rendement over 30 dagen min dat van BTC over dezelfde dagen
  uitgerekt: number;             // (prijs - EMA20) / ATR: hoe laat je instapt in de beweging
  // Voor meting I: de momentum-ingrediënten op dat moment (zelfde venster als de engine) en de
  // uitkomst van de trade op deze bar met de niveaus van scoorCandles, zoals in meting A.
  mom: MomentumIngredienten;
  rBar: number;
  ema20: number;                 // EMA20 van de engine op die bar, voor de EMA20-stop in meting J
};

// Alles wat de markt op een gegeven dag over zichzelf zei. Een poort mag hier alleen uit putten,
// nooit uit de toekomst.
const marktOp = (datum: string) => ({
  riskOn: btcRiskOnPerDag[datum],           // BTC boven EMA200
  btc50: btcBovenEma50[datum],              // BTC boven EMA50
  breedte: breedtePerDag[datum],            // deel van het universum boven EMA50
  breedteStijgt: breedteStijgend[datum],    // breedte hoger dan 20 dagen geleden
  fng: fng[datum],                          // Fear & Greed
});
// Relatieve sterkte: het rendement van de coin over 30 dagen min dat van BTC over exact dezelfde
// dagen. Positief = de coin houdt beter stand dan de markt. Dezelfde grootheid die de app al toont
// in bear-modus (engine/relatieveSterkte.ts), hier voor het eerst gemeten als instapfilter.
//
// Op datum opzoeken en niet op index: coins hebben verschillende startdatums, dus index i bij ADA
// is een andere dag dan index i bij BTC.
const RS_DAGEN = 30;
function rsVoor(candles: Candle[], i: number): number | null {
  if (i < RS_DAGEN) return null;
  const toen = candles[i - RS_DAGEN];
  const nu = candles[i];
  if (!toen.close || !nu.close) return null;
  const btcNu = btcCloseOpDag[datumVan(nu.tijd)];
  const btcToen = btcCloseOpDag[datumVan(toen.tijd)];
  if (!btcNu || !btcToen) return null;
  return (nu.close / toen.close - 1) - (btcNu / btcToen - 1);
}

const signalenPerCoin: Record<string, Signaal[]> = {};

for (const symbool of coins) {
  const candles = laadCandles(symbool);
  if (candles.length < MIN_CANDLES + 2) continue;

  // Eén keer per coin over de hele reeks: een EMA is causaal, de waarde op bar i hangt alleen af
  // van bars 0..i. De app ziet per coin 200 candles en kan een EMA100 daarbinnen dus ook
  // uitrekenen; na ~100 bars is hij ingelopen en is het verschil met deze berekening te klein om
  // een beslissing te kantelen.
  const closes = candles.map(c => c.close);
  const ema100 = ema(closes, 100);

  let bezetTot = -1; // voor meting B: geen overlappende trades in dezelfde coin
  signalenPerCoin[symbool] = [];

  // BTC-slotkoers op dezelfde dagen als deze coin, voor de relatieve sterkte in meting I. Op datum
  // uitgelijnd, net als rsVoor; een dag zonder BTC-koers wordt NaN en levert dan geen RS op.
  const btcUitgelijnd = candles.map(c => btcCloseOpDag[datumVan(c.tijd)] ?? NaN);

  for (let i = MIN_CANDLES - 1; i < candles.length - 1; i++) {
    // minRR: 0 zet de R/R-filter uit, zodat we óók de afgewezen signalen kunnen meten.
    const vensterStart = Math.max(0, i - VENSTER + 1);
    const venster = candles.slice(vensterStart, i + 1);
    const t: Trade | null = scoorCandles(symbool, venster, 'binance', { minRR: 0 });
    if (!t) continue;

    // Omkeerprofiel op exact hetzelfde venster (candles[0..i]), dus geen extra look-ahead
    // t.o.v. het momentumsignaal hierboven. Geeft de engine hier null terug, dan moet deze
    // bar nooit als omkeersignaal gekozen kunnen worden: koopOmkeer/rrOkOmkeer blijven false.
    const tOmkeer: Trade | null = scoorCandles(symbool, venster, 'binance', { minRR: 0, profiel: 'omkeer' });

    const uitkomst = simuleer(candles, i, t.entry, t.stopLoss, t.takeProfit);
    if (!uitkomst) continue;

    const datum = datumVan(candles[i].tijd);
    signalenPerCoin[symbool].push({
      i, datum, entry: t.entry, stop: t.stopLoss, atr: t.atr,
      score: t.score, hc: t.highConviction, koop: t.signaal === 'KOOP',
      rrOk: t.rr >= MIN_RISK_REWARD - 1e-9,
      breedte: breedtePerDag[datum] ?? null,
      scoreOmkeer: tOmkeer?.score ?? 0,
      entryOmkeer: tOmkeer?.entry ?? 0,
      stopOmkeer: tOmkeer?.stopLoss ?? 0,
      koopOmkeer: tOmkeer ? tOmkeer.signaal === 'KOOP' : false,
      rrOkOmkeer: tOmkeer ? tOmkeer.rr >= MIN_RISK_REWARD - 1e-9 : false,
      // Pas vanaf bar 100 zegt een EMA100 iets; daarvoor null, en dan telt de coin niet mee in de
      // regels die erop filteren (net als bij btcRiskOn vóór bar 200).
      bovenEma100: i >= 100 ? candles[i].close > ema100[i] : null,
      rs30: rsVoor(candles, i),
      uitgerekt: t.atr > 0 ? (t.entry - t.ema20) / t.atr : 0,
      mom: momentumIngredienten(venster, btcUitgelijnd.slice(vensterStart, i + 1)),
      rBar: uitkomst.r,
      ema20: t.ema20,
    });
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
      breedte: breedtePerDag[datum] ?? null,
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

function stat(rijen: { r: number }[]): Stat {
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

function tabel(titel: string, rijen: [string, { r: number }[]][]) {
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

tabel('Marktbreedte: welk deel van het universum staat boven zijn EMA50?', [
  ['breedte < 20%', alle.filter(s => s.breedte !== null && s.breedte < 0.2)],
  ['breedte 20-40%', alle.filter(s => s.breedte !== null && s.breedte >= 0.2 && s.breedte < 0.4)],
  ['breedte 40-60%', alle.filter(s => s.breedte !== null && s.breedte >= 0.4 && s.breedte < 0.6)],
  ['breedte >= 60%', alle.filter(s => s.breedte !== null && s.breedte >= 0.6)],
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

// --- gereedschap voor de poort-analyses -------------------------------------------------
//
// Vanaf hier draait alles om één vraag: Kader blijft long-only, dus kunnen we een vijandige
// markt op tijd herkennen en dan gewoon zwijgen? Met negen jaar historie zitten er drie
// bearmarkten in de data (2018, 2022, 2025-26), dus een poort moet zich nu op drie omslagen
// bewijzen in plaats van op één.

const jaarVan = (datum: string) => datum.slice(0, 4);
const jaren = [...new Set(alle.map(s => jaarVan(s.datum)))].sort();

const gem = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

// Gespiegelde niveaus voor een short: stop boven de recente swing high, doel eronder. Rekent
// bewust NIET zelf: dit roept dezelfde stopAfstandStructuur aan die de app gebruikt. Hier stond
// eerder een eigen kopie met een eigen `SWING = 10` naast SWING_PERIODE, en dan meet de backtest
// op termijn iets anders dan de app draait.
function shortNiveaus(candles: Candle[], i: number, atr: number, capAtr: number) {
  const entry = candles[i].close;
  const risico = stopAfstandStructuur(candles.slice(0, i + 1), entry, atr, capAtr, 'short');
  return { entry, stop: entry + risico };
}

function simuleerShort(
  candles: Candle[], i: number, entry: number, stop: number, doel: number, maxBars: number,
): { r: number; bars: number } | null {
  const risico = stop - entry;
  if (risico <= 0) return null;
  const eind = Math.min(i + maxBars, candles.length - 1);
  if (eind <= i) return null;

  for (let j = i + 1; j <= eind; j++) {
    const c = candles[j];
    if (c.open >= stop) return { r: (entry - c.open) / risico, bars: j - i };
    if (c.open <= doel) return { r: (entry - c.open) / risico, bars: j - i };
    // Weer conservatief: raakt de candle stop en doel allebei, dan nemen we het verlies.
    if (c.high >= stop) return { r: (entry - stop) / risico, bars: j - i };
    if (c.low <= doel) return { r: (entry - doel) / risico, bars: j - i };
  }
  return { r: (entry - candles[eind].close) / risico, bars: eind - i };
}

// Draait een instapregel als echte strategie: geen overlappende trades per coin, doel en
// houdtijd instelbaar. Retourneert het resultaat van elke trade met zijn datum.
function draai(
  kiest: (s: Signaal) => boolean,
  opties: { doelAtr?: number; maxBars?: number; short?: boolean; shortCap?: number; minShortRR?: number; bron?: 'momentum' | 'omkeer' } = {},
): { r: number; datum: string }[] {
  const doelAtr = opties.doelAtr ?? 3.0;
  const maxBars = opties.maxBars ?? MAX_BARS;
  const bron = opties.bron ?? 'momentum';
  const uit: { r: number; datum: string }[] = [];

  for (const symbool of coins) {
    const candles = laadCandles(symbool);
    let bezetTot = -1;
    for (const s of signalenPerCoin[symbool] ?? []) {
      if (s.i <= bezetTot || !kiest(s)) continue;

      // Welk paar entry/stop we gebruiken hangt af van bron: het momentumsignaal (default) of
      // het omkeersignaal op dezelfde bar. De bezetTot-logica hierboven blijft ongewijzigd:
      // die voorkomt overlappende trades per coin, ongeacht welke bron er gekozen is.
      const entry = bron === 'omkeer' ? s.entryOmkeer : s.entry;
      const stop = bron === 'omkeer' ? s.stopOmkeer : s.stop;

      const u = opties.short
        ? (() => {
            const n = shortNiveaus(candles, s.i, s.atr, opties.shortCap ?? 3);
            // Derde variant: stop-cap onaangeroerd laten (3x ATR) en in plaats daarvan de
            // R/R-drempel toepassen die de app voor longs ook hanteert. Dat is een andere
            // strategie dan de stop knijpen: hier vallen signalen af, daar verschuift de stop.
            if (opties.minShortRR !== undefined) {
              const rr = (n.entry - (n.entry - doelAtr * s.atr)) / (n.stop - n.entry);
              if (!(rr >= opties.minShortRR - 1e-9)) return null;
            }
            return simuleerShort(candles, s.i, n.entry, n.stop, n.entry - doelAtr * s.atr, maxBars);
          })()
        : simuleer(candles, s.i, entry, stop, entry + doelAtr * s.atr, maxBars);

      if (!u) continue;
      uit.push({ r: u.r, datum: s.datum });
      bezetTot = s.i + u.bars;
    }
  }
  return uit;
}

// Eén regel van de jaartabel: totaal plus de uitkomst per jaar.
function jaarRegel(naam: string, trades: { r: number; datum: string }[]) {
  const alleR = trades.map(t => t.r);
  const treffer = alleR.length ? (alleR.filter(r => r > 0).length / alleR.length) * 100 : 0;
  let regel =
    naam.padEnd(30) +
    String(alleR.length).padStart(6) +
    (alleR.length ? treffer.toFixed(0) : '-').padStart(5) +
    (alleR.length ? gem(alleR).toFixed(3) : '-').padStart(8) +
    ' |';
  for (const jaar of jaren) {
    const rs = trades.filter(t => jaarVan(t.datum) === jaar).map(t => t.r);
    regel += (rs.length >= 10 ? gem(rs).toFixed(2) : '.').padStart(7);
  }
  console.log('  ' + regel);
}

function jaarKop(titel: string) {
  console.log(`\n${titel}`);
  let kop = 'regel'.padEnd(30) + 'n'.padStart(6) + 'tr%'.padStart(5) + 'gem R'.padStart(8) + ' |';
  for (const jaar of jaren) kop += jaar.slice(2).padStart(7);
  console.log('  ' + kop);
  console.log('  ' + '-'.repeat(kop.length));
}

// --- meting C: hoe ziet de cyclus eruit? ------------------------------------------------

console.log('\n' + '='.repeat(72));
console.log('METING C: het huidige algoritme, per jaar');
console.log('='.repeat(72));
console.log('\nPer jaar de gemiddelde R. Een jaar met minder dan 10 trades toont een punt.');

jaarKop('Long, doel 3x ATR, 30 dagen:');
jaarRegel('alle bars (willekeurig)', draai(() => true));
jaarRegel('KOOP + R/R-filter (app nu)', draai(s => s.koop && s.rrOk));
jaarRegel('KOOP, geen R/R-filter', draai(s => s.koop));
jaarRegel('score 75+', draai(s => s.score >= 75));
jaarRegel('high conviction', draai(s => s.hc));

// --- meting D: welke poort houdt ons uit een bearmarkt? ---------------------------------

console.log('\n' + '='.repeat(72));
console.log('METING D: long-only poorten. Welke sluit de slechte jaren zonder de goede te slopen?');
console.log('='.repeat(72));
console.log('\nBasis is telkens high conviction. Een poort is pas iets waard als hij de rode jaren');
console.log('dempt en de groene jaren grotendeels intact laat.');

const M = (s: Signaal) => marktOp(s.datum);

jaarKop('High conviction, met poort:');
jaarRegel('geen poort', draai(s => s.hc));
jaarRegel('BTC boven EMA200', draai(s => s.hc && M(s).riskOn === true));
jaarRegel('BTC boven EMA50', draai(s => s.hc && M(s).btc50 === true));
jaarRegel('BTC boven EMA50 en EMA200', draai(s => s.hc && M(s).btc50 === true && M(s).riskOn === true));
jaarRegel('breedte >= 40%', draai(s => s.hc && (M(s).breedte ?? 0) >= 0.4));
jaarRegel('breedte stijgt', draai(s => s.hc && M(s).breedteStijgt === true));
jaarRegel('breedte >= 40% en stijgt', draai(s => s.hc && (M(s).breedte ?? 0) >= 0.4 && M(s).breedteStijgt === true));
jaarRegel('geen hebzucht (F&G <= 75)', draai(s => s.hc && (M(s).fng ?? 50) <= 75));
jaarRegel('BTC EMA50 + breedte stijgt', draai(s => s.hc && M(s).btc50 === true && M(s).breedteStijgt === true));

// --- meting E: doel en houdtijd ---------------------------------------------------------

console.log('\n' + '='.repeat(72));
console.log('METING E: doel en houdtijd, over negen jaar');
console.log('='.repeat(72));

jaarKop('High conviction, geen poort:');
for (const maxBars of [10, 20, 30]) {
  for (const k of [1.5, 2.0, 3.0]) {
    jaarRegel(`doel ${k.toFixed(1)}x ATR, ${maxBars} dagen`, draai(s => s.hc, { doelAtr: k, maxBars }));
  }
}

// --- meting F: shorts, alleen ter informatie --------------------------------------------
//
// Shorts staan voorlopig geparkeerd (te veel afhankelijkheden op eToro), maar met negen jaar
// data is het wel het vastleggen waard of ze consistent werken in bearmarkten of dat 2025-26
// toeval was.

console.log('\n' + '='.repeat(72));
console.log('METING F: shorts op de zwakste coins (geparkeerd, alleen ter informatie)');
console.log('='.repeat(72));

jaarKop('Short, doel 2x ATR, 20 dagen:');
jaarRegel('score < 40 (cap 3x ATR, zoals oorspronkelijk gemeten)', draai(s => s.score < 40, { doelAtr: 2.0, maxBars: 20, short: true }));
// Overwogen en afgevallen: de stop knijpen tot 1x ATR zodat de R/R per constructie boven
// MIN_RISK_REWARD uitkomt. Houdt alle signalen maar verschuift de stop, en dat kostte precies het
// jaar waar het om gaat (2025 van +0,13 naar +0,02). Blijft hier staan zodat de vergelijking
// reproduceerbaar is en niemand het idee opnieuw hoeft te bedenken.
jaarRegel('score < 40 (cap 1x ATR, overwogen en afgevallen)', draai(s => s.score < 40, { doelAtr: 2.0, maxBars: 20, short: true, shortCap: 1.0 }));
jaarRegel(`score < 40 (cap 3x ATR + R/R-filter ${MIN_RISK_REWARD}, WAT DE APP DOET)`, draai(s => s.score < 40, { doelAtr: 2.0, maxBars: 20, short: true, minShortRR: MIN_RISK_REWARD }));
jaarRegel('score < 40, BTC onder EMA200', draai(s => s.score < 40 && M(s).riskOn === false, { doelAtr: 2.0, maxBars: 20, short: true }));
jaarRegel('score < 25, BTC onder EMA200', draai(s => s.score < 25 && M(s).riskOn === false, { doelAtr: 2.0, maxBars: 20, short: true }));

// --- meting G: omkeerprofiel op poort-dichte dagen --------------------------------------
//
// Meting D liet zien dat een poort de slechte jaren kan dempen door simpelweg te zwijgen.
// Maar zwijgen is niet de enige optie: als de markt in díe periodes voorspelbaar terugveert
// (mean reversion), kan een omkeerprofiel daar iets opleveren in plaats van niets. Deze meting
// beantwoordt de vraag: presteren mean-reversion-longs (het omkeerprofiel) beter dan
// momentum-longs in precies de periodes waarin de klimaatpoort dicht stond? Dit is de
// go/no-go voor fase 3 van het bearmarkt-plan: is een actief omkeersignaal de moeite waard,
// naast het stille "geen trade" dat de poort nu al oplevert?

console.log('\n' + '='.repeat(72));
console.log('METING G: omkeerprofiel versus momentum, op poort-dichte dagen');
console.log('='.repeat(72));
console.log('\nPoort dicht = exact bepaalKlimaat() uit marktklimaat.ts: BTC onder EMA50 en de');
console.log('marktbreedte stijgt niet. Nulmeting is willekeurige instap op diezelfde dagen.');

// Zelfde definitie als bepaalKlimaat() in src/engine/marktklimaat.ts (regel 58). Niet los
// herschrijven: dan meten we een andere poort dan de app werkelijk gebruikt.
const poortDicht = (s: Signaal) => M(s).btc50 === false && M(s).breedteStijgt === false;

for (const maxBars of [10, 20]) {
  for (const k of [1.5, 2.0]) {
    jaarKop(`G1, poort dicht, doel ${k.toFixed(1)}x ATR, ${maxBars} dagen:`);
    jaarRegel('nulmeting (willekeurig)', draai(s => poortDicht(s), { doelAtr: k, maxBars }));
    jaarRegel('momentum (KOOP + R/R)', draai(s => s.koop && s.rrOk && poortDicht(s), { doelAtr: k, maxBars }));
    jaarRegel('omkeer (KOOP + R/R)', draai(s => s.koopOmkeer && s.rrOkOmkeer && poortDicht(s), { doelAtr: k, maxBars, bron: 'omkeer' }));
  }
}

console.log('\nG2: dezelfde drie regels zónder poortfilter, doel 2,0x ATR / 20 dagen. Dit is de');
console.log('contextvraag: werkt het omkeerprofiel alleen in een bearmarkt, of altijd?');

jaarKop('G2, geen poortfilter, doel 2,0x ATR, 20 dagen:');
jaarRegel('nulmeting (willekeurig)', draai(() => true, { doelAtr: 2.0, maxBars: 20 }));
jaarRegel('momentum (KOOP + R/R)', draai(s => s.koop && s.rrOk, { doelAtr: 2.0, maxBars: 20 }));
jaarRegel('omkeer (KOOP + R/R)', draai(s => s.koopOmkeer && s.rrOkOmkeer, { doelAtr: 2.0, maxBars: 20, bron: 'omkeer' }));

// G3 splitst de poort-dichte dagen in tweeën. "Poort dicht" betekent BTC onder zijn EMA50 en een
// niet-stijgende breedte, en dat overkomt een opgaande markt ook: een dip van een paar weken
// binnen een bullmarkt ziet er op dat moment precies zo uit als het begin van een bearmarkt. Het
// verschil zie je pas aan de lange trend. BTC boven zijn EMA200 is dus "dip in een opgaande
// markt", eronder is "echte bearmarkt". Zonder deze splitsing kan een profiel dat alleen dips
// koopt zich verstoppen achter een gemiddelde dat door de bulljaren omhoog wordt getrokken.
console.log('\nG3: poort-dichte dagen gesplitst op BTC t.o.v. EMA200. Boven = dip binnen een');
console.log('opgaande markt, onder = echte bearmarkt. Doel 2,0x ATR, 20 dagen.');

const dipInBull = (s: Signaal) => poortDicht(s) && M(s).riskOn === true;
const echteBear = (s: Signaal) => poortDicht(s) && M(s).riskOn === false;

jaarKop('G3a, poort dicht MAAR BTC boven EMA200 (dip in een opgaande markt):');
jaarRegel('nulmeting (willekeurig)', draai(dipInBull, { doelAtr: 2.0, maxBars: 20 }));
jaarRegel('momentum (KOOP + R/R)', draai(s => s.koop && s.rrOk && dipInBull(s), { doelAtr: 2.0, maxBars: 20 }));
jaarRegel('omkeer (KOOP + R/R)', draai(s => s.koopOmkeer && s.rrOkOmkeer && dipInBull(s), { doelAtr: 2.0, maxBars: 20, bron: 'omkeer' }));

jaarKop('G3b, poort dicht EN BTC onder EMA200 (echte bearmarkt):');
jaarRegel('nulmeting (willekeurig)', draai(echteBear, { doelAtr: 2.0, maxBars: 20 }));
jaarRegel('momentum (KOOP + R/R)', draai(s => s.koop && s.rrOk && echteBear(s), { doelAtr: 2.0, maxBars: 20 }));
jaarRegel('omkeer (KOOP + R/R)', draai(s => s.koopOmkeer && s.rrOkOmkeer && echteBear(s), { doelAtr: 2.0, maxBars: 20, bron: 'omkeer' }));

// --- meting H: filters op de COIN zelf, bovenop wat de app al doet -----------------------
//
// Meting D vond de beste poort (BTC boven EMA50 en een stijgende breedte, +0,193 op high
// conviction), maar die kijkt naar de MARKT. 2025 en 2026 blijven daar negatief. De vraag hier is
// een andere: als de poort openstaat, zijn er dan coin-eigenschappen die de goede instappen van
// de slechte scheiden?
//
// Drie kandidaten, alle drie al aanwezig in de app of goedkoop uit dezelfde 200 candles:
//
//   H1  De coin boven zijn eigen EMA100. De engine kijkt niet verder dan EMA50, dus een coin die
//       structureel daalt maar kortstondig opveert haalt nu gewoon een KOOP.
//   H2  Relatieve sterkte over 30 dagen versus BTC. De app rekent dit al uit en toont het in
//       bear-modus, maar het telt nergens mee in de instapbeslissing.
//   H3  Niet te ver uitgerekt boven EMA20, gemeten in ATR. Een coin die al 3 ATR boven zijn
//       gemiddelde staat is een late instap: het doel ligt op 3x ATR en de helft is dan geweest.
//
// De vergelijking is telkens tegen dezelfde basis, en n staat er nadrukkelijk bij: een filter dat
// de gemiddelde R optilt door 90% van de trades weg te gooien is geen verbetering maar een kleinere
// steekproef.

console.log('\n\n' + '='.repeat(72));
console.log('METING H: filters op de coin zelf, bovenop de bestaande strategie');
console.log('='.repeat(72));
console.log('\nDe poorten uit meting D kijken naar de markt. Deze drie kijken naar de coin.');
console.log('Basis is telkens de regel eronder, zodat elk filter zijn eigen bijdrage toont.');

// De poort die meting D als beste aanwees. Alle H-regels draaien hierbinnen, want dat is wat de
// app vandaag doet: bepaalKlimaat() sluit de poort op precies deze twee voorwaarden.
const poortOpenNu = (s: Signaal) => M(s).btc50 === true && M(s).breedteStijgt === true;

const basisKoop = (s: Signaal) => s.koop && s.rrOk && poortOpenNu(s);
const basisHc = (s: Signaal) => s.hc && poortOpenNu(s);

jaarKop('H1/H2/H3 op KOOP + R/R, poort open, doel 3x ATR / 30 dagen:');
jaarRegel('basis (KOOP + R/R)', draai(basisKoop));
jaarRegel('+ boven eigen EMA100', draai(s => basisKoop(s) && s.bovenEma100 === true));
jaarRegel('+ sterker dan BTC (30d)', draai(s => basisKoop(s) && s.rs30 !== null && s.rs30 > 0));
jaarRegel('+ niet uitgerekt (< 2 ATR)', draai(s => basisKoop(s) && s.uitgerekt < 2));
jaarRegel('+ niet uitgerekt (< 1 ATR)', draai(s => basisKoop(s) && s.uitgerekt < 1));

jaarKop('Dezelfde drie op high conviction (de sterkste bucket), poort open:');
jaarRegel('basis (high conviction)', draai(basisHc));
jaarRegel('+ boven eigen EMA100', draai(s => basisHc(s) && s.bovenEma100 === true));
jaarRegel('+ sterker dan BTC (30d)', draai(s => basisHc(s) && s.rs30 !== null && s.rs30 > 0));
jaarRegel('+ niet uitgerekt (< 2 ATR)', draai(s => basisHc(s) && s.uitgerekt < 2));

// De omgekeerde kant van elk filter. Als een filter echt onderscheid maakt, hoort de weggelaten
// helft het slechter te doen dan de basis. Doet die het even goed, dan sorteert het filter niets
// en is de winst in de regel hierboven toeval.
jaarKop('Tegenproef: wat gooien de filters weg? (KOOP + R/R, poort open)');
jaarRegel('ONDER eigen EMA100', draai(s => basisKoop(s) && s.bovenEma100 === false));
jaarRegel('ZWAKKER dan BTC (30d)', draai(s => basisKoop(s) && s.rs30 !== null && s.rs30 <= 0));
jaarRegel('WEL uitgerekt (>= 2 ATR)', draai(s => basisKoop(s) && s.uitgerekt >= 2));

// Combinaties, maar alleen van de filters die op zichzelf iets deden. Meer filters stapelen is
// makkelijk en bijna altijd een manier om op ruis te passen, dus n blijft hier de belangrijkste
// kolom: zakt hij onder een paar honderd, dan zegt het gemiddelde niets meer.
jaarKop('Combinaties (KOOP + R/R, poort open):');
jaarRegel('EMA100 + sterker dan BTC', draai(s => basisKoop(s) && s.bovenEma100 === true && s.rs30 !== null && s.rs30 > 0));
jaarRegel('EMA100 + niet uitgerekt', draai(s => basisKoop(s) && s.bovenEma100 === true && s.uitgerekt < 2));
jaarRegel('alle drie', draai(s => basisKoop(s) && s.bovenEma100 === true && s.rs30 !== null && s.rs30 > 0 && s.uitgerekt < 2));

// H2 verdiende een tweede blik. De binaire split (sterker of zwakker dan BTC) gaf het
// tegenovergestelde van wat verwacht werd: juist de ACHTERBLIJVERS deden het beter. Een binaire
// split kan echter door een staart gedreven worden. Als het effect echt is, hoort het monotoon te
// zijn: hoe verder achter, hoe beter. Is het dat niet, dan is de winst hierboven toeval.
jaarKop('H2b, relatieve sterkte in emmers (KOOP + R/R, poort open):');
const rsEmmer = (laag: number, hoog: number) => (s: Signaal) =>
  basisKoop(s) && s.rs30 !== null && s.rs30 > laag && s.rs30 <= hoog;
jaarRegel('rs < -20%', draai(s => basisKoop(s) && s.rs30 !== null && s.rs30 <= -0.20));
jaarRegel('rs -20% tot -10%', draai(rsEmmer(-0.20, -0.10)));
jaarRegel('rs -10% tot 0%', draai(rsEmmer(-0.10, 0)));
jaarRegel('rs 0% tot +10%', draai(rsEmmer(0, 0.10)));
jaarRegel('rs +10% tot +25%', draai(rsEmmer(0.10, 0.25)));
jaarRegel('rs +25% tot +50%', draai(rsEmmer(0.25, 0.50)));
jaarRegel('rs > +50%', draai(s => basisKoop(s) && s.rs30 !== null && s.rs30 > 0.50));

// En dezelfde emmers op high conviction, want dat is de bucket waar de app zijn uitgelichte advies
// op baseert. Werkt het daar niet, dan raakt het de belangrijkste plek in de app niet.
jaarKop('H2c, dezelfde emmers op high conviction:');
const rsEmmerHc = (laag: number, hoog: number) => (s: Signaal) =>
  basisHc(s) && s.rs30 !== null && s.rs30 > laag && s.rs30 <= hoog;
jaarRegel('rs < -10%', draai(s => basisHc(s) && s.rs30 !== null && s.rs30 <= -0.10));
jaarRegel('rs -10% tot 0%', draai(rsEmmerHc(-0.10, 0)));
jaarRegel('rs 0% tot +25%', draai(rsEmmerHc(0, 0.25)));
jaarRegel('rs +25% tot +50%', draai(rsEmmerHc(0.25, 0.50)));
jaarRegel('rs > +50%', draai(s => basisHc(s) && s.rs30 !== null && s.rs30 > 0.50));

// Een drempel is pas bruikbaar als hij ook zonder de marktpoort standhoudt: de poort staat lang
// niet altijd open, en een filter dat alleen binnen die smalle doorsnede werkt is te veel op maat
// van deze steekproef gesneden.
jaarKop('H2d, zonder marktpoort (alleen KOOP + R/R), controle:');
const kaal = (s: Signaal) => s.koop && s.rrOk;
jaarRegel('basis, geen poort', draai(kaal));
jaarRegel('+ zwakker dan BTC', draai(s => kaal(s) && s.rs30 !== null && s.rs30 <= 0));
jaarRegel('+ sterker dan BTC', draai(s => kaal(s) && s.rs30 !== null && s.rs30 > 0));

// H2e is de vraag die na H2 openbleef: wat kóst en levert optie (c) nu precies op? Dat is de
// variant waarin de app coins die ver voorliggen op BTC nooit meer als KOOP toont. Hier staat hij
// naast wat de app vandaag doet, in de twee doorsnedes die ertoe doen: de volledige strategie en
// high conviction, allebei met de marktpoort erbij zoals de app hem draait.
//
// De kolom die het meest telt is n. Een filter dat de gemiddelde R optilt door de helft van de
// trades weg te gooien maakt de app óók de helft stiller, en in een jaar waarin de poort al vaak
// dicht staat is dat het verschil tussen "weinig signalen" en "geen signalen".
jaarKop('H2e, wat optie (c) zou doen (poort open, doel 3x ATR / 30 dagen):');
jaarRegel('KOOP + R/R (vandaag)', draai(basisKoop));
jaarRegel('  zonder voorlopers >25%', draai(s => basisKoop(s) && (s.rs30 === null || s.rs30 <= 0.25)));
jaarRegel('  zonder voorlopers >10%', draai(s => basisKoop(s) && (s.rs30 === null || s.rs30 <= 0.10)));
jaarRegel('  alleen achterblijvers', draai(s => basisKoop(s) && s.rs30 !== null && s.rs30 <= -0.10));
jaarRegel('high conviction (vandaag)', draai(basisHc));
jaarRegel('  zonder voorlopers >25%', draai(s => basisHc(s) && (s.rs30 === null || s.rs30 <= 0.25)));
jaarRegel('  zonder voorlopers >10%', draai(s => basisHc(s) && (s.rs30 === null || s.rs30 <= 0.10)));
jaarRegel('  alleen achterblijvers', draai(s => basisHc(s) && s.rs30 !== null && s.rs30 <= -0.10));

// En hetzelfde zonder poort, want de poort staat lang niet altijd open en een regel in de engine
// werkt ook op de dagen dat hij dicht is.
jaarKop('H2f, idem maar zonder marktpoort:');
jaarRegel('KOOP + R/R (vandaag)', draai(kaal));
jaarRegel('  zonder voorlopers >25%', draai(s => kaal(s) && (s.rs30 === null || s.rs30 <= 0.25)));
jaarRegel('  zonder voorlopers >10%', draai(s => kaal(s) && (s.rs30 === null || s.rs30 <= 0.10)));
jaarRegel('  alleen achterblijvers', draai(s => kaal(s) && s.rs30 !== null && s.rs30 <= -0.10));

// Hoeveel signalen raken we kwijt, uitgedrukt in dagen met minstens een signaal? Gemiddelde R zegt
// niets over of de app nog iets te melden heeft.
const dagenMet = (kiest: (s: Signaal) => boolean) => {
  const dagen = new Set<string>();
  for (const symbool of coins) {
    for (const s of signalenPerCoin[symbool] ?? []) if (kiest(s)) dagen.add(s.datum);
  }
  return dagen.size;
};
console.log('\n  Dagen met minstens een KOOP-signaal (poort open):');
console.log(`    vandaag                 ${dagenMet(basisKoop)}`);
console.log(`    zonder voorlopers >25%  ${dagenMet(s => basisKoop(s) && (s.rs30 === null || s.rs30 <= 0.25))}`);
console.log(`    zonder voorlopers >10%  ${dagenMet(s => basisKoop(s) && (s.rs30 === null || s.rs30 <= 0.10))}`);
console.log(`    alleen achterblijvers   ${dagenMet(s => basisKoop(s) && s.rs30 !== null && s.rs30 <= -0.10)}`);

// --- meting I: momentum-radar voor het Kansen-scherm ------------------------------------
//
// Het Kansen-scherm wordt een momentum-radar: welke coins lopen de laatste 1 tot 4 weken voorop, en
// is er nu een nette instap? De oude kansScore (7d/30d-rendement, volume/marktcap, afstand tot ATH,
// kleine marktcap) is nooit gemeten. Hier meten we elk ingrediënt uit engine/momentum.ts los, met de
// niveaus die scoorCandles op die bar gaf (momentumprofiel, minRR 0, doel 3x ATR, 30 dagen).
//
//   I-a  Per ingrediënt in kwintielen over ALLE bars (overlappend, zoals meting A). Een kwintiel is
//        pas iets waard als het de nulmeting "alle bars" verslaat, en het effect hoort monotoon te
//        lopen; een enkel uitschietend kwintiel is ruis.
//   I-a2 Dezelfde kwintielen binnen KOOP + R/R: voegt het ingrediënt iets toe BOVENOP wat Markt al
//        doet? Dat is de vraag die het scherm straks stelt.
//   I-b  De samengestelde momentumScore per bucket.
//   I-c  Radar (momentumScore >= RADAR_DREMPEL) EN KOOP + R/R, tegen Markt's gewone KOOP, als echte
//        strategie (geen overlap per coin) en per jaar (I-d).
//
// Kwintielgrenzen komen uit de hele steekproef. Voor een meting is dat prima; de drempels die in
// momentum.ts belanden zijn ronde getallen in de buurt, geen tot op de komma gepaste grenzen.

console.log('\n\n' + '='.repeat(72));
console.log('METING I: momentum-radar (ingrediënten voor het Kansen-scherm)');
console.log('='.repeat(72));

const alleSignalen: Signaal[] = coins.flatMap(s => signalenPerCoin[s] ?? []);
const rijR = (set: Signaal[]) => set.map(s => ({ r: s.rBar }));
const nulI = stat(rijR(alleSignalen));
console.log(`\nNulmeting: ${nulI.n} bars, treffer ${nulI.treffer.toFixed(1)}%, gem R ${nulI.gemR.toFixed(3)}`);
const koopRr = alleSignalen.filter(s => s.koop && s.rrOk);
const nulKoop = stat(rijR(koopRr));
console.log(`KOOP + R/R: ${nulKoop.n} bars, treffer ${nulKoop.treffer.toFixed(1)}%, gem R ${nulKoop.gemR.toFixed(3)}`);

type IngredientNaam = keyof MomentumIngredienten;
const ingredienten: [IngredientNaam, string][] = [
  ['rendement7d', 'rendement 7d (%)'],
  ['rendement30d', 'rendement 30d (%)'],
  ['volumeTrend', 'volumetrend 7/30'],
  ['rsBtc30d', 'RS vs BTC 30d (pp)'],
  ['afstandHigh90d', 'afstand 90d-high (%)'],
  ['trendConsistentie', 'dagen boven EMA20'],
];

// Grenzen op 20/40/60/80% van de waarden in de hele steekproef.
function kwintielGrenzen(waarden: number[]): number[] {
  const s = [...waarden].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map(p => s[Math.floor(p * (s.length - 1))]);
}
const kwintielVan = (v: number, g: number[]) => g.filter(x => v > x).length;
const fmt = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2));

const grenzenPer: Partial<Record<IngredientNaam, number[]>> = {};
for (const [sleutel, label] of ingredienten) {
  const metWaarde = alleSignalen.filter(s => s.mom[sleutel] !== null);
  const g = kwintielGrenzen(metWaarde.map(s => s.mom[sleutel] as number));
  grenzenPer[sleutel] = g;
  const naamVan = (k: number) =>
    `Q${k + 1} ${k === 0 ? '<=' + fmt(g[0]) : k === 4 ? '>' + fmt(g[3]) : fmt(g[k - 1]) + '..' + fmt(g[k])}`;
  const emmers = (set: Signaal[]): [string, { r: number }[]][] =>
    [0, 1, 2, 3, 4].map(k => [
      naamVan(k),
      rijR(set.filter(s => s.mom[sleutel] !== null && kwintielVan(s.mom[sleutel] as number, g) === k)),
    ]);
  tabel(`I-a ${label}, alle bars (nulmeting gem R ${nulI.gemR.toFixed(3)}):`, emmers(metWaarde));
  tabel(`I-a2 ${label}, binnen KOOP + R/R (basis gem R ${nulKoop.gemR.toFixed(3)}):`, emmers(koopRr));
}

// Per jaar, als echte strategie zonder overlap: het bovenste en onderste kwintiel van elk
// ingrediënt naast de nulmeting. Zakt het bovenste kwintiel in de dalende jaren (2018, 2022, 2025)
// ver onder de nulmeting, dan is het een bullmarkt-effect en geen radar.
const inKwintiel = (sleutel: IngredientNaam, k: number) => (s: Signaal) =>
  s.mom[sleutel] !== null && kwintielVan(s.mom[sleutel] as number, grenzenPer[sleutel]!) === k;
jaarKop('I-d per ingrediënt, onderste en bovenste kwintiel, alle bars, 3x ATR / 30 dagen:');
jaarRegel('nulmeting (alle bars)', draai(() => true));
for (const [sleutel, label] of ingredienten) {
  jaarRegel(`${label} Q1`, draai(inKwintiel(sleutel, 0)));
  jaarRegel(`${label} Q5`, draai(inKwintiel(sleutel, 4)));
}

// I-e: dezelfde kwintielen, maar gemeten TEGEN DE ANDERE COINS OP DEZELFDE DAG. Een radar
// rangschikt coins op één moment, dus dit is de eerlijke vraag. De pooled cijfers van I-a mengen er
// een markteffect doorheen: op dagen dat veel coins hard stijgen staat de hele markt in een
// bullfase, en dan doet elke instap het beter. Excess R = R van de bar min de gemiddelde R van
// alle coins op die dag (alleen dagen met minstens 15 coins).
const perDagR: Record<string, number[]> = {};
for (const s of alleSignalen) (perDagR[s.datum] ??= []).push(s.rBar);
const excessVan = (s: Signaal) => {
  const d = perDagR[s.datum];
  return d.length >= 15 ? s.rBar - gem(d) : null;
};
console.log('\nI-e excess R per kwintiel t.o.v. de andere coins op dezelfde dag (0 = niets beter):');
console.log('  ' + 'ingrediënt'.padEnd(22) + ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map(q => q.padStart(9)).join(''));
console.log('  ' + '-'.repeat(67));
for (const [sleutel, label] of ingredienten) {
  let regel = '  ' + label.padEnd(22);
  for (let k = 0; k < 5; k++) {
    const ex = alleSignalen.filter(inKwintiel(sleutel, k)).map(excessVan).filter((x): x is number => x !== null);
    regel += gem(ex).toFixed(3).padStart(9);
  }
  console.log(regel);
}

// I-b: de samengestelde score.
const scoreVan = (s: Signaal) => momentumScore(s.mom);
const scoreEmmers: [string, (s: Signaal) => boolean][] = [
  ['score 0-20', s => scoreVan(s) < 20],
  ['score 20-40', s => scoreVan(s) >= 20 && scoreVan(s) < 40],
  ['score 40-60', s => scoreVan(s) >= 40 && scoreVan(s) < 60],
  ['score 60-80', s => scoreVan(s) >= 60 && scoreVan(s) < 80],
  ['score 80-100', s => scoreVan(s) >= 80],
];
tabel(`I-b momentumScore, alle bars (nulmeting gem R ${nulI.gemR.toFixed(3)}):`,
  scoreEmmers.map(([naam, f]) => [naam, rijR(alleSignalen.filter(f))]));
tabel(`I-b momentumScore, binnen KOOP + R/R (basis gem R ${nulKoop.gemR.toFixed(3)}):`,
  scoreEmmers.map(([naam, f]) => [naam, rijR(koopRr.filter(f))]));
tabel('I-b R/R-effect binnen de radar (momentumScore >= RADAR_DREMPEL, alle bars):', [
  ['radar, R/R >= 2', rijR(alleSignalen.filter(s => scoreVan(s) >= RADAR_DREMPEL && s.rrOk))],
  ['radar, R/R < 2', rijR(alleSignalen.filter(s => scoreVan(s) >= RADAR_DREMPEL && !s.rrOk))],
]);

// I-c/I-d: wat het scherm straks als KOOP toont, naast Markt. Met en zonder de marktpoort, want
// Markt zet zijn KOOP op WATCH zodra bepaalKlimaat() de poort sluit.
const radar = (s: Signaal) => scoreVan(s) >= RADAR_DREMPEL;
const radarVanaf = (t: number) => (s: Signaal) => scoreVan(s) >= t;

// Welke drempel? Hoe hoger, hoe beter per trade maar hoe leger de lijst. Meting I-c hieronder
// draait op RADAR_DREMPEL; deze regels laten de buren zien.
jaarKop('I-c0 drempelkeuze: radar + KOOP + R/R, 3x ATR / 30 dagen:');
for (const t of [40, 50, 60, 70, 80]) jaarRegel(`score >= ${t} + KOOP + R/R`, draai(s => radarVanaf(t)(s) && s.koop && s.rrOk));
for (const t of [40, 50, 60, 70, 80]) jaarRegel(`score >= ${t} (elke bar)`, draai(radarVanaf(t)));
jaarKop(`I-c radar (score >= ${RADAR_DREMPEL}) + KOOP + R/R versus Markt, 3x ATR / 30 dagen:`);
jaarRegel('nulmeting (alle bars)', draai(() => true));
jaarRegel('radar alleen (elke bar)', draai(radar));
jaarRegel('Markt KOOP + R/R', draai(s => s.koop && s.rrOk));
jaarRegel('radar + KOOP + R/R', draai(s => radar(s) && s.koop && s.rrOk));
jaarRegel('KOOP + R/R, NIET op radar', draai(s => !radar(s) && s.koop && s.rrOk));
jaarRegel('Markt KOOP + R/R, poort open', draai(basisKoop));
jaarRegel('radar + KOOP + R/R, poort open', draai(s => radar(s) && basisKoop(s)));
jaarRegel('high conviction', draai(s => s.hc));
jaarRegel('radar + high conviction', draai(s => radar(s) && s.hc));

// I-f: dezelfde excess-vraag als I-e, nu per jaar voor de radar zelf. Een radar die alleen in
// bulljaren boven de andere coins uitkomt, rangschikt niets: dan meet hij de markt.
console.log('\nI-f excess R per jaar t.o.v. de andere coins op dezelfde dag (alle bars, overlappend):');
let kopF = '  ' + 'groep'.padEnd(30) + 'n'.padStart(7) + 'excess'.padStart(8) + ' |';
for (const jaar of jaren) kopF += jaar.slice(2).padStart(7);
console.log(kopF);
console.log('  ' + '-'.repeat(kopF.length - 2));
const excessGroepen: [string, (s: Signaal) => boolean][] = [
  [`radar (score >= ${RADAR_DREMPEL})`, radar],
  ['niet op radar', s => !radar(s)],
  ['radar + KOOP + R/R', s => radar(s) && s.koop && s.rrOk],
  ['Markt KOOP + R/R', s => s.koop && s.rrOk],
];
for (const [naam, f] of excessGroepen) {
  const set = alleSignalen.filter(f).flatMap(s => {
    const ex = excessVan(s);
    return ex === null ? [] : [{ ex, jaar: jaarVan(s.datum) }];
  });
  let regel = '  ' + naam.padEnd(30) + String(set.length).padStart(7) + gem(set.map(x => x.ex)).toFixed(3).padStart(8) + ' |';
  for (const jaar of jaren) {
    const ex = set.filter(x => x.jaar === jaar).map(x => x.ex);
    regel += (ex.length >= 30 ? gem(ex).toFixed(2) : '.').padStart(7);
  }
  console.log(regel);
}

console.log('\n  Dagen met minstens een signaal:');
console.log(`    Markt KOOP + R/R         ${dagenMet(s => s.koop && s.rrOk)}`);
console.log(`    radar + KOOP + R/R       ${dagenMet(s => radar(s) && s.koop && s.rrOk)}`);
console.log(`    radar (elke bar)         ${dagenMet(radar)}`);

// --- meting J: radar-niveaus ------------------------------------------------------------
//
// Meting I liet zien dat binnen de radar de R/R-filter averechts werkt: bars met R/R < 2 deden het
// beter dan bars erboven, omdat een coin vlak onder zijn top zijn swing-low ver weg heeft. Een
// KOOP-oordeel met de vaste regel R/R >= MIN_RISK_REWARD (die drempel gaat NIET omlaag) zegt op
// Kansen dan niets. De vraag hier: bestaat er een stop/doel-constructie waarbij R/R binnen de radar
// wel sorteert, dus waarbij R/R >= 2 BETER presteert dan R/R < 2?
//
// Het rooster: vijf stops maal vijf doelen = 25 varianten. Dat is veel, dus het risico op
// overfitting is reëel; daarom staat per jaar erbij en telt de winnaar alleen als hij in de
// meeste jaren wint, niet alleen gemiddeld. Alles causaal: niveaus uit candles[0..i], de
// uitkomst via simuleer() met dezelfde 30 dagen houdtijd. Alleen radar-bars, geen overlap per coin.
//
//   stops:  swing-low met cap 3x ATR (huidig), cap 2x, cap 1,5x; EMA20; EMA20 - 0,5x ATR. De
//           EMA20-stops krijgen dezelfde vloer (0,5x ATR) en cap (3x ATR) als de swing-stop, anders
//           geeft een koers vlak boven zijn EMA20 een ruis-krappe stop en een absurde R/R.
//   doelen: 3x ATR (huidig), 4x, 5x ATR; 90d-high + 1x ATR, 90d-high + 2x ATR (uitbraakdoel).

console.log('\n\n' + '='.repeat(72));
console.log('METING J: radar-niveaus. Kan R/R binnen de radar wel sorteren?');
console.log('='.repeat(72));

const candlesCache: Record<string, Candle[]> = {};
const candlesVan = (s: string) => (candlesCache[s] ??= laadCandles(s));

type StopRegel = { naam: string; afstand: (c: Candle[], s: Signaal) => number | null };
type DoelRegel = { naam: string; doel: (c: Candle[], s: Signaal) => number | null };

const swingStop = (cap: number): StopRegel => ({
  naam: `swing cap ${cap}x`,
  afstand: (c, s) => stopAfstandStructuur(c.slice(Math.max(0, s.i - 20), s.i + 1), s.entry, s.atr, cap),
});
const emaStop = (buffer: number): StopRegel => ({
  naam: buffer === 0 ? 'EMA20' : `EMA20 - ${buffer}x ATR`,
  afstand: (_c, s) => {
    const ruw = s.entry - (s.ema20 - buffer * s.atr);
    // Koers onder (of op) de EMA20: deze stop bestaat dan niet.
    if (!(s.entry > s.ema20)) return null;
    return Math.min(Math.max(ruw, 0.5 * s.atr), 3 * s.atr);
  },
});
const stopRegels: StopRegel[] = [swingStop(3), swingStop(2), swingStop(1.5), emaStop(0), emaStop(0.5)];

const hoogste90 = (c: Candle[], i: number) => {
  let top = -Infinity;
  for (let j = Math.max(0, i - 89); j <= i; j++) top = Math.max(top, c[j].high);
  return top;
};
const atrDoel = (k: number): DoelRegel => ({ naam: `${k}x ATR`, doel: (_c, s) => s.entry + k * s.atr });
const uitbraakDoel = (k: number): DoelRegel => ({
  naam: `90d-high + ${k}x ATR`,
  doel: (c, s) => Math.max(hoogste90(c, s.i), s.entry) + k * s.atr,
});
const doelRegels: DoelRegel[] = [atrDoel(3), atrDoel(4), atrDoel(5), uitbraakDoel(1), uitbraakDoel(2)];

// Draait een instapregel met eigen niveaus, zonder overlap per coin. `rrEis` filtert op de R/R die
// deze variant op dat moment zou tonen. `kiest` krijgt ook de candles van de coin mee, zodat een
// regel de app-functies zelf kan aanroepen (zie J3).
function draaiNiveaus(
  kiest: (s: Signaal, c: Candle[]) => boolean,
  stop: StopRegel,
  doel: DoelRegel,
  rrEis: 'alle' | 'rr>=2' | 'rr<2',
): { r: number; datum: string }[] {
  const uit: { r: number; datum: string }[] = [];
  for (const symbool of coins) {
    const c = candlesVan(symbool);
    let bezetTot = -1;
    for (const s of signalenPerCoin[symbool] ?? []) {
      if (s.i <= bezetTot || !kiest(s, c)) continue;
      const risico = stop.afstand(c, s);
      const d = doel.doel(c, s);
      if (risico === null || d === null || !(risico > 0)) continue;
      const rr = (d - s.entry) / risico;
      const rrOk = rr >= MIN_RISK_REWARD - 1e-9;
      if (rrEis === 'rr>=2' && !rrOk) continue;
      if (rrEis === 'rr<2' && rrOk) continue;
      const u = simuleer(c, s.i, s.entry, s.entry - risico, d);
      if (!u) continue;
      uit.push({ r: u.r, datum: s.datum });
      bezetTot = s.i + u.bars;
    }
  }
  return uit;
}

const radarJ = (s: Signaal) => momentumScore(s.mom) >= RADAR_DREMPEL;
const radarKoopJ = (s: Signaal) => radarJ(s) && s.score >= DREMPEL_KOOP;

// Referentie per jaar: radar alleen onder de huidige niveaus. Een variant "wint een jaar" als zijn
// R/R >= 2-regel daar hoger uitkomt.
const refRadar = draaiNiveaus(radarJ, stopRegels[0], doelRegels[0], 'alle');
const perJaar = (t: { r: number; datum: string }[]) =>
  Object.fromEntries(jaren.map(j => {
    const rs = t.filter(x => jaarVan(x.datum) === j).map(x => x.r);
    return [j, rs.length >= 10 ? gem(rs) : null];
  })) as Record<string, number | null>;
const refJaar = perJaar(refRadar);

const kort = (t: { r: number }[]) =>
  t.length ? `${String(t.length).padStart(5)} ${gem(t.map(x => x.r)).toFixed(3).padStart(7)}` : '    0       -';

console.log('\nJ1 rooster, alleen radar-bars zonder overlap. Per kolom: n en gem R.');
console.log('   "rr>=2 wint" = in hoeveel jaren R/R >= 2 beter is dan R/R < 2 (jaren met >= 10 trades in beide).');
console.log('   "vs radar" = in hoeveel jaren R/R >= 2 beter is dan radar alleen onder de huidige niveaus.');
console.log('  ' + 'stop'.padEnd(16) + 'doel'.padEnd(20) + '   alle radar' + '      R/R >= 2' + '       R/R < 2' + '  +score55,rr>=2' + '  rr>=2 wint' + '  vs radar');
console.log('  ' + '-'.repeat(132));

type Uitkomst = { stop: StopRegel; doel: DoelRegel; hoog: { r: number; datum: string }[]; wintJaren: number; vsRadar: number; jarenGeteld: number };
const uitkomsten: Uitkomst[] = [];
for (const stop of stopRegels) {
  for (const doel of doelRegels) {
    const alleR = draaiNiveaus(radarJ, stop, doel, 'alle');
    const hoog = draaiNiveaus(radarJ, stop, doel, 'rr>=2');
    const laag = draaiNiveaus(radarJ, stop, doel, 'rr<2');
    const koop = draaiNiveaus(radarKoopJ, stop, doel, 'rr>=2');
    const jh = perJaar(hoog);
    const jl = perJaar(laag);
    let wint = 0, geteld = 0, vsRadar = 0, vsGeteld = 0;
    for (const j of jaren) {
      if (jh[j] !== null && jl[j] !== null) { geteld++; if (jh[j]! > jl[j]!) wint++; }
      if (jh[j] !== null && refJaar[j] !== null) { vsGeteld++; if (jh[j]! > refJaar[j]!) vsRadar++; }
    }
    uitkomsten.push({ stop, doel, hoog, wintJaren: wint, vsRadar, jarenGeteld: vsGeteld });
    console.log(
      '  ' + stop.naam.padEnd(16) + doel.naam.padEnd(20) +
      kort(alleR).padStart(13) + kort(hoog).padStart(14) + kort(laag).padStart(14) + kort(koop).padStart(16) +
      `${wint}/${geteld}`.padStart(12) + `${vsRadar}/${vsGeteld}`.padStart(10),
    );
  }
}

// Per jaar voor de varianten waar R/R >= 2 het vaakst wint van R/R < 2, plus de referentie.
const top = [...uitkomsten]
  .filter(u => u.hoog.length >= 200)
  .sort((a, b) => (b.wintJaren - a.wintJaren) || (gem(b.hoog.map(x => x.r)) - gem(a.hoog.map(x => x.r))))
  .slice(0, 4);

jaarKop('J2 per jaar, referenties en de vier varianten waar R/R >= 2 het vaakst wint (n >= 200):');
jaarRegel('nulmeting (alle bars)', draai(() => true));
jaarRegel('radar alleen (huidig)', refRadar);
jaarRegel('Markt KOOP + R/R', draai(s => s.koop && s.rrOk));
jaarRegel('Markt KOOP + R/R, poort open', draai(basisKoop));
jaarRegel('radar + R/R>=2 (huidig)', draaiNiveaus(radarJ, stopRegels[0], doelRegels[0], 'rr>=2'));
for (const u of top) {
  const naam = `${u.stop.naam} / ${u.doel.naam}`;
  console.log(`\n  ${naam}:`);
  jaarRegel('  radar, R/R >= 2', u.hoog);
  jaarRegel('  radar, R/R < 2', draaiNiveaus(radarJ, u.stop, u.doel, 'rr<2'));
  jaarRegel('  radar + score>=55 + R/R>=2', draaiNiveaus(radarKoopJ, u.stop, u.doel, 'rr>=2'));
  jaarRegel('  idem, poort open', draaiNiveaus(s => radarKoopJ(s) && poortOpenNu(s), u.stop, u.doel, 'rr>=2'));
  jaarRegel('  radar + R/R>=2, poort open', draaiNiveaus(s => radarJ(s) && poortOpenNu(s), u.stop, u.doel, 'rr>=2'));
}

// J3: de gekozen variant zoals de app hem krijgt, via radarNiveaus() uit momentum.ts. Moet exact
// gelijk zijn aan de roosterregel "EMA20 / 90d-high + 2x ATR"; anders meet de backtest iets anders
// dan de app straks draait.
const viaApp = (c: Candle[], s: Signaal) =>
  radarNiveaus(c.slice(Math.max(0, s.i - VENSTER + 1), s.i + 1), s.atr, s.ema20);
const appStop: StopRegel = { naam: 'radarNiveaus', afstand: (c, s) => { const n = viaApp(c, s); return n ? n.entry - n.stopLoss : null; } };
const appDoel: DoelRegel = { naam: 'radarNiveaus', doel: (c, s) => viaApp(c, s)?.takeProfit ?? null };
const appHoog = draaiNiveaus(radarJ, appStop, appDoel, 'rr>=2');
const roosterHoog = draaiNiveaus(radarJ, emaStop(0), uitbraakDoel(2), 'rr>=2');
jaarKop('J3 radarNiveaus() uit momentum.ts, ter controle:');
jaarRegel('radar + R/R>=2 via radarNiveaus', appHoog);
// De KOOP-regel zoals de app hem neemt: radarSignaal() uit opportunities.ts op de radarNiveaus, in
// plaats van de nagebouwde conditie score >= DREMPEL_KOOP plus R/R >= 2. Moet hetzelfde opleveren.
const appKoop = draaiNiveaus(
  (s, c) => radarJ(s) && radarSignaal(viaApp(c, s), s.score).signaal === 'KOOP', appStop, appDoel, 'alle',
);
const nagebouwdKoop = draaiNiveaus(radarKoopJ, appStop, appDoel, 'rr>=2');
jaarRegel('radar + score>=55 + R/R>=2', appKoop);
console.assert(
  appKoop.length === nagebouwdKoop.length && Math.abs(gem(appKoop.map(x => x.r)) - gem(nagebouwdKoop.map(x => x.r))) < 1e-9,
  `radarSignaal wijkt af van de nagebouwde KOOP-regel: ${appKoop.length} tegen ${nagebouwdKoop.length} trades`,
);
console.assert(
  appHoog.length === roosterHoog.length && Math.abs(gem(appHoog.map(x => x.r)) - gem(roosterHoog.map(x => x.r))) < 1e-9,
  `radarNiveaus wijkt af van de roosterregel: ${appHoog.length} tegen ${roosterHoog.length} trades`,
);

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
