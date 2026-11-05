// Benchmark in Historie: jouw resultaat naast "hetzelfde geld op dezelfde dagen in BTC". Per trade
// rekenen we wat de inleg had gedaan als je hem op de instapdag in BTC had gestoken en op de
// sluitdag weer verkocht. Dat is eerlijker dan BTC over de hele periode: het rekent alleen met de
// momenten waarop jouw geld echt in de markt zat.
//
// Puur, met een self-check onderaan: `npx tsx src/state/benchmark.ts` vanuit app/.

import type { Candle } from '../engine/types';
import type { PortfolioTrade } from './portfolioTypes';
import type { WaardePunt } from './portfolioWaarde';
import { resultaatVan } from './statistieken';

// De slotkoers van BTC op het moment `ms`: de laatste dagcandle die op of voor dat moment opende.
// Null als `ms` voor de eerste candle valt: dan hebben we geen koers en verzinnen we er geen.
export function btcOp(candles: Candle[], ms: number): number | null {
  let lo = 0, hi = candles.length - 1, beste = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = candles[mid].tijd ?? 0;
    if (t <= ms) { beste = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return beste >= 0 ? candles[beste].close : null;
}

export function inlegVan(t: PortfolioTrade): number | null {
  if (typeof t.aantalCoins === 'number' && t.aantalCoins > 0) return t.aantalCoins * t.entryPrijs;
  if (typeof t.bedragUsd === 'number' && t.bedragUsd > 0) return t.bedragUsd;
  return null;
}

export interface Benchmark {
  jouwUsd: number;
  btcUsd: number;
  aantal: number;
  // Trades die niet te vergelijken waren: geen openingstijd of inleg, of ouder dan de BTC-data.
  overgeslagen: number;
}

// Vergelijkt de gesloten trades (al gefilterd op periode) met BTC.
export function vergelijkMetBtc(gesloten: PortfolioTrade[], btc: Candle[]): Benchmark {
  const uit: Benchmark = { jouwUsd: 0, btcUsd: 0, aantal: 0, overgeslagen: 0 };
  for (const t of gesloten) {
    const inleg = inlegVan(t);
    const jouw = resultaatVan(t);
    const van = typeof t.openTijd === 'number' ? btcOp(btc, t.openTijd) : null;
    const tot = typeof t.slotTijd === 'number' ? btcOp(btc, t.slotTijd) : null;
    const eerste = btc[0]?.tijd ?? Infinity;
    if (inleg === null || jouw === null || van === null || tot === null || (t.openTijd as number) < eerste) {
      uit.overgeslagen += 1;
      continue;
    }
    uit.jouwUsd += jouw;
    uit.btcUsd += inleg * (tot / van - 1);
    uit.aantal += 1;
  }
  return uit;
}

// De gestippelde BTC-lijn bij de waardegrafiek: begint op jouw eerste punt en beweegt daarna met
// wat al je trades (open en gesloten) in BTC hadden gedaan. Null als er te weinig data is.
export function btcLijn(punten: WaardePunt[], trades: PortfolioTrade[], btc: Candle[]): number[] | null {
  if (punten.length < 2 || btc.length === 0) return null;
  const eerste = btc[0].tijd ?? Infinity;
  const bruikbaar = trades
    .map(t => ({ t, inleg: inlegVan(t), open: t.openTijd }))
    .filter((x): x is { t: PortfolioTrade; inleg: number; open: number } =>
      x.inleg !== null && typeof x.open === 'number' && x.open >= eerste && btcOp(btc, x.open) !== null);
  if (bruikbaar.length === 0) return null;

  const resultaatTot = (ms: number) => {
    let som = 0;
    for (const { t, inleg, open } of bruikbaar) {
      if (open > ms) continue;
      const eind = typeof t.slotTijd === 'number' && t.status !== 'open' ? Math.min(t.slotTijd, ms) : ms;
      const van = btcOp(btc, open)!;
      const tot = btcOp(btc, eind);
      if (tot !== null) som += inleg * (tot / van - 1);
    }
    return som;
  };
  const start = resultaatTot(punten[0].tijd);
  return punten.map(p => punten[0].waarde + resultaatTot(p.tijd) - start);
}

if (typeof require !== 'undefined' && require.main === module) {
  const DAG = 24 * 60 * 60 * 1000;
  const t0 = Date.UTC(2026, 9, 1);
  const btc: Candle[] = [100, 110, 120, 90, 100].map((close, i) => ({ open: close, high: close, low: close, close, volume: 0, tijd: t0 + i * DAG }));
  console.assert(btcOp(btc, t0 + 2.5 * DAG) === 120, 'laatste candle op of voor het moment');
  console.assert(btcOp(btc, t0 - 1) === null, 'voor de data: geen koers');

  const trade = (over: Partial<PortfolioTrade>): PortfolioTrade => ({
    id: 'x', symbool: 'SOL', naam: '', entryPrijs: 10, stopLoss: 9, takeProfit: 13, rr: 3, datum: '', status: 'gewonnen', ...over,
  });
  const a = trade({ aantalCoins: 10, exitPrijs: 12, openTijd: t0, slotTijd: t0 + 2 * DAG }); // jij +20, BTC 100 -> 120: +20
  const b = trade({ aantalCoins: 10, exitPrijs: 11, openTijd: t0 + 2 * DAG, slotTijd: t0 + 3 * DAG }); // jij +10, BTC 120 -> 90: -25
  const oud = trade({ aantalCoins: 1, exitPrijs: 11, openTijd: t0 - 5 * DAG, slotTijd: t0 + DAG });
  const v = vergelijkMetBtc([a, b, oud], btc);
  console.assert(v.aantal === 2 && v.overgeslagen === 1, 'oude trade overgeslagen');
  console.assert(Math.abs(v.jouwUsd - 30) < 1e-9 && Math.abs(v.btcUsd - (-5)) < 1e-9, `jij +30, BTC -5, kreeg ${v.jouwUsd} ${v.btcUsd}`);

  const punten: WaardePunt[] = [0, 1, 2, 3, 4].map(i => ({ tijd: t0 + i * DAG, waarde: 1000 + i, berekend: true }));
  const lijn = btcLijn(punten, [a, b], btc)!;
  console.assert(lijn[0] === 1000, 'lijn begint op jouw eerste punt');
  console.assert(Math.abs(lijn[2] - 1020) < 1e-9, `dag 2: a +20 (b net open, 0), kreeg ${lijn[2]}`);
  console.assert(Math.abs(lijn[4] - 995) < 1e-9, `dag 4: a +20, b -25, kreeg ${lijn[4]}`);
  console.log('benchmark.ts self-check klaar');
}
