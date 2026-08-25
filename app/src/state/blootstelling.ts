import { Klimaat } from '../engine/marktklimaat';

// Hoeveel van je kapitaal er bij een gegeven marktklimaat hoogstens in de markt hoort te staan.
//
// Let op wat dit wel en niet is. Dit zijn risicoconventies, geen backtestuitkomst. De backtest in
// scripts/backtest.ts meet losse trades (gemiddelde R per signaal), niet portefeuilles, en kan dus
// niets zeggen over een verstandig blootstellingspercentage. Het cijfer volgt uit iets simpelers:
// in een klimaat waarin koopsignalen historisch gemiddeld geld verloren, hoort er minder geld in de
// markt te staan. De app presenteert het daarom als richtlijn, niet als meting.
export const PLAFOND_PER_KLIMAAT: Record<Klimaat, number> = {
  gunstig: 1.0,
  gemengd: 0.5,
  ongunstig: 0.2,
};

export interface BlootstellingOordeel {
  klimaat: Klimaat;
  // Het plafond in procenten (0-100), altijd bekend: dat hangt alleen van het klimaat af.
  plafondPct: number;
  // Wat er nu in de markt staat, in dollars. Alleen de posities waarvan we een aantal én een live
  // prijs hebben; de rest kunnen we niet waarderen en telt dus niet mee.
  inMarktUsd: number;
  // Het door de gebruiker ingevulde handelskapitaal. null = niet ingevuld, en dan blijft alles
  // hieronder ook null. Een verzonnen noemer maakt het percentage waardeloos.
  kapitaalUsd: number | null;
  huidigPct: number | null;
  binnenPlafond: boolean | null;
  // Hoeveel er boven het plafond uitsteekt, in dollars. 0 als je eronder zit.
  bovenPlafondUsd: number | null;
}

export function beoordeelBlootstelling(
  inMarktUsd: number,
  kapitaalUsd: number | null,
  klimaat: Klimaat,
): BlootstellingOordeel {
  const plafondPct = PLAFOND_PER_KLIMAAT[klimaat] * 100;

  if (kapitaalUsd === null || !(kapitaalUsd > 0)) {
    return {
      klimaat, plafondPct, inMarktUsd,
      kapitaalUsd: null, huidigPct: null, binnenPlafond: null, bovenPlafondUsd: null,
    };
  }

  const huidigPct = (inMarktUsd / kapitaalUsd) * 100;
  const plafondUsd = kapitaalUsd * PLAFOND_PER_KLIMAAT[klimaat];

  return {
    klimaat, plafondPct, inMarktUsd, kapitaalUsd, huidigPct,
    binnenPlafond: huidigPct <= plafondPct + 1e-9,
    bovenPlafondUsd: Math.max(0, inMarktUsd - plafondUsd),
  };
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/state/blootstelling.ts`
if (require.main === module) {
  const zonder = beoordeelBlootstelling(500, null, 'ongunstig');
  console.assert(zonder.plafondPct === 20, 'het plafond hangt alleen van het klimaat af en is altijd bekend');
  console.assert(zonder.huidigPct === null && zonder.binnenPlafond === null,
    'zonder kapitaal hoort er geen percentage uit te komen');

  const teVeel = beoordeelBlootstelling(500, 1000, 'ongunstig');
  console.assert(teVeel.huidigPct === 50, `50% verwacht, was ${teVeel.huidigPct}`);
  console.assert(teVeel.binnenPlafond === false, '50% zit boven het plafond van 20%');
  console.assert(teVeel.bovenPlafondUsd === 300, `300 boven het plafond verwacht, was ${teVeel.bovenPlafondUsd}`);

  const precies = beoordeelBlootstelling(200, 1000, 'ongunstig');
  console.assert(precies.binnenPlafond === true, 'precies op het plafond telt als binnen');
  console.assert(precies.bovenPlafondUsd === 0, 'op het plafond steekt er niets bovenuit');

  const bull = beoordeelBlootstelling(1000, 1000, 'gunstig');
  console.assert(bull.binnenPlafond === true, 'in een gunstig klimaat is er geen plafond onder 100%');

  console.log('blootstelling.ts self-check geslaagd');
}
