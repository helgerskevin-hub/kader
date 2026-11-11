// Kaders eigen stop en doel voor een coin, op verse dagcandles. Voor een kopie waarbij de trader
// zelf geen stop of doel zette: dan gaat Kaders kader mee, want een kopie zonder stop komt er niet.
import { haalData } from '../engine/marketData';
import { scoorCandles, splitsLopendeDag, metPlan } from '../engine/analyzer';
import { LABEL_KOOP_BEWEZEN } from '../engine/drempels';

export interface KaderNiveaus {
  koers: number;
  stop: number;
  doel: number;
}

export async function haalKaderNiveaus(symbool: string): Promise<KaderNiveaus | null> {
  try {
    const data = await haalData(symbool);
    if (!data) return null;
    // Hetzelfde plan als op de kaarten van Markt en Kansen: de score op de afgesloten dagen, stop
    // en doel op de koers van nu. minRR 0: ook een coin zonder signaal heeft een stop en doel nodig.
    const { gesloten, prijsNu } = data.bron === 'Binance'
      ? splitsLopendeDag(data.candles, Date.now())
      : { gesloten: data.candles, prijsNu: null };
    const ruw = scoorCandles(symbool, gesloten, data.bron, { minRR: 0 });
    const trade = ruw ? metPlan(ruw, prijsNu) : null;
    if (!trade || !(trade.prijs > 0) || !(trade.stopLoss > 0) || !(trade.takeProfit > 0)) return null;
    return { koers: trade.prijs, stop: trade.stopLoss, doel: trade.takeProfit };
  } catch {
    return null;
  }
}

// ---------- Kader-check voor een gekopieerde trade ----------
// Hoe Kader zelf over de coin denkt, naast wat de trader doet. Puur informatief: het verandert niets
// aan de kopie. Eerst uit de laatste marktanalyse (die heeft alle coins al gescoord), anders een
// eigen scoring op verse dagcandles (zonder R/R-drempel, zoals de analyse ook alle coins scoort), een
// half uur bewaard zodat de Feed niet bij elke render haalt. Een mislukte ophaalpoging maar twee minuten.

export interface KaderCheck {
  score: number;
  // Null zolang KOOP zich niet bewezen heeft (LABEL_KOOP_BEWEZEN): dan zegt Kader over een koop
  // niets, ook niet "geen koopsignaal". Anders wat de laatste analyse toonde.
  signaal: 'KOOP' | 'WATCH' | null;
  // De belangrijkste reden uit de analyse, zoals "opwaartse trend (EMA20>EMA50)", of null.
  reden: string | null;
}

const CHECK_TTL_MS = 30 * 60 * 1000;
const checkCache = new Map<string, { tijd: number; check: KaderCheck | null }>();

export function naarKaderCheck(t: { score: number; signaal: 'KOOP' | 'WATCH'; redenen: string[] }): KaderCheck {
  return { score: Math.round(t.score), signaal: LABEL_KOOP_BEWEZEN ? t.signaal : null, reden: t.redenen[0] ?? null };
}

export async function haalKaderCheck(symbool: string): Promise<KaderCheck | null> {
  const bekend = checkCache.get(symbool);
  if (bekend && Date.now() - bekend.tijd < (bekend.check ? CHECK_TTL_MS : 2 * 60 * 1000)) return bekend.check;
  let check: KaderCheck | null = null;
  try {
    const data = await haalData(symbool);
    // Op de afgesloten dagen, net als de marktanalyse, zodat de score hier dezelfde is. Een eigen
    // scoring kent het klimaat niet en geeft dus nooit een koopsignaal door.
    const basis = data && data.bron === 'Binance' ? splitsLopendeDag(data.candles, Date.now()).gesloten : data?.candles;
    const trade = data && basis ? scoorCandles(symbool, basis, data.bron, { minRR: 0 }) : null;
    check = trade ? naarKaderCheck({ ...trade, signaal: 'WATCH' }) : null;
  } catch {
    check = null;
  }
  checkCache.set(symbool, { tijd: Date.now(), check });
  return check;
}
