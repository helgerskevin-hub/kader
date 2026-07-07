import { fmtPrijs } from '../engine/format';

export type AdviesKleur = 'neutraal' | 'winst' | 'verlies' | 'letOp';

export interface Advies {
  tekst: string;
  kleur: AdviesKleur;
}

export function bepaalAdvies(
  entryPrijs: number,
  stopLoss: number,
  takeProfit: number,
  livePrijs: number | undefined,
): Advies {
  if (livePrijs === undefined) {
    return { tekst: 'Live prijs laden...', kleur: 'neutraal' };
  }

  if (stopLoss <= 0 || takeProfit <= 0) {
    return { tekst: 'Stel een stop-loss en take-profit in om advies te zien.', kleur: 'neutraal' };
  }

  if (livePrijs <= stopLoss) {
    return { tekst: 'Stop-loss geraakt. Plan was hier uit te stappen.', kleur: 'verlies' };
  }

  if (livePrijs >= takeProfit) {
    return { tekst: 'Doel bereikt. Overweeg (deels) winst te nemen.', kleur: 'winst' };
  }

  const drempelNaarDoel = takeProfit - (takeProfit - entryPrijs) * 0.1;
  if (livePrijs > drempelNaarDoel) {
    return { tekst: 'Bijna op doel. Houd vast of zet een trailing stop.', kleur: 'letOp' };
  }

  if (livePrijs < entryPrijs) {
    return {
      tekst: 'Onder entry. Plan: vasthouden tot stop, niet eerder uitstappen op emotie.',
      kleur: 'letOp',
    };
  }

  return {
    tekst: `Op koers. Vasthouden volgens plan. Stop: ${fmtPrijs(stopLoss)}, doel: ${fmtPrijs(takeProfit)}.`,
    kleur: 'neutraal',
  };
}
