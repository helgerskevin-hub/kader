// Open risico: wat je verliest als al je stops tegelijk geraakt worden, als deel van je
// handelskapitaal. Per positie is dat (instap - huidige stop) * aantal. Een stop op of boven de instap
// is 0: die positie kan je geen inleg meer kosten. Een positie zonder stop heeft geen grens, en
// die tellen we apart in plaats van er een getal voor te verzinnen.
//
// Self-check onderaan: `npx tsx src/state/openRisico.ts` vanuit app/.

import type { PortfolioTrade } from './portfolioTypes';

// Boven dit deel van je kapitaal kleurt het open risico oranje. Bij 1% per trade zijn dat ongeveer
// vijf volle posities.
export const PLAFOND_PCT = 5;

export interface OpenRisico {
  risicoUsd: number;
  // Open posities met een stop onder de instap: die tellen mee in risicoUsd.
  metRisico: number;
  // Open posities waarvan de stop al op of boven de instap staat.
  zonderRisico: string[];
  // Open posities zonder stop: hun risico is onbegrensd en zit dus niet in risicoUsd.
  zonderStop: string[];
}

// `trades` uit PortfolioProvider hoort al bij de actieve omgeving, behalve handmatige trades. Die
// zijn geen speelgeld, dus in Demo tellen ze niet mee.
export function inOmgeving(t: PortfolioTrade, omgeving: 'real' | 'demo'): boolean {
  return omgeving === 'real' || t.bron === 'etoro';
}

function aantalVan(t: PortfolioTrade): number | null {
  if (typeof t.aantalCoins === 'number' && t.aantalCoins > 0) return t.aantalCoins;
  if (typeof t.bedragUsd === 'number' && t.bedragUsd > 0 && t.entryPrijs > 0) return t.bedragUsd / t.entryPrijs;
  return null;
}

export function berekenOpenRisico(trades: PortfolioTrade[], omgeving: 'real' | 'demo'): OpenRisico {
  const uit: OpenRisico = { risicoUsd: 0, metRisico: 0, zonderRisico: [], zonderStop: [] };
  for (const t of trades) {
    if (t.status !== 'open' || !inOmgeving(t, omgeving)) continue;
    const aantal = aantalVan(t);
    if (aantal === null) continue;
    if (!(t.stopLoss > 0)) { uit.zonderStop.push(t.symbool); continue; }
    const perCoin = t.entryPrijs - t.stopLoss;
    if (perCoin <= 0) { uit.zonderRisico.push(t.symbool); continue; }
    uit.risicoUsd += perCoin * aantal;
    uit.metRisico += 1;
  }
  return uit;
}

export function alsPctVan(usd: number, kapitaal: number | null): number | null {
  return kapitaal !== null && kapitaal > 0 ? (usd / kapitaal) * 100 : null;
}

export function fmtPctKort(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

if (typeof require !== 'undefined' && require.main === module) {
  const basis = { naam: '', rr: 3, datum: '', takeProfit: 0, id: 'x' } as const;
  const trades: PortfolioTrade[] = [
    { ...basis, symbool: 'BTC', entryPrijs: 100, stopLoss: 90, aantalCoins: 2, status: 'open', bron: 'etoro' },
    { ...basis, symbool: 'SOL', entryPrijs: 50, stopLoss: 55, aantalCoins: 1, status: 'open', bron: 'etoro' },
    { ...basis, symbool: 'ADA', entryPrijs: 10, stopLoss: 0, aantalCoins: 5, status: 'open', bron: 'etoro' },
    { ...basis, symbool: 'ETH', entryPrijs: 20, stopLoss: 18, bedragUsd: 200, status: 'open', bron: 'handmatig' },
    { ...basis, symbool: 'DOT', entryPrijs: 20, stopLoss: 10, aantalCoins: 1, status: 'verloren', bron: 'etoro' },
  ];
  const echt = berekenOpenRisico(trades, 'real');
  console.assert(echt.risicoUsd === 20 + 20, `echt risico 40, kreeg ${echt.risicoUsd}`);
  console.assert(echt.metRisico === 2, 'twee posities met risico');
  console.assert(echt.zonderRisico.join() === 'SOL', 'stop boven instap telt als 0');
  console.assert(echt.zonderStop.join() === 'ADA', 'zonder stop apart');
  const demo = berekenOpenRisico(trades, 'demo');
  console.assert(demo.risicoUsd === 20, 'handmatige trade telt niet in demo');
  console.assert(alsPctVan(40, 1000) === 4, '4% van 1000');
  console.assert(alsPctVan(40, null) === null, 'zonder kapitaal geen pct');
  console.log('openRisico.ts self-check klaar');
}
