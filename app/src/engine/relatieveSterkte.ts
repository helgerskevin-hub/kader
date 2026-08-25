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

  console.log('relatieveSterkte.ts self-check geslaagd');
}
