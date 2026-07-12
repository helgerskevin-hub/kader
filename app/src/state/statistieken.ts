import { PortfolioTrade } from './portfolioTypes';

export interface PortfolioStatistieken {
  afgesloten: number;
  trefferpercentage: number | null;
  gemBehaaldeRR: number | null;
  totaalResultaatUsd: number | null;
}

export interface PortfolioWaarde {
  openPosities: number;        // aantal open trades
  ingelegdUsd: number;         // som(aantalCoins * entryPrijs) van open trades met live prijs
  huidigeWaardeUsd: number;    // som(aantalCoins * livePrijs) van open trades met live prijs
  ongerealiseerdUsd: number;   // huidige waarde - ingelegd (alleen posities met beide)
  ongerealiseerdPct: number | null;
  gewaardeerd: number;         // aantal open posities dat in de waarde meetelt
  zonderLivePrijs: number;     // open posities zonder aantal of live prijs
}

export function berekenPortfolioWaarde(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
): PortfolioWaarde {
  const open = trades.filter(t => t.status === 'open');

  let ingelegdUsd = 0;
  let huidigeWaardeUsd = 0;
  let gewaardeerd = 0;
  let zonderLivePrijs = 0;

  for (const t of open) {
    const livePrijs = livePrijzen[t.symbool];
    const heeftAantal = typeof t.aantalCoins === 'number' && t.aantalCoins > 0;
    if (heeftAantal && typeof livePrijs === 'number') {
      ingelegdUsd += t.entryPrijs * t.aantalCoins!;
      huidigeWaardeUsd += livePrijs * t.aantalCoins!;
      gewaardeerd += 1;
    } else {
      zonderLivePrijs += 1;
    }
  }

  const ongerealiseerdUsd = huidigeWaardeUsd - ingelegdUsd;
  const ongerealiseerdPct = ingelegdUsd > 0 ? (ongerealiseerdUsd / ingelegdUsd) * 100 : null;

  return {
    openPosities: open.length,
    ingelegdUsd,
    huidigeWaardeUsd,
    ongerealiseerdUsd,
    ongerealiseerdPct,
    gewaardeerd,
    zonderLivePrijs,
  };
}

function behaaldeExit(t: PortfolioTrade): number {
  return t.exitPrijs ?? (t.status === 'gewonnen' ? t.takeProfit : t.stopLoss);
}

// R is een veelvoud van het bedrag dat je riskeerde, en dat bedrag bestaat alleen als er een
// stop-loss was. Trades zonder stop (veel eToro-historie) tellen dus niet mee: met stopLoss 0
// zou het risico gelijk zijn aan de hele entryprijs en kwam er een rendementsfractie uit (0,3
// voor +30%) die vervolgens werd gemiddeld met echte R-waarden van 2 of 3. Dat trok het
// gemiddelde naar nul en maakte de stat betekenisloos.
function behaaldeRR(t: PortfolioTrade): number | null {
  if (t.stopLoss <= 0) return null;
  const risico = t.entryPrijs - t.stopLoss;
  if (risico <= 0) return null;
  return (behaaldeExit(t) - t.entryPrijs) / risico;
}

// Het werkelijke resultaat in dollars. eToro's netProfit is inclusief kosten en dus de waarheid;
// die gebruiken we als hij er is. Voor handmatige trades kennen we de kosten niet en blijft het
// bruto koersverschil de beste schatting.
function resultaatVan(t: PortfolioTrade): number | null {
  if (typeof t.resultaatUsd === 'number') return t.resultaatUsd;
  if (typeof t.aantalCoins === 'number' && t.aantalCoins > 0) {
    return (behaaldeExit(t) - t.entryPrijs) * t.aantalCoins;
  }
  return null;
}

export function berekenStatistieken(trades: PortfolioTrade[]): PortfolioStatistieken {
  const gesloten = trades.filter(t => t.status !== 'open');
  const gewonnen = gesloten.filter(t => t.status === 'gewonnen');

  const trefferpercentage = gesloten.length > 0
    ? (gewonnen.length / gesloten.length) * 100
    : null;

  const rrWaarden = gesloten.map(behaaldeRR).filter((v): v is number => v !== null);
  const gemBehaaldeRR = rrWaarden.length > 0
    ? rrWaarden.reduce((s, v) => s + v, 0) / rrWaarden.length
    : null;

  const resultaten = gesloten.map(resultaatVan).filter((v): v is number => v !== null);
  const totaalResultaatUsd = resultaten.length > 0
    ? resultaten.reduce((s, v) => s + v, 0)
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

  // eToro-trade zonder stop-loss: telt niet mee in de R/R, want zonder stop is er geen risico-eenheid.
  // Zou hij dat wel doen, dan kwam er (130-100)/100 = 0,3 uit en zakte het gemiddelde van 1 naar 0,77.
  const zonderStop: PortfolioTrade[] = [
    ...trades,
    { id: '4', symbool: 'DOGE', naam: 'Dogecoin', entryPrijs: 100, stopLoss: 0, takeProfit: 0, rr: 0, datum: '', status: 'gewonnen', exitPrijs: 130, aantalCoins: 1, resultaatUsd: 28, bron: 'etoro' },
  ];
  const z = berekenStatistieken(zonderStop);
  console.assert(z.gemBehaaldeRR === 1, `trade zonder stop-loss mag de gem R/R niet verwateren, was ${z.gemBehaaldeRR}`);

  // resultaatUsd (netto, inclusief kosten) gaat voor op het bruto koersverschil: 40 + 28 = 68.
  // Bruto zou (130-100)*1 = 30 zijn geweest, dus 70. Die 2 dollar verschil zijn de kosten.
  console.assert(z.totaalResultaatUsd === 68, `netto resultaat moet voorgaan op bruto (68), was ${z.totaalResultaatUsd}`);

  // Netto verlies terwijl de koers steeg: telt als verlies én als negatief bedrag.
  const kostenVerlies = berekenStatistieken([
    { id: '5', symbool: 'BTC', naam: 'Bitcoin', entryPrijs: 100, stopLoss: 90, takeProfit: 130, rr: 3, datum: '', status: 'verloren', exitPrijs: 100.4, aantalCoins: 1, resultaatUsd: -2, bron: 'etoro' },
  ]);
  console.assert(kostenVerlies.totaalResultaatUsd === -2, `kosten maken dit een verlies van -2, was ${kostenVerlies.totaalResultaatUsd}`);
  console.assert(kostenVerlies.trefferpercentage === 0, 'netto verlies telt als verlies in het trefferpercentage');

  // Open SOL (entry 50, 3 coins) tegen live 60 => ingelegd 150, waarde 180, +30 (+20%).
  const openTrades: PortfolioTrade[] = [
    { id: '3', symbool: 'SOL', naam: 'Solana', entryPrijs: 50, stopLoss: 40, takeProfit: 80, rr: 3, datum: '', status: 'open', aantalCoins: 3 },
    { id: '4', symbool: 'ADA', naam: 'Cardano', entryPrijs: 1, stopLoss: 0.8, takeProfit: 1.6, rr: 3, datum: '', status: 'open' },
  ];
  const w = berekenPortfolioWaarde(openTrades, { SOL: 60 });
  console.assert(w.openPosities === 2, `openPosities moet 2 zijn, was ${w.openPosities}`);
  console.assert(w.ingelegdUsd === 150, `ingelegd moet 150 zijn, was ${w.ingelegdUsd}`);
  console.assert(w.huidigeWaardeUsd === 180, `huidige waarde moet 180 zijn, was ${w.huidigeWaardeUsd}`);
  console.assert(w.ongerealiseerdUsd === 30, `ongerealiseerd moet 30 zijn, was ${w.ongerealiseerdUsd}`);
  console.assert(w.ongerealiseerdPct === 20, `ongerealiseerd% moet 20 zijn, was ${w.ongerealiseerdPct}`);
  console.assert(w.gewaardeerd === 1 && w.zonderLivePrijs === 1, `ADA hoort zonder live prijs te vallen (gewaardeerd ${w.gewaardeerd}, zonder ${w.zonderLivePrijs})`);
  console.log('statistieken.ts self-check geslaagd');
}
