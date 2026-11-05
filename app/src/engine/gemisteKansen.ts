// Gemiste kansen: signalen van Kader die hun doel haalden terwijl jij niet kocht, en eerlijk
// daarnaast de stops die je zo ontweek. Samen zeggen ze of niet-kopen je geld kostte of juist
// scheelde. Puur, met een self-check onderaan: `npx tsx src/engine/gemisteKansen.ts` vanuit app/.

import type { GelogdSignaal } from './signaalLog';
import type { PortfolioTrade } from '../state/portfolioTypes';
import { fmtBedrag } from './format';

// Binnen zoveel dagen na het signaal kopen telt als "gekocht".
export const KOOP_VENSTER_DAGEN = 3;
const DAG_MS = 24 * 60 * 60 * 1000;

export type GemistSoort = 'gemist' | 'ontweken';

export interface GemistItem {
  soort: GemistSoort;
  signaal: GelogdSignaal;
  r: number;
  // Wanneer doel of stop geraakt werd.
  tijd: number;
}

// Had je die coin rond het signaal? Een positie telt als hij binnen het koopvenster opende, of al
// open stond toen het signaal kwam. Trades zonder openingstijd zijn niet te plaatsen en tellen niet.
function hadPositie(s: GelogdSignaal, trades: PortfolioTrade[]): boolean {
  const venster = s.tijd + KOOP_VENSTER_DAGEN * DAG_MS;
  return trades.some(t =>
    t.symbool === s.symbool
    && typeof t.openTijd === 'number'
    && t.openTijd <= venster
    && (typeof t.slotTijd !== 'number' || t.slotTijd >= s.tijd));
}

// Alleen signalen met een echte uitkomst (doel of stop). Verlopen signalen zijn geen kans en geen
// ontweken klap. Nieuwste eerst.
export function bepaalGemisteKansen(signalen: GelogdSignaal[], trades: PortfolioTrade[]): GemistItem[] {
  const uit: GemistItem[] = [];
  for (const s of signalen) {
    if ((s.uitkomst !== 'doel' && s.uitkomst !== 'stop') || typeof s.behaaldeR !== 'number') continue;
    if (hadPositie(s, trades)) continue;
    uit.push({ soort: s.uitkomst === 'doel' ? 'gemist' : 'ontweken', signaal: s, r: s.behaaldeR, tijd: s.uitkomstTijd ?? s.tijd });
  }
  return uit.sort((a, b) => b.tijd - a.tijd);
}

export interface GemistStand {
  gemist: { aantal: number; r: number };
  ontweken: { aantal: number; r: number };
  // Wat elk niet-gekocht signaal blind volgen had opgeleverd.
  nettoR: number;
}

export function vatGemistSamen(items: GemistItem[]): GemistStand {
  const stand: GemistStand = { gemist: { aantal: 0, r: 0 }, ontweken: { aantal: 0, r: 0 }, nettoR: 0 };
  for (const i of items) {
    stand[i.soort].aantal += 1;
    stand[i.soort].r += i.r;
    stand.nettoR += i.r;
  }
  return stand;
}

export function sindsDagen(items: GemistItem[], dagen: number, nu: number): GemistItem[] {
  const grens = nu - dagen * DAG_MS;
  return items.filter(i => i.tijd >= grens);
}

// Een R-bedrag in dollars bij jouw risico per trade. Null zonder handelskapitaal.
export function rInDollars(r: number, kapitaal: number | null, risicoPct: number): number | null {
  return kapitaal !== null && kapitaal > 0 ? r * kapitaal * (risicoPct / 100) : null;
}

// Een R-bedrag als geld bij jouw risico: in euro als er een koers is, anders in dollars.
export function geldBijRisico(r: number, kapitaal: number | null, risicoPct: number, eurPerUsd: number | null): string | null {
  const usd = rInDollars(r, kapitaal, risicoPct);
  if (usd === null) return null;
  const teken = usd < -0.005 ? '−' : '+';
  return eurPerUsd !== null
    ? `${teken}€${Math.abs(usd * eurPerUsd).toFixed(0)}`
    : `${teken}${fmtBedrag(Math.abs(usd), { valuta: 'USD' })}`;
}

if (typeof require !== 'undefined' && require.main === module) {
  const nu = Date.UTC(2026, 10, 5);
  const sig = (symbool: string, uitkomst: GelogdSignaal['uitkomst'], r: number | undefined, dagenGeleden: number): GelogdSignaal => ({
    id: symbool + dagenGeleden, symbool, tijd: nu - dagenGeleden * DAG_MS, score: 70, advies: 'KOOPZONE',
    entry: 100, stop: 90, doel: 130, rr: 3, uitkomst, behaaldeR: r, uitkomstTijd: nu - (dagenGeleden - 2) * DAG_MS,
  });
  const trade = (symbool: string, openDagenGeleden: number, slotDagenGeleden?: number): PortfolioTrade => ({
    id: symbool, symbool, naam: '', entryPrijs: 100, stopLoss: 90, takeProfit: 130, rr: 3, datum: '',
    status: slotDagenGeleden === undefined ? 'open' : 'gewonnen',
    openTijd: nu - openDagenGeleden * DAG_MS,
    slotTijd: slotDagenGeleden === undefined ? undefined : nu - slotDagenGeleden * DAG_MS,
  });
  const signalen = [
    sig('ETH', 'doel', 3, 10),
    sig('SOL', 'doel', 3, 10),     // binnen 2 dagen gekocht
    sig('ADA', 'stop', -1, 8),
    sig('BTC', 'doel', 3, 20),     // stond al open
    sig('DOT', 'open', undefined, 3),
    sig('LINK', 'verlopen', 0.4, 40),
    sig('AVAX', 'doel', 2.5, 30),  // pas na 5 dagen gekocht: telt als gemist
  ];
  const trades = [trade('SOL', 8, 4), trade('BTC', 25), trade('AVAX', 25, 20)];
  const items = bepaalGemisteKansen(signalen, trades);
  console.assert(items.map(i => i.signaal.symbool).join() === 'ADA,ETH,AVAX', `verwacht ADA,ETH,AVAX, kreeg ${items.map(i => i.signaal.symbool).join()}`);
  const stand = vatGemistSamen(items);
  console.assert(stand.gemist.aantal === 2 && stand.gemist.r === 5.5, 'gemist 2 x, +5.5 R');
  console.assert(stand.ontweken.aantal === 1 && stand.ontweken.r === -1, 'ontweken 1 x, -1 R');
  console.assert(stand.nettoR === 4.5, 'netto +4.5 R');
  console.assert(sindsDagen(items, 7, nu).length === 1, 'alleen ADA viel de afgelopen 7 dagen');
  console.assert(rInDollars(2, 4200, 1) === 84, '2 R bij 1% van 4200 is $84');
  console.assert(rInDollars(2, null, 1) === null, 'zonder kapitaal geen bedrag');
  console.log('gemisteKansen.ts self-check klaar');
}
