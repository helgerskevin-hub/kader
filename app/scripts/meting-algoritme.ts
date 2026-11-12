// Meting O: het Markt-algoritme aan de testbank. De beslisregels staan in docs/algoritme-plan.md
// en lagen vast voordat dit script voor het eerst draaide.
//
// Wat dit script toevoegt aan meting-kansen.ts (waar het de poort en de statistiek van leent):
//   - uitstappen zonder vast doel: een stop die meeloopt, of verkopen op een regel;
//   - een portefeuille-simulatie: vermogen, jaarrendement, terugval, naast BTC houden;
//   - een tweede set coins (data/holdout/) die nooit in een meting heeft gezeten.
//
// Gebruik (vanuit app/):
//   npx tsx scripts/meting-algoritme.ts ijk|uitstap|instap|selectie|combinatie   (alleen de 57 coins)
//   npx tsx scripts/meting-algoritme.ts toets                                     (één keer, holdout)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoorCandles, KLIMAAT_UNIVERSUM, MIN_CANDLES } from '../src/engine/analyzer';
import { ema, atr as atrReeks } from '../src/engine/indicators';
import { radarNiveaus } from '../src/engine/momentum';
import { DREMPEL_KOOP } from '../src/engine/drempels';
import { Candle } from '../src/engine/types';
import { poortOpen, poortBekend, btcBoven200, interval, gem, f, KOSTEN_ETORO, MIN_STOP_BTC } from './meting-kansen';

const HIER = dirname(fileURLToPath(import.meta.url));
const MAP_57 = join(HIER, '..', '..', 'data', 'historie');
const MAP_HOLDOUT = join(HIER, '..', '..', 'data', 'holdout');
const VENSTER = 200;
const DAG_MS = 86_400_000;

const datumVan = (t: number | undefined) => new Date(t as number).toISOString().slice(0, 10);

// --- kenmerken per bar ---------------------------------------------------------------------

// Alles wat een regel op het slot van candle i mag weten. Causaal: alleen candles[0..i].
interface Bar {
  sym: string; i: number; datum: string; close: number; instap: number;
  atr: number;        // ATR van scoorCandles op het venster van de app: de basis van de beginstop
  score: number;
  ema50: number; ema200: number;
  hh50: number | null; hh100: number | null;   // hoogste high van de 50/100 dagen ervoor
  ret90: number | null; ret30: number | null;
  natr: number;       // atr / slot
  poort: boolean;
}

// Per coin: de candles en de reeksen die een lopende trade dagelijks nodig heeft.
interface Coin {
  sym: string; c: Candle[]; datum: string[];
  atr: number[]; ema50: number[]; low20: number[];
  bars: Bar[];
  barOp: Map<number, Bar>;
  laatsteDatum: string;
}

function laadCoin(sym: string, c: Candle[]): Coin {
  const closes = c.map(x => x.close);
  const e50 = ema(closes, 50), e200 = ema(closes, 200);
  const datum = c.map(x => datumVan(x.tijd));
  const low20 = c.map((_, i) => { let m = Infinity; for (let j = Math.max(0, i - 19); j <= i; j++) m = Math.min(m, c[j].low); return m; });
  const bars: Bar[] = [];
  // Zelfde startpunt als meting-kansen.ts, zodat Nu op de 57 coins exact meting N reproduceert.
  for (let i = Math.max(MIN_CANDLES - 1, 90); i < c.length - 1; i++) {
    // Alleen als de volgende candle de dag erna is: anders koop je na een gat op een oud signaal.
    if ((c[i + 1].tijd as number) - (c[i].tijd as number) !== DAG_MS) continue;
    const venster = c.slice(Math.max(0, i - VENSTER + 1), i + 1);
    const t = scoorCandles(sym, venster, 'Binance', { minRR: 0 });
    if (!t || !(t.atr > 0)) continue;
    const hh = (n: number) => { if (i < n) return null; let m = -Infinity; for (let j = i - n; j < i; j++) m = Math.max(m, c[j].high); return m; };
    bars.push({
      sym, i, datum: datum[i], close: c[i].close, instap: c[i + 1].open,
      atr: t.atr, score: t.score, ema50: e50[i], ema200: e200[i],
      hh50: hh(50), hh100: hh(100),
      ret90: i >= 90 ? c[i].close / c[i - 90].close - 1 : null,
      ret30: i >= 30 ? c[i].close / c[i - 30].close - 1 : null,
      natr: t.atr / c[i].close, poort: poortOpen(datum[i]),
    });
  }
  return { sym, c, datum, atr: atrReeks(c, 14), ema50: e50, low20, bars, barOp: new Map(bars.map(b => [b.i, b])), laatsteDatum: datum[datum.length - 1] };
}

function laadSet(map: string, alleen?: string[]): Coin[] {
  const bestanden = readdirSync(map).filter(x => x.endsWith('.json') && !x.startsWith('_')).map(x => x.replace('.json', ''));
  const syms = alleen ? alleen.filter(s => bestanden.includes(s)) : bestanden.sort();
  console.error(`Kenmerken berekenen voor ${syms.length} coins uit ${map.split('/').slice(-1)[0]}...`);
  return syms.flatMap(s => stukken(JSON.parse(readFileSync(join(map, `${s}.json`), 'utf8')))
    .map((c, k, alle) => laadCoin(alle.length > 1 ? `${s}#${k + 1}` : s, c)));
}

// Plan 6a: knippen bij een gat van meer dan 3 dagen of een open buiten 0,2 tot 5 keer het slot
// ervoor (een redenominatie of een hergebruikte ticker). Elk stuk is een eigen coin; stukken
// korter dan 400 candles vallen af.
const MIN_STUK = 400;
function stukken(c: Candle[]): Candle[][] {
  const uit: Candle[][] = [];
  let begin = 0;
  for (let i = 1; i <= c.length; i++) {
    const breuk = i === c.length || (c[i].tijd as number) - (c[i - 1].tijd as number) > 3 * DAG_MS ||
      !(c[i].open / c[i - 1].close >= 0.2 && c[i].open / c[i - 1].close <= 5);
    if (breuk) { if (i - begin >= MIN_STUK) uit.push(c.slice(begin, i)); begin = i; }
  }
  return uit;
}

// --- uitstap -------------------------------------------------------------------------------

type UitstapSoort = 'doel' | 'atrMee' | 'ema50' | 'low20' | 'doelDanMee' | 'poort';
interface Uitstap { naam: string; soort: UitstapSoort; maxDagen: number; doelR?: number }

export const UITSTAPPEN: Record<string, Uitstap> = {
  U0: { naam: 'U0 doel 3R, 30d (Nu)', soort: 'doel', doelR: 3, maxDagen: 30 },
  U1: { naam: 'U1 doel 3R, 90d', soort: 'doel', doelR: 3, maxDagen: 90 },
  U2: { naam: 'U2 stop mee, slot-hoog min 3x ATR', soort: 'atrMee', maxDagen: 365 },
  U3: { naam: 'U3 verkopen na slot onder EMA50', soort: 'ema50', maxDagen: 365 },
  U4: { naam: 'U4 stop mee, laagste 20 dagen', soort: 'low20', maxDagen: 365 },
  U5: { naam: 'U5 vast tot +3R, daarna stop mee', soort: 'doelDanMee', doelR: 3, maxDagen: 365 },
  U6: { naam: 'U6 verkopen als de poort dicht is', soort: 'poort', maxDagen: 365 },
};

interface Trade {
  sym: string; datum: string;            // signaaldag
  inIdx: number; uitIdx: number;         // candle-index van instap en uitstap
  instap: number; uitPrijs: number; uitOpOpen: boolean;
  risico: number; r: number; bruto: number;
  af: boolean;                           // false = liep nog toen de data van ALLE coins ophield
}

// Eén trade vanaf de open van candle i+1. Gap- en kostenregels als simuleer() in meting-kansen.ts:
// een gap rekent met de open, raakt een candle stop en doel allebei dan telt de stop. Een
// meelopende stop en een verkoopregel worden op het slot bepaald en gelden vanaf de volgende dag.
function handel(coin: Coin, b: Bar, u: Uitstap, kosten: number, minStop: number, eindDatum: string, crash = false): Trade | null {
  const { c } = coin;
  const i = b.i;
  const nv = radarNiveaus(b.instap, b.atr);
  if (!nv) return null;
  const instap = b.instap;
  let stop = Math.min(nv.stopLoss, instap * (1 - minStop));
  const risico = instap - stop;
  if (!(risico > 0)) return null;
  const doel = u.doelR !== undefined && u.soort === 'doel' ? instap + u.doelR * risico : Infinity;
  const meeVanaf = u.soort === 'doelDanMee' ? instap + (u.doelR as number) * risico : -Infinity;
  let hoogsteSlot = -Infinity, meeActief = u.soort === 'atrMee', verkoop = false;
  const laatste = Math.min(i + u.maxDagen, c.length - 1);
  const uit = (prijs: number, j: number, opOpen: boolean, af = true): Trade => ({
    sym: coin.sym, datum: b.datum, inIdx: i + 1, uitIdx: j, instap, uitPrijs: prijs, uitOpOpen: opOpen, risico,
    bruto: (prijs - instap) / risico, r: (prijs - instap - kosten * (instap + prijs)) / risico, af,
  });
  for (let j = i + 1; j <= laatste; j++) {
    const k = c[j];
    if (j > i + 1) {
      if (verkoop || k.open <= stop || k.open >= doel) return uit(k.open, j, true);
    }
    // Gevoeligheid (plan 6a): op een crashcandle ver onder de stop vult de stop slechter.
    if (k.low <= stop) return uit(crash && k.low < 0.8 * stop ? (stop + k.low) / 2 : stop, j, false);
    if (k.high >= doel) return uit(doel, j, false);
    // Het slot van dag j: wat geldt er vanaf morgen?
    hoogsteSlot = Math.max(hoogsteSlot, k.close);
    if (u.soort === 'doelDanMee' && k.close >= meeVanaf) meeActief = true;
    if (meeActief) stop = Math.max(stop, hoogsteSlot - 3 * coin.atr[j]);
    if (u.soort === 'low20') stop = Math.max(stop, coin.low20[j]);
    if (u.soort === 'ema50' && k.close < coin.ema50[j]) verkoop = true;
    if (u.soort === 'poort' && !poortOpen(coin.datum[j])) verkoop = true;
  }
  // Houdtijd om: verkopen op het slot. Hield de data van deze coin op (gedelist), dan is dat slot
  // het laatste dat er te verkopen viel. Hield ALLE data op, dan liep de trade nog.
  const nogBezig = laatste < i + u.maxDagen && coin.laatsteDatum >= eindDatum;
  return uit(c[laatste].close, laatste, false, !nogBezig);
}

// --- instap, rangorde, grootte ---------------------------------------------------------------

interface Instap { naam: string; kiest: (b: Bar) => boolean }
export const INSTAPPEN: Record<string, Instap> = {
  I0: { naam: 'I0 score 55+ (Nu)', kiest: b => b.poort && b.score >= DREMPEL_KOOP },
  I1: { naam: 'I1 elke coin (ijk)', kiest: b => b.poort },
  I2: { naam: 'I2 uitbraak 50 dagen', kiest: b => b.poort && b.hh50 !== null && b.close > b.hh50 },
  I3: { naam: 'I3 uitbraak 100 dagen', kiest: b => b.poort && b.hh100 !== null && b.close > b.hh100 },
  I4: { naam: 'I4 EMA50 > EMA200, slot > EMA50', kiest: b => b.poort && b.ema50 > b.ema200 && b.close > b.ema50 },
  I5: { naam: 'I5 90d-rendement > 0, slot > EMA50', kiest: b => b.poort && b.ret90 !== null && b.ret90 > 0 && b.close > b.ema50 },
};

// Vaste willekeur per coin en dag, zodat twee runs hetzelfde geven.
const hash = (s: string) => { let h = 2166136261; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); return (h >>> 0) / 4294967296; };
export const RANGORDES: Record<string, (b: Bar) => number> = {
  score: b => b.score,
  ret90: b => b.ret90 ?? -Infinity,
  achterblijver: b => -(b.ret30 ?? Infinity),
  rustig: b => -b.natr,
  willekeur: b => hash(b.sym + b.datum),
};

interface Strategie {
  naam: string; instap: Instap; uitstap: Uitstap;
  rang?: keyof typeof RANGORDES; plekken?: number; grootte?: 'gelijk' | 'risico';
  kosten?: number; minStop?: number; crash?: boolean;
}

// --- per coin, als losse trades (zoals meting M en N) ------------------------------------------

function losseTrades(set: Coin[], s: Strategie, eind: string): Trade[] {
  const kosten = s.kosten ?? KOSTEN_ETORO, minStop = s.minStop ?? 0;
  const uit: Trade[] = [];
  for (const coin of set) {
    let bezetTot = -1;
    for (const b of coin.bars) {
      if (b.i <= bezetTot || !s.instap.kiest(b)) continue;
      const t = handel(coin, b, s.uitstap, kosten, minStop, eind, s.crash);
      if (!t || !t.af) continue;
      uit.push(t);
      bezetTot = t.uitIdx;
    }
  }
  return uit;
}

// --- portefeuille --------------------------------------------------------------------------

interface Curve { datums: string[]; vermogen: number[]; belegd: number[]; trades: Trade[] }

// Dag voor dag. Op de open: eerst wat op de open verkocht wordt, dan nieuwe posities uit de
// signalen van het slot ervoor. Op het slot: wat die dag op stop, doel of houdtijd uitging, en de
// rest tegen het slot gewaardeerd. Elke trade is vooraf uitgerekend; de portefeuille kiest alleen
// welke ze neemt.
function portefeuille(set: Coin[], s: Strategie, datums: string[]): Curve {
  const kosten = s.kosten ?? KOSTEN_ETORO, minStop = s.minStop ?? 0;
  const N = s.plekken ?? 10;
  const rang = RANGORDES[s.rang ?? 'score'];
  const eind = datums[datums.length - 1];
  const index = new Map(datums.map((d, k) => [d, k]));
  // Signalen per dag (het slot waarop ze vallen).
  const signalen = new Map<string, { coin: Coin; b: Bar }[]>();
  for (const coin of set) for (const b of coin.bars) {
    if (!index.has(b.datum) || !s.instap.kiest(b)) continue;
    (signalen.get(b.datum) ?? signalen.set(b.datum, []).get(b.datum)!).push({ coin, b });
  }
  for (const lijst of signalen.values()) lijst.sort((x, y) => rang(y.b) - rang(x.b) || (x.b.sym < y.b.sym ? -1 : 1));

  interface Positie { coin: Coin; t: Trade; stuks: number; laatste: number }
  const open = new Map<string, Positie>();
  // Zoals bij losse trades: een nieuw signaal telt pas als het na de uitstapdag valt.
  const vrijNa = new Map<string, number>();
  let kas = 1;
  const vermogen: number[] = [], belegd: number[] = [], genomen: Trade[] = [];
  const waarde = () => [...open.values()].reduce((x, p) => x + p.stuks * p.laatste, 0);
  const sluit = (p: Positie) => { kas += p.stuks * p.t.uitPrijs * (1 - kosten); open.delete(p.coin.sym); vrijNa.set(p.coin.sym, p.t.uitIdx); };

  for (let k = 0; k < datums.length; k++) {
    const d = datums[k];
    const vorigVermogen = k === 0 ? 1 : vermogen[k - 1];
    // Open: verkopen op de open.
    for (const p of [...open.values()]) if (p.coin.datum[p.t.uitIdx] === d && p.t.uitOpOpen) sluit(p);
    // Open: kopen op de signalen van gisteren.
    if (k > 0) for (const { coin, b } of signalen.get(datums[k - 1]) ?? []) {
      if (open.size >= N) break;
      if (open.has(coin.sym) || b.i <= (vrijNa.get(coin.sym) ?? -1) || coin.datum[b.i + 1] !== d) continue;
      const t = handel(coin, b, s.uitstap, kosten, minStop, eind, s.crash);
      if (!t) continue;
      let bedrag = vorigVermogen / N;
      if (s.grootte === 'risico') bedrag = Math.min(bedrag, (0.02 * vorigVermogen) / (t.risico / t.instap));
      bedrag = Math.min(bedrag, kas);
      if (bedrag < 1e-9) break;
      kas -= bedrag;
      const p: Positie = { coin, t, stuks: bedrag / (t.instap * (1 + kosten)), laatste: t.instap };
      open.set(coin.sym, p);
      genomen.push(t);
      // Kan op de instapdag zelf al uitgaan (stop of doel geraakt).
    }
    // Slot: uitgegaan op stop, doel of houdtijd; de rest waarderen.
    for (const p of [...open.values()]) {
      const j = p.coin.datum.indexOf(d, p.t.inIdx);
      if (j >= 0) p.laatste = p.coin.c[j].close;
      if (p.coin.datum[p.t.uitIdx] === d && !p.t.uitOpOpen) sluit(p);
      else if (p.t.uitIdx < p.coin.datum.length && p.coin.datum[p.t.uitIdx] < d) sluit(p);   // vangnet: coin had die dag geen candle
    }
    vermogen.push(kas + waarde());
    belegd.push(open.size);
  }
  return { datums, vermogen, belegd, trades: genomen };
}

// Eén munt aan of uit op een regel van het slot ervoor, handel op de open. Voor de ijklijnen.
function eenMunt(coin: Coin, aan: (d: string) => boolean, datums: string[], kosten = KOSTEN_ETORO): Curve {
  const per = new Map(coin.datum.map((d, j) => [d, coin.c[j]]));
  let kas = 1, stuks = 0, laatsteSlot = 0;
  const vermogen: number[] = [], belegd: number[] = [];
  let wissels = 0;
  for (let k = 0; k < datums.length; k++) {
    const c = per.get(datums[k]);
    if (!c) { vermogen.push(kas + stuks * laatsteSlot); belegd.push(stuks > 0 ? 1 : 0); continue; }
    laatsteSlot = c.close;
    const wil = k > 0 && aan(datums[k - 1]);
    if (wil && stuks === 0) { stuks = kas / (c.open * (1 + kosten)); kas = 0; wissels++; }
    else if (!wil && stuks > 0) { kas = stuks * c.open * (1 - kosten); stuks = 0; wissels++; }
    vermogen.push(kas + stuks * c.close);
    belegd.push(stuks > 0 ? 1 : 0);
  }
  return { datums, vermogen, belegd, trades: new Array(Math.ceil(wissels / 2)) };
}

// --- statistiek op een curve ----------------------------------------------------------------

interface Uitslag { cagr: number; dd: number; sharpe: number; inMarkt: number; perJaar: Record<string, number>; perMaand: Record<string, number>; tradesPerJaar: number; eind: number }

function uitslag(cv: Curve): Uitslag {
  const v = cv.vermogen, d = cv.datums;
  const dagen = (Date.parse(d[d.length - 1]) - Date.parse(d[0])) / DAG_MS;
  let piek = -Infinity, dd = 0;
  const rend: number[] = [];
  for (let k = 0; k < v.length; k++) {
    piek = Math.max(piek, v[k]); dd = Math.min(dd, v[k] / piek - 1);
    if (k > 0) rend.push(v[k] / v[k - 1] - 1);
  }
  const sd = Math.sqrt(gem(rend.map(x => (x - gem(rend)) ** 2)));
  const perJaar: Record<string, number> = {}, perMaand: Record<string, number> = {};
  const slotVan = (len: number) => { const m: Record<string, number> = {}; d.forEach((x, k) => { m[x.slice(0, len)] = v[k]; }); return m; };
  for (const [uit, len] of [[perJaar, 4], [perMaand, 7]] as [Record<string, number>, number][]) {
    const slot = slotVan(len); let vorig = v[0];
    for (const p of Object.keys(slot).sort()) { uit[p] = slot[p] / vorig - 1; vorig = slot[p]; }
  }
  return {
    cagr: Math.pow(v[v.length - 1] / v[0], 365 / dagen) - 1, dd, sharpe: sd > 0 ? (gem(rend) / sd) * Math.sqrt(365) : 0,
    inMarkt: cv.belegd.filter(x => x > 0).length / cv.belegd.length, perJaar, perMaand,
    tradesPerJaar: cv.trades.length / (dagen / 365), eind: v[v.length - 1],
  };
}

// 90%-interval van het gemiddelde maandverschil (a min b), bootstrap over kalendermaanden.
function maandVerschil(a: Uitslag, b: Uitslag): [number, number, number] {
  const maanden = Object.keys(a.perMaand).filter(m => m in b.perMaand);
  const verschil = maanden.map(m => a.perMaand[m] - b.perMaand[m]);
  let s = 12345 >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const g: number[] = [];
  for (let k = 0; k < 2000; k++) { let t = 0; for (let x = 0; x < verschil.length; x++) t += verschil[Math.floor(rnd() * verschil.length)]; g.push(t / verschil.length); }
  g.sort((x, y) => x - y);
  return [gem(verschil), g[100], g[1900]];
}

// --- uitvoer -------------------------------------------------------------------------------

const pct = (x: number, d = 0) => (isNaN(x) ? '.' : (x >= 0 ? '+' : '') + (x * 100).toFixed(d) + '%');

function kop(jaren: string[]) {
  console.log('  ' + 'strategie'.padEnd(40) + 'CAGR'.padStart(7) + 'maxDD'.padStart(7) + 'Sharpe'.padStart(7) + 'inMkt'.padStart(6) + 'tr/jr'.padStart(6) +
    '    n' + '  netto R' + '  90%-int R'.padEnd(17) + ' | ' + jaren.map(j => j.slice(2).padStart(6)).join(''));
}
function rij(naam: string, u: Uitslag, jaren: string[], losse?: Trade[]) {
  let r = '';
  if (losse) { const [lo, hi] = interval(losse); r = String(losse.length).padStart(5) + f(gem(losse.map(t => t.r))).padStart(9) + `  [${f(lo, 2)}, ${f(hi, 2)}]`.padEnd(17); }
  else r = ''.padEnd(5 + 9 + 17);
  console.log('  ' + naam.padEnd(40) + pct(u.cagr, 1).padStart(7) + pct(u.dd).padStart(7) + u.sharpe.toFixed(2).padStart(7) +
    pct(u.inMarkt).padStart(6) + u.tradesPerJaar.toFixed(0).padStart(6) + r + ' | ' + jaren.map(j => pct(u.perJaar[j] ?? NaN).padStart(6)).join(''));
}

// --- draaien -------------------------------------------------------------------------------

const onderdeel = (process.argv[1] ?? '').endsWith('meting-algoritme.ts') ? (process.argv[2] ?? 'ijk') : '';

if (onderdeel) {
  const holdout = onderdeel === 'toets';
  if (holdout && !existsSync(MAP_HOLDOUT)) { console.error('Geen holdout. Draai eerst node scripts/haal-holdout.mjs vanuit de repo-root.'); process.exit(1); }
  const set57 = laadSet(MAP_57, KLIMAAT_UNIVERSUM);
  const btc = set57.find(c => c.sym === 'BTC')!;
  // De periode: vanaf de eerste dag dat de poort te bepalen is, t/m de laatste BTC-dag.
  const datums = btc.datum.filter(poortBekend);
  const eind = datums[datums.length - 1];
  const jaren = [...new Set(datums.map(d => d.slice(0, 4)))];
  const set = holdout ? laadSet(MAP_HOLDOUT) : set57;
  console.log(`\nMETING O, ${onderdeel}. ${holdout ? 'HOLDOUT' : 'De 57 coins'}: ${set.length} coins, ${datums[0]} t/m ${eind}. 1% per kant, instap op de open na het signaal.\n`);

  const ijk = () => {
    const btcHouden = uitslag(eenMunt(btc, () => true, datums));
    rij('BTC houden', btcHouden, jaren);
    rij('BTC met de poort', uitslag(eenMunt(btc, poortOpen, datums)), jaren);
    rij('BTC boven EMA200', uitslag(eenMunt(btc, btcBoven200, datums)), jaren);
    return btcHouden;
  };
  const toon = (s: Strategie) => {
    const u = uitslag(portefeuille(set, s, datums));
    rij(s.naam, u, jaren, losseTrades(set, s, eind));
    return u;
  };
  const NU: Strategie = { naam: 'Nu: I0 + U0, 10 plekken', instap: INSTAPPEN.I0, uitstap: UITSTAPPEN.U0 };

  if (onderdeel === 'ijk') {
    // Eerst de controle: Nu als losse trades moet meting N4 ("met de huidige poort") reproduceren.
    const losse = losseTrades(set, NU, eind).filter(t => t.datum >= '2023-01-01');
    console.log(`  controle meting N4, huidige poort, 2023+: n=${losse.length}, netto ${f(gem(losse.map(t => t.r)))} (verwacht n=1780, +0.133)\n`);
    // Controle portefeuille: BTC houden moet de koersverhouding min 2% kosten teruggeven.
    const bh = eenMunt(btc, () => true, datums);
    const j0 = btc.datum.indexOf(datums[1]), j1 = btc.datum.indexOf(eind);
    const verwacht = (btc.c[j1].close / (btc.c[j0].open * (1 + KOSTEN_ETORO)));
    console.log(`  controle BTC houden: eindvermogen ${bh.vermogen[bh.vermogen.length - 1].toFixed(4)}, verwacht ${verwacht.toFixed(4)}\n`);
    kop(jaren);
    ijk();
    toon(NU);
    toon({ ...NU, naam: 'Nu, zonder kosten', kosten: 0 });
    for (const n of [3, 5, 20]) toon({ ...NU, naam: `Nu, ${n} plekken`, plekken: n });
  }

  if (onderdeel === 'uitstap') {
    kop(jaren); ijk();
    for (const u of Object.values(UITSTAPPEN)) toon({ naam: u.naam, instap: INSTAPPEN.I0, uitstap: u });
  }

  // Ronde 1 koos U4 (hoogste CAGR met een terugval kleiner dan BTC houden), U3 als tweede.
  const BESTE_UIT = UITSTAPPEN.U4;
  if (onderdeel === 'instap') {
    kop(jaren); ijk();
    toon(NU);
    for (const i of Object.values(INSTAPPEN)) toon({ naam: `${i.naam} + U4`, instap: i, uitstap: BESTE_UIT });
  }

  // Ronde 2: I0 en I1 binnen 1 procentpunt, zelfde Sharpe, dus de eenvoudigste: I1.
  const BESTE_IN = INSTAPPEN.I1;
  if (onderdeel === 'selectie') {
    kop(jaren); ijk();
    for (const n of [3, 5, 10]) {
      for (const r of Object.keys(RANGORDES) as (keyof typeof RANGORDES)[]) toon({ naam: `I1 + U4, ${n} plekken, rang ${r}`, instap: BESTE_IN, uitstap: BESTE_UIT, plekken: n, rang: r });
      if (n < 10) toon({ naam: `I1 + U4, ${n} plekken, score, gelijk risico`, instap: BESTE_IN, uitstap: BESTE_UIT, plekken: n, grootte: 'risico' });
      console.log('');
    }
  }

  // Ronde 3: 5 plekken en 3 plekken op rang "rustig" binnen 1 procentpunt; 5 plekken heeft de
  // hogere Sharpe. De combinatie is dus I1 + U4, 5 plekken, laagste volatiliteit eerst.
  // De vier regels voor de holdout (paragraaf 6 van het plan), vooraf vastgelegd:
  const REGELS: Strategie[] = [
    NU,
    { naam: 'A: Nu-instap + U4 (beste uitstap)', instap: INSTAPPEN.I0, uitstap: BESTE_UIT },
    { naam: 'B: I1 + U4 (beste instap)', instap: BESTE_IN, uitstap: BESTE_UIT },
    { naam: 'C: I1 + U4, 5 plekken, rustig eerst', instap: BESTE_IN, uitstap: BESTE_UIT, plekken: 5, rang: 'rustig' },
  ];
  // Alleen ter informatie, geen eis: het jaarrendement zonder 2021, het jaar dat alles optilt.
  const zonder2021 = (u: Uitslag) => {
    const js = Object.keys(u.perJaar).filter(j => j !== '2021');
    const groei = js.reduce((x, j) => x * (1 + u.perJaar[j]), 1);
    const dagen = (Date.parse(eind) - Date.parse(datums[0])) / DAG_MS - 365;
    return Math.pow(groei, 365 / dagen) - 1;
  };

  if (onderdeel === 'combinatie' || onderdeel === 'toets') {
    kop(jaren);
    const btcHouden = ijk();
    const uit = REGELS.map(s => {
      const cv = portefeuille(set, s, datums);
      const u = uitslag(cv);
      // Plan 6a: de trades die de portefeuille werkelijk nam.
      const losse = cv.trades.filter(t => t.af);
      rij(s.naam, u, jaren, losse);
      return { s, u, losse };
    });
    // Gevoeligheid op de gekozen regel (plan 6 en 6a), geen eisen.
    {
      const c = REGELS[3];
      for (const [naam, v] of [['C, 1,5% per kant', { kosten: 0.015 }], ['C, stop minimaal 10%', { minStop: MIN_STOP_BTC }], ['C, crashcandles vullen slechter', { crash: true }], ['Nu, crashcandles vullen slechter', { crash: true }]] as [string, Partial<Strategie>][]) {
        const basis = naam.startsWith('Nu') ? NU : c;
        const cv = portefeuille(set, { ...basis, ...v }, datums);
        rij(naam, uitslag(cv), jaren, cv.trades.filter(t => t.af));
      }
    }
    console.log('\n  Jaarrendement zonder 2021 (informatie): ' + [['BTC houden', btcHouden], ...uit.map(x => [x.s.naam.split(':')[0], x.u])].map(([n, u]) => `${n} ${pct(zonder2021(u as Uitslag), 1)}`).join(', '));
    console.log('  Mediane netto R per trade: ' + uit.map(x => `${x.s.naam.split(':')[0]} ${f([...x.losse.map(t => t.r)].sort((a, b) => a - b)[Math.floor(x.losse.length / 2)], 2)}`).join(', '));

    // Beschrijvend, geen eis: welke coins dragen C? Winst per coin in procent van de inleg.
    {
      const c = uit[3];
      const per = new Map<string, { n: number; som: number }>();
      for (const t of c.losse) { const x = per.get(t.sym) ?? { n: 0, som: 0 }; x.n++; x.som += t.uitPrijs / t.instap - 1; per.set(t.sym, x); }
      const lijst = [...per.entries()].sort((x, y) => y[1].som - x[1].som);
      console.log(`  C handelde ${per.size} coins. Grootste bijdragen: ` + lijst.slice(0, 8).map(([k, x]) => `${k} ${x.n}x ${pct(x.som)}`).join(', '));
      console.log('  Meest verhandeld: ' + [...per.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, 8).map(([k, x]) => `${k} ${x.n}x`).join(', '));
      const zonderBeste = c.losse.filter(t => t.sym !== lijst[0][0]);
      console.log(`  Netto R per trade zonder ${lijst[0][0]}: ${f(gem(zonderBeste.map(t => t.r)))}, interval [${interval(zonderBeste).map(x => f(x, 2)).join(', ')}]`);
    }

    // De lat uit paragraaf 6, voor elke regel tegen Nu.
    const nu = uit[0];
    for (const x of uit.slice(1)) {
      const [vg, lo, hi] = maandVerschil(x.u, nu.u);
      const js = jaren.filter(j => j in x.u.perJaar && j in nu.u.perJaar && j !== jaren[0]);
      const beter = js.filter(j => x.u.perJaar[j] > nu.u.perJaar[j]).length;
      const [rlo] = interval(x.losse);
      const eisen: [string, boolean][] = [
        [`minstens 150 trades (${x.losse.length})`, x.losse.length >= 150],
        [`CAGR hoger dan Nu (${pct(x.u.cagr, 1)} tegen ${pct(nu.u.cagr, 1)})`, x.u.cagr > nu.u.cagr],
        [`maandverschil met Nu ${pct(vg, 2)}, 90%-interval [${pct(lo, 2)}, ${pct(hi, 2)}] boven nul`, lo > 0],
        [`beter dan Nu in ${beter} van ${js.length} jaren (meerderheid nodig)`, beter > js.length / 2],
        [`max drawdown ${pct(x.u.dd)} niet slechter dan BTC houden (${pct(btcHouden.dd)})`, x.u.dd >= btcHouden.dd],
      ];
      console.log(`\n  ${x.s.naam}: ${eisen.every(e => e[1]) ? 'BETER DAN NU' : 'niet aantoonbaar beter dan Nu'}`);
      for (const [t, ok] of eisen) console.log(`      ${ok ? 'ja ' : 'NEE'}  ${t}`);
      console.log(`      (los: netto R per trade ${f(gem(x.losse.map(t => t.r)))}, ondergrens 90%-interval ${f(rlo, 2)}${rlo > 0 ? ', aantoonbaar boven nul' : ''})`);
    }
  }
}

// Zelftoets van de meelopende stop op een gemaakte reeks met bekende uitkomst.
{
  const mk = (o: number, h: number, l: number, cl: number, k: number): Candle => ({ open: o, high: h, low: l, close: cl, volume: 1, tijd: Date.UTC(2020, 0, 1 + k) });
  const c = [mk(100, 100, 100, 100, 0), mk(100, 101, 99, 100, 1), mk(100, 111, 99, 110, 2), mk(110, 121, 109, 120, 3), mk(120, 121, 112, 113, 4), mk(113, 114, 100, 101, 5)];
  const coin: Coin = { sym: 'T', c, datum: c.map(x => datumVan(x.tijd)), atr: c.map(() => 2), ema50: c.map(() => 0), low20: c.map(() => 0), bars: [], barOp: new Map(), laatsteDatum: '2099-01-01' };
  const b = { sym: 'T', i: 0, datum: coin.datum[0], close: 100, instap: 100, atr: 2 } as Bar;
  // Beginstop 94. Slot dag 3 is 120, dus vanaf dag 4 stop 120 - 6 = 114. Dag 4 low 112: uit op 114.
  const t = handel(coin, b, UITSTAPPEN.U2, 0, 0, '2099-01-01');
  console.assert(t !== null && t.uitIdx === 4 && Math.abs(t.uitPrijs - 114) < 1e-9 && !t.uitOpOpen, 'meelopende stop klopt niet', t);
  // Met doel 3R (= 118) gaat dezelfde trade op dag 3 uit op het doel.
  const t2 = handel(coin, b, UITSTAPPEN.U0, 0, 0, '2099-01-01');
  console.assert(t2 !== null && t2.uitIdx === 3 && Math.abs(t2.uitPrijs - 118) < 1e-9, 'vast doel klopt niet', t2);
}
