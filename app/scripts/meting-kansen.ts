// Meetharness voor de Kansen-tab. Staat bewust los van backtest.ts: die meet Markt en blijft
// ongemoeid. Dit script meet wat Kansen straks werkelijk doet, met de dingen die backtest.ts
// niet heeft:
//
//   - Kosten. eToro rekent 1% bij kopen en 1% bij verkopen van crypto.
//   - eToro's minimale stopafstand. Alleen voor BTC gemeten (10%, zie
//     docs/etoro-direct-handelen-plan.md); daarom elk scenario zonder grens en met 10%.
//   - Instap op de open van de dag NA het signaal. Het oordeel valt op een afgesloten dag, kopen
//     kan pas daarna. backtest.ts stapt in op het slot van de signaaldag zelf.
//   - Afstellen en toetsen gescheiden: t/m 2022 afstellen, 2023 en later toetsen.
//   - Excess R tegen dezelfde niveaus op een willekeurige coin op dezelfde dag.
//   - Betrouwbaarheidsinterval via bootstrap per kalendermaand van instap.
//
// De beslisregels staan in docs/kansen-analyse-plan.md, paragraaf 5, en lagen vast voordat dit
// script voor het eerst draaide.
//
// Gebruik (vanuit app/):
//   node ../scripts/haal-historie.mjs 9      (eenmalig, vanuit de repo-root)
//   npx tsx scripts/meting-kansen.ts [onderdeel]

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoorCandles, STANDAARD_UNIVERSUM, MIN_CANDLES, MIN_RISK_REWARD } from '../src/engine/analyzer';
import { ema } from '../src/engine/indicators';
import { DREMPEL_KOOP } from '../src/engine/drempels';
import { momentumIngredienten, momentumScore, radarNiveaus as appNiveaus, RADAR_DREMPEL, RADAR_STOP_ATR, RADAR_DOEL_R, RADAR_HOUDTIJD_DAGEN, ETORO_KOSTEN_PER_KANT } from '../src/engine/momentum';
import { Candle } from '../src/engine/types';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATA = join(HIER, '..', '..', 'data', 'historie');

// Zelfde venster als de app (limit=200 in marketData.ts).
const VENSTER = 200;
export const KOSTEN_ETORO = ETORO_KOSTEN_PER_KANT;   // per kant, hetzelfde getal als in de app
export const MIN_STOP_BTC = 0.10;      // eToro's gemeten ondergrens voor BTC
export const TOETS_VANAF = '2023-01-01';
// Een afsteltrade loopt hoogstens 30 dagen. Signalen in de laatste maand voor de toets zouden hun
// uitkomst deels in de toetsjaren halen, dus die tellen bij geen van beide.
export const AFSTEL_TOT = '2022-12-01';
const DAGEN_HIGH = 90;

// --- data --------------------------------------------------------------------------------

const beschikbaar = new Set(
  readdirSync(DATA).filter(f => f.endsWith('.json') && !f.startsWith('_')).map(f => f.replace('.json', '')),
);
export const coins = STANDAARD_UNIVERSUM.filter(s => beschikbaar.has(s));
if (coins.length === 0) {
  console.error('Geen data. Draai eerst `node scripts/haal-historie.mjs 9` vanuit de repo-root.');
  process.exit(1);
}
const reeksen: Record<string, Candle[]> = {};
for (const s of coins) reeksen[s] = JSON.parse(readFileSync(join(DATA, `${s}.json`), 'utf8'));

const datumVan = (tijd: number | undefined) => {
  if (tijd === undefined) throw new Error('Candle zonder tijd');
  return new Date(tijd).toISOString().slice(0, 10);
};

// --- markt per dag (zelfde berekening als backtest.ts, meting D) ---------------------------

const btc = reeksen['BTC'];
const btcClose: Record<string, number> = {};
const btcBovenEma50: Record<string, boolean> = {};
{
  const e50 = ema(btc.map(c => c.close), 50);
  btc.forEach((c, i) => {
    btcClose[datumVan(c.tijd)] = c.close;
    if (i >= 50) btcBovenEma50[datumVan(c.tijd)] = c.close > e50[i];
  });
}
const breedteStijgt: Record<string, boolean> = {};
{
  const tel: Record<string, { boven: number; totaal: number }> = {};
  for (const s of coins) {
    const c = reeksen[s];
    const e50 = ema(c.map(x => x.close), 50);
    for (let i = 50; i < c.length; i++) {
      const d = datumVan(c[i].tijd);
      tel[d] ??= { boven: 0, totaal: 0 };
      tel[d].totaal++;
      if (c[i].close > e50[i]) tel[d].boven++;
    }
  }
  const breedte: Record<string, number> = {};
  for (const [d, t] of Object.entries(tel)) if (t.totaal >= 20) breedte[d] = t.boven / t.totaal;
  const dagen = Object.keys(breedte).sort();
  for (let i = 20; i < dagen.length; i++) breedteStijgt[dagen[i]] = breedte[dagen[i]] > breedte[dagen[i - 20]];
}
// Exact de poort van bepaalKlimaat(): BTC boven zijn EMA50 en de breedte hoger dan 20 dagen terug.
export const poortOpen = (datum: string) => btcBovenEma50[datum] === true && breedteStijgt[datum] === true;

// --- kenmerken per bar -------------------------------------------------------------------
//
// Alles wat een regel mag weten op het slot van bar i. Causaal: alleen candles[0..i].

export interface Bar {
  sym: string;
  i: number;
  datum: string;
  close: number;
  // Open van de dag erna: de eerste koers waartegen je na het signaal kunt kopen.
  instap: number;
  atr: number;
  ema20: number;
  ema50: number;
  radar: number;                 // momentumScore() van de app, op dit venster
  score: number;                 // de technische score van Markt
  rrMarkt: number;               // R/R van Markts eigen niveaus
  stopMarkt: number;
  volumeRatio: number;
  top90: number;                 // hoogste high van de laatste 90 dagen, deze dag inbegrepen
  top90Voor: number;             // idem, van de 90 dagen ervoor (zonder deze dag)
  low20: number;
  rs30: number | null;           // 30-dagenrendement min dat van BTC, in procentpunten
  // ATR als deel van de koers, gedeeld door de mediaan daarvan over de 60 dagen ervoor.
  // Onder 1 = de schommelingen zijn kleiner dan gebruikelijk.
  atrKrimp: number | null;
  poort: boolean;
}

const mediaan = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

function bouwBars(sym: string): Bar[] {
  const c = reeksen[sym];
  const uit: Bar[] = [];
  const natr: number[] = [];       // per bar in `uit`
  for (let i = Math.max(MIN_CANDLES - 1, DAGEN_HIGH); i < c.length - 1; i++) {
    const venster = c.slice(Math.max(0, i - VENSTER + 1), i + 1);
    const t = scoorCandles(sym, venster, 'Binance', { minRR: 0 });
    if (!t || !(t.atr > 0)) continue;
    let top90 = -Infinity, top90Voor = -Infinity, low20 = Infinity;
    for (let j = i - DAGEN_HIGH + 1; j <= i; j++) top90 = Math.max(top90, c[j].high);
    for (let j = i - DAGEN_HIGH; j <= i - 1; j++) top90Voor = Math.max(top90Voor, c[j].high);
    for (let j = i - 19; j <= i; j++) low20 = Math.min(low20, c[j].low);
    const datum = datumVan(c[i].tijd);
    let rs30: number | null = null;
    if (i >= 30) {
      const bNu = btcClose[datum], bToen = btcClose[datumVan(c[i - 30].tijd)];
      if (bNu && bToen && c[i - 30].close > 0) rs30 = ((c[i].close / c[i - 30].close - 1) - (bNu / bToen - 1)) * 100;
    }
    const n = t.atr / c[i].close;
    const vorige = natr.slice(-60);
    natr.push(n);
    uit.push({
      sym, i, datum, close: c[i].close, instap: c[i + 1].open,
      atr: t.atr, ema20: t.ema20, ema50: t.ema50,
      radar: momentumScore(momentumIngredienten(venster)),
      score: t.score, rrMarkt: t.rr, stopMarkt: t.stopLoss,
      volumeRatio: t.volumeRatio,
      top90, top90Voor, low20, rs30,
      atrKrimp: vorige.length >= 40 ? n / mediaan(vorige) : null,
      poort: poortOpen(datum),
    });
  }
  return uit;
}

console.error(`Kenmerken berekenen voor ${coins.length} coins...`);
export const barsPer: Record<string, Bar[]> = {};
for (const s of coins) barsPer[s] = bouwBars(s);
export const alleBars: Bar[] = coins.flatMap(s => barsPer[s]);

// --- simulatie ---------------------------------------------------------------------------

export interface Niveaus { stop: number; doel: number }

// De stop zoals eToro hem toelaat: minimaal `minStop` onder de instap. Het doel blijft staan.
function metEtoroStop(instap: number, nv: Niveaus, minStop: number): Niveaus {
  return { stop: Math.min(nv.stop, instap * (1 - minStop)), doel: nv.doel };
}

// Eén trade vanaf de open van bar i+1. Zelfde uitstapregels als simuleer() in backtest.ts:
// een gap rekent met de open, en raakt een candle stop en doel allebei, dan telt de stop.
// Het resultaat is netto: `kosten` over het aankoopbedrag en over het verkoopbedrag.
function simuleer(c: Candle[], i: number, instap: number, nv: Niveaus, maxBars: number, kosten: number)
  : { r: number; bruto: number; bars: number } | null {
  const risico = instap - nv.stop;
  if (!(risico > 0) || !(nv.doel > instap)) return null;
  const eind = Math.min(i + maxBars, c.length - 1);
  if (eind <= i) return null;
  // Loopt de data af voordat de houdtijd om is, dan is de trade alleen af als stop of doel geraakt
  // is. Anders zou een trade van vorige week als afgerond meetellen op de koers van vandaag.
  const volledig = i + maxBars <= c.length - 1;
  const sluit = (prijs: number, j: number) => ({
    bruto: (prijs - instap) / risico,
    r: (prijs - instap - kosten * (instap + prijs)) / risico,
    bars: j - i,
  });
  for (let j = i + 1; j <= eind; j++) {
    const k = c[j];
    // Op de instapdag zelf is de open onze eigen instap, geen gap.
    if (j > i + 1) {
      if (k.open <= nv.stop) return sluit(k.open, j);
      if (k.open >= nv.doel) return sluit(k.open, j);
    }
    if (k.low <= nv.stop) return sluit(nv.stop, j);
    if (k.high >= nv.doel) return sluit(nv.doel, j);
  }
  return volledig ? sluit(c[eind].close, eind) : null;
}

export interface Regel {
  naam: string;
  kiest: (b: Bar) => boolean;
  // Stop en doel bij een gegeven instapkoers, of null als er geen plan te maken valt.
  niveaus: (b: Bar, instap: number) => Niveaus | null;
  // Minimale R/R op de niveaus zoals eToro ze toelaat. 0 = geen eis.
  rrMin?: number;
  maxBars?: number;
}

export interface TradeUit { r: number; bruto: number; datum: string; sym: string; stopPct: number; excess: number | null }
export interface Opties { kosten?: number; minStop?: number }

// Gemiddelde netto R per dag van ELKE coin met dezelfde niveaus, ongeacht of de regel hem koos.
// Dat is de tegenstander voor excess R: kiest de regel beter dan blind dezelfde niveaus nemen?
const ijkCache = new Map<string, Record<string, number>>();
// Op de niveaus-functie zelf en niet op de naam: twee regels met dezelfde niveaus delen hun ijk,
// en twee regels die toevallig hetzelfde heten kunnen elkaars ijk nooit krijgen.
const fnId = new Map<Regel['niveaus'], number>();
function ijkPerDag(regel: Regel, o: Required<Opties>): Record<string, number> {
  if (!fnId.has(regel.niveaus)) fnId.set(regel.niveaus, fnId.size);
  const sleutel = `${fnId.get(regel.niveaus)}|${regel.maxBars ?? 30}|${o.kosten}|${o.minStop}`;
  const al = ijkCache.get(sleutel);
  if (al) return al;
  const som: Record<string, { s: number; n: number }> = {};
  for (const b of alleBars) {
    const ruw = regel.niveaus(b, b.instap);
    if (!ruw) continue;
    const u = simuleer(reeksen[b.sym], b.i, b.instap, metEtoroStop(b.instap, ruw, o.minStop), regel.maxBars ?? 30, o.kosten);
    if (!u) continue;
    (som[b.datum] ??= { s: 0, n: 0 }).s += u.r;
    som[b.datum].n++;
  }
  const uit: Record<string, number> = {};
  for (const [d, x] of Object.entries(som)) if (x.n >= 15) uit[d] = x.s / x.n;
  ijkCache.set(sleutel, uit);
  return uit;
}

// Draait een regel als echte strategie: per coin geen overlappende trades.
export function draai(regel: Regel, opties: Opties = {}): TradeUit[] {
  const o = { kosten: opties.kosten ?? KOSTEN_ETORO, minStop: opties.minStop ?? 0 };
  const ijk = ijkPerDag(regel, o);
  const uit: TradeUit[] = [];
  for (const sym of coins) {
    const c = reeksen[sym];
    let bezetTot = -1;
    for (const b of barsPer[sym]) {
      if (b.i <= bezetTot || !regel.kiest(b)) continue;
      const ruw = regel.niveaus(b, b.instap);
      if (!ruw) continue;
      const nv = metEtoroStop(b.instap, ruw, o.minStop);
      const risico = b.instap - nv.stop;
      if (!(risico > 0)) continue;
      if (regel.rrMin && (nv.doel - b.instap) / risico < regel.rrMin - 1e-9) continue;
      const u = simuleer(c, b.i, b.instap, nv, regel.maxBars ?? 30, o.kosten);
      if (!u) continue;
      uit.push({
        r: u.r, bruto: u.bruto, datum: b.datum, sym, stopPct: (risico / b.instap) * 100,
        excess: ijk[b.datum] !== undefined ? u.r - ijk[b.datum] : null,
      });
      bezetTot = b.i + u.bars;
    }
  }
  return uit;
}

// --- statistiek --------------------------------------------------------------------------

export const gem = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const jaarVan = (d: string) => d.slice(0, 4);
export const jaren = [...new Set(alleBars.map(b => jaarVan(b.datum)))].sort();
const toetsJaren = jaren.filter(j => `${j}-12-31` >= TOETS_VANAF);

// Vaste reeks, zodat twee runs hetzelfde interval geven.
function lcg(zaad: number) {
  let s = zaad >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// 90%-interval van het gemiddelde, door hele instapmaanden opnieuw te trekken. Coins bewegen
// samen en een trade loopt weken, dus trades binnen een maand zijn geen losse waarnemingen.
export function interval(trades: { r: number; datum: string }[], waarde: (t: any) => number = t => t.r): [number, number] {
  const blokken: Record<string, number[]> = {};
  for (const t of trades) (blokken[t.datum.slice(0, 7)] ??= []).push(waarde(t));
  const lijst = Object.values(blokken);
  if (lijst.length < 6) return [NaN, NaN];
  const rnd = lcg(12345);
  const gemiddelden: number[] = [];
  for (let k = 0; k < 2000; k++) {
    let s = 0, n = 0;
    for (let b = 0; b < lijst.length; b++) {
      const blok = lijst[Math.floor(rnd() * lijst.length)];
      for (const x of blok) { s += x; n++; }
    }
    if (n > 0) gemiddelden.push(s / n);
  }
  gemiddelden.sort((a, b) => a - b);
  return [gemiddelden[Math.floor(0.05 * gemiddelden.length)], gemiddelden[Math.floor(0.95 * gemiddelden.length)]];
}

const f = (x: number, d = 3) => (isNaN(x) ? '.' : (x >= 0 ? '+' : '') + x.toFixed(d));

export function kop() {
  console.log(
    '  ' + 'regel'.padEnd(44) + 'n'.padStart(6) + 'bruto'.padStart(8) + 'netto'.padStart(8) +
    ' |' + 'afstel'.padStart(8) + ' |' + 'n'.padStart(5) + 'toets'.padStart(8) + 'excess'.padStart(8) + '  90%-interval excess' +
    ' | ' + jaren.map(j => j.slice(2).padStart(6)).join(''),
  );
}

export interface Samenvatting {
  n: number; netto: number; afstel: number; nToets: number; toets: number; excessToets: number;
  ondergrens: number; jarenWinst: number; jarenGeteld: number; toetsJarenWinst: number; toetsJarenGeteld: number;
}

export function vat(trades: TradeUit[]): Samenvatting {
  const afstel = trades.filter(t => t.datum < AFSTEL_TOT);
  const toets = trades.filter(t => t.datum >= TOETS_VANAF);
  const ex = (set: TradeUit[]) => set.filter(t => t.excess !== null).map(t => t.excess as number);
  const perJaar = (j: string) => ex(trades.filter(t => jaarVan(t.datum) === j));
  const meetbaar = jaren.filter(j => perJaar(j).length >= 10);
  const toetsMeetbaar = toetsJaren.filter(j => perJaar(j).length >= 10);
  return {
    n: trades.length, netto: gem(trades.map(t => t.r)), afstel: gem(afstel.map(t => t.r)),
    nToets: toets.length, toets: gem(toets.map(t => t.r)), excessToets: gem(ex(toets)),
    ondergrens: interval(toets.filter(t => t.excess !== null), t => t.excess)[0],
    jarenWinst: meetbaar.filter(j => gem(perJaar(j)) > 0).length, jarenGeteld: meetbaar.length,
    toetsJarenWinst: toetsMeetbaar.filter(j => gem(perJaar(j)) > 0).length,
    toetsJarenGeteld: toetsMeetbaar.length,
  };
}

export function regel(naam: string, trades: TradeUit[]) {
  const s = vat(trades);
  const toets = trades.filter(t => t.datum >= TOETS_VANAF && t.excess !== null);
  const [lo, hi] = interval(toets, t => t.excess);
  const perJaar = jaren.map(j => {
    const rs = trades.filter(t => jaarVan(t.datum) === j).map(t => t.r);
    return (rs.length >= 10 ? f(gem(rs), 2) : '.').padStart(6);
  }).join('');
  console.log(
    '  ' + naam.padEnd(44) + String(s.n).padStart(6) + f(gem(trades.map(t => t.bruto))).padStart(8) + f(s.netto).padStart(8) +
    ' |' + f(s.afstel).padStart(8) + ' |' + String(s.nToets).padStart(5) + f(s.toets).padStart(8) + f(s.excessToets).padStart(8) +
    `  [${f(lo, 2)}, ${f(hi, 2)}]`.padEnd(21) + ' | ' + perJaar,
  );
}

// De lat uit paragraaf 5 van het plan. Alle eisen moeten kloppen.
export function oordeel(trades: TradeUit[], markt: TradeUit[]): string {
  const s = vat(trades);
  const m = vat(markt);
  const eisen: [string, boolean][] = [
    [`minstens 150 trades in de toetsjaren (${s.nToets})`, s.nToets >= 150],
    [`netto excess R boven nul, ondergrens interval ${f(s.ondergrens, 2)}`, s.ondergrens > 0],
    [`wint van Markt KOOP met poort (${f(s.toets)} tegen ${f(m.toets)})`, s.toets > m.toets],
    // Regel 4 uit het plan: minstens 3 van de 4 toetsjaren, en de meerderheid van alle jaren.
    [`excess positief in ${s.toetsJarenWinst} van ${s.toetsJarenGeteld} toetsjaren (minstens 3 nodig)`, s.toetsJarenWinst >= 3],
    [`excess positief in ${s.jarenWinst} van ${s.jarenGeteld} jaren in totaal (meerderheid nodig)`, s.jarenWinst > s.jarenGeteld / 2],
  ];
  const gehaald = eisen.every(e => e[1]);
  return (gehaald ? 'HAALT DE LAT' : 'haalt de lat niet') + '\n' + eisen.map(([t, ok]) => `      ${ok ? 'ja ' : 'NEE'}  ${t}`).join('\n');
}

// --- de regels die er al zijn ------------------------------------------------------------

// De score van de app zelf (momentumScore uit momentum.ts), niet een kopie ervan.
const radarScore = (b: Bar) => b.radar;

// Het plan dat Kansen t/m november 2026 had: stop op de EMA20 (0,5x tot 3x ATR), doel 2x ATR boven
// de 90d-top. Staat alleen nog hier, als de regel waar de nieuwe tegen gemeten is.
const oudeRadarNiveaus = (b: Bar, instap: number): Niveaus | null => {
  if (!(instap > b.ema20)) return null;
  const risico = Math.min(Math.max(instap - b.ema20, 0.5 * b.atr), 3 * b.atr);
  return { stop: instap - risico, doel: Math.max(b.top90, instap) + 2 * b.atr };
};
const marktNiveaus = (b: Bar, instap: number): Niveaus => ({
  stop: instap - (b.close - b.stopMarkt), doel: instap + 3 * b.atr,
});

export const KANSEN_NU: Regel = {
  naam: 'Kansen oud (radar + score 55 + R/R 2)',
  kiest: b => radarScore(b) >= RADAR_DREMPEL && b.score >= DREMPEL_KOOP,
  niveaus: oudeRadarNiveaus, rrMin: MIN_RISK_REWARD,
};
export const MARKT_KOOP: Regel = {
  naam: 'Markt KOOP + R/R',
  kiest: b => b.score >= DREMPEL_KOOP && b.rrMarkt >= MIN_RISK_REWARD - 1e-9,
  niveaus: marktNiveaus,
};
export const MARKT_KOOP_POORT: Regel = { ...MARKT_KOOP, naam: 'Markt KOOP + R/R, poort open', kiest: b => MARKT_KOOP.kiest(b) && b.poort };
const WILLEKEURIG: Regel = { naam: 'elke bar, Markt-niveaus', kiest: () => true, niveaus: marktNiveaus };

// --- uitvoer -----------------------------------------------------------------------------

const onderdeel = process.argv[2] ?? 'basis';

if (onderdeel === 'basis') {
  console.log(`Kansen-meting over ${coins.length} coins, ${alleBars.length} bars, ${jaren[0]} t/m ${jaren[jaren.length - 1]}.`);
  console.log(`Afstellen t/m 2022, toetsen vanaf ${TOETS_VANAF}. Instap op de open na het signaal.\n`);

  for (const [titel, o] of [
    ['ZONDER KOSTEN (wat backtest.ts meet)', { kosten: 0, minStop: 0 }],
    ['eToro: 1% per kant', { kosten: KOSTEN_ETORO, minStop: 0 }],
    ['eToro: 1% per kant, stop minimaal 10%', { kosten: KOSTEN_ETORO, minStop: MIN_STOP_BTC }],
  ] as [string, Opties][]) {
    console.log(titel);
    kop();
    regel(WILLEKEURIG.naam, draai(WILLEKEURIG, o));
    regel(MARKT_KOOP.naam, draai(MARKT_KOOP, o));
    regel(MARKT_KOOP_POORT.naam, draai(MARKT_KOOP_POORT, o));
    regel(KANSEN_NU.naam, draai(KANSEN_NU, o));
    regel('Kansen oud, poort open', draai({ ...KANSEN_NU, kiest: b => KANSEN_NU.kiest(b) && b.poort }, o));
    console.log('');
  }
}

// --- afstellen: alleen t/m 2022 ----------------------------------------------------------
//
// Alles hieronder toont uitsluitend de afsteljaren. De toetsjaren komen pas in beeld bij het
// onderdeel 'toets', één keer, met de regels die hier gekozen zijn.

const afstelJaren = jaren.filter(j => `${j}-01-01` < AFSTEL_TOT);

function afstelKop() {
  console.log(
    '  ' + 'regel'.padEnd(46) + 'n'.padStart(6) + 'stop%'.padStart(7) + 'bruto'.padStart(8) + 'netto'.padStart(8) +
    'excess'.padStart(8) + '  90%-interval excess' + ' | ' + afstelJaren.map(j => j.slice(2).padStart(6)).join('') + '  jaren+',
  );
}
function afstelRegel(naam: string, alle: TradeUit[]) {
  const t = alle.filter(x => x.datum < AFSTEL_TOT);
  const metEx = t.filter(x => x.excess !== null);
  const [lo, hi] = interval(metEx, x => x.excess);
  let plus = 0, geteld = 0;
  const perJaar = afstelJaren.map(j => {
    const set = t.filter(x => jaarVan(x.datum) === j);
    const ex = set.filter(x => x.excess !== null).map(x => x.excess as number);
    if (ex.length >= 10) { geteld++; if (gem(ex) > 0) plus++; }
    return (set.length >= 10 ? f(gem(set.map(x => x.r)), 2) : '.').padStart(6);
  }).join('');
  console.log(
    '  ' + naam.padEnd(46) + String(t.length).padStart(6) + (t.length ? mediaan(t.map(x => x.stopPct)).toFixed(1) : '.').padStart(7) +
    f(gem(t.map(x => x.bruto))).padStart(8) + f(gem(t.map(x => x.r))).padStart(8) + f(gem(metEx.map(x => x.excess as number))).padStart(8) +
    `  [${f(lo, 2)}, ${f(hi, 2)}]`.padEnd(21) + ' | ' + perJaar + `  ${plus}/${geteld}`,
  );
}

// Niveaus als bouwstenen. De stop is een veelvoud van de ATR of een structuurniveau, het doel een
// veelvoud van het eigen risico. Zo is de R/R per constructie vast en zegt een R/R-filter niets
// meer: de keuze zit in de regel, niet in een toevallig krappe stop.
const atrStop = (k: number, m: number) => (b: Bar, instap: number): Niveaus => ({ stop: instap - k * b.atr, doel: instap + m * k * b.atr });
const structuurStop = (m: number) => (b: Bar, instap: number): Niveaus | null => {
  const stop = Math.min(b.low20, b.ema50) - 0.1 * b.atr;
  const risico = instap - stop;
  return risico > 0 ? { stop, doel: instap + m * risico } : null;
};

if (onderdeel === 'niveaus') {
  // Stap 1: welke opzet van stop, doel en houdtijd draagt de kosten het best? Gemeten op een
  // brede, neutrale selectie (trend op, poort open), zodat de keuze niet op één soort kans past.
  const trend = (b: Bar) => b.ema20 > b.ema50 && b.close > b.ema20 && b.poort;
  for (const minStop of [0, MIN_STOP_BTC]) {
    console.log(`\nNIVEAUS, trend op en poort open, 1% per kant, stop minimaal ${minStop * 100}% (alleen t/m 2022)`);
    afstelKop();
    for (const maxBars of [30, 60, 90]) {
      for (const [naam, nv] of [
        ['stop 1,5x ATR, doel 2R', atrStop(1.5, 2)], ['stop 1,5x ATR, doel 3R', atrStop(1.5, 3)],
        ['stop 2x ATR, doel 2R', atrStop(2, 2)], ['stop 2x ATR, doel 3R', atrStop(2, 3)],
        ['stop 3x ATR, doel 2R', atrStop(3, 2)], ['stop 3x ATR, doel 3R', atrStop(3, 3)],
        ['stop onder low20/EMA50, doel 2R', structuurStop(2)], ['stop onder low20/EMA50, doel 3R', structuurStop(3)],
      ] as [string, Regel['niveaus']][]) {
        afstelRegel(`${naam}, ${maxBars}d`, draai({ naam, kiest: trend, niveaus: nv, maxBars }, { minStop }));
      }
      console.log('');
    }
  }
}

// De opzet die stap 1 koos: stop 3x ATR, doel 3R, 30 dagen. Eén opzet voor alle soorten. Via
// radarNiveaus() van de app zelf, zodat dit script meet wat de kaart toont.
export const PLAN = (b: Bar, instap: number): Niveaus | null => {
  const nv = appNiveaus(instap, b.atr);
  return nv ? { stop: nv.stopLoss, doel: nv.takeProfit } : null;
};
// De app-functie moet hetzelfde geven als de bouwsteen waarmee stap 1 de opzet koos.
{
  const proef = alleBars[Math.floor(alleBars.length / 2)];
  const a = PLAN(proef, proef.instap), b = atrStop(RADAR_STOP_ATR, RADAR_DOEL_R)(proef, proef.instap);
  console.assert(a !== null && Math.abs(a.stop - b.stop) < 1e-9 && Math.abs(a.doel - b.doel) < 1e-9,
    'radarNiveaus() wijkt af van de gemeten opzet');
}

// De soorten als filters op een bar. Drempels zijn parameters, zodat het afstellen zichtbaar is.
const trendOp = (b: Bar) => b.ema20 > b.ema50;
const afstandAtr = (b: Bar) => (b.top90 - b.close) / b.atr;
export const soorten = {
  topPct: (score: number) => (b: Bar) => radarScore(b) >= score,
  topAtr: (maxAtr: number) => (b: Bar) => afstandAtr(b) <= maxAtr,
  terugval: (rs: number) => (b: Bar) => trendOp(b) && b.rs30 !== null && b.rs30 <= rs,
  uitbraak: (vol: number) => (b: Bar) => b.close > b.top90Voor && b.volumeRatio >= vol,
  opbouw: (krimp: number) => (b: Bar) => trendOp(b) && b.close > b.ema20 && b.atrKrimp !== null && b.atrKrimp <= krimp,
};

if (onderdeel === 'soorten') {
  const lijst: [string, (b: Bar) => boolean][] = [
    ['ijk: elke bar', () => true],
    ['ijk: trend op (EMA20 > EMA50)', trendOp],
    ['ijk: Markt score >= 55', b => b.score >= DREMPEL_KOOP],
    ['top: binnen 9% (radar nu)', soorten.topPct(70)],
    ['top: binnen 1x ATR', soorten.topAtr(1)],
    ['top: binnen 2x ATR', soorten.topAtr(2)],
    ['top: binnen 3x ATR', soorten.topAtr(3)],
    ['terugval: trend op, 10pp achter op BTC', soorten.terugval(-10)],
    ['terugval: trend op, 20pp achter op BTC', soorten.terugval(-20)],
    ['terugval 10pp + score >= 55', b => soorten.terugval(-10)(b) && b.score >= DREMPEL_KOOP],
    ['uitbraak: nieuwe top, volume 1,5x', soorten.uitbraak(1.5)],
    ['uitbraak: nieuwe top, volume 2x', soorten.uitbraak(2)],
    ['uitbraak: nieuwe top, elk volume', soorten.uitbraak(0)],
    ['opbouw: trend op, ATR-krimp 0,8', soorten.opbouw(0.8)],
    ['opbouw: trend op, ATR-krimp 0,7', soorten.opbouw(0.7)],
  ];
  for (const metPoort of [true, false]) {
    console.log(`\nSOORTEN, stop 3x ATR, doel 3R, 30 dagen, 1% per kant, ${metPoort ? 'POORT OPEN' : 'zonder poort'} (alleen t/m 2022)`);
    afstelKop();
    for (const [naam, kiest] of lijst) {
      afstelRegel(naam, draai({ naam, kiest: b => kiest(b) && (!metPoort || b.poort), niveaus: PLAN }));
    }
  }
}

if (onderdeel === 'top') {
  console.log('\nBIJ DE TOP: drempel en Markt-score, poort open, stop 3x ATR, doel 3R, 30 dagen, 1% per kant (alleen t/m 2022)');
  afstelKop();
  for (const d of [50, 60, 70, 80, 90]) {
    afstelRegel(`score >= ${d} (binnen ${(30 - d * 0.3).toFixed(0)}%)`, draai({ naam: 't', kiest: b => radarScore(b) >= d && b.poort, niveaus: PLAN }));
  }
  console.log('');
  for (const d of [60, 70, 80]) {
    afstelRegel(`score >= ${d} + Markt-score >= 55`, draai({ naam: 't', kiest: b => radarScore(b) >= d && b.score >= DREMPEL_KOOP && b.poort, niveaus: PLAN }));
    afstelRegel(`score >= ${d} + Markt-score < 55`, draai({ naam: 't', kiest: b => radarScore(b) >= d && b.score < DREMPEL_KOOP && b.poort, niveaus: PLAN }));
  }
  console.log('\n  Emmers (elk los, voor de sortering):');
  for (const [lo, hi] of [[0, 40], [40, 60], [60, 70], [70, 80], [80, 90], [90, 101]]) {
    afstelRegel(`score ${lo} tot ${Math.min(hi, 100)}`, draai({ naam: 't', kiest: b => radarScore(b) >= lo && radarScore(b) < hi && b.poort, niveaus: PLAN }));
  }
  console.log('\n  Ter vergelijking, zelfde opzet:');
  afstelRegel('Markt KOOP + R/R, poort open (eigen niveaus)', draai(MARKT_KOOP_POORT));
  afstelRegel('Markt KOOP + R/R, poort open (deze opzet)', draai({ ...MARKT_KOOP_POORT, niveaus: PLAN }));
}

// De regel die het afstellen koos. Hierna is er niets meer aan veranderd.
export const KANSEN_NIEUW: Regel = {
  naam: 'Kansen nieuw (radar 70, poort, 3x ATR, 3R)',
  kiest: b => radarScore(b) >= RADAR_DREMPEL && b.poort,
  niveaus: PLAN, maxBars: RADAR_HOUDTIJD_DAGEN,
};

if (onderdeel === 'toets') {
  console.log(`TOETS op ${toetsJaren[0]} t/m ${toetsJaren[toetsJaren.length - 1]}. Eén keer, met de regel uit het afstellen.\n`);
  for (const minStop of [0, MIN_STOP_BTC]) {
    const o = { minStop };
    console.log(`eToro: 1% per kant, stop minimaal ${minStop * 100}%`);
    kop();
    const markt = draai(MARKT_KOOP_POORT, o);
    const nieuw = draai(KANSEN_NIEUW, o);
    regel(MARKT_KOOP_POORT.naam, markt);
    regel('Kansen oud, poort open', draai({ ...KANSEN_NU, kiest: b => KANSEN_NU.kiest(b) && b.poort }, o));
    regel(KANSEN_NIEUW.naam, nieuw);
    regel('idem, zonder poort', draai({ ...KANSEN_NIEUW, kiest: b => radarScore(b) >= RADAR_DREMPEL }, o));
    regel('idem, zonder kosten', draai(KANSEN_NIEUW, { ...o, kosten: 0 }));
    regel('idem, 0,5% per kant', draai(KANSEN_NIEUW, { ...o, kosten: 0.005 }));
    regel('idem, 1,5% per kant', draai(KANSEN_NIEUW, { ...o, kosten: 0.015 }));
    // Overlevingsbias begrenzen: alleen coins die voor juli 2019 al koersen hadden.
    const oud = new Set(coins.filter(s => datumVan(reeksen[s][0].tijd) < '2019-07-01'));
    regel(`idem, alleen ${oud.size} coins van voor 2019`, nieuw.filter(t => oud.has(t.sym)));
    console.log(`\n  ${KANSEN_NIEUW.naam}: ${oordeel(nieuw, markt)}\n`);
    const t = nieuw.filter(x => x.datum >= TOETS_VANAF);
    const [lo, hi] = interval(t);
    console.log(`  Netto R in de toetsjaren: ${f(gem(t.map(x => x.r)))}, 90%-interval [${f(lo, 2)}, ${f(hi, 2)}], treffer ${(100 * t.filter(x => x.r > 0).length / t.length).toFixed(0)}%, mediane stop ${mediaan(t.map(x => x.stopPct)).toFixed(0)}%`);
    const dagen = new Set(alleBars.filter(b => b.datum >= TOETS_VANAF).map(b => b.datum));
    const metSignaal = new Set(alleBars.filter(b => b.datum >= TOETS_VANAF && KANSEN_NIEUW.kiest(b)).map(b => b.datum));
    console.log(`  Dagen met minstens een signaal: ${metSignaal.size} van ${dagen.size} (${(100 * metSignaal.size / dagen.size).toFixed(0)}%)\n`);
  }
}
