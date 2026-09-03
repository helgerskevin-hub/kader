import { Candle } from './types';
import { ema as berekenEma } from './indicators';

// Relatieve sterkte: hoeveel beter (of slechter) een coin het doet dan BTC over dezelfde periode.
//
// Waarom dit bestaat: de gewone score in analyzer.ts is een momentumprofiel en dat zegt in een
// dalende markt bijna niets, want dan daalt alles en scoort alles laag. Wat dan wél informatie is,
// is wie er mínder hard daalt dan BTC. Dat is geen koopsignaal, het is een watchlist: de coins die
// standhouden tijdens de daling zijn doorgaans de leiders van de volgende opgaande fase.
//
// Bewust geen onderdeel van de 0-100 score. Die score is met de backtest gekalibreerd; er een
// ongemeten component in mengen zou alle gemeten drempels in drempels.ts stilzwijgend verschuiven.

export const RS_PERIODE = 30;

const EMA_LANG = 50;
const MIN_CANDLES = EMA_LANG + 5;

export interface RelatieveSterkte {
  symbool: string;
  prijs: number;
  // Rendement van de coin zelf over de periode, in procenten.
  rendement: number;
  // Verschil met BTC over diezelfde periode, in procentpunten. Positief = houdt beter stand.
  versusBtc: number;
  // Staat de coin boven zijn eigen 50-daags EMA? In een dalende markt is dat zeldzaam en dus
  // veelzeggend. null als er te weinig historie is.
  bovenEma50: boolean | null;
}

function rendementOver(candles: Candle[], periode: number): number | null {
  if (candles.length < periode + 1) return null;
  const nu = candles[candles.length - 1].close;
  const toen = candles[candles.length - 1 - periode].close;
  if (!(toen > 0) || !(nu > 0)) return null;
  return ((nu - toen) / toen) * 100;
}

function bovenEigenEma50(candles: Candle[]): boolean | null {
  if (candles.length < MIN_CANDLES) return null;
  const close = candles.map(c => c.close);
  const ema50 = berekenEma(close, EMA_LANG);
  return close[close.length - 1] > ema50[ema50.length - 1];
}

/**
 * Rangschikt het universum op prestatie ten opzichte van BTC, sterkste eerst.
 *
 * Geeft een lege lijst terug als BTC zelf ontbreekt of te weinig historie heeft: zonder ijkpunt is
 * "relatief" een leeg woord, en een verzonnen rangschikking is erger dan geen rangschikking.
 */
export function berekenRelatieveSterkte(
  reeksen: { symbool: string; candles: Candle[] }[],
  periode: number = RS_PERIODE,
): RelatieveSterkte[] {
  const btc = reeksen.find(r => r.symbool === 'BTC');
  if (!btc) return [];
  const btcRendement = rendementOver(btc.candles, periode);
  if (btcRendement === null) return [];

  const uit: RelatieveSterkte[] = [];
  for (const { symbool, candles } of reeksen) {
    if (symbool === 'BTC') continue;
    const rendement = rendementOver(candles, periode);
    if (rendement === null) continue;
    uit.push({
      symbool,
      prijs: candles[candles.length - 1].close,
      rendement,
      versusBtc: rendement - btcRendement,
      bovenEma50: bovenEigenEma50(candles),
    });
  }

  uit.sort((a, b) => b.versusBtc - a.versusBtc);
  return uit;
}

// Wat het cijfer betekent voor een INSTAP, gemeten in meting H van de backtest (2 sep 2026, negen
// jaar, 3251 trades). De verwachting was dat voorlopers het beter zouden doen; het tegendeel bleek
// waar en de helling loopt monotoon:
//
//   rs < -20%      +0,775 R      rs 0 tot +10%    -0,146 R
//   -20 tot -10%   +0,406 R      +10 tot +25%     -0,146 R
//   -10 tot 0%     +0,132 R      +25 tot +50%     -0,122 R
//
// Zonder de marktpoort houdt het ook stand: "zwakker dan BTC" geeft +0,168 over 1879 trades,
// "sterker dan BTC" -0,032 over 1862. Te lezen als: een koopsignaal eist al een opwaartse trend en
// bullish MACD, dus een coin die daarbovenop veel harder steeg dan BTC heeft het makkelijke deel
// gehad. Dezelfde coin die juist achterbleef is een terugval binnen een opgaande trend.
//
// Dit oordeel is puur informatief. Het telt niet mee in de 0-100 score en filtert niets weg: die
// score is met de backtest gekalibreerd en er een component in mengen verschuift stilzwijgend alle
// drempels in drempels.ts. Zie de openstaande keuze in TODO.md.
export type RsOordeel = 'achterblijver' | 'gelijk' | 'voorloper';

// Grenzen uit de emmers hierboven: vanaf -10pp kantelt het gemiddelde duidelijk naar positief,
// vanaf +25pp is het al twee emmers lang negatief. Daartussen zegt het cijfer weinig.
export const RS_ACHTERBLIJVER_PP = -10;
export const RS_VOORLOPER_PP = 25;

export function oordeelRs(versusBtc: number): RsOordeel {
  if (!isFinite(versusBtc)) return 'gelijk';
  if (versusBtc <= RS_ACHTERBLIJVER_PP) return 'achterblijver';
  if (versusBtc >= RS_VOORLOPER_PP) return 'voorloper';
  return 'gelijk';
}

/** Eén regel uitleg bij het cijfer, of leeg als er niets bijzonders aan de hand is. */
export function rsUitleg(versusBtc: number): string {
  switch (oordeelRs(versusBtc)) {
    case 'achterblijver':
      return `Deze coin bleef ${Math.abs(versusBtc).toFixed(0)}% achter op bitcoin in 30 dagen. In de backtest deden koopsignalen op achterblijvers het beter dan op coins die al voorliepen: een terugval binnen een opgaande trend, in plaats van een beweging die al grotendeels geweest is.`;
    case 'voorloper':
      return `Deze coin liep ${versusBtc.toFixed(0)}% voor op bitcoin in 30 dagen. In de backtest deden koopsignalen op zulke voorlopers het gemiddeld slechter dan op achterblijvers: het makkelijke deel van de beweging is dan vaak geweest. Dit weegt niet mee in de score.`;
    default:
      return '';
  }
}

// De keuze die de gebruiker onder Filters maakt. 'alle' is de standaard en verandert niets.
export type RsFilter = 'alle' | 'geenVoorlopers' | 'achterblijvers';

/**
 * Laat dit filter deze coin door?
 *
 * Een coin zonder cijfer (te weinig historie, of BTC zelf niet opgehaald) valt NOOIT weg. Zonder
 * cijfer valt er niets te oordelen, en iets wegfilteren op basis van onbekend is erger dan het
 * laten staan: de gebruiker zou een coin missen zonder te weten waarom.
 */
export function magDoorRsFilter(filter: RsFilter, versusBtc: number | undefined): boolean {
  if (filter === 'alle' || versusBtc === undefined || !isFinite(versusBtc)) return true;
  if (filter === 'geenVoorlopers') return versusBtc < RS_VOORLOPER_PP;
  return versusBtc <= RS_ACHTERBLIJVER_PP;
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/relatieveSterkte.ts`
if (require.main === module) {
  const reeks = (start: number, factor: number, n = 60): Candle[] =>
    Array.from({ length: n }, (_, i) => {
      const close = start * Math.pow(factor, i);
      return { open: close, high: close, low: close, close, volume: 1 };
    });

  // BTC daalt 1% per candle, ALT daalt 0,5%: ALT hoort bovenaan met een positieve versusBtc.
  const uitkomst = berekenRelatieveSterkte([
    { symbool: 'BTC', candles: reeks(100, 0.99) },
    { symbool: 'ALT', candles: reeks(10, 0.995) },
    { symbool: 'ZWAK', candles: reeks(10, 0.98) },
  ], 30);
  console.assert(uitkomst.length === 2, `BTC hoort niet in de lijst zelf, kreeg ${uitkomst.length}`);
  console.assert(uitkomst[0].symbool === 'ALT', `ALT hoort bovenaan, was ${uitkomst[0].symbool}`);
  console.assert(uitkomst[0].versusBtc > 0, 'ALT daalt minder hard dan BTC en hoort dus positief te staan');
  console.assert(uitkomst[1].versusBtc < 0, 'ZWAK daalt harder dan BTC en hoort dus negatief te staan');

  // Zonder BTC is er geen ijkpunt en dus geen rangschikking.
  console.assert(
    berekenRelatieveSterkte([{ symbool: 'ALT', candles: reeks(10, 0.995) }]).length === 0,
    'zonder BTC hoort de lijst leeg te zijn',
  );

  // Te weinig historie voor de gevraagde periode: coin valt weg in plaats van een verzonnen cijfer.
  console.assert(
    berekenRelatieveSterkte([
      { symbool: 'BTC', candles: reeks(100, 0.99) },
      { symbool: 'KORT', candles: reeks(10, 0.99, 5) },
    ], 30).length === 0,
    'een coin met te weinig candles hoort weg te vallen',
  );

  // ---------- oordeelRs ----------
  console.assert(oordeelRs(-30) === 'achterblijver', 'ver achter hoort achterblijver te zijn');
  console.assert(oordeelRs(RS_ACHTERBLIJVER_PP) === 'achterblijver', 'precies op de grens telt mee');
  console.assert(oordeelRs(-5) === 'gelijk', 'tussen de grenzen zegt het cijfer weinig');
  console.assert(oordeelRs(0) === 'gelijk', 'gelijk aan BTC is gelijk');
  console.assert(oordeelRs(10) === 'gelijk', '+10pp valt nog in de middenmoot');
  console.assert(oordeelRs(RS_VOORLOPER_PP) === 'voorloper', 'precies op de bovengrens telt mee');
  console.assert(oordeelRs(60) === 'voorloper', 'ver voor hoort voorloper te zijn');
  console.assert(oordeelRs(NaN) === 'gelijk', 'een onbruikbaar cijfer mag niets beweren');

  console.assert(rsUitleg(-5) === '', 'de middenmoot krijgt geen uitleg');
  console.assert(rsUitleg(-30).includes('30%'), `de uitleg noemt het cijfer, was: ${rsUitleg(-30)}`);
  console.assert(rsUitleg(-30).includes('beter'), 'bij een achterblijver hoort de gemeten uitkomst te staan');
  console.assert(rsUitleg(40).includes('slechter'), 'bij een voorloper ook, maar dan andersom');
  // Geen minteken in de tekst bij een achterblijver: die staat er al in het woord "achter".
  console.assert(!rsUitleg(-30).includes('-30'), `dubbel minteken leest raar, was: ${rsUitleg(-30)}`);

  // ---------- magDoorRsFilter ----------
  console.assert(magDoorRsFilter('alle', 99) && magDoorRsFilter('alle', -99), 'zonder filter valt niets weg');
  console.assert(magDoorRsFilter('geenVoorlopers', 24), 'net onder de voorloper-grens mag blijven');
  console.assert(!magDoorRsFilter('geenVoorlopers', RS_VOORLOPER_PP), 'precies op de grens valt weg');
  console.assert(magDoorRsFilter('geenVoorlopers', -30), 'een achterblijver blijft bij dit filter staan');
  console.assert(magDoorRsFilter('achterblijvers', RS_ACHTERBLIJVER_PP), 'precies op de grens telt als achterblijver');
  console.assert(!magDoorRsFilter('achterblijvers', -5), '5% achter is niet genoeg');
  console.assert(!magDoorRsFilter('achterblijvers', 30), 'een voorloper valt bij dit filter weg');

  // De belangrijkste regel: onbekend mag nooit wegvallen.
  console.assert(magDoorRsFilter('achterblijvers', undefined), 'zonder cijfer valt een coin niet weg');
  console.assert(magDoorRsFilter('geenVoorlopers', undefined), 'ook niet bij het andere filter');
  console.assert(magDoorRsFilter('achterblijvers', NaN), 'een onbruikbaar cijfer telt als onbekend');

  console.log('relatieveSterkte.ts self-check geslaagd');
}
