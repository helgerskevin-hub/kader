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

// Long of short. Woont hier en niet in state/portfolioTypes, want het is een eigenschap van de
// analyse zelf: de engine bepaalt de richting, het portfolio neemt hem over. portfolioTypes
// exporteert hem door, zodat bestaande imports blijven werken.
export type Richting = 'long' | 'short';

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
  // Haalt deze coin de minimale risk/reward (MIN_RISK_REWARD)? Zo niet, dan blijft de analyse
  // gewoon zichtbaar maar wordt het signaal nooit KOOP. Vroeger liet scoorCandles zo'n coin
  // helemaal vallen, waardoor de Markt in een brede markt een leeg scherm gaf zonder uitleg.
  voldoetAanRR: boolean;
  // Long of short. Zonder dit veld is een short niet van een long te onderscheiden zodra ze in
  // dezelfde lijst staan, en dan leest elke long-aanname de niveaus verkeerd: bij een short ligt
  // stopLoss BOVEN entry en takeProfit eronder.
  richting: Richting;
  // Met welk scoreprofiel deze trade is gescoord. Score, niveaus en redenen betekenen per profiel
  // iets anders, dus zonder dit veld valt een omkeer-trade niet van een momentum-trade te
  // onderscheiden zodra ze in dezelfde lijst staan.
  profiel: Scoreprofiel;
}

// Eén coin op de momentum-radar van het Kansen-scherm, zie engine/opportunities.ts.
export interface Opportunity {
  symbool: string;
  naam: string;
  // Uit CoinGecko, als aanvulling. Null als die niet bereikbaar was of de coin niet kende.
  marktcap: number | null;
  prijs: number;
  // 0-100, alleen de nabijheid tot de 90-dagen-high (zie momentumScore in momentum.ts).
  momentumScore: number;
  ingredienten: MomentumIngredienten;
  redenen: string[];
  // De laatste ~30 slotkoersen, oudste eerst.
  sparkline: number[];
  // KOOP vraagt R/R >= MIN_RISK_REWARD op de radar-niveaus én trade.score >= DREMPEL_KOOP.
  signaal: 'KOOP' | 'WATCH';
  // Het uitbraak-plan (stop op EMA20, doel boven de 90d-high), NIET de niveaus uit trade. Null als
  // de koers niet boven zijn EMA20 staat: dan is er geen plan en dus geen Koop-knop.
  niveaus: RadarNiveaus | null;
  voldoetAanRR: boolean;
  // Het volledige scoorCandles-resultaat, voor RSI, trend, MACD en de technische score. Let op:
  // de niveaus hierin zijn die van de Markt en horen niet op de Kansen-kaart.
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
