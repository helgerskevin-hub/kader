import { Candle, Trade } from './types';
import { rsi as berekenRsi, ema as berekenEma, macd as berekenMacd, atr as berekenAtr } from './indicators';
import { haalData } from './marketData';

// De coins die wij analyseren: op eToro te kopen én met een live Binance USDT-paar (eventueel via
// een alias, zie BINANCE_ALIAS in marketData.ts). Dit is dus een deelverzameling van ETORO_TRADABLE
// in opportunities.ts, niet dezelfde lijst: TON kun je op eToro aanhouden maar niet op Binance
// uitlezen, dus die analyseren we niet. `node scripts/check-universum.mjs` controleert allebei.
export const STANDAARD_UNIVERSUM = [
  'BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ETC',
  'ADA', 'SOL', 'DOT', 'AVAX', 'ATOM', 'BNB', 'TRX', 'XLM',
  'ALGO', 'VET', 'HBAR', 'XTZ', 'NEAR', 'FTM', 'ICP', 'FLOW',
  'APT', 'SUI', 'INJ', 'SEI',
  'MATIC', 'OP', 'ARB',
  'LINK', 'UNI', 'AAVE', 'COMP', 'MKR', 'SNX', 'YFI', 'CRV', 'SUSHI',
  '1INCH', 'ZRX', 'GRT', 'ENJ', 'MANA', 'SAND',
  'AXS', 'CHZ', 'GALA', 'IMX',
  'DOGE', 'SHIB', 'PEPE',
  'FET', 'RNDR',
  'FIL', 'THETA', 'BAT',
  'TIA',
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

// Minimaal aantal candles voordat EMA50 en consorten iets betekenen.
export const MIN_CANDLES = EMA_LANG + 5;

// De scoring zelf, zonder netwerk. `candles` is de historie tot en met de candle die
// beoordeeld wordt; alles wat later komt bestaat voor deze functie niet. De backtest
// schuift daardoor gewoon een venster op (candles.slice(0, i + 1)) en kan per constructie
// niet in de toekomst kijken.
export function scoorCandles(
  symbool: string,
  candles: Candle[],
  bron: Trade['bron'],
  // De backtest zet de R/R-filter uit (minRR: 0) om te kunnen meten wat die filter ons kost:
  // presteren de afgewezen signalen beter of slechter dan de toegelaten? De app gebruikt de
  // default en gedraagt zich dus precies als voorheen.
  opties?: { minRR?: number },
): Trade | null {
  if (candles.length < MIN_CANDLES) return null;
  const minRR = opties?.minRR ?? MIN_RISK_REWARD;

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

  if (rr < minRR - 1e-9) return null;

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

export async function analyseerCoin(symbool: string): Promise<Trade | null> {
  const result = await haalData(symbool);
  if (!result) return null;
  return scoorCandles(symbool, result.candles, result.bron);
}

// ponytail: blokken van 6 i.p.v. een worker-pool. 57 coins x weight 2 = 114 van
// Binance' 6000/min, ruim binnen budget. Verhoog als de scan traag blijft aanvoelen.
const GELIJKTIJDIG = 6;

export async function analyseerMarkt(options?: {
  universum?: string[];
  topN?: number;
  onProgress?: (current: number, total: number, symbool: string) => void;
}): Promise<Trade[]> {
  const universum = options?.universum ?? STANDAARD_UNIVERSUM;
  const topN = options?.topN ?? 20;
  const resultaten: Trade[] = [];
  let klaar = 0;

  for (let i = 0; i < universum.length; i += GELIJKTIJDIG) {
    const blok = universum.slice(i, i + GELIJKTIJDIG);
    const uitkomsten = await Promise.all(
      blok.map(async sym => {
        try {
          const res = await analyseerCoin(sym);
          options?.onProgress?.(++klaar, universum.length, sym);
          return res;
        } catch {
          options?.onProgress?.(++klaar, universum.length, sym);
          return null;
        }
      }),
    );
    for (const res of uitkomsten) if (res) resultaten.push(res);
  }

  // Sorteer: HIGH CONVICTION eerst, dan op score, dan op R/R
  resultaten.sort((a, b) => {
    if (a.highConviction !== b.highConviction) return a.highConviction ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.rr - a.rr;
  });

  return resultaten.slice(0, topN);
}
