// Mijn copies per trader: wat je van wie kopieerde, wat nog open staat, wat al dicht is, en hoe je
// instap zich verhoudt tot die van de trader. Plus het plafond: hoeveel van je handelskapitaal er
// in copies mag zitten. Puur, zodat het zonder app te toetsen is.
import type { CopyHerkomst, FeedItem } from './copyOpslag';
import type { PortfolioTrade } from './portfolioTypes';

export interface CopyRegel {
  trade: PortfolioTrade;
  herkomst: CopyHerkomst;
  // Resultaat in dollars en procenten, of null als het niet te rekenen is (geen koers, geen aantal).
  usd: number | null;
  pct: number | null;
  // De instap van de trader in Kaders eenheid, of null als Kader hem niet (meer) weet.
  traderEntry: number | null;
  // Hoeveel hoger (positief) of lager jij instapte dan de trader, in procenten.
  verschilPct: number | null;
}

export interface TraderGroep {
  username: string;
  open: CopyRegel[];
  gesloten: CopyRegel[];
  openUsd: number | null;
  openPct: number | null;
  geslotenUsd: number | null;
  geslotenPct: number | null;
}

const isGetal = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function traderEntryVoor(h: CopyHerkomst, feed: readonly FeedItem[], factorVan: (symbool: string) => number): number | null {
  if (isGetal(h.bronOpenRate) && h.bronOpenRate > 0) return h.bronOpenRate;
  // Oudere copies hebben de instap niet bewaard; zolang de Feed de trade nog heeft, staat hij daar.
  const item = feed.find(i => i.username === h.username && i.positionId === h.bronPositieId);
  if (!item || !(item.openRate > 0)) return null;
  const factor = factorVan(h.symbool);
  return factor > 0 ? item.openRate / factor : null;
}

function regel(trade: PortfolioTrade, h: CopyHerkomst, livePrijs: number | undefined, traderEntry: number | null): CopyRegel {
  let usd: number | null = null;
  let pct: number | null = null;
  const aantal = isGetal(trade.aantalCoins) && trade.aantalCoins > 0 ? trade.aantalCoins : null;
  const inleg = isGetal(trade.bedragUsd) && trade.bedragUsd > 0 ? trade.bedragUsd : null;
  if (trade.status === 'open') {
    if (isGetal(livePrijs) && trade.entryPrijs > 0) {
      pct = ((livePrijs - trade.entryPrijs) / trade.entryPrijs) * 100;
      if (aantal !== null) usd = (livePrijs - trade.entryPrijs) * aantal;
    }
  } else {
    // eToro's netProfit is het echte resultaat, kosten inbegrepen. Zonder dat het koersverschil.
    if (isGetal(trade.resultaatUsd)) usd = trade.resultaatUsd;
    else if (isGetal(trade.exitPrijs) && aantal !== null) usd = (trade.exitPrijs - trade.entryPrijs) * aantal;
    if (usd !== null && inleg !== null) pct = (usd / inleg) * 100;
    else if (isGetal(trade.exitPrijs) && trade.entryPrijs > 0) pct = ((trade.exitPrijs - trade.entryPrijs) / trade.entryPrijs) * 100;
  }
  const verschilPct = traderEntry !== null && trade.entryPrijs > 0
    ? ((trade.entryPrijs - traderEntry) / traderEntry) * 100
    : null;
  return { trade, herkomst: h, usd, pct, traderEntry, verschilPct };
}

// Som in dollars, en als procent van de inleg. Mist bij één regel het resultaat of de inleg, dan
// geen totaal: een som over een deel van je copies leest als het geheel, en dat is verzonnen.
function totaal(regels: readonly CopyRegel[]): { usd: number | null; pct: number | null } {
  if (regels.length === 0 || regels.some(r => r.usd === null)) return { usd: null, pct: null };
  const usd = regels.reduce((s, r) => s + (r.usd as number), 0);
  const inlegBekend = regels.every(r => isGetal(r.trade.bedragUsd) && (r.trade.bedragUsd as number) > 0);
  const inleg = regels.reduce((s, r) => s + (r.trade.bedragUsd ?? 0), 0);
  return { usd, pct: inlegBekend && inleg > 0 ? (usd / inleg) * 100 : null };
}

// De trade zoals hij nu in de portfolio staat, voor een sheet die op een getikte trade opende. Ook
// als hij intussen gesloten is: dan ziet de verkoopsheet dat en houdt hij de knop dicht. Een
// gesloten trade kan in de historie een ander id hebben, dus ook op positie en omgeving zoeken.
export function versteTrade(trades: readonly PortfolioTrade[], gekozen: PortfolioTrade): PortfolioTrade {
  const omg = gekozen.etoroOmgeving ?? 'real';
  return trades.find(t => t.id === gekozen.id)
    ?? (isGetal(gekozen.etoroPositionID)
      ? trades.find(t => t.etoroPositionID === gekozen.etoroPositionID && (t.etoroOmgeving ?? 'real') === omg)
      : undefined)
    ?? gekozen;
}

export function groepeerCopies(invoer: {
  trades: readonly PortfolioTrade[];
  herkomst: readonly CopyHerkomst[];
  livePrijzen: Record<string, number>;
  omgeving: 'real' | 'demo';
  feed: readonly FeedItem[];
  factorVan: (symbool: string) => number;
}): TraderGroep[] {
  const perPositie = new Map<number, CopyHerkomst>();
  for (const h of invoer.herkomst) {
    if (h.omgeving === invoer.omgeving && isGetal(h.etoroPositionID)) perPositie.set(h.etoroPositionID, h);
  }
  const groepen = new Map<string, { open: CopyRegel[]; gesloten: CopyRegel[] }>();
  for (const t of invoer.trades) {
    if (t.bron !== 'etoro' || (t.etoroOmgeving ?? 'real') !== invoer.omgeving || !isGetal(t.etoroPositionID)) continue;
    const h = perPositie.get(t.etoroPositionID);
    if (!h) continue;
    const sleutel = h.username.toLowerCase();
    const groep = groepen.get(sleutel) ?? { open: [], gesloten: [] };
    const r = regel(t, h, invoer.livePrijzen[t.symbool], traderEntryVoor(h, invoer.feed, invoer.factorVan));
    (t.status === 'open' ? groep.open : groep.gesloten).push(r);
    groepen.set(sleutel, groep);
  }
  const uit: TraderGroep[] = [];
  for (const { open, gesloten } of groepen.values()) {
    const username = (open[0] ?? gesloten[0]).herkomst.username;
    gesloten.sort((a, b) => (b.trade.slotTijd ?? 0) - (a.trade.slotTijd ?? 0));
    const o = totaal(open);
    const g = totaal(gesloten);
    uit.push({ username, open, gesloten, openUsd: o.usd, openPct: o.pct, geslotenUsd: g.usd, geslotenPct: g.pct });
  }
  // Wie nu open copies heeft eerst, daarna de rest; binnen elk op naam.
  return uit.sort((a, b) => (b.open.length > 0 ? 1 : 0) - (a.open.length > 0 ? 1 : 0) || a.username.localeCompare(b.username));
}

export const STANDAARD_MAX_COPIES_PCT = 25;
export const MAX_COPIES_OPTIES = [10, 25, 50, 100] as const;

export interface CopyPlafond {
  grensUsd: number;
  // Het deel van het kapitaal dat nu in copies zit.
  nuPct: number;
  // Met deze nieuwe kopie erbij boven de grens?
  boven: boolean;
}

// Null zonder kapitaal: een plafond op een verzonnen noemer is geen plafond.
export function copyPlafond(invoer: { copiesUsd: number; kapitaal: number | null; maxPct: number; extraUsd?: number }): CopyPlafond | null {
  const { copiesUsd, kapitaal, maxPct } = invoer;
  if (!isGetal(kapitaal) || kapitaal <= 0 || !isGetal(maxPct) || maxPct <= 0) return null;
  const grensUsd = (kapitaal * maxPct) / 100;
  const na = Math.max(0, copiesUsd) + Math.max(0, invoer.extraUsd ?? 0);
  return { grensUsd, nuPct: (Math.max(0, copiesUsd) / kapitaal) * 100, boven: na > grensUsd + 0.005 };
}

// ponytail: self-check ipv testframework, run met `npx tsx src/state/mijnCopies.ts`
if (typeof require !== 'undefined' && require.main === module) {
  let missers = 0;
  const check = (ok: boolean, wat: string) => { if (!ok) { missers++; console.error('MIS:', wat); } };
  const bijna = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-6;
  const basis = { naam: '', stopLoss: 0, takeProfit: 0, rr: 0, datum: '', bron: 'etoro', etoroOmgeving: 'demo' } as unknown as PortfolioTrade;
  const trades: PortfolioTrade[] = [
    { ...basis, id: 'a', symbool: 'BTC', status: 'open', entryPrijs: 100, aantalCoins: 1, bedragUsd: 100, etoroPositionID: 1 },
    { ...basis, id: 'b', symbool: 'ETH', status: 'gewonnen', entryPrijs: 10, aantalCoins: 5, bedragUsd: 50, exitPrijs: 12, resultaatUsd: 9, slotTijd: 5, etoroPositionID: 2 },
    { ...basis, id: 'c', symbool: 'SOL', status: 'verloren', entryPrijs: 10, bedragUsd: 20, exitPrijs: 9, slotTijd: 9, etoroPositionID: 3 },
    // Andere omgeving met hetzelfde id: hoort er niet bij.
    { ...basis, id: 'd', symbool: 'BTC', status: 'open', entryPrijs: 100, etoroPositionID: 1, etoroOmgeving: 'real' },
    // Geen herkomst: eigen trade.
    { ...basis, id: 'e', symbool: 'ADA', status: 'open', entryPrijs: 1, etoroPositionID: 99 },
  ];
  const h = (id: number, username: string, symbool: string, extra: Partial<CopyHerkomst> = {}): CopyHerkomst =>
    ({ verzoekId: `v${id}`, username, bronPositieId: 500 + id, symbool, omgeving: 'demo', tijd: 0, etoroPositionID: id, ...extra });
  const herkomst = [h(1, 'Jan', 'BTC', { bronOpenRate: 98 }), h(2, 'jan', 'ETH'), h(3, 'Piet', 'SOL')];
  const feed = [{ username: 'jan', positionId: 502, openRate: 100, symbool: 'ETH' } as FeedItem];
  const groepen = groepeerCopies({ trades, herkomst, livePrijzen: { BTC: 110 }, omgeving: 'demo', feed, factorVan: () => 10 });
  check(groepen.length === 2, `twee traders, was ${groepen.length}`);
  const jan = groepen[0];
  check(jan.username === 'Jan' && jan.open.length === 1 && jan.gesloten.length === 1, 'Jan: een open, een dicht, hoofdletters samen');
  check(bijna(jan.openUsd, 10) && bijna(jan.openPct, 10), 'open +$10, +10%');
  check(bijna(jan.geslotenUsd, 9) && bijna(jan.geslotenPct, 18), 'dicht: netProfit $9 op $50 = 18%');
  check(bijna(jan.open[0].verschilPct, (100 - 98) / 98 * 100), 'instap boven die van de trader');
  check(bijna(jan.gesloten[0].traderEntry, 10), 'oude copy: instap uit de Feed, gedeeld door de factor');
  const piet = groepen[1];
  check(piet.open.length === 0 && piet.gesloten[0].traderEntry === null, 'Piet: niets open, instap onbekend');
  check(piet.geslotenUsd === null && bijna(piet.gesloten[0].pct, -10), 'zonder aantal en netProfit: geen dollars, wel koers-%');
  check(groepeerCopies({ trades, herkomst, livePrijzen: {}, omgeving: 'demo', feed: [], factorVan: () => 1 })[0].openUsd === null,
    'zonder koers geen open resultaat');
  const twee = groepeerCopies({
    trades: [...trades, { ...basis, id: 'f', symbool: 'XRP', status: 'open', entryPrijs: 1, aantalCoins: 10, bedragUsd: 10, etoroPositionID: 4 }],
    herkomst: [...herkomst, h(4, 'Jan', 'XRP')], livePrijzen: { BTC: 110 }, omgeving: 'demo', feed, factorVan: () => 10,
  })[0];
  check(twee.open.length === 2 && twee.openUsd === null && twee.openPct === null, 'een open copy zonder koers: geen deeltotaal');
  const dicht = { ...trades[0], id: 'hist', status: 'verloren' as const };
  check(versteTrade([dicht], trades[0]).status === 'verloren', 'verse trade: gesloten onder een ander id gevonden');
  check(versteTrade([{ ...trades[0], etoroOmgeving: 'real', id: 'x' }], trades[0]) === trades[0], 'andere omgeving telt niet');

  check(copyPlafond({ copiesUsd: 100, kapitaal: null, maxPct: 25 }) === null, 'zonder kapitaal geen plafond');
  const p = copyPlafond({ copiesUsd: 200, kapitaal: 1000, maxPct: 25, extraUsd: 50 });
  check(p !== null && p.grensUsd === 250 && p.nuPct === 20 && !p.boven, 'precies op de grens is niet erover');
  check(copyPlafond({ copiesUsd: 200, kapitaal: 1000, maxPct: 25, extraUsd: 60 })?.boven === true, 'erover');
  if (missers > 0) { console.error(`mijnCopies self-check GEFAALD: ${missers}`); process.exit(1); }
  console.log('mijnCopies self-check geslaagd');
}
