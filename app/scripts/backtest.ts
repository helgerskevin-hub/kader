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

// --- meting A: elke bar, elke coin ------------------------------------------------------

console.log(`Backtest over ${coins.length} coins, max houdduur ${MAX_BARS} dagen.\n`);

const alle: Simulatie[] = [];
const strategie: Simulatie[] = [];

// Wat de engine op elke bar zei, bewaard zodat meting D er andere doelen en houdtijden
// overheen kan leggen zonder 57.000 keer opnieuw te scoren. De instapbeslissing (entry, stop)
// blijft van de engine, alleen het beheer van de trade varieert.
type Signaal = {
  i: number; datum: string; entry: number; stop: number; atr: number;
  score: number; hc: boolean; koop: boolean; breedte: number | null;
};
const signalenPerCoin: Record<string, Signaal[]> = {};

for (const symbool of coins) {
  const candles = laadCandles(symbool);
  if (candles.length < MIN_CANDLES + 2) continue;

  let bezetTot = -1; // voor meting B: geen overlappende trades in dezelfde coin
  signalenPerCoin[symbool] = [];

  for (let i = MIN_CANDLES - 1; i < candles.length - 1; i++) {
    // minRR: 0 zet de R/R-filter uit, zodat we óók de afgewezen signalen kunnen meten.
    const t: Trade | null = scoorCandles(symbool, candles.slice(0, i + 1), 'binance', { minRR: 0 });
    if (!t) continue;

    const uitkomst = simuleer(candles, i, t.entry, t.stopLoss, t.takeProfit);
    if (!uitkomst) continue;

    const datum = datumVan(candles[i].tijd);
    signalenPerCoin[symbool].push({
      i, datum, entry: t.entry, stop: t.stopLoss, atr: t.atr,
      score: t.score, hc: t.highConviction, koop: t.signaal === 'KOOP',
      breedte: breedtePerDag[datum] ?? null,
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

const breed = (s: Simulatie, drempel: number) => s.breedte !== null && s.breedte >= drempel;
const nietHebzucht = (s: Simulatie) => s.fng === null || s.fng <= 75;

const varianten: [string, (s: Simulatie) => boolean][] = [
  ['app nu (KOOP + R/R)', s => s.signaal === 'KOOP' && s.doorRrFilter],
  ['KOOP, geen R/R-filter', s => s.signaal === 'KOOP'],
  ['score 75+, geen filter', s => s.score >= 75],
  ['high conviction', s => s.highConviction],
  ['high conv. + niet hebzucht', s => s.highConviction && nietHebzucht(s)],
  // De breedte-poort: alleen kopen als de altmarkt zelf meedoet.
  ['KOOP + breedte >= 40%', s => s.signaal === 'KOOP' && breed(s, 0.4)],
  ['score 75+ + breedte >= 40%', s => s.score >= 75 && breed(s, 0.4)],
  ['high conv. + breedte >= 30%', s => s.highConviction && breed(s, 0.3)],
  ['high conv. + breedte >= 40%', s => s.highConviction && breed(s, 0.4)],
  ['high conv. + breedte >= 50%', s => s.highConviction && breed(s, 0.5)],
  ['high conv. + breedte + F&G', s => s.highConviction && breed(s, 0.4) && nietHebzucht(s)],
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

// --- meting D: hoe beheren we de trade? -------------------------------------------------
//
// De instap blijft precies zoals de engine hem doet (dezelfde entry, dezelfde swing-low-stop).
// We variëren alleen het doel (nu vast op 3x ATR) en hoe lang we een trade laten lopen (nu 30
// dagen). Als een trendvolger in een schokkerige markt zijn winst steeds ziet wegsmelten voor
// hij zijn doel haalt, dan is dát het probleem, en niet het instapmoment.

console.log('\n' + '='.repeat(72));
console.log('METING D: zelfde instap, ander doel en andere houdtijd');
console.log('='.repeat(72));

function sweep(naam: string, kiest: (s: Signaal) => boolean) {
  console.log(`\nInstapregel: ${naam}`);
  console.log('  ' + 'doel'.padEnd(10) + 'houd'.padStart(6) + 'n'.padStart(7) + 'treffer%'.padStart(10) + 'gem R'.padStart(9) + 'eerste deel'.padStart(13) + 'laatste deel'.padStart(14));
  console.log('  ' + '-'.repeat(69));

  for (const maxBars of [10, 20, 30]) {
    for (const k of [1.0, 1.5, 2.0, 3.0]) {
      const rs: { r: number; datum: string }[] = [];

      for (const symbool of coins) {
        const candles = laadCandles(symbool);
        let bezetTot = -1;
        for (const s of signalenPerCoin[symbool] ?? []) {
          if (!kiest(s) || s.i <= bezetTot) continue;
          const doel = s.entry + k * s.atr;
          const u = simuleer(candles, s.i, s.entry, s.stop, doel, maxBars);
          if (!u) continue;
          rs.push({ r: u.r, datum: s.datum });
          bezetTot = s.i + u.bars;
        }
      }

      if (rs.length === 0) continue;
      const gem = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
      const alleR = rs.map(x => x.r);
      const vroeg = rs.filter(x => x.datum < grens).map(x => x.r);
      const laat = rs.filter(x => x.datum >= grens).map(x => x.r);
      const treffer = (alleR.filter(r => r > 0).length / alleR.length) * 100;

      console.log(
        '  ' + `${k.toFixed(1)}x ATR`.padEnd(10) +
        `${maxBars}d`.padStart(6) +
        String(rs.length).padStart(7) +
        treffer.toFixed(1).padStart(10) +
        gem(alleR).toFixed(3).padStart(9) +
        (vroeg.length ? gem(vroeg).toFixed(3) : '-').padStart(13) +
        (laat.length ? gem(laat).toFixed(3) : '-').padStart(14),
      );
    }
  }
}

sweep('high conviction', s => s.hc);
sweep('KOOP (score >= 55), geen R/R-filter', s => s.koop);

// --- meting E: werkt de score ook als short? --------------------------------------------
//
// De app is long-only en verloor anderhalf jaar lang geld, in een markt waarin de mediane coin
// 71% zakte. De vraag die dat oproept: zit er in dezelfde score ook een bruikbaar shortsignaal?
// Een score die zowel de stijgers als de dalers herkent, is een veel sterker instrument dan een
// score die alleen maar "koop" kan zeggen.
//
// Gespiegelde mechaniek: stop boven de recente swing high, doel k x ATR onder de entry.
// R = (entry - exit) / risico, dus een dalende koers levert een positieve R op.

const SWING = 10;

function shortNiveaus(candles: Candle[], i: number, atr: number) {
  const entry = candles[i].close;
  let swingHigh = -Infinity;
  for (let j = Math.max(0, i - SWING + 1); j <= i; j++) swingHigh = Math.max(swingHigh, candles[j].high);
  const ruw = (swingHigh + 0.1 * atr) - entry;
  const risico = Math.min(Math.max(ruw, 0.5 * atr), 3 * atr);
  return { entry, stop: entry + risico, risico };
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
    // Weer conservatief: raakt de candle allebei, dan nemen we het verlies.
    if (c.high >= stop) return { r: (entry - stop) / risico, bars: j - i };
    if (c.low <= doel) return { r: (entry - doel) / risico, bars: j - i };
  }
  return { r: (entry - candles[eind].close) / risico, bars: eind - i };
}

console.log('\n' + '='.repeat(72));
console.log('METING E: dezelfde score, maar dan als short (doel 2x ATR omlaag, 20 dagen)');
console.log('='.repeat(72));
console.log('\nEen lage score zou een slechte coin moeten aanwijzen. Levert short gaan op die coins geld op?\n');
console.log('  ' + 'scorebucket'.padEnd(20) + 'n'.padStart(7) + 'treffer%'.padStart(10) + 'gem R'.padStart(9) + 'eerste deel'.padStart(13) + 'laatste deel'.padStart(14));
console.log('  ' + '-'.repeat(73));

const shortBuckets: [string, (score: number) => boolean][] = [
  ['score 0-25', s => s < 25],
  ['score 25-40', s => s >= 25 && s < 40],
  ['score 40-55', s => s >= 40 && s < 55],
  ['score 55-75', s => s >= 55 && s < 75],
  ['score 75+', s => s >= 75],
];

for (const [naam, past] of shortBuckets) {
  const rs: { r: number; datum: string }[] = [];

  for (const symbool of coins) {
    const candles = laadCandles(symbool);
    let bezetTot = -1;
    for (const s of signalenPerCoin[symbool] ?? []) {
      if (!past(s.score) || s.i <= bezetTot) continue;
      const n = shortNiveaus(candles, s.i, s.atr);
      const doel = n.entry - 2.0 * s.atr;
      const u = simuleerShort(candles, s.i, n.entry, n.stop, doel, 20);
      if (!u) continue;
      rs.push({ r: u.r, datum: s.datum });
      bezetTot = s.i + u.bars;
    }
  }

  if (rs.length === 0) continue;
  const gem = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const alleR = rs.map(x => x.r);
  const vroeg = rs.filter(x => x.datum < grens).map(x => x.r);
  const laat = rs.filter(x => x.datum >= grens).map(x => x.r);
  console.log(
    '  ' + naam.padEnd(20) +
    String(rs.length).padStart(7) +
    ((alleR.filter(r => r > 0).length / alleR.length) * 100).toFixed(1).padStart(10) +
    gem(alleR).toFixed(3).padStart(9) +
    (vroeg.length ? gem(vroeg).toFixed(3) : '-').padStart(13) +
    (laat.length ? gem(laat).toFixed(3) : '-').padStart(14),
  );
}

// --- meting F: een tool die van richting kan wisselen ------------------------------------
//
// De beslissende vraag. Longs verdienden in de bull en verloren in de bear; shorts precies
// andersom. Kader kent maar één richting en heeft dus per definitie de helft van de tijd
// ongelijk. Wat als de BTC-trend bepaalt welke kant we op kijken?
//
// Belangrijk: de poort gebruikt alleen data van vóór de instap (BTC-close t.o.v. zijn EMA200 op
// die dag), dus dit is een regel die je in het echt ook had kunnen volgen.

console.log('\n' + '='.repeat(72));
console.log('METING F: richting bepalen met de BTC-trend (long boven EMA200, short eronder)');
console.log('='.repeat(72));
console.log('\n  ' + 'strategie'.padEnd(34) + 'n'.padStart(6) + 'treffer%'.padStart(10) + 'gem R'.padStart(9) + 'eerste deel'.padStart(13) + 'laatste deel'.padStart(14));
console.log('  ' + '-'.repeat(86));

// Long-doel op 2x ATR, short-doel op 2x ATR, allebei 20 dagen: één set regels, geen
// per-richting gefrutsel aan de knoppen.
function draaiRichting(naam: string, longKiest: (s: Signaal) => boolean, shortKiest: (s: Signaal) => boolean, gebruikPoort: boolean) {
  const rs: { r: number; datum: string }[] = [];

  for (const symbool of coins) {
    const candles = laadCandles(symbool);
    let bezetTot = -1;
    for (const s of signalenPerCoin[symbool] ?? []) {
      if (s.i <= bezetTot) continue;
      const riskOn = btcRiskOnPerDag[s.datum];
      if (riskOn === undefined) continue;

      // Zonder poort: alleen long, wat de app nu doet.
      const magLong = gebruikPoort ? riskOn : true;
      const magShort = gebruikPoort ? !riskOn : false;

      if (magLong && longKiest(s)) {
        const u = simuleer(candles, s.i, s.entry, s.stop, s.entry + 2.0 * s.atr, 20);
        if (!u) continue;
        rs.push({ r: u.r, datum: s.datum });
        bezetTot = s.i + u.bars;
      } else if (magShort && shortKiest(s)) {
        const n = shortNiveaus(candles, s.i, s.atr);
        const u = simuleerShort(candles, s.i, n.entry, n.stop, n.entry - 2.0 * s.atr, 20);
        if (!u) continue;
        rs.push({ r: u.r, datum: s.datum });
        bezetTot = s.i + u.bars;
      }
    }
  }

  if (rs.length === 0) return;
  const gem = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const alleR = rs.map(x => x.r);
  const vroeg = rs.filter(x => x.datum < grens).map(x => x.r);
  const laat = rs.filter(x => x.datum >= grens).map(x => x.r);
  console.log(
    '  ' + naam.padEnd(34) +
    String(rs.length).padStart(6) +
    ((alleR.filter(r => r > 0).length / alleR.length) * 100).toFixed(1).padStart(10) +
    gem(alleR).toFixed(3).padStart(9) +
    (vroeg.length ? gem(vroeg).toFixed(3) : '-').padStart(13) +
    (laat.length ? gem(laat).toFixed(3) : '-').padStart(14),
  );
}

// De zwakste coins shorten: precies het spiegelbeeld van wat de app long doet.
const zwak = (s: Signaal) => s.score < 40;

draaiRichting('alleen long, high conv. (nu)', s => s.hc, () => false, false);
// Niets doen zodra BTC onder zijn EMA200 zakt: de goedkoopste ingreep, geen shorts nodig.
// De long-tak van de poort, zonder de short-tak.
draaiRichting('long, maar alleen als BTC risk-on', s => s.hc && (btcRiskOnPerDag[s.datum] === true), () => false, false);
draaiRichting('long/short, high conv. + zwak', s => s.hc, zwak, true);
draaiRichting('long/short, KOOP + zwak', s => s.koop, zwak, true);

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
