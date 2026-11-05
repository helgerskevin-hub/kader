// De rem na verliezen: na drie gesloten verliestrades op rij vraagt de kooporder 24 uur lang een
// extra bevestiging. Na zo'n reeks is de neiging groot om het snel terug te willen halen, en juist
// dan kopen mensen te groot of te vroeg. Kopen blijft kunnen; de rem maakt het alleen bewust.
//
// Een trade telt als verlies vanaf -0.25 R: wie net onder zijn instap sluit heeft geen echte klap
// gehad. Trades zonder R (geen stop, zie behaaldeRR) zijn niet te beoordelen en slaan we over.
//
// Self-check onderaan: `npx tsx src/state/verliesRem.ts` vanuit app/.

import type { PortfolioTrade } from './portfolioTypes';
import { behaaldeRR } from './statistieken';
import { inOmgeving } from './openRisico';

export const REM_REEKS = 3;
export const REM_DREMPEL_R = -0.25;
export const REM_DUUR_MS = 24 * 60 * 60 * 1000;

export interface RemStand {
  // Sluittijd van de laatste verliestrade: begin van de rem, en het kenmerk van deze reeks. Heft
  // de gebruiker de rem op, dan bewaren we dit tijdstip; een volgende verliestrade geeft een nieuw
  // kenmerk en dus weer een rem.
  anker: number;
  tot: number;
}

// De rem die nu loopt, of null. `opgeheven` is het anker van de reeks die de gebruiker zelf ophief.
export function bepaalRem(
  trades: PortfolioTrade[],
  omgeving: 'real' | 'demo',
  opgeheven: number | null,
  nu: number,
): RemStand | null {
  const beoordeeld = trades
    .filter(t => t.status !== 'open' && typeof t.slotTijd === 'number' && inOmgeving(t, omgeving))
    .map(t => ({ tijd: t.slotTijd as number, r: behaaldeRR(t) }))
    .filter((x): x is { tijd: number; r: number } => x.r !== null)
    .sort((a, b) => b.tijd - a.tijd)
    .slice(0, REM_REEKS);
  if (beoordeeld.length < REM_REEKS || !beoordeeld.every(x => x.r <= REM_DREMPEL_R)) return null;
  const anker = beoordeeld[0].tijd;
  const tot = anker + REM_DUUR_MS;
  if (nu >= tot || opgeheven === anker) return null;
  return { anker, tot };
}

// "vandaag 21:40" of "morgen 21:40", voor de kaart en de kooporder.
export function remTotTekst(tot: number, nu: number): string {
  const d = new Date(tot);
  const tijd = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dagVan = (ms: number) => { const x = new Date(ms); x.setHours(0, 0, 0, 0); return x.getTime(); };
  return `${dagVan(tot) === dagVan(nu) ? 'vandaag' : 'morgen'} ${tijd}`;
}

if (typeof require !== 'undefined' && require.main === module) {
  const UUR = 60 * 60 * 1000;
  const nu = Date.UTC(2026, 10, 5, 12);
  const t = (symbool: string, exit: number, uurGeleden: number, extra: Partial<PortfolioTrade> = {}): PortfolioTrade => ({
    id: symbool + uurGeleden, symbool, naam: '', entryPrijs: 100, stopLoss: 90, takeProfit: 130, rr: 3, datum: '',
    status: exit >= 100 ? 'gewonnen' : 'verloren', exitPrijs: exit, slotTijd: nu - uurGeleden * UUR, bron: 'etoro', ...extra,
  });
  const drieVerlies = [t('A', 90, 1), t('B', 95, 5), t('C', 97, 9), t('D', 120, 20)];
  const rem = bepaalRem(drieVerlies, 'real', null, nu);
  console.assert(rem !== null && rem.anker === nu - UUR && rem.tot === nu + 23 * UUR, 'drie verliezen op rij geeft rem tot 24 u na de laatste');
  console.assert(bepaalRem(drieVerlies, 'real', nu - UUR, nu) === null, 'opgeheven rem blijft uit');
  console.assert(bepaalRem(drieVerlies, 'real', null, nu + 23 * UUR + 1) === null, 'na 24 uur voorbij');
  console.assert(bepaalRem([t('A', 90, 1), t('B', 99, 5), t('C', 97, 9)], 'real', null, nu) === null, '-0.1 R telt niet als verlies');
  console.assert(bepaalRem([t('A', 90, 1), t('B', 95, 5), t('C', 120, 9), t('D', 90, 12)], 'real', null, nu) === null, 'winst breekt de reeks');
  console.assert(bepaalRem([t('A', 90, 1), t('X', 50, 3, { stopLoss: 0 }), t('B', 95, 5), t('C', 97, 9)], 'real', null, nu) !== null, 'trade zonder stop slaan we over');
  console.assert(bepaalRem([t('A', 90, 1), t('B', 95, 5)], 'real', null, nu) === null, 'twee is te weinig');
  console.assert(bepaalRem(drieVerlies.map(x => ({ ...x, bron: 'handmatig' as const })), 'demo', null, nu) === null, 'handmatig telt niet in demo');
  console.log('verliesRem.ts self-check klaar');
}
