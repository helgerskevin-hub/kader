import { Candle } from './types';

// EWM with adjust=False — spiegelt pandas ewm(adjust=False)
// Seeded at values[0], alpha opgegeven als argument.
function _ewm(values: number[], alpha: number): number[] {
  if (values.length === 0) return [];
  const out: number[] = [values[0]];
  const beta = 1 - alpha;
  for (let i = 1; i < values.length; i++) {
    out.push(alpha * values[i] + beta * out[i - 1]);
  }
  return out;
}

// RSI — port van bereken_rsi(close, 14)
// ewm(alpha=1/period, min_periods=period, adjust=False), fillna(50)
export function rsi(close: number[], period = 14): number[] {
  const n = close.length;
  const result = new Array<number>(n).fill(50);
  if (n < 2) return result;

  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < n; i++) {
    const d = close[i] - close[i - 1];
    gains.push(Math.max(0, d));
    losses.push(Math.max(0, -d));
  }

  const alpha = 1 / period;
  const avgGains = _ewm(gains, alpha);
  const avgLosses = _ewm(losses, alpha);

  for (let i = period; i < n; i++) {
    const l = avgLosses[i];
    if (l === 0) {
      result[i] = avgGains[i] === 0 ? 50 : 100;
    } else {
      result[i] = 100 - 100 / (1 + avgGains[i] / l);
    }
  }
  return result;
}

// EMA — port van bereken_ema(close, span)
// ewm(span=N, adjust=False) => alpha = 2/(N+1)
export function ema(close: number[], span: number): number[] {
  return _ewm(close, 2 / (span + 1));
}

// MACD — port van bereken_macd(close, 12, 26, 9)
export function macd(
  close: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const emaFast = ema(close, fast);
  const emaSlow = ema(close, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = _ewm(macdLine, 2 / (signal + 1));
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

// ATR — port van bereken_atr(df, 14)
// TR = max(high-low, |high-prevClose|, |low-prevClose|)
// ATR = ewm(alpha=1/period, adjust=False)
export function atr(candles: Candle[], period = 14): number[] {
  const n = candles.length;
  if (n === 0) return [];
  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low;
    const hpc = Math.abs(candles[i].high - candles[i - 1].close);
    const lpc = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(hl, hpc, lpc));
  }
  return _ewm(tr, 1 / period);
}
