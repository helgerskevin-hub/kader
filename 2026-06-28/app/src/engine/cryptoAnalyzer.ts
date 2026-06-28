// Exact port of src/crypto_analyzer.py — same math, same logic, same output shape.

export interface Trade {
  symbool: string;
  bron: string;
  prijs: number;
  entry: number;
  entryLaag: number;
  entryHoog: number;
  stopLoss: number;
  takeProfit: number;
  rr: number;
  atr: number;
  rsi: number;
  ema20: number;
  ema50: number;
  macdBullish: boolean;
  volumeRatio: number;
  score: number;
  redenen: string[];
  signaal: 'KOOP' | 'WATCH';
  highConviction: boolean;
}

export interface Kans {
  symbool: string;
  naam: string;
  rang: number | null;
  marktcap: number | null;
  p24: number;
  p7: number;
  p30: number;
  redenen: string[];
  prijs: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  rr: number;
  rsi: number | null;
  trendOp: boolean | null;
  macdBullish: boolean | null;
  methode: string;
  heeftTechnisch: boolean;
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ---------------------------------------------------------------------------
// Config (mirrors Python constants)
// ---------------------------------------------------------------------------
const STANDAARD_UNIVERSUM = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE',
  'LINK', 'DOT', 'MATIC', 'LTC', 'ATOM', 'NEAR', 'ARB', 'OP',
  'INJ', 'SUI', 'APT', 'TIA', 'RNDR', 'FET', 'SEI', 'AAVE',
];

const BINANCE_BASES = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
];

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', ADA: 'cardano', AVAX: 'avalanche-2', DOGE: 'dogecoin',
  LINK: 'chainlink', DOT: 'polkadot', MATIC: 'matic-network',
  LTC: 'litecoin', ATOM: 'cosmos', NEAR: 'near', ARB: 'arbitrum',
  OP: 'optimism', INJ: 'injective-protocol', SUI: 'sui',
  APT: 'aptos', TIA: 'celestia', RNDR: 'render-token',
  FET: 'fetch-ai', SEI: 'sei-network', AAVE: 'aave',
};

const RSI_PERIODE = 14;
const EMA_KORT = 20;
const EMA_LANG = 50;
const ATR_PERIODE = 14;
const VOLUME_GEMIDDELDE_PERIODE = 20;
const ATR_STOP_MULTIPLIER = 1.5;
const REWARD_MULTIPLIER = 3.0;
const HIGH_CONVICTION_SCORE = 75;
const HTTP_TIMEOUT = 15000;

const UITSLUITEN = new Set([
  'USDT', 'USDC', 'DAI', 'TUSD', 'FDUSD', 'USDE', 'PYUSD', 'USDD', 'BUSD',
  'GUSD', 'FRAX', 'LUSD', 'USDS', 'USD0', 'WBTC', 'WETH', 'STETH', 'WSTETH',
  'WEETH', 'WBETH', 'RETH', 'CBETH', 'SOLVBTC', 'LBTC',
]);

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
async function httpGet<T = unknown>(url: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT);
    const res = await fetch(url + qs, {
      headers: { 'User-Agent': 'kader-app/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) return res.json() as Promise<T>;
  } catch {
    // network error or timeout — fall through
  }
  return null;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
async function haalBinanceKlines(symbool: string, limit = 200): Promise<Candle[] | null> {
  const pair = `${symbool}USDT`;
  for (const base of BINANCE_BASES) {
    const data = await httpGet<unknown[]>(`${base}/api/v3/klines`, {
      symbol: pair, interval: '1d', limit: String(limit),
    });
    if (!Array.isArray(data) || data.length <= EMA_LANG) continue;
    const candles: Candle[] = (data as unknown[][]).map((row) => ({
      open:   parseFloat(String(row[1])),
      high:   parseFloat(String(row[2])),
      low:    parseFloat(String(row[3])),
      close:  parseFloat(String(row[4])),
      volume: parseFloat(String(row[5])),
    })).filter(c => !isNaN(c.open) && !isNaN(c.close));
    if (candles.length > EMA_LANG) return candles;
  }
  return null;
}

async function haalCoinGeckoOhlc(symbool: string, days = 30): Promise<Candle[] | null> {
  const cgId = COINGECKO_IDS[symbool];
  if (!cgId) return null;
  const data = await httpGet<number[][]>(`${COINGECKO_BASE}/coins/${cgId}/ohlc`, {
    vs_currency: 'usd', days: String(days),
  });
  if (!Array.isArray(data) || data.length <= EMA_LANG) return null;
  return data.map((row) => ({
    open: row[1], high: row[2], low: row[3], close: row[4], volume: 0,
  }));
}

async function haalData(symbool: string): Promise<{ candles: Candle[]; bron: string } | null> {
  const binance = await haalBinanceKlines(symbool);
  if (binance && binance.length > EMA_LANG) return { candles: binance, bron: 'Binance' };
  const cg = await haalCoinGeckoOhlc(symbool);
  if (cg && cg.length > EMA_LANG) return { candles: cg, bron: 'CoinGecko (fallback)' };
  return null;
}

// ---------------------------------------------------------------------------
// Indicators (exact match of Python ewm(alpha=1/n, adjust=False, min_periods=n))
// ---------------------------------------------------------------------------

// EWM with alpha, adjust=False. Returns NaN for indices < minPeriods-1.
function ewm(values: number[], alpha: number, minPeriods: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  let acc = 0;
  for (let i = 0; i < values.length; i++) {
    acc = i === 0 ? values[i] : (1 - alpha) * acc + alpha * values[i];
    if (i >= minPeriods - 1) result[i] = acc;
  }
  return result;
}

// EMA with span (alpha = 2/(span+1)), adjust=False
function ema(close: number[], span: number): number[] {
  const alpha = 2 / (span + 1);
  const result: number[] = new Array(close.length).fill(NaN);
  let acc = close[0];
  for (let i = 0; i < close.length; i++) {
    acc = i === 0 ? close[i] : (1 - alpha) * acc + alpha * close[i];
    result[i] = acc;
  }
  return result;
}

export function berekenRsi(close: number[], periode = RSI_PERIODE): number[] {
  const delta = close.map((v, i) => i === 0 ? 0 : v - close[i - 1]);
  const winst  = delta.map(d => Math.max(d, 0));
  const verlies = delta.map(d => Math.max(-d, 0));
  const alpha = 1 / periode;
  const avgW = ewm(winst,  alpha, periode);
  const avgL = ewm(verlies, alpha, periode);
  return avgW.map((w, i) => {
    if (isNaN(w)) return 50;
    const l = avgL[i];
    if (l === 0) return 100;
    return 100 - 100 / (1 + w / l);
  });
}

export function berekenEma(close: number[], span: number): number[] {
  return ema(close, span);
}

export function berekenMacd(close: number[], snel = 12, traag = 26, signaal = 9): { macd: number[]; signaal: number[]; histogram: number[] } {
  const emaSnel  = ema(close, snel);
  const emaTraag = ema(close, traag);
  const macdLijn = macdLijn_(emaSnel, emaTraag);
  const sigLijn  = ema(macdLijn, signaal);
  const hist     = macdLijn.map((v, i) => v - sigLijn[i]);
  return { macd: macdLijn, signaal: sigLijn, histogram: hist };
}

function macdLijn_(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

export function berekenAtr(candles: Candle[], periode = ATR_PERIODE): number[] {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
  return ewm(tr, 1 / periode, periode);
}

// ---------------------------------------------------------------------------
// Per-coin analysis
// ---------------------------------------------------------------------------
export async function analyseerCoin(symbool: string): Promise<Trade | null> {
  const result = await haalData(symbool);
  if (!result || result.candles.length < EMA_LANG + 5) return null;
  const { candles, bron } = result;
  const close = candles.map(c => c.close);
  const last = close.length - 1;
  const prijs = close[last];

  const rsiArr  = berekenRsi(close);
  const ema20   = berekenEma(close, EMA_KORT);
  const ema50   = berekenEma(close, EMA_LANG);
  const { macd, signaal: sig, histogram } = berekenMacd(close);
  const atrArr  = berekenAtr(candles);

  const rsiNu    = rsiArr[last];
  const ema20Nu  = ema20[last];
  const ema50Nu  = ema50[last];
  const macdNu   = macd[last];
  const sigNu    = sig[last];
  const histNu   = histogram[last];
  const atrNu    = isNaN(atrArr[last]) ? prijs * 0.03 : atrArr[last];

  const totalVol = candles.reduce((s, c) => s + c.volume, 0);
  let volumeRatio = 1.0;
  if (totalVol > 0) {
    const recent = candles.slice(-VOLUME_GEMIDDELDE_PERIODE);
    const volGem = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
    const volNu  = candles[last].volume;
    volumeRatio  = volGem > 0 ? volNu / volGem : 1.0;
  }

  let score = 0;
  const redenen: string[] = [];

  if (ema20Nu > ema50Nu) { score += 25; redenen.push('opwaartse trend (EMA20>EMA50)'); }
  if (prijs > ema20Nu)   { score += 15; redenen.push('prijs boven EMA20'); }
  if (rsiNu >= 45 && rsiNu <= 68) { score += 20; redenen.push(`RSI gezond (${Math.round(rsiNu)})`); }
  else if (rsiNu < 35)  { score += 10; redenen.push(`RSI oversold (${Math.round(rsiNu)}) - mogelijke bounce`); }
  if (macdNu > sigNu)   { score += 20; redenen.push('MACD bullish'); if (histNu > 0) score += 5; }
  if (volumeRatio >= 1.5)      { score += 15; redenen.push(`volume spike (${volumeRatio.toFixed(1)}x)`); }
  else if (volumeRatio >= 1.2) { score += 8;  redenen.push(`verhoogd volume (${volumeRatio.toFixed(1)}x)`); }

  score = Math.min(score, 100);

  const entry       = prijs;
  const risk        = ATR_STOP_MULTIPLIER * atrNu;
  const stopLoss    = entry - risk;
  const takeProfit  = entry + REWARD_MULTIPLIER * atrNu;
  const reward      = takeProfit - entry;
  const rr          = risk > 0 ? reward / risk : 0;
  const entryLaag   = entry - 0.2 * atrNu;
  const entryHoog   = entry + 0.2 * atrNu;

  const highConviction = score >= HIGH_CONVICTION_SCORE && ema20Nu > ema50Nu && macdNu > sigNu && volumeRatio >= 1.3;

  return {
    symbool, bron, prijs, entry, entryLaag, entryHoog, stopLoss, takeProfit,
    rr: Math.round(rr * 10) / 10, atr: atrNu, rsi: Math.round(rsiNu * 10) / 10,
    ema20: ema20Nu, ema50: ema50Nu, macdBullish: macdNu > sigNu, volumeRatio,
    score, redenen, signaal: score >= 55 ? 'KOOP' : 'WATCH', highConviction,
  };
}

export async function analyseerMarkt(
  universum: string[] = STANDAARD_UNIVERSUM,
  topN = 10,
  onVoortgang?: (symbool: string, i: number, totaal: number) => void,
): Promise<Trade[]> {
  const resultaten: Trade[] = [];
  for (let i = 0; i < universum.length; i++) {
    const sym = universum[i];
    onVoortgang?.(sym, i + 1, universum.length);
    try {
      const res = await analyseerCoin(sym);
      if (res) resultaten.push(res);
    } catch { /* skip */ }
    await delay(250);
  }
  resultaten.sort((a, b) => {
    if (a.highConviction !== b.highConviction) return a.highConviction ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.rr - a.rr;
  });
  return resultaten.slice(0, Math.max(5, topN));
}

// ---------------------------------------------------------------------------
// Grote-kansen scanner
// ---------------------------------------------------------------------------
interface CoinGeckoMarkt {
  symbol: string;
  name: string;
  market_cap_rank: number | null;
  market_cap: number | null;
  total_volume: number | null;
  current_price: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
  price_change_percentage_30d_in_currency: number | null;
  ath_change_percentage: number | null;
}

async function haalCoinGeckoMarkten(): Promise<CoinGeckoMarkt[]> {
  const data = await httpGet<CoinGeckoMarkt[]>(`${COINGECKO_BASE}/coins/markets`, {
    vs_currency: 'usd', order: 'market_cap_desc', per_page: '250', page: '1',
    price_change_percentage: '24h,7d,30d',
  });
  return Array.isArray(data) ? data : [];
}

function kansScore(c: CoinGeckoMarkt): number {
  const p7   = c.price_change_percentage_7d_in_currency ?? 0;
  const p30  = c.price_change_percentage_30d_in_currency ?? 0;
  const p24  = c.price_change_percentage_24h_in_currency ?? 0;
  const vol  = c.total_volume ?? 0;
  const mcap = c.market_cap ?? 1;
  const rank = c.market_cap_rank ?? 999;
  const ath  = c.ath_change_percentage ?? 0;

  let score = 0;
  score += Math.max(Math.min(p7, 40), -20) * 1.2;
  score += Math.max(Math.min(p30, 80), -30) * 0.5;
  score += Math.min((vol / mcap) * 100, 25);
  if (ath < 0) score += Math.min(Math.abs(ath) * 0.15, 20);
  if (rank > 50) score += 10;
  if (rank > 120) score += 5;
  if (p24 > 35) score -= 25;
  else if (p24 > 20) score -= 10;
  return score;
}

function waaromKans(c: CoinGeckoMarkt): string[] {
  const p7   = c.price_change_percentage_7d_in_currency ?? 0;
  const p30  = c.price_change_percentage_30d_in_currency ?? 0;
  const vol  = c.total_volume ?? 0;
  const mcap = c.market_cap ?? 1;
  const rank = c.market_cap_rank ?? 999;
  const ath  = c.ath_change_percentage ?? 0;
  const r: string[] = [];
  if (p7 >= 12) r.push(`sterk momentum: +${Math.round(p7)}% in 7 dagen`);
  else if (p7 >= 4) r.push(`opwaarts: +${Math.round(p7)}% in 7 dagen`);
  if (p30 >= 25) r.push(`+${Math.round(p30)}% over 30 dagen — trend intact`);
  if (mcap && vol / mcap >= 0.12) r.push('hoge handelsactiviteit t.o.v. marktcap (groeiende interesse)');
  if (ath <= -55) r.push(`${Math.round(Math.abs(ath))}% onder all-time high — veel herstelruimte`);
  if (rank >= 60) r.push(`kleinere marktcap (#${rank}) — meer ruimte om te groeien`);
  if (!r.length) r.push('solide combinatie van momentum, liquiditeit en marktpositie');
  return r;
}

async function kansNiveaus(symbool: string, prijsFallback: number): Promise<Omit<Kans, 'symbool' | 'naam' | 'rang' | 'marktcap' | 'p24' | 'p7' | 'p30' | 'redenen'>> {
  const result = await haalData(symbool);
  if (result && result.candles.length > ATR_PERIODE + 2) {
    const { candles } = result;
    const close = candles.map(c => c.close);
    const prijs = close[close.length - 1];
    const atrArr = berekenAtr(candles);
    let atr = atrArr[atrArr.length - 1];
    if (isNaN(atr) || atr <= 0) atr = prijs * 0.04;
    const ema20Arr = berekenEma(close, EMA_KORT);
    const ema50Arr = berekenEma(close, EMA_LANG);
    const { macd, signaal: sig } = berekenMacd(close);
    const rsiArr = berekenRsi(close);
    const stop = prijs - ATR_STOP_MULTIPLIER * atr;
    const tp   = prijs + REWARD_MULTIPLIER * atr;
    return {
      prijs, entry: prijs, stopLoss: stop, takeProfit: tp,
      rr: prijs > stop ? Math.round((tp - prijs) / (prijs - stop) * 10) / 10 : 2.0,
      rsi: Math.round(rsiArr[rsiArr.length - 1]),
      trendOp: ema20Arr[ema20Arr.length - 1] > ema50Arr[ema50Arr.length - 1],
      macdBullish: macd[macd.length - 1] > sig[sig.length - 1],
      methode: 'ATR (candle-data)', heeftTechnisch: true,
    };
  }
  const prijs = prijsFallback ?? 0;
  return {
    prijs, entry: prijs, stopLoss: prijs * 0.875, takeProfit: prijs * 1.25, rr: 2.0,
    rsi: null, trendOp: null, macdBullish: null,
    methode: 'richtlijn (−12,5% / +25%)', heeftTechnisch: false,
  };
}

export async function zoekKansen(topN = 10): Promise<Kans[]> {
  const markten = await haalCoinGeckoMarkten();
  const kandidaten = markten.filter(c => {
    const sym = (c.symbol ?? '').toUpperCase();
    const rank = c.market_cap_rank ?? 999;
    const vol  = c.total_volume ?? 0;
    return sym && !UITSLUITEN.has(sym) && rank >= 12 && rank <= 260 && vol >= 15_000_000;
  });
  kandidaten.sort((a, b) => kansScore(b) - kansScore(a));

  const resultaten: Kans[] = [];
  for (const c of kandidaten) {
    if (resultaten.length >= topN) break;
    const sym = (c.symbol ?? '').toUpperCase();
    const niveaus = await kansNiveaus(sym, c.current_price ?? 0);
    resultaten.push({
      symbool: sym,
      naam: c.name ?? sym,
      rang: c.market_cap_rank,
      marktcap: c.market_cap,
      p24: Math.round((c.price_change_percentage_24h_in_currency ?? 0) * 10) / 10,
      p7:  Math.round((c.price_change_percentage_7d_in_currency ?? 0) * 10) / 10,
      p30: Math.round((c.price_change_percentage_30d_in_currency ?? 0) * 10) / 10,
      redenen: waaromKans(c),
      ...niveaus,
    });
    await delay(200);
  }
  return resultaten;
}

// ---------------------------------------------------------------------------
// Price formatter (used by screens)
// ---------------------------------------------------------------------------
export function fmtPrijs(p: number | null | undefined): string {
  if (p == null) return '—';
  if (p >= 100) return '$' + p.toLocaleString('nl-NL', { maximumFractionDigits: 2 });
  if (p >= 1)   return '$' + p.toFixed(3);
  return '$' + p.toFixed(5);
}

// ---------------------------------------------------------------------------
// Live price (single ticker — no full candle analysis needed)
// ---------------------------------------------------------------------------
export async function haalLivePrijs(symbool: string): Promise<number | null> {
  const pair = `${symbool}USDT`;
  for (const base of BINANCE_BASES) {
    const data = await httpGet<{ price: string }>(`${base}/api/v3/ticker/price`, { symbol: pair });
    if (data && data.price) {
      const p = parseFloat(data.price);
      if (!isNaN(p)) return p;
    }
  }
  // CoinGecko fallback
  const cgId = COINGECKO_IDS[symbool];
  if (cgId) {
    const data = await httpGet<Record<string, { usd: number }>>(`${COINGECKO_BASE}/simple/price`, {
      ids: cgId, vs_currencies: 'usd',
    });
    if (data?.[cgId]?.usd) return data[cgId].usd;
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
