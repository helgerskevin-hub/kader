import { Candle } from './types';
import { ema as berekenEma } from './indicators';

// Momentum-radar voor het Kansen-scherm: welke coins lopen de laatste 1 tot 4 weken voorop?
//
// Alles hier is puur en causaal: de functies zien alleen de candles die ze krijgen (t/m de bar die
// beoordeeld wordt) en doen geen netwerk. De backtest (meting I in app/scripts/backtest.ts) voert
// ze daardoor exact dezelfde vensters als de app en kan per constructie niet in de toekomst kijken.

export interface MomentumIngredienten {
  // Rendement over 7 en 30 dagen, in procenten (+18 = +18%).
  rendement7d: number | null;
  rendement30d: number | null;
  // Gemiddeld volume van de laatste 7 dagen gedeeld door dat van de laatste 30. Boven 1 = de
  // handel neemt toe.
  volumeTrend: number | null;
  // Rendement over 30 dagen min dat van BTC over dezelfde dagen, in procentpunten.
  rsBtc30d: number | null;
  // Afstand van de slotkoers tot de hoogste high van de laatste 90 dagen, in procenten (0 = op de
  // top, -25 = 25% eronder). Nooit positief.
  afstandHigh90d: number | null;
  // Aandeel van de laatste 30 dagen waarop de slotkoers boven de EMA20 van die dag stond (0 tot 1).
  trendConsistentie: number | null;
}

const DAGEN_KORT = 7;
const DAGEN_LANG = 30;
const DAGEN_HIGH = 90;
const EMA_TREND = 20;

function rendement(closes: number[], dagen: number): number | null {
  if (closes.length < dagen + 1) return null;
  const nu = closes[closes.length - 1];
  const toen = closes[closes.length - 1 - dagen];
  if (!(nu > 0) || !(toen > 0)) return null;
  return (nu / toen - 1) * 100;
}

const gemiddelde = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

/**
 * De losse ingrediënten van het momentum van een coin op de laatste candle.
 *
 * `btcCloses` zijn de BTC-slotkoersen op DEZELFDE dagen als `candles`: het laatste element hoort
 * bij dezelfde dag als de laatste candle. Zonder BTC (of met te weinig historie) blijft rsBtc30d
 * null; elk ingrediënt waarvoor te weinig candles zijn blijft null in plaats van een verzonnen
 * getal.
 */
export function momentumIngredienten(candles: Candle[], btcCloses?: number[]): MomentumIngredienten {
  const closes = candles.map(c => c.close);
  const n = closes.length;

  const rendement7d = rendement(closes, DAGEN_KORT);
  const rendement30d = rendement(closes, DAGEN_LANG);

  let volumeTrend: number | null = null;
  if (n >= DAGEN_LANG) {
    const vol = candles.map(c => c.volume);
    const lang = gemiddelde(vol.slice(-DAGEN_LANG));
    if (lang > 0) volumeTrend = gemiddelde(vol.slice(-DAGEN_KORT)) / lang;
  }

  let rsBtc30d: number | null = null;
  if (rendement30d !== null && btcCloses) {
    const btc = rendement(btcCloses, DAGEN_LANG);
    if (btc !== null) rsBtc30d = rendement30d - btc;
  }

  let afstandHigh90d: number | null = null;
  if (n >= DAGEN_HIGH) {
    const top = Math.max(...candles.slice(-DAGEN_HIGH).map(c => c.high));
    if (top > 0) afstandHigh90d = Math.min(0, (closes[n - 1] / top - 1) * 100);
  }

  // Een EMA20 is na ~20 bars ingelopen; we willen er daarna nog 30 dagen van kunnen tellen.
  let trendConsistentie: number | null = null;
  if (n >= EMA_TREND + DAGEN_LANG) {
    const e = berekenEma(closes, EMA_TREND);
    let boven = 0;
    for (let i = n - DAGEN_LANG; i < n; i++) if (closes[i] > e[i]) boven++;
    trendConsistentie = boven / DAGEN_LANG;
  }

  return { rendement7d, rendement30d, volumeTrend, rsBtc30d, afstandHigh90d, trendConsistentie };
}

// De score draait op EEN ingrediënt: hoe dicht de koers bij zijn 90-dagen-high staat. 100 op de
// top, lineair naar 0 op 30% eronder. Gemeten in meting I van app/scripts/backtest.ts (28 sep 2026,
// negen jaar Binance-historie, 57 coins, niveaus uit scoorCandles, doel 3x ATR, 30 dagen).
//
// Waarom alleen dit? Van de zes kandidaten versloegen er in de gepoolde cijfers vier de nulmeting
// (alle bars +0,002 R): 7d-rendement Q5 +0,084, 30d-rendement Q5 +0,101, volumetrend Q5 +0,107 en
// dicht bij de 90d-high Q5 +0,108. Maar een radar rangschikt coins op één moment, dus de eerlijke
// vraag is of hij beter kiest dan de ANDERE coins op dezelfde dag (meting I-e). Dan valt het beeld
// om: 7d-, 30d-rendement en volumetrend hebben in hun bovenste kwintiel een negatieve excess R
// (-0,036, -0,036, -0,002). Hun gepoolde voorsprong was een markteffect: veel coins met sterk
// momentum betekent een bullfase, en dan doet elke instap het beter. Per jaar kwam het bovenste
// 30d-kwintiel in 5 van de 10 jaar onder de nulmeting uit (meting I-d). Relatieve sterkte vs
// BTC werkt precies andersom (achterblijvers Q1 +0,145, zie ook meting H) en past dus niet in een
// momentumscore.
// Trendconsistentie (dagen boven EMA20) liep niet monotoon en had Q5 op -0,011 excess. Alleen de
// afstand tot de 90d-high hield stand: Q5 (binnen ~17% van de top) +0,041 excess, en de score
// loopt monotoon op (bucket 60-80 +0,099 R, 80-100 +0,184 R, per bar). Het onderste kwintiel
// (meer dan 50% onder de top) scoort ook positief, maar dat is terugveren na een crash en hoort bij
// het omkeerprofiel, niet op een momentumradar; daarom telt alleen de bovenkant.
//
// De radar (score >= RADAR_DREMPEL) als strategie zonder overlap: +0,176 R over 1754 trades tegen
// +0,032 voor de nulmeting. Tegen de andere coins op dezelfde dag positief in 7 van de 8 meetbare
// jaren, ook in de dalende jaren (2022 +0,10, 2025 +0,33, 2026 +0,19); alleen 2021 -0,06. In
// absolute zin blijft hij in een bearmarkt wel verliezen (2022 -0,45 R), net als elke long.
//
// Eerlijke kanttekening voor het scherm: radar + KOOP + R/R voegt weinig toe aan Markt's KOOP. Het
// gaf +0,091 R over 288 trades tegen +0,083 over 3170, met de marktpoort erbij zelfs +0,057 tegen
// +0,187. Binnen de radar doen de bars met R/R < 2 het beter (+0,154) dan die erboven (+0,113),
// want een coin vlak onder zijn top heeft zijn swing-low ver weg en dus een brede stop. De radar is
// daarmee vooral een lijst "wie loopt voorop", geen extra koopfilter. Radar + high conviction
// deed het wel beter dan high conviction alleen (+0,198 over 1248 tegen +0,154 over 2262).
const AFSTAND_NUL = -30;

export function momentumScore(m: MomentumIngredienten): number {
  if (m.afstandHigh90d === null) return 0;
  const deel = (m.afstandHigh90d - AFSTAND_NUL) / -AFSTAND_NUL;
  return Math.round(100 * Math.max(0, Math.min(1, deel)));
}

// Score 70 = binnen 9% van de 90-dagen-high. Gekozen in meting I-c0: als lijst gaf 60 +0,134 R,
// 70 +0,176 en 80 +0,180; 80 voegt dus niets meer toe en maakt de lijst op de helft van de dagen
// leeg. Op 70 staan er gemiddeld zo'n drie coins op de radar, op 42% van de dagen geen enkele.
export const RADAR_DREMPEL = 70;

// Trade-niveaus voor een coin op de radar: stop onder de EMA20, doel een uitbraak boven de
// 90-dagen-high. Gemeten in meting J van app/scripts/backtest.ts (28 sep 2026, 25 varianten: vijf
// stops maal vijf doelen, alleen radar-bars, geen overlap, 30 dagen houdtijd).
//
// Het probleem dat dit oplost: met de gewone niveaus uit scoorCandles (swing-low-stop, doel 3x ATR)
// sorteert R/R binnen de radar averechts. R/R >= 2 gaf +0,081 R over 318 trades, R/R < 2 +0,182;
// de vaste regel R/R >= MIN_RISK_REWARD gooide dus juist de betere instappen weg. Een doel op vaste
// ATR-afstand zegt niets over hoeveel ruimte er boven de top is, en de swing-low ligt bij een coin
// vlak onder zijn top ver weg.
//
// Met deze niveaus sorteert R/R wel: R/R >= 2 +0,238 R over 1167 trades tegen +0,170 over 1667
// voor R/R < 2, en R/R >= 2 was beter in 6 van de 8 meetbare jaren. Het is geen losse gelukstreffer
// in het rooster: alle vier de combinaties van een EMA20-stop (met of zonder 0,5x ATR buffer) met
// een uitbraakdoel (90d-high + 1x of 2x ATR) lieten R/R >= 2 winnen in 5 of 6 van de 7 à 8 jaren.
// Radar + score >= 55 + R/R >= 2 gaf +0,235 over 1161 trades, tegen +0,176 voor de radar alleen en
// +0,083 voor Markt's KOOP + R/R.
//
// Eerlijke grenzen: met de marktpoort open haalt het +0,173 tegen +0,187 voor Markt's KOOP met poort,
// dus binnen de poort voegt het niets toe. 2022 blijft zwaar negatief (-0,66 R). En R is hier in
// eenheden van het eigen risico: een krappere stop maakt 1R kleiner, dus vergelijk bedragen niet
// één op één met de Markt-niveaus.
//
// Stop: EMA20 met dezelfde vloer (0,5x ATR) en cap (3x ATR) als stopAfstandStructuur. Staat de koers
// niet boven zijn EMA20, dan bestaat deze stop niet en geeft de functie null.
const RADAR_DOEL_BOVEN_TOP_ATR = 2;

export interface RadarNiveaus {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  rr: number;
}

/**
 * Entry, stop, doel en R/R voor een radar-coin op de laatste candle. `atr` en `ema20` zijn de
 * waarden op die candle (zoals scoorCandles ze teruggeeft). Null bij te weinig historie voor de
 * 90-dagen-high of als de koers niet boven de EMA20 staat.
 */
export function radarNiveaus(candles: Candle[], atr: number, ema20: number): RadarNiveaus | null {
  if (candles.length < DAGEN_HIGH || !(atr > 0)) return null;
  const entry = candles[candles.length - 1].close;
  if (!(entry > ema20)) return null;
  const risico = Math.min(Math.max(entry - ema20, 0.5 * atr), 3 * atr);
  const top = Math.max(...candles.slice(-DAGEN_HIGH).map(c => c.high));
  const takeProfit = Math.max(top, entry) + RADAR_DOEL_BOVEN_TOP_ATR * atr;
  return { entry, stopLoss: entry - risico, takeProfit, rr: (takeProfit - entry) / risico };
}

// Korte Nederlandse redenen voor op de kaart. De eerste regel is waar de score op draait; de
// tweede is context (30-dagenrendement en het verschil met BTC) die bewust NIET meetelt, zie de
// comment bij momentumScore.
export function momentumRedenen(m: MomentumIngredienten): string[] {
  const r: string[] = [];
  if (m.afstandHigh90d !== null) {
    const onder = Math.abs(m.afstandHigh90d);
    r.push(onder < 1 ? 'op de hoogste koers van de afgelopen 90 dagen' : `${onder.toFixed(0)}% onder de hoogste koers van 90 dagen`);
  }
  if (m.rendement30d !== null) {
    let regel = `${m.rendement30d >= 0 ? '+' : ''}${m.rendement30d.toFixed(0)}% in 30 dagen`;
    if (m.rsBtc30d !== null) {
      regel += m.rsBtc30d >= 0
        ? `, ${m.rsBtc30d.toFixed(0)}% sterker dan BTC`
        : `, ${Math.abs(m.rsBtc30d).toFixed(0)}% zwakker dan BTC`;
    }
    r.push(regel);
  }
  return r;
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/momentum.ts`
if (require.main === module) {
  // 100 dagen oplopend van 100 naar 199, BTC vlak op 50.
  const candles: Candle[] = Array.from({ length: 100 }, (_, i) => ({
    open: 100 + i, high: 100 + i, low: 100 + i, close: 100 + i, volume: 1000,
  }));
  const btc = Array.from({ length: 100 }, () => 50);
  const m = momentumIngredienten(candles, btc);
  console.assert(m.afstandHigh90d === 0, `op de top hoort de afstand 0 te zijn, was ${m.afstandHigh90d}`);
  console.assert(momentumScore(m) === 100, `op de top hoort de score 100 te zijn, was ${momentumScore(m)}`);
  console.assert(Math.abs((m.rendement30d ?? 0) - (199 / 169 - 1) * 100) < 1e-9, `30d-rendement klopt niet: ${m.rendement30d}`);
  console.assert(m.rsBtc30d === m.rendement30d, 'met een vlakke BTC is de RS gelijk aan het eigen rendement');
  console.assert(m.volumeTrend === 1, `vlak volume hoort 1 te geven, was ${m.volumeTrend}`);
  console.assert(m.trendConsistentie === 1, `een stijgende reeks staat elke dag boven zijn EMA20, was ${m.trendConsistentie}`);

  // 15% onder de top: score 50. 30% of meer eronder: 0.
  console.assert(momentumScore({ ...m, afstandHigh90d: -15 }) === 50, 'halverwege hoort 50 te zijn');
  console.assert(momentumScore({ ...m, afstandHigh90d: -45 }) === 0, 'ver onder de top hoort 0 te zijn');
  console.assert(momentumScore({ ...m, afstandHigh90d: null }) === 0, 'zonder cijfer geen score');

  // Te weinig historie: geen verzonnen getallen.
  const kort = momentumIngredienten(candles.slice(0, 20));
  console.assert(kort.rendement30d === null && kort.afstandHigh90d === null && kort.rsBtc30d === null,
    'te weinig candles hoort null te geven');
  console.assert(momentumIngredienten(candles).rsBtc30d === null, 'zonder BTC geen relatieve sterkte');

  const redenen = momentumRedenen(m);
  console.assert(redenen[0].includes('hoogste koers'), `eerste reden hoort over de top te gaan: ${redenen[0]}`);
  console.assert(redenen.every(r => !r.includes('\u2014')), 'geen em-dashes in de redenen');

  // radarNiveaus: entry 199, EMA20 190 geeft 9 afstand, gecapt op 3x ATR = 6. Doel = top 199 + 2x2.
  const nv = radarNiveaus(candles, 2, 190);
  console.assert(nv !== null && nv.stopLoss === 193 && nv.takeProfit === 203,
    `radarNiveaus klopt niet: ${JSON.stringify(nv)}`);
  console.assert(nv !== null && Math.abs(nv.rr - 4 / 6) < 1e-9, `R/R klopt niet: ${nv?.rr}`);
  console.assert(radarNiveaus(candles, 2, 199) === null, 'koers op de EMA20 hoort geen niveaus te geven');
  console.assert(radarNiveaus(candles.slice(0, 50), 2, 100) === null, 'zonder 90 dagen historie geen niveaus');

  console.log('momentum.ts self-check geslaagd');
}
