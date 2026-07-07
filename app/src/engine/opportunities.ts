import { Opportunity } from './types';
import { haalData, haalCoingeckoMarkten, delay } from './marketData';
import { rsi as berekenRsi, ema as berekenEma, macd as berekenMacd, atr as berekenAtr } from './indicators';
import { REWARD_MULTIPLIER, ATR_PERIODE, EMA_KORT, EMA_LANG, RSI_PERIODE, stopAfstandStructuur } from './analyzer';

const UITSLUITEN = new Set([
  'USDT', 'USDC', 'DAI', 'TUSD', 'FDUSD', 'USDE', 'PYUSD', 'USDD', 'BUSD',
  'GUSD', 'FRAX', 'LUSD', 'USDS', 'USD0', 'WBTC', 'WETH', 'STETH', 'WSTETH',
  'WEETH', 'WBETH', 'RETH', 'CBETH', 'BSC-USD', 'SOLVBTC', 'LBTC',
]);

// Cryptos die verhandelbaar zijn op eToro (NL/EU). Controleer etoro.com voor updates.
export const ETORO_TRADABLE = new Set([
  'BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ETC',
  'ADA', 'SOL', 'DOT', 'AVAX', 'ATOM', 'BNB', 'TRX', 'XLM',
  'ALGO', 'VET', 'HBAR', 'XTZ', 'NEAR', 'FTM', 'ICP', 'FLOW',
  'APT', 'SUI', 'TON', 'INJ', 'SEI',
  'MATIC', 'OP', 'ARB',
  'LINK', 'UNI', 'AAVE', 'COMP', 'MKR', 'SNX', 'YFI', 'CRV', 'SUSHI',
  '1INCH', 'ZRX', 'GRT', 'ENJ', 'MANA', 'SAND',
  'AXS', 'CHZ', 'GALA', 'IMX',
  'DOGE', 'SHIB', 'PEPE',
  'FET', 'RNDR',
  'FIL', 'THETA', 'BAT',
]);

function kansScore(c: Record<string, unknown>): number {
  const p7 = (c['price_change_percentage_7d_in_currency'] as number) ?? 0;
  const p30 = (c['price_change_percentage_30d_in_currency'] as number) ?? 0;
  const p24 = (c['price_change_percentage_24h_in_currency'] as number) ?? 0;
  const vol = (c['total_volume'] as number) ?? 0;
  const mcap = (c['market_cap'] as number) ?? 1;
  const rank = (c['market_cap_rank'] as number) ?? 999;
  const athChg = (c['ath_change_percentage'] as number) ?? 0;

  let score = 0;
  score += Math.max(Math.min(p7, 40), -20) * 1.2;
  score += Math.max(Math.min(p30, 80), -30) * 0.5;
  const volratio = mcap ? vol / mcap : 0;
  score += Math.min(volratio * 100, 25);
  if (athChg < 0) score += Math.min(Math.abs(athChg) * 0.15, 20);
  if (rank > 50) score += 10;
  if (rank > 120) score += 5;
  if (p24 > 35) score -= 25;
  else if (p24 > 20) score -= 10;
  return score;
}

function waaromKans(c: Record<string, unknown>): string[] {
  const p7 = (c['price_change_percentage_7d_in_currency'] as number) ?? 0;
  const p30 = (c['price_change_percentage_30d_in_currency'] as number) ?? 0;
  const vol = (c['total_volume'] as number) ?? 0;
  const mcap = (c['market_cap'] as number) ?? 1;
  const rank = (c['market_cap_rank'] as number) ?? 999;
  const athChg = (c['ath_change_percentage'] as number) ?? 0;
  const r: string[] = [];
  if (p7 >= 12) r.push(`sterk momentum: +${p7.toFixed(0)}% in 7 dagen`);
  else if (p7 >= 4) r.push(`opwaarts: +${p7.toFixed(0)}% in 7 dagen`);
  if (p30 >= 25) r.push(`+${p30.toFixed(0)}% over 30 dagen — trend intact`);
  if (mcap && vol / mcap >= 0.12) r.push('hoge handelsactiviteit t.o.v. marktcap (groeiende interesse)');
  if (athChg <= -55) r.push(`${Math.abs(athChg).toFixed(0)}% onder all-time high — veel herstelruimte`);
  if (rank >= 60) r.push(`kleinere marktcap (#${rank}) — meer ruimte om te groeien`);
  if (r.length === 0) r.push('solide combinatie van momentum, liquiditeit en marktpositie');
  return r;
}

async function kansNiveaus(symbool: string, prijsFallback: number): Promise<Omit<Opportunity, 'symbool' | 'naam' | 'rang' | 'marktcap' | 'p24' | 'p7' | 'p30' | 'redenen' | 'kansScore'>> {
  const result = await haalData(symbool);
  // EMA50/MACD hebben genoeg candles nodig om te settelen (net als analyseerCoin: EMA_LANG + 5)
  if (result && result.candles.length > EMA_LANG + 5) {
    const { candles } = result;
    const close = candles.map(c => c.close);
    const prijs = close[close.length - 1];
    const atrArr = berekenAtr(candles, ATR_PERIODE);
    let atrVal = atrArr[atrArr.length - 1];
    if (isNaN(atrVal) || atrVal <= 0) atrVal = prijs * 0.04;
    const ema20 = berekenEma(close, EMA_KORT);
    const ema50 = berekenEma(close, EMA_LANG);
    const { macdLine, signalLine } = berekenMacd(close);
    const n = close.length;
    const stopAfstand = stopAfstandStructuur(candles, prijs, atrVal);
    const stop = prijs - stopAfstand;
    const tp = prijs + REWARD_MULTIPLIER * atrVal;
    const rr = Math.round(((tp - prijs) / stopAfstand) * 10) / 10;
    return {
      prijs, entry: prijs, stopLoss: stop, takeProfit: tp, rr,
      rsi: Math.round(berekenRsi(close, RSI_PERIODE)[n - 1]),
      trendOp: ema20[n - 1] > ema50[n - 1],
      macdBullish: macdLine[n - 1] > signalLine[n - 1],
      methode: 'ATR (candle-data)', heeftTechnisch: true,
    };
  }
  const prijs = prijsFallback || 0;
  return {
    prijs, entry: prijs,
    stopLoss: prijs * 0.875, takeProfit: prijs * 1.25, rr: 2.0,
    rsi: null, trendOp: null, macdBullish: null,
    methode: 'richtlijn (−12,5% / +25%)', heeftTechnisch: false,
  };
}

export async function zoekKansen(
  topN = 10,
  onProgress?: (gescand: number, totaal: number) => void,
  alleenEtoro = true,
): Promise<Opportunity[]> {
  const markten = await haalCoingeckoMarkten();
  const kandidaten: Array<Record<string, unknown> & { _score: number }> = [];

  for (const c of markten) {
    const sym = ((c['symbol'] as string) ?? '').toUpperCase();
    const rank = (c['market_cap_rank'] as number) ?? 999;
    const vol = (c['total_volume'] as number) ?? 0;
    if (!sym || UITSLUITEN.has(sym)) continue;
    if (alleenEtoro && !ETORO_TRADABLE.has(sym)) continue;
    if (rank < 12 || rank > 260) continue;
    if (vol < 15_000_000) continue;
    kandidaten.push({ ...c, _score: kansScore(c) });
  }

  kandidaten.sort((a, b) => b._score - a._score);

  const resultaten: Opportunity[] = [];
  for (let i = 0; i < kandidaten.length; i++) {
    if (resultaten.length >= topN) break;
    const c = kandidaten[i];
    const sym = ((c['symbol'] as string) ?? '').toUpperCase();
    onProgress?.(i + 1, kandidaten.length);
    const niveaus = await kansNiveaus(sym, c['current_price'] as number);
    resultaten.push({
      symbool: sym,
      naam: (c['name'] as string) ?? sym,
      rang: c['market_cap_rank'] as number,
      marktcap: c['market_cap'] as number,
      p24: Math.round(((c['price_change_percentage_24h_in_currency'] as number) ?? 0) * 10) / 10,
      p7: Math.round(((c['price_change_percentage_7d_in_currency'] as number) ?? 0) * 10) / 10,
      p30: Math.round(((c['price_change_percentage_30d_in_currency'] as number) ?? 0) * 10) / 10,
      redenen: waaromKans(c),
      kansScore: Math.round(c._score),
      ...niveaus,
    });
    if (i < kandidaten.length - 1) await delay(200);
  }
  return resultaten;
}
