// Welk deel van wat er in posities staat via copies loopt, voor de statuskaart op Portfolio. Copies
// zijn twee soorten: trades die je in Kader van een trader kopieerde (gewone eToro-posities,
// herkend via copyHerkomst) en eToro's eigen CopyTrader-relaties (Kopieer alles). Eigen trades zijn
// de rest.
import type { CopyHerkomst } from './copyOpslag';
import type { PortfolioTrade } from './portfolioTypes';

export interface CopyAandeel {
  // Kader-copies op de live koers plus het geld in CopyTrader-relaties.
  copiesUsd: number;
  // Hoeveel open posities uit een Kader-copy komen.
  kaderCopies: number;
  // Geld in CopyTrader-relaties; die posities staan niet in de lijst, dus dit telt bij het totaal op.
  copyTraderUsd: number;
}

// Per eToro-positie de trader van wie hij gekopieerd is. Alleen voor de actieve omgeving: een
// positionID uit demo kan in echt iets anders betekenen.
export function copyVanPerPositie(herkomst: readonly CopyHerkomst[], omgeving: 'real' | 'demo'): Map<number, string> {
  const kaart = new Map<number, string>();
  for (const h of herkomst) {
    if (h.omgeving === omgeving && typeof h.etoroPositionID === 'number') kaart.set(h.etoroPositionID, h.username);
  }
  return kaart;
}

// Dezelfde waardering als berekenPortfolioWaarde: aantal maal live koers, anders de inleg.
function waardeVan(t: PortfolioTrade, livePrijs: number | undefined): number {
  if (typeof t.aantalCoins === 'number' && t.aantalCoins > 0 && typeof livePrijs === 'number') return t.aantalCoins * livePrijs;
  return typeof t.bedragUsd === 'number' && t.bedragUsd > 0 ? t.bedragUsd : 0;
}

export function copyAandeel(invoer: {
  trades: readonly PortfolioTrade[];
  herkomst: readonly CopyHerkomst[];
  livePrijzen: Record<string, number>;
  omgeving: 'real' | 'demo';
  copyTraderUsd: number;
}): CopyAandeel {
  const copyVan = copyVanPerPositie(invoer.herkomst, invoer.omgeving);
  const kader = invoer.trades.filter(t => t.status === 'open' && t.bron === 'etoro'
    && (t.etoroOmgeving ?? 'real') === invoer.omgeving
    && typeof t.etoroPositionID === 'number' && copyVan.has(t.etoroPositionID));
  const kaderUsd = kader.reduce((som, t) => som + waardeVan(t, invoer.livePrijzen[t.symbool]), 0);
  const copyTraderUsd = Math.max(0, invoer.copyTraderUsd);
  return { copiesUsd: kaderUsd + copyTraderUsd, kaderCopies: kader.length, copyTraderUsd };
}

// ponytail: self-check ipv testframework, run met `npx tsx src/state/kapitaalVerdeling.ts`
if (typeof require !== 'undefined' && require.main === module) {
  let missers = 0;
  const check = (ok: boolean, wat: string) => { if (!ok) { missers++; console.error('MIS:', wat); } };
  const basis = { tijd: 0, entryPrijs: 100, status: 'open', bron: 'etoro', etoroOmgeving: 'demo' } as unknown as PortfolioTrade;
  const trades: PortfolioTrade[] = [
    { ...basis, id: 'a', symbool: 'BTC', aantalCoins: 1, etoroPositionID: 1 },
    { ...basis, id: 'b', symbool: 'ETH', aantalCoins: 2, etoroPositionID: 2 },
    // Zelfde positionID, andere omgeving: telt niet als copy.
    { ...basis, id: 'c', symbool: 'SOL', bedragUsd: 50, etoroPositionID: 3, etoroOmgeving: 'real' },
  ];
  const herkomst = [
    { verzoekId: 'x', username: 'jan', bronPositieId: 9, symbool: 'ETH', omgeving: 'demo', tijd: 0, etoroPositionID: 2 },
    { verzoekId: 'y', username: 'piet', bronPositieId: 8, symbool: 'SOL', omgeving: 'demo', tijd: 0, etoroPositionID: 3 },
  ] as CopyHerkomst[];
  const a = copyAandeel({ trades, herkomst, livePrijzen: { ETH: 150 }, omgeving: 'demo', copyTraderUsd: 100 });
  check(a.kaderCopies === 1, `een Kader-copy, was ${a.kaderCopies}`);
  check(a.copiesUsd === 400, `2 x 150 live + 100 CopyTrader, was ${a.copiesUsd}`);
  check(copyVanPerPositie(herkomst, 'demo').get(2) === 'jan', 'copy van per positie');
  check(copyVanPerPositie(herkomst, 'real').size === 0, 'andere omgeving telt niet');
  check(copyAandeel({ trades: [], herkomst: [], livePrijzen: {}, omgeving: 'demo', copyTraderUsd: -5 }).copiesUsd === 0, 'nooit negatief');
  if (missers > 0) { console.error(`kapitaalVerdeling self-check GEFAALD: ${missers}`); process.exit(1); }
  console.log('kapitaalVerdeling self-check geslaagd');
}
