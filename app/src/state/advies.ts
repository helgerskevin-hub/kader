import { fmtPrijs } from '../engine/format';

export type AdviesKleur = 'neutraal' | 'winst' | 'verlies' | 'letOp';

export interface Advies {
  tekst: string;
  // Korte versie van `tekst` voor de compacte weergave, waar geen ruimte is voor een hele zin.
  kort: string;
  kleur: AdviesKleur;
}

// Vanaf welke koers een trade "bijna op doel" staat: de laatste 10% van de weg tussen entry en
// take-profit. Geëxporteerd omdat de trade-meldingen dezelfde grens gebruiken; twee kopieën zouden
// stilletjes uiteen kunnen lopen.
export function drempelBijnaOpDoel(entryPrijs: number, takeProfit: number): number {
  return takeProfit - (takeProfit - entryPrijs) * 0.1;
}

export function bepaalAdvies(
  entryPrijs: number,
  stopLoss: number,
  takeProfit: number,
  livePrijs: number | undefined,
): Advies {
  if (livePrijs === undefined) {
    return { tekst: 'Live prijs laden...', kort: 'Live prijs laden', kleur: 'neutraal' };
  }

  if (stopLoss <= 0 || takeProfit <= 0) {
    return {
      tekst: 'Stel een stop-loss en take-profit in om advies te zien.',
      kort: 'Geen stop/doel',
      kleur: 'neutraal',
    };
  }

  if (livePrijs <= stopLoss) {
    return { tekst: 'Stop-loss geraakt. Plan was hier uit te stappen.', kort: 'Stop geraakt', kleur: 'verlies' };
  }

  if (livePrijs >= takeProfit) {
    return { tekst: 'Doel bereikt. Overweeg (deels) winst te nemen.', kort: 'Doel bereikt', kleur: 'winst' };
  }

  const drempelNaarDoel = drempelBijnaOpDoel(entryPrijs, takeProfit);
  if (livePrijs > drempelNaarDoel) {
    return { tekst: 'Bijna op doel. Houd vast of zet een trailing stop.', kort: 'Bijna op doel', kleur: 'letOp' };
  }

  if (livePrijs < entryPrijs) {
    return {
      tekst: 'Onder entry. Plan: vasthouden tot stop, niet eerder uitstappen op emotie.',
      kort: 'Onder entry',
      kleur: 'letOp',
    };
  }

  return {
    tekst: `Op koers. Vasthouden volgens plan. Stop: ${fmtPrijs(stopLoss)}, doel: ${fmtPrijs(takeProfit)}.`,
    kort: 'Op koers',
    kleur: 'neutraal',
  };
}
