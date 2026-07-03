export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tijd?: number;
}

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

export interface Opportunity {
  symbool: string;
  naam: string;
  rang: number;
  marktcap: number;
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
  kansScore: number;
}

export interface ConsistentieAnalyse {
  score: number;
  positiefPct: number;
  stdev: number;
  gemMaand: number;
  slechtsteManad: number;
  opmerking: string;
}

export interface RisicoAnalyse {
  score: number;
  jaarrendement: number;
  maxDrawdown: number;
  ratio: number;
  riskScore: number;
  opmerking: string;
}

export interface PortfolioAnalyse {
  score: number;
  grootstePositie: number;
  grootsteGroep: number;
  cash: number;
  groepConcentratie: Record<string, number>;
  opmerking: string;
}

export interface TraderInput {
  naam: string;
  maandrendementen: number[];
  maxDrawdown: number;
  jaarrendement?: number | null;
  riskScore: number;
  gemHoldtijdDagen?: number | null;
  portfolio: Record<string, number>;
}

export interface TraderAudit {
  naam: string;
  consistentie: ConsistentieAnalyse;
  risico: RisicoAnalyse;
  portfolio: PortfolioAnalyse;
  totaalscore: number;
  oordeel: 'GROEN' | 'GEEL' | 'ROOD';
  kleur: 'green' | 'yellow' | 'red';
  csl: number;
}

export interface KoopAdvies {
  label: string;
  kleur: 'groen' | 'oranje' | 'rood';
  uitleg: string;
}

export interface CoinInfo {
  naam: string;
  categorie: string;
  wat: string;
}
