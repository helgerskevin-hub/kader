import { PortfolioTrade } from './portfolioTypes';

export interface PortfolioStatistieken {
  afgesloten: number;
  trefferpercentage: number | null;
  gemBehaaldeRR: number | null;
  totaalResultaatUsd: number | null;
}

function behaaldeExit(t: PortfolioTrade): number {
  return t.exitPrijs ?? (t.status === 'gewonnen' ? t.takeProfit : t.stopLoss);
}

function behaaldeRR(t: PortfolioTrade): number | null {
  const risico = t.entryPrijs - t.stopLoss;
  if (risico <= 0) return null;
  return (behaaldeExit(t) - t.entryPrijs) / risico;
}

export function berekenStatistieken(trades: PortfolioTrade[]): PortfolioStatistieken {
  const gesloten = trades.filter(t => t.status !== 'open');
  const gewonnen = gesloten.filter(t => t.status === 'gewonnen');
  const verloren = gesloten.filter(t => t.status === 'verloren');

  const trefferpercentage = gesloten.length > 0
    ? (gewonnen.length / gesloten.length) * 100
    : null;

  const rrWaarden = gesloten.map(behaaldeRR).filter((v): v is number => v !== null);
  const gemBehaaldeRR = rrWaarden.length > 0
    ? rrWaarden.reduce((s, v) => s + v, 0) / rrWaarden.length
    : null;

  const metBedrag = gesloten.filter(t => typeof t.aantalCoins === 'number' && t.aantalCoins > 0);
  const totaalResultaatUsd = metBedrag.length > 0
    ? metBedrag.reduce((s, t) => s + (behaaldeExit(t) - t.entryPrijs) * t.aantalCoins!, 0)
    : null;

  return {
    afgesloten: gesloten.length,
    trefferpercentage,
    gemBehaaldeRR,
    totaalResultaatUsd,
  };
}

// ponytail: self-check ipv testframework, run met `npx ts-node app/src/state/statistieken.ts`
if (require.main === module) {
  const trades: PortfolioTrade[] = [
    { id: '1', symbool: 'BTC', naam: 'Bitcoin', entryPrijs: 100, stopLoss: 90, takeProfit: 130, rr: 3, datum: '', status: 'gewonnen', exitPrijs: 130, aantalCoins: 2 },
    { id: '2', symbool: 'ETH', naam: 'Ethereum', entryPrijs: 100, stopLoss: 80, takeProfit: 160, rr: 3, datum: '', status: 'verloren', exitPrijs: 80, aantalCoins: 1 },
    { id: '3', symbool: 'SOL', naam: 'Solana', entryPrijs: 50, stopLoss: 40, takeProfit: 80, rr: 3, datum: '', status: 'open' },
  ];
  const s = berekenStatistieken(trades);
  console.assert(s.afgesloten === 2, 'afgesloten telt open trades niet mee');
  console.assert(s.trefferpercentage === 50, `trefferpercentage moet 50 zijn, was ${s.trefferpercentage}`);
  console.assert(s.gemBehaaldeRR === 1, `gem R/R moet 1 zijn (+3 en -1 gemiddeld), was ${s.gemBehaaldeRR}`);
  console.assert(s.totaalResultaatUsd === 40, `totaal resultaat moet 40 zijn (60 - 20), was ${s.totaalResultaatUsd}`);
  console.log('statistieken.ts self-check geslaagd');
}
