// Discipline: hield je je aan het plan waarmee je een trade opende? Per gesloten trade de afwijking,
// en over een periode een score en wat afwijken je kostte in R.
//
// Puur (geen React Native, geen opslag), met een self-check onderaan, net als sluitReden.ts.
//
// Het plan is: stop en doel staan vast bij opening, en de trade eindigt op een van de twee. Een stop
// optrekken (break-even, winst vastzetten) volgt het plan juist, want daar adviseert Kader zelf toe.
// Bewust weggelaten: hoeveel "eerder gesloten" kostte. Daarvoor zou je moeten weten waar de koers
// daarna heen ging, en een oordeel op een gok is erger dan geen oordeel.

import { PortfolioTrade, risicoStop } from './portfolioTypes';
import { bepaalSluitReden } from './sluitReden';

export type Afwijking = 'geenStop' | 'stopVerlaagd' | 'voorbijStop' | 'eerderGesloten';

export const AFWIJKING_LABEL: Record<Afwijking, string> = {
  geenStop: 'Geen stop',
  stopVerlaagd: 'Stop verlaagd',
  voorbijStop: 'Voorbij stop',
  eerderGesloten: 'Eerder gesloten',
};

// Een stop die in een snelle daling geraakt wordt vult vaak verder dan het niveau. Tot 15% van het
// risico extra tellen we als slippage en niet als afwijking.
const SLIPPAGE_R = 0.15;
// Onder dit aantal beoordeelde trades is een score vooral toeval.
export const MIN_TRADES_VOOR_SCORE = 5;

export interface TradeOordeel {
  // null: niet te beoordelen (nog open, of geen exitkoers bekend).
  afwijking: Afwijking | null;
  beoordeeld: boolean;
  // Extra verlies in R ten opzichte van het plan (negatief), alleen bij een stop die niet hield.
  kostenR: number;
}

export function beoordeelTrade(t: PortfolioTrade): TradeOordeel {
  const niet: TradeOordeel = { afwijking: null, beoordeeld: false, kostenR: 0 };
  if (t.status === 'open' || typeof t.exitPrijs !== 'number' || !(t.exitPrijs > 0)) return niet;

  const openStop = t.initieleStop ?? t.stopLoss;
  if (!(openStop > 0) && !(t.stopLoss > 0)) return { afwijking: 'geenStop', beoordeeld: true, kostenR: 0 };

  const stop = risicoStop(t);
  // Stop bij opening al op of boven de instap: geen risico om in te rekenen, niets te beoordelen.
  if (stop === null) return niet;
  const r = (t.exitPrijs - t.entryPrijs) / (t.entryPrijs - stop);

  if (r < -1 - SLIPPAGE_R) {
    const verlaagd = t.stopLoss > 0 && t.stopLoss < stop * 0.999;
    const zonderStop = !(t.stopLoss > 0);
    return {
      afwijking: zonderStop ? 'geenStop' : verlaagd ? 'stopVerlaagd' : 'voorbijStop',
      beoordeeld: true,
      kostenR: r + 1,
    };
  }

  // Tussen stop en doel gesloten, terwijl de (eventueel opgetrokken) stop niet geraakt is.
  if (t.takeProfit > 0 && bepaalSluitReden(t, t.exitPrijs) === 'handmatig') {
    return { afwijking: 'eerderGesloten', beoordeeld: true, kostenR: 0 };
  }
  return { afwijking: null, beoordeeld: true, kostenR: 0 };
}

export interface DisciplineStand {
  beoordeeld: number;
  gevolgd: number;
  // 0-100, null onder MIN_TRADES_VOOR_SCORE.
  score: number | null;
  meestVoorkomend: { afwijking: Afwijking; aantal: number } | null;
  kostenR: number;
  // Aantal trades waarbij de stop niet hield en dat dus kostenR oplevert.
  stopAfwijkingen: number;
}

export function berekenDiscipline(trades: PortfolioTrade[]): DisciplineStand {
  const oordelen = trades.map(beoordeelTrade).filter(o => o.beoordeeld);
  const gevolgd = oordelen.filter(o => o.afwijking === null).length;
  const tel = new Map<Afwijking, number>();
  for (const o of oordelen) if (o.afwijking) tel.set(o.afwijking, (tel.get(o.afwijking) ?? 0) + 1);
  let meest: DisciplineStand['meestVoorkomend'] = null;
  for (const [afwijking, aantal] of tel) if (!meest || aantal > meest.aantal) meest = { afwijking, aantal };
  const kosten = oordelen.filter(o => o.kostenR < 0);
  return {
    beoordeeld: oordelen.length,
    gevolgd,
    score: oordelen.length >= MIN_TRADES_VOOR_SCORE ? Math.round((gevolgd / oordelen.length) * 100) : null,
    meestVoorkomend: meest,
    kostenR: kosten.reduce((s, o) => s + o.kostenR, 0),
    stopAfwijkingen: kosten.length,
  };
}

if (require.main === module) {
  let missers = 0;
  const origineleAssert = console.assert.bind(console);
  console.assert = ((voorwaarde?: boolean, ...rest: unknown[]) => {
    if (!voorwaarde) missers++;
    origineleAssert(voorwaarde, ...rest);
  }) as typeof console.assert;

  const trade = (over: Partial<PortfolioTrade> = {}): PortfolioTrade => ({
    id: 'x', symbool: 'BTC', naam: 'Bitcoin', entryPrijs: 100, stopLoss: 90, initieleStop: 90, takeProfit: 130, rr: 3,
    datum: '1 jan 2026', status: 'verloren', ...over,
  });

  console.assert(beoordeelTrade(trade({ exitPrijs: 90 })).afwijking === null, 'op de stop gesloten volgt het plan');
  console.assert(beoordeelTrade(trade({ exitPrijs: 89 })).afwijking === null, 'slippage onder de stop is geen afwijking');
  console.assert(beoordeelTrade(trade({ exitPrijs: 130, status: 'gewonnen' })).afwijking === null, 'op het doel volgt het plan');

  const verlaagd = beoordeelTrade(trade({ stopLoss: 70, exitPrijs: 70 }));
  console.assert(verlaagd.afwijking === 'stopVerlaagd' && verlaagd.kostenR === -2, `stop verlaagd naar 70 kost 2R extra, was ${verlaagd.afwijking} ${verlaagd.kostenR}`);

  const voorbij = beoordeelTrade(trade({ exitPrijs: 75 }));
  console.assert(voorbij.afwijking === 'voorbijStop' && voorbij.kostenR === -1.5, `ver onder een ongewijzigde stop, was ${voorbij.afwijking} ${voorbij.kostenR}`);

  console.assert(beoordeelTrade(trade({ exitPrijs: 110, status: 'gewonnen' })).afwijking === 'eerderGesloten', 'tussen stop en doel dicht is eerder gesloten');
  console.assert(beoordeelTrade(trade({ stopLoss: 105, exitPrijs: 105, status: 'gewonnen' })).afwijking === null, 'opgetrokken stop geraakt volgt het plan');
  console.assert(beoordeelTrade(trade({ stopLoss: 0, initieleStop: undefined, exitPrijs: 80 })).afwijking === 'geenStop', 'zonder stop is geen stop');
  console.assert(!beoordeelTrade(trade({ status: 'open' })).beoordeeld, 'open trades tellen niet');
  console.assert(!beoordeelTrade(trade({ exitPrijs: undefined })).beoordeeld, 'zonder exitkoers geen oordeel');

  const stand = berekenDiscipline([
    trade({ exitPrijs: 90 }), trade({ exitPrijs: 130, status: 'gewonnen' }), trade({ exitPrijs: 130, status: 'gewonnen' }),
    trade({ stopLoss: 70, exitPrijs: 70 }), trade({ stopLoss: 80, exitPrijs: 80 }), trade({ exitPrijs: 110, status: 'gewonnen' }),
  ]);
  console.assert(stand.score === 50, `3 van 6 gevolgd is 50, was ${stand.score}`);
  console.assert(stand.meestVoorkomend?.afwijking === 'stopVerlaagd' && stand.meestVoorkomend.aantal === 2, 'stop verlaagd komt het vaakst voor');
  console.assert(stand.kostenR === -3 && stand.stopAfwijkingen === 2, `kosten -2 en -1, was ${stand.kostenR}`);
  console.assert(berekenDiscipline([trade({ exitPrijs: 90 })]).score === null, 'onder 5 trades geen score');

  if (missers > 0) {
    console.error(`discipline.ts self-check GEFAALD: ${missers} controle(s) klopten niet`);
    process.exit(1);
  }
  console.log('discipline.ts self-check geslaagd');
}
