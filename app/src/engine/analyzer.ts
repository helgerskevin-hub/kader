import { Trade } from './types';
import { rsi as berekenRsi, ema as berekenEma, macd as berekenMacd, atr as berekenAtr } from './indicators';
import { haalData, delay } from './marketData';

// Configuratie
export const STANDAARD_UNIVERSUM = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE',
  'LINK', 'DOT', 'MATIC', 'LTC', 'ATOM', 'NEAR', 'ARB', 'OP',
  'INJ', 'SUI', 'APT', 'TIA', 'RNDR', 'FET', 'SEI', 'AAVE',
];

export const REWARD_MULTIPLIER = 3.0;
export const MIN_RISK_REWARD = 2.0;
export const HIGH_CONVICTION_SCORE = 75;
export const RSI_PERIODE = 14;
export const EMA_KORT = 20;
export const EMA_LANG = 50;
export const ATR_PERIODE = 14;
export const VOLUME_GEMIDDELDE_PERIODE = 20;
export const SWING_PERIODE = 10;

// Stop-afstand op basis van de recente swing-low (support), niet een vast ATR-veelvoud.
// Zo varieert de R/R per coin en heeft de MIN_RISK_REWARD-drempel weer betekenis.
// ponytail: structuur-gebaseerde stop met ATR-ruisfloor (0.5x) en -cap (3x) tegen
// candles met een absurd dichte of verre swing-low.
export function stopAfstandStructuur(
  candles: { low: number }[],
  entry: number,
  atr: number,
): number {
  const swingLow = Math.min(...candles.slice(-SWING_PERIODE).map(c => c.low));
  const ruwAfstand = entry - (swingLow - 0.1 * atr); // klein buffertje onder support
  return Math.min(Math.max(ruwAfstand, 0.5 * atr), 3 * atr);
}

export async function analyseerCoin(symbool: string): Promise<Trade | null> {
  const result = await haalData(symbool);
  if (!result || result.candles.length < EMA_LANG + 5) return null;

  const { candles, bron } = result;
  const close = candles.map(c => c.close);
  const prijs = close[close.length - 1];

  const rsiWaarden = berekenRsi(close, RSI_PERIODE);
  const ema20Waarden = berekenEma(close, EMA_KORT);
  const ema50Waarden = berekenEma(close, EMA_LANG);
  const { macdLine, signalLine, histogram } = berekenMacd(close);
  const atrWaarden = berekenAtr(candles, ATR_PERIODE);

  const n = close.length;
  const rsiNu = rsiWaarden[n - 1];
  const ema20Nu = ema20Waarden[n - 1];
  const ema50Nu = ema50Waarden[n - 1];
  const macdNu = macdLine[n - 1];
  const signaalNu = signalLine[n - 1];
  const histNu = histogram[n - 1];
  const atrRaw = atrWaarden[n - 1];
  const atrNu = isNaN(atrRaw) || atrRaw <= 0 ? prijs * 0.03 : atrRaw;

  // Volume spike t.o.v. 20-daags gemiddelde
  const totalVol = candles.reduce((s, c) => s + c.volume, 0);
  let volumeRatio = 1.0;
  if (totalVol > 0) {
    // Middel over de vórige N candles (excl. de huidige), anders drukt de spike-candle
    // zijn eigen gemiddelde op en wordt de ratio structureel onderschat.
    const recent = candles.slice(-VOLUME_GEMIDDELDE_PERIODE - 1, -1);
    const volGem = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
    const volNu = candles[n - 1].volume;
    volumeRatio = volGem > 0 ? volNu / volGem : 1.0;
  }

  // Scoring 0-100
  let score = 0;
  const redenen: string[] = [];

  if (ema20Nu > ema50Nu) {
    score += 25;
    redenen.push('opwaartse trend (EMA20>EMA50)');
  }
  if (prijs > ema20Nu) {
    score += 15;
    redenen.push('prijs boven EMA20');
  }
  if (rsiNu >= 45 && rsiNu <= 68) {
    score += 20;
    redenen.push(`RSI gezond (${rsiNu.toFixed(0)})`);
  } else if (rsiNu < 35) {
    score += 10;
    redenen.push(`RSI oversold (${rsiNu.toFixed(0)}) - mogelijke bounce`);
  }
  if (macdNu > signaalNu) {
    score += 20;
    redenen.push('MACD bullish');
    // histNu is binnen deze tak per definitie > 0; beloon alleen een stíjgend histogram
    if (histNu > histogram[n - 2]) score += 5;
  }
  if (volumeRatio >= 1.5) {
    score += 15;
    redenen.push(`volume spike (${volumeRatio.toFixed(1)}x)`);
  } else if (volumeRatio >= 1.2) {
    score += 8;
    redenen.push(`verhoogd volume (${volumeRatio.toFixed(1)}x)`);
  }
  score = Math.min(score, 100);

  // Trade-niveaus: stop op basis van marktstructuur (swing-low), doel ATR-gebaseerd
  const entry = prijs;
  const risk = stopAfstandStructuur(candles, entry, atrNu);
  const stopLoss = entry - risk;
  const takeProfit = entry + REWARD_MULTIPLIER * atrNu;
  const reward = takeProfit - entry;
  const rr = risk > 0 ? reward / risk : 0;

  const entryLaag = entry - 0.2 * atrNu;
  const entryHoog = entry + 0.2 * atrNu;

  if (rr < MIN_RISK_REWARD - 1e-9) return null;

  const signaalTekst: 'KOOP' | 'WATCH' = score >= 55 ? 'KOOP' : 'WATCH';
  const highConviction =
    score >= HIGH_CONVICTION_SCORE &&
    ema20Nu > ema50Nu &&
    macdNu > signaalNu &&
    volumeRatio >= 1.3;

  return {
    symbool, bron, prijs, entry, entryLaag, entryHoog,
    stopLoss, takeProfit, rr, atr: atrNu,
    rsi: rsiNu, ema20: ema20Nu, ema50: ema50Nu,
    macdBullish: macdNu > signaalNu,
    volumeRatio, score, redenen,
    signaal: signaalTekst, highConviction,
  };
}

export async function analyseerMarkt(options?: {
  universum?: string[];
  topN?: number;
  onProgress?: (current: number, total: number, symbool: string) => void;
}): Promise<Trade[]> {
  const universum = options?.universum ?? STANDAARD_UNIVERSUM;
  const topN = options?.topN ?? 10;
  const resultaten: Trade[] = [];

  for (let i = 0; i < universum.length; i++) {
    const sym = universum[i];
    options?.onProgress?.(i + 1, universum.length, sym);
    try {
      const res = await analyseerCoin(sym);
      if (res) resultaten.push(res);
    } catch {
      // coin overgeslagen
    }
    if (i < universum.length - 1) await delay(250);
  }

  // Sorteer: HIGH CONVICTION eerst, dan op score, dan op R/R
  resultaten.sort((a, b) => {
    if (a.highConviction !== b.highConviction) return a.highConviction ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.rr - a.rr;
  });

  return resultaten.slice(0, topN);
}
