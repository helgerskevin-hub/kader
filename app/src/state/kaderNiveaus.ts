// Kaders eigen stop en doel voor een coin, op verse dagcandles. Voor een kopie waarbij de trader
// zelf geen stop of doel zette: dan gaat Kaders kader mee, want een kopie zonder stop komt er niet.
import { haalData } from '../engine/marketData';
import { scoorCandles } from '../engine/analyzer';

export interface KaderNiveaus {
  koers: number;
  stop: number;
  doel: number;
}

export async function haalKaderNiveaus(symbool: string): Promise<KaderNiveaus | null> {
  try {
    const data = await haalData(symbool);
    if (!data) return null;
    // minRR 0: ook een coin die nu geen koopsignaal geeft heeft een stop en doel nodig.
    const trade = scoorCandles(symbool, data.candles, data.bron, { minRR: 0 });
    if (!trade || !(trade.prijs > 0) || !(trade.stopLoss > 0) || !(trade.takeProfit > 0)) return null;
    return { koers: trade.prijs, stop: trade.stopLoss, doel: trade.takeProfit };
  } catch {
    return null;
  }
}
