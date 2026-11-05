// De inhoud van de Android-widget: het open resultaat van je portfolio in R, en welke posities dicht
// bij hun stop of doel staan. Puur rekenwerk zonder React of opslag; de app en de achtergrondtaak
// rekenen dit uit en bewaren het, de widget zelf tekent alleen wat er bewaard is.
//
// Self-check onderaan: `npx tsx src/state/widgetStand.ts` vanuit app/.

import { PortfolioTrade, bronVan } from './portfolioTypes';
import { behaaldeRR, resultaatVan } from './statistieken';
import { drempelBijnaOpDoel } from './advies';
import { inOmgeving } from './openRisico';

// Zoveel posities passen er op de brede widget (4x2).
export const MAX_WIDGET_POSITIES = 3;

// Het laatste deel van de weg dat als "dicht bij" telt. Gelijk aan drempelBijnaOpDoel (de laatste
// 10% tussen instap en doel), zodat de widget hetzelfde zegt als Portfolio en Eén ding vandaag.
const DICHT_BIJ_DEEL = 0.1;

export type WidgetNabij = 'stop' | 'doel' | null;

export interface WidgetPositie {
  symbool: string;
  // Open resultaat in R tegen de oorspronkelijke stop. Null zonder stop onder de instap.
  r: number | null;
  // Open resultaat in dollars. Null zonder aantal coins.
  usd: number | null;
  nabij: WidgetNabij;
}

export interface WidgetStand {
  omgeving: 'real' | 'demo';
  // Open posities in deze omgeving, ook die zonder koers.
  aantalOpen: number;
  // Hoeveel daarvan een koers hadden. Minder dan aantalOpen betekent een totaal over een deel.
  metKoers: number;
  // Som over de posities met een koers en een R. Null als er geen enkele meetelt.
  totaalR: number | null;
  totaalUsd: number | null;
  // Met een koers, de meest urgente eerst, hoogstens MAX_WIDGET_POSITIES.
  posities: WidgetPositie[];
  // Epoch ms van de berekening.
  tijd: number;
}

// Zelfde scheiding als op Portfolio. De opgeslagen lijst bevat beide omgevingen, dus eerst wat
// Portfolio in deze omgeving toont (zichtbareTrades in PortfolioProvider), en daarvan in Demo alleen
// wat speelgeld is: handmatige trades niet (inOmgeving in openRisico.ts).
export function hoortBijWidget(t: PortfolioTrade, omgeving: 'real' | 'demo'): boolean {
  const zichtbaar = bronVan(t) === 'handmatig' || (t.etoroOmgeving ?? 'real') === omgeving;
  return zichtbaar && inOmgeving(t, omgeving);
}

// Vanaf welke koers een positie dicht bij zijn stop staat: het laatste tiende van de weg van de
// instap naar de stop, gespiegeld aan drempelBijnaOpDoel. Staat de stop al op of boven de instap,
// dan is de weg van de stop naar het doel de maat, want onder de instap ligt dan niets meer.
export function drempelDichtBijStop(t: PortfolioTrade): number | null {
  if (!(t.stopLoss > 0)) return null;
  const basis = t.stopLoss < t.entryPrijs ? t.entryPrijs : t.takeProfit;
  if (!(basis > t.stopLoss)) return null;
  return t.stopLoss + (basis - t.stopLoss) * DICHT_BIJ_DEEL;
}

// Hoeveel van de weg naar stop of doel er nog over is, als deel van die weg: 0 is erop, 1 is net
// begonnen. Het kleinste van de twee bepaalt hoe urgent een positie is.
function restVanWeg(t: PortfolioTrade, koers: number): number {
  let rest = Infinity;
  if (t.stopLoss > 0) {
    const basis = t.stopLoss < t.entryPrijs ? t.entryPrijs : t.takeProfit;
    if (basis > t.stopLoss) rest = Math.min(rest, (koers - t.stopLoss) / (basis - t.stopLoss));
  }
  if (t.takeProfit > t.entryPrijs) rest = Math.min(rest, (t.takeProfit - koers) / (t.takeProfit - t.entryPrijs));
  return rest;
}

function nabijVan(t: PortfolioTrade, koers: number): WidgetNabij {
  const stopDrempel = drempelDichtBijStop(t);
  if (stopDrempel !== null && koers <= stopDrempel) return 'stop';
  if (t.takeProfit > t.entryPrijs && koers > drempelBijnaOpDoel(t.entryPrijs, t.takeProfit)) return 'doel';
  return null;
}

export function berekenWidgetStand(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
  omgeving: 'real' | 'demo',
  tijd: number,
): WidgetStand {
  const open = trades.filter(t => t.status === 'open' && hoortBijWidget(t, omgeving));
  let totaalR: number | null = null;
  let totaalUsd: number | null = null;
  const metKoers: (WidgetPositie & { rest: number })[] = [];

  for (const t of open) {
    const koers = livePrijzen[t.symbool];
    if (typeof koers !== 'number' || !(koers > 0)) continue;
    // Alsof de positie nu op de actuele koers sloot: dan rekenen behaaldeRR en resultaatVan precies
    // zoals bij een gesloten trade. resultaatUsd leeg, want dat is eToro's gerealiseerde resultaat.
    const nu: PortfolioTrade = { ...t, exitPrijs: koers, resultaatUsd: undefined };
    const r = behaaldeRR(nu);
    const usd = resultaatVan(nu);
    if (r !== null) totaalR = (totaalR ?? 0) + r;
    if (usd !== null) totaalUsd = (totaalUsd ?? 0) + usd;
    metKoers.push({ symbool: t.symbool, r, usd, nabij: nabijVan(t, koers), rest: restVanWeg(t, koers) });
  }

  metKoers.sort((a, b) => a.rest - b.rest);
  const posities = metKoers.slice(0, MAX_WIDGET_POSITIES).map(({ rest: _rest, ...p }) => p);
  return { omgeving, aantalOpen: open.length, metKoers: metKoers.length, totaalR, totaalUsd, posities, tijd };
}

if (typeof require !== 'undefined' && require.main === module) {
  const basis = { naam: '', rr: 3, datum: '', status: 'open', bron: 'etoro' } as const;
  const trades: PortfolioTrade[] = [
    // +0.5 R, ver van alles.
    { ...basis, id: '1', symbool: 'BTC', entryPrijs: 100, stopLoss: 90, takeProfit: 130, aantalCoins: 2 },
    // 129 ligt in het laatste tiende naar het doel: +2.9 R.
    { ...basis, id: '2', symbool: 'ETH', entryPrijs: 100, stopLoss: 90, takeProfit: 130, aantalCoins: 1 },
    // 90.5 ligt in het laatste tiende naar de stop: −0.95 R.
    { ...basis, id: '3', symbool: 'SOL', entryPrijs: 100, stopLoss: 90, takeProfit: 130, aantalCoins: 1 },
    // Stop opgetrokken naar de instap, oorspronkelijke stop 80: +0.15 R, net boven de stop.
    { ...basis, id: '4', symbool: 'ADA', entryPrijs: 100, stopLoss: 100, initieleStop: 80, takeProfit: 140, aantalCoins: 1 },
    // Geen koers: telt als open, niet in het totaal.
    { ...basis, id: '5', symbool: 'DOT', entryPrijs: 10, stopLoss: 9, takeProfit: 13, aantalCoins: 1 },
    // Andere omgeving en een gesloten trade: tellen niet mee.
    { ...basis, id: '6', symbool: 'LINK', entryPrijs: 10, stopLoss: 9, takeProfit: 13, aantalCoins: 1, etoroOmgeving: 'demo' },
    { ...basis, id: '7', symbool: 'XRP', entryPrijs: 10, stopLoss: 9, takeProfit: 13, aantalCoins: 1, status: 'gewonnen' },
    // Handmatig: alleen in Echt.
    { ...basis, id: '8', symbool: 'AVAX', entryPrijs: 20, stopLoss: 18, takeProfit: 26, bron: 'handmatig' },
  ];
  const koersen = { BTC: 105, ETH: 129, SOL: 90.5, ADA: 103, LINK: 11, AVAX: 21 };
  const s = berekenWidgetStand(trades, koersen, 'real', 0);
  const bijna = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-9;

  console.assert(s.aantalOpen === 6, `zes open in echt, kreeg ${s.aantalOpen}`);
  console.assert(s.metKoers === 5, `vijf met koers (DOT niet), kreeg ${s.metKoers}`);
  // 0.5 + 2.9 - 0.95 + 0.15 + 0.5 (AVAX)
  console.assert(bijna(s.totaalR, 3.1), `totaal R 3.1, kreeg ${s.totaalR}`);
  // 10 + 29 - 9.5 + 3; AVAX heeft geen aantal.
  console.assert(bijna(s.totaalUsd, 32.5), `totaal $ 32.5, kreeg ${s.totaalUsd}`);
  console.assert(s.posities.length === MAX_WIDGET_POSITIES, 'hoogstens drie posities');
  console.assert(s.posities.map(p => p.symbool).join() === 'ETH,SOL,ADA', `urgentste eerst, kreeg ${s.posities.map(p => p.symbool).join()}`);
  console.assert(s.posities[0].nabij === 'doel' && s.posities[1].nabij === 'stop', 'doel en stop herkend');
  console.assert(s.posities[2].nabij === 'stop', 'stop op instap: 103 ligt in het eerste tiende van 100 naar 140');
  console.assert(bijna(s.posities[2].r, 0.15), 'R tegen de oorspronkelijke stop');

  const demo = berekenWidgetStand(trades, koersen, 'demo', 0);
  console.assert(demo.aantalOpen === 1 && demo.posities[0].symbool === 'LINK', 'demo: alleen demo-posities');
  console.assert(bijna(demo.totaalR, 1), 'LINK +1 R');

  const leeg = berekenWidgetStand([], {}, 'real', 0);
  console.assert(leeg.aantalOpen === 0 && leeg.totaalR === null && leeg.posities.length === 0, 'leeg');
  const zonderKoers = berekenWidgetStand(trades, {}, 'real', 0);
  console.assert(zonderKoers.aantalOpen === 6 && zonderKoers.metKoers === 0 && zonderKoers.totaalR === null, 'zonder koersen geen totaal');

  console.assert(drempelDichtBijStop({ ...trades[0] }) === 91, 'drempel stop 91');
  console.assert(drempelDichtBijStop({ ...trades[0], stopLoss: 0 }) === null, 'zonder stop geen drempel');
  console.log('widgetStand.ts self-check klaar');
}
