import type { MomentumIngredienten, RadarNiveaus } from './momentum';

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tijd?: number;
}

// Welk scoreprofiel een trade heeft opgeleverd. 'momentum' is het oorspronkelijke profiel dat
// opwaartse trend en kracht beloont; 'omkeer' is het mean-reversion-profiel voor een dalende
// markt, waarin momentum per constructie niets vindt.
export type Scoreprofiel = 'momentum' | 'omkeer';

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
  // Wat de kaart toont. Alleen KOOP als het label bewezen is (LABEL_KOOP_BEWEZEN in drempels.ts);
  // anders altijd WATCH, ook bij een hoge score en een gunstig klimaat.
  signaal: 'KOOP' | 'WATCH';
  // Idem voor STERK KOOP en BEVESTIGD (LABEL_STERK_BEWEZEN).
  highConviction: boolean;
  // Wat de score en het klimaat zeggen, los van of het label getoond mag worden. Alleen gezet door
  // analyseerMarkt. Het signaalboek volgt dit, zodat een label zich live kan bewijzen.
  ruwSignaal?: 'KOOP' | 'WATCH';
  ruwHighConviction?: boolean;
  // Haalt deze coin de minimale risk/reward (MIN_RISK_REWARD)? Zo niet, dan blijft de analyse
  // gewoon zichtbaar maar wordt het signaal nooit KOOP. Vroeger liet scoorCandles zo'n coin
  // helemaal vallen, waardoor de Markt in een brede markt een leeg scherm gaf zonder uitleg.
  voldoetAanRR: boolean;
  // Met welk scoreprofiel deze trade is gescoord. Score, niveaus en redenen betekenen per profiel
  // iets anders, dus zonder dit veld valt een omkeer-trade niet van een momentum-trade te
  // onderscheiden zodra ze in dezelfde lijst staan.
  profiel: Scoreprofiel;
  // De laatste 31 dagcloses, oudste eerst: de grafiek op de Markt-kaart en de 30D-verandering
  // (eerste tegen laatste punt). Optioneel, want niet elke plek die een Trade bouwt heeft candles.
  sparkline?: number[];
}

// Eén coin op de momentum-radar van het Kansen-scherm, zie engine/opportunities.ts. Een volglijst:
// er hoort geen koopsignaal bij (zie meting M in momentum.ts).
export interface Opportunity {
  symbool: string;
  naam: string;
  // Uit CoinGecko, als aanvulling. Null als die niet bereikbaar was of de coin niet kende.
  marktcap: number | null;
  // De koers van nu. Score en ingrediënten hieronder komen van de laatste AFGESLOTEN dag.
  prijs: number;
  // Hoeveel de koers van nu afwijkt van het slot van die afgesloten dag, in procenten. Verklaart
  // op de kaart waarom de prijs en "x% onder de top" uit elkaar kunnen lopen. Null zonder koers
  // van nu; ontbreekt in een scan die voor dit veld bewaard is.
  vandaagPct?: number | null;
  // 0-100, alleen de nabijheid tot de 90-dagen-high (zie momentumScore in momentum.ts).
  momentumScore: number;
  ingredienten: MomentumIngredienten;
  redenen: string[];
  // De laatste ~30 slotkoersen, oudste eerst, met de koers van nu als laatste punt.
  sparkline: number[];
  // Het plan (stop 3x ATR onder de koers, doel op 3R), NIET de niveaus uit trade. Null zonder
  // bruikbare ATR.
  niveaus: RadarNiveaus | null;
  // Het volledige scoorCandles-resultaat, voor RSI, trend, MACD en de technische score. Let op:
  // de niveaus en de prijs hierin zijn die van de afgesloten dag en horen niet op de Kansen-kaart.
  trade: Trade;
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
