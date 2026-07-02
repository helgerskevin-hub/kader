import { Candle } from './types';

const BINANCE_BASES = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api.binance.us',
];

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', ADA: 'cardano', AVAX: 'avalanche-2', DOGE: 'dogecoin',
  LINK: 'chainlink', DOT: 'polkadot', MATIC: 'matic-network',
  LTC: 'litecoin', ATOM: 'cosmos', NEAR: 'near', ARB: 'arbitrum',
  OP: 'optimism', INJ: 'injective-protocol', SUI: 'sui',
  APT: 'aptos', TIA: 'celestia', RNDR: 'render-token',
  FET: 'fetch-ai', SEI: 'sei-network', AAVE: 'aave',
};

const EMA_LANG = 50;
const HTTP_TIMEOUT = 15_000;
const HEADERS = { 'Accept': 'application/json' };

async function httpGet<T = unknown>(url: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const fullUrl = params ? `${url}?${new URLSearchParams(params)}` : url;
    const res = await Promise.race([
      fetch(fullUrl, { headers: HEADERS }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), HTTP_TIMEOUT)),
    ]) as Response;
    if (res.ok) return res.json() as Promise<T>;
    return null;
  } catch {
    return null;
  }
}

function parseBinanceKlines(data: unknown[][]): Candle[] {
  return data.map(row => ({
    open: parseFloat(row[1] as string),
    high: parseFloat(row[2] as string),
    low: parseFloat(row[3] as string),
    close: parseFloat(row[4] as string),
    volume: parseFloat(row[5] as string),
  })).filter(c => !isNaN(c.close));
}

export async function haalBinanceKlines(
  symbool: string,
  interval = '1d',
  limit = 200,
): Promise<Candle[] | null> {
  const pair = `${symbool}USDT`;
  for (const base of BINANCE_BASES) {
    const data = await httpGet<unknown[][]>(`${base}/api/v3/klines`, {
      symbol: pair, interval, limit: String(limit),
    });
    if (Array.isArray(data) && data.length > EMA_LANG) {
      const candles = parseBinanceKlines(data);
      if (candles.length > EMA_LANG) return candles;
    }
  }
  return null;
}

export async function haalCoingeckoOhlc(symbool: string, days = 30): Promise<Candle[] | null> {
  const cgId = COINGECKO_IDS[symbool];
  if (!cgId) return null;
  const data = await httpGet<number[][]>(`${COINGECKO_BASE}/coins/${cgId}/ohlc`, {
    vs_currency: 'usd', days: String(days),
  });
  if (!Array.isArray(data) || data.length <= EMA_LANG) return null;
  return data.map(row => ({
    open: row[1], high: row[2], low: row[3], close: row[4], volume: 0,
  }));
}

export async function haalData(symbool: string): Promise<{ candles: Candle[]; bron: string } | null> {
  const binance = await haalBinanceKlines(symbool);
  if (binance && binance.length > EMA_LANG) return { candles: binance, bron: 'Binance' };
  const cg = await haalCoingeckoOhlc(symbool);
  if (cg && cg.length > EMA_LANG) return { candles: cg, bron: 'CoinGecko (fallback)' };
  return null;
}

export async function haalCoingeckoMarkten(perPage = 250): Promise<Record<string, unknown>[]> {
  const data = await httpGet<Record<string, unknown>[]>(
    `${COINGECKO_BASE}/coins/markets`,
    {
      vs_currency: 'usd', order: 'market_cap_desc',
      per_page: String(perPage), page: '1',
      price_change_percentage: '24h,7d,30d',
    },
  );
  return Array.isArray(data) ? data : [];
}

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function haalLaatstePrijs(symbool: string): Promise<number | null> {
  const pair = `${symbool}USDT`;
  for (const base of BINANCE_BASES) {
    const data = await httpGet<{ price: string }>(`${base}/api/v3/ticker/price`, { symbol: pair });
    if (data && typeof data.price === 'string') {
      const prijs = parseFloat(data.price);
      if (!isNaN(prijs) && prijs > 0) return prijs;
    }
  }
  const candles = await haalBinanceKlines(symbool, '1d', 2);
  if (candles && candles.length > 0) return candles[candles.length - 1].close;
  return null;
}

export async function haalLaatstePrijzen(symbolen: string[]): Promise<Record<string, number>> {
  const resultaat: Record<string, number> = {};
  await Promise.all(
    symbolen.map(async sym => {
      const prijs = await haalLaatstePrijs(sym);
      if (prijs !== null) resultaat[sym] = prijs;
    }),
  );
  return resultaat;
}

export async function haalFearGreed(): Promise<{ waarde: number; klasse: string } | null> {
  const data = await httpGet<{ data: { value: string; value_classification: string }[] }>(
    'https://api.alternative.me/fng/',
  );
  const eerste = data?.data?.[0];
  if (!eerste) return null;
  const waarde = parseInt(eerste.value, 10);
  if (isNaN(waarde)) return null;
  return { waarde, klasse: eerste.value_classification };
}
