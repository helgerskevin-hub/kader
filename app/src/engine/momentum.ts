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
// Wat de score NIET is: een koopsignaal. Meting M (app/scripts/meting-kansen.ts, 11 nov 2026) rekende
// voor het eerst met eToro's kosten (1% bij kopen, 1% bij verkopen) en toetste op jaren die bij het
// afstellen niet gebruikt waren (2023 t/m 2026). Coins op de radar haalden daar netto +0,29 R per
// trade met het plan uit radarNiveaus hieronder, maar niet aantoonbaar meer dan een willekeurige
// coin op dezelfde dag met hetzelfde plan (+0,04 R, interval -0,01 tot +0,09, positief in 2 van de
// 4 jaren). De radar is dus een volglijst van wie voorop loopt. Zie docs/metingen.md, meting M.
const AFSTAND_NUL = -30;

export function momentumScore(m: MomentumIngredienten): number {
  if (m.afstandHigh90d === null) return 0;
  const deel = (m.afstandHigh90d - AFSTAND_NUL) / -AFSTAND_NUL;
  return Math.round(100 * Math.max(0, Math.min(1, deel)));
}

// Score 70 = binnen 9% van de 90-dagen-high. Gekozen in meting I-c0 en in meting M opnieuw bekeken
// op alleen de afsteljaren (t/m 2022), na kosten: 60 gaf +0,12 R boven een willekeurige coin op
// dezelfde dag, 70 +0,20 en 80 +0,12. Boven de 70 lopen de emmers niet verder op, dus een fijnere
// rangorde dan "op de radar of niet" is niet te onderbouwen.
export const RADAR_DREMPEL = 70;

// Het plan bij een coin op de radar: stop 3x ATR onder de koers, doel op drie keer dat risico.
// Gekozen in meting M (app/scripts/meting-kansen.ts, 11 nov 2026), op alleen de afsteljaren.
//
// Waarom zo ruim? De kosten van eToro zijn 2% van de koers, heen en terug. Uitgedrukt in R is dat
// 2% gedeeld door de stopafstand: bij een stop op 4% ben je een halve R kwijt voordat de koers
// beweegt, bij een stop op 20% een tiende. Het oude plan (stop op de EMA20, doel 2x ATR boven de
// 90d-top) had een mediane stop van 7% en ging met kosten van +0,22 R naar -0,17 R per trade. Van
// acht opzetten op een neutrale selectie (trend op, klimaat gunstig) hield deze na kosten het
// meeste over: +0,30 R, tegen +0,15 R voor een stop van 1,5x ATR met hetzelfde doel van 3R.
//
// Bijkomend voordeel: 3x ATR ligt vrijwel altijd verder weg dan de 10% die eToro bij BTC minimaal
// eist. In de meting gaf "stop minimaal 10%" dezelfde uitkomst, dus het plan op de kaart is het
// plan dat je bij eToro ook kunt zetten.
//
// De R/R is hier per constructie 3. Een R/R-filter zegt daarom niets meer en bestaat op Kansen
// niet meer: bij het oude plan beloonde die filter vooral een toevallig krappe stop.
// eToro rekent 1% bij kopen en 1% bij verkopen van crypto. Het meetscript en het live trackrecord
// van de volglijst rekenen allebei met dit getal.
export const ETORO_KOSTEN_PER_KANT = 0.01;
// Wat de radar met dit plan na kosten gemiddeld deed in de toetsjaren (2023 t/m 2026), bij een
// gunstig klimaat. Het ijkpunt waar het live trackrecord naast staat. Onzeker: het 90%-interval
// loopt van -0,10 tot +0,64.
export const RADAR_METING_NETTO_R = 0.29;

export const RADAR_STOP_ATR = 3;
export const RADAR_DOEL_R = 3;
// Zo lang liep een trade in de meting hoogstens. Het plan zegt dus ook iets over geduld.
export const RADAR_HOUDTIJD_DAGEN = 30;

// Wat de kaart over het plan zegt. Staat hier en niet in de component, zodat de zin en de meting
// waar hij op leunt niet uit elkaar kunnen lopen. Cijfers uit meting M, toetsjaren 2023 t/m 2026.
export const RADAR_PLAN_UITLEG =
  `Plan: stop ${RADAR_STOP_ATR}x ATR onder de koers, doel op ${RADAR_DOEL_R} keer dat risico, hoogstens ${RADAR_HOUDTIJD_DAGEN} dagen. `
  + 'De ruime stop houdt de kosten van eToro (1% bij kopen, 1% bij verkopen) klein tegenover je risico.';
export const RADAR_METING_UITLEG =
  'Dit is een volglijst, geen koopadvies. Coins op de radar haalden met dit plan na kosten gemiddeld '
  + '+0,29 R per trade (2023 t/m 2026, bij een gunstig marktklimaat). Dat gemiddelde is onzeker en '
  + '2025 en 2026 waren verliesjaren. Het was ook niet aantoonbaar beter dan een willekeurige coin op '
  + 'dezelfde dag.';

export interface RadarNiveaus {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  rr: number;
}

/**
 * Entry, stop, doel en R/R bij een gegeven koers. `prijs` is de koers van nu, `atr` de ATR van de
 * laatste afgesloten dag. Null zonder bruikbare ATR, of als 3x ATR de hele koers zou beslaan.
 */
export function radarNiveaus(prijs: number, atr: number): RadarNiveaus | null {
  if (!(prijs > 0) || !(atr > 0)) return null;
  const risico = RADAR_STOP_ATR * atr;
  if (!(risico < prijs)) return null;
  return { entry: prijs, stopLoss: prijs - risico, takeProfit: prijs + RADAR_DOEL_R * risico, rr: RADAR_DOEL_R };
}

// Korte Nederlandse redenen voor op de kaart. De eerste regel is waar de score op draait; de
// tweede is context (30-dagenrendement en het verschil met bitcoin) die bewust NIET meetelt, zie de
// comment bij momentumScore. Het verschil met bitcoin staat er daarom als kaal getal: "sterker dan
// BTC" las als een pluspunt, terwijl geen enkele meting dat liet zien.
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
        ? `, ${m.rsBtc30d.toFixed(0)} procentpunt meer dan bitcoin`
        : `, ${Math.abs(m.rsBtc30d).toFixed(0)} procentpunt minder dan bitcoin`;
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

  // radarNiveaus: koers 100, ATR 5 geeft stop 85 en doel 145, R/R 3.
  const nv = radarNiveaus(100, 5);
  console.assert(nv !== null && nv.stopLoss === 85 && nv.takeProfit === 145 && nv.rr === 3,
    `radarNiveaus klopt niet: ${JSON.stringify(nv)}`);
  console.assert(radarNiveaus(100, 0) === null, 'zonder ATR geen niveaus');
  console.assert(radarNiveaus(100, 40) === null, 'een stop onder nul bestaat niet');
  console.assert(redenen[1].includes('procentpunt meer dan bitcoin'), `tweede reden hoort neutraal te zijn: ${redenen[1]}`);

  console.log('momentum.ts self-check geslaagd');
}
