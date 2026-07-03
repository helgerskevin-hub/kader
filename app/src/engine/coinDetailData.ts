import { Candle, Trade, Opportunity } from './types';
import { PortfolioTrade } from '../state/portfolioTypes';
import { infoVoor } from './coinInfo';
import { rsi, ema, macd, atr } from './indicators';

export type CoinDetailContext = 'markt' | 'kansen' | 'portfolio';

export interface CoinDetailData {
  symbool: string;
  naam: string;
  context: CoinDetailContext;
  prijs?: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  rr?: number;
  score?: number | null;
  // alleen relevant voor context 'portfolio'
  entryPrijs?: number;
  bedragUsd?: number;
  aantalCoins?: number;
  status?: 'open' | 'gewonnen' | 'verloren';
  notitie?: string;
  exitPrijs?: number;
  slotDatum?: string;
}

export function vanTrade(trade: Trade): CoinDetailData {
  return {
    symbool: trade.symbool,
    naam: infoVoor(trade.symbool).naam,
    context: 'markt',
    prijs: trade.prijs,
    entry: trade.entry,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    rr: trade.rr,
    score: trade.score,
  };
}

export function vanOpportunity(kans: Opportunity): CoinDetailData {
  return {
    symbool: kans.symbool,
    naam: kans.naam || infoVoor(kans.symbool).naam,
    context: 'kansen',
    prijs: kans.prijs,
    entry: kans.heeftTechnisch ? kans.entry : undefined,
    stopLoss: kans.heeftTechnisch ? kans.stopLoss : undefined,
    takeProfit: kans.heeftTechnisch ? kans.takeProfit : undefined,
    rr: kans.heeftTechnisch ? kans.rr : undefined,
    score: null,
  };
}

export function vanPortfolioTrade(trade: PortfolioTrade, livePrijs?: number): CoinDetailData {
  return {
    symbool: trade.symbool,
    naam: trade.naam || infoVoor(trade.symbool).naam,
    context: 'portfolio',
    prijs: livePrijs,
    entry: trade.entryPrijs,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    rr: trade.rr,
    score: null,
    entryPrijs: trade.entryPrijs,
    bedragUsd: trade.bedragUsd,
    aantalCoins: trade.aantalCoins,
    status: trade.status,
    notitie: trade.notitie,
    exitPrijs: trade.exitPrijs,
    slotDatum: trade.slotDatum,
  };
}

export interface VerseIndicatoren {
  rsi: number;
  ema20: number;
  ema50: number;
  macdBullish: boolean;
  volumeRatio: number;
  atr: number;
  trendOp: boolean;
}

const EMA_LANG = 50;
const VOLUME_GEMIDDELDE_PERIODE = 20;

// Herberekent RSI/EMA/MACD/ATR/volume rechtstreeks uit verse candles, zodat het
// detailscherm altijd actuele indicatoren toont, ongeacht of de bron (Trade,
// Opportunity of PortfolioTrade) die zelf al meelevert.
export function berekenVerseIndicatoren(candles: Candle[]): VerseIndicatoren | null {
  if (candles.length <= EMA_LANG) return null;
  const close = candles.map(c => c.close);
  const n = close.length;

  const rsiWaarden = rsi(close, 14);
  const ema20Waarden = ema(close, 20);
  const ema50Waarden = ema(close, EMA_LANG);
  const { macdLine, signalLine } = macd(close);
  const atrWaarden = atr(candles, 14);

  const recent = candles.slice(-VOLUME_GEMIDDELDE_PERIODE);
  const volGem = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
  const volNu = candles[n - 1].volume;
  const volumeRatio = volGem > 0 ? volNu / volGem : 1.0;

  const ema20Nu = ema20Waarden[n - 1];
  const ema50Nu = ema50Waarden[n - 1];

  return {
    rsi: rsiWaarden[n - 1],
    ema20: ema20Nu,
    ema50: ema50Nu,
    macdBullish: macdLine[n - 1] > signalLine[n - 1],
    volumeRatio,
    atr: atrWaarden[n - 1],
    trendOp: ema20Nu > ema50Nu,
  };
}
